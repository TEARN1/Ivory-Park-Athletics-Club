import { useEffect, useMemo, useState } from "react";
import { DEFAULT_HUB, DEFAULT_ROUTER, MAX_VARIANTS, followRoads, generateLoops, reroute, routeBetween, type Route } from "../lib/routes";
import { loadRoutes, saveRoutes } from "../lib/store";
import ClubMap, { type MapMarker } from "./ClubMap";
import type { LatLon } from "../lib/geo";
import {
  ATHLETE_PICKUP_ROSTER,
  RACE_VENUES,
  formatTransportWhatsApp,
  optimizePickupRoute,
  type AthletePickupLocation,
  type OptimizedPickupSchedule,
} from "../lib/transport";

const COMPASS = [["North", 0], ["North-east", 45], ["East", 90], ["South-east", 135], ["South", 180], ["South-west", 225], ["West", 270], ["North-west", 315]] as const;

export const LONG_RUN_PRESETS: { label: string; coords: LatLon; distHint: string }[] = [
  { label: "Mall of Africa / Midrand Long Run", coords: { lat: -26.0152, lon: 28.1065 }, distHint: "14.2 km straight out" },
  { label: "Tembisa / Andrew Mapheto Corridor", coords: { lat: -25.9930, lon: 28.2285 }, distHint: "9.8 km straight out" },
  { label: "Clayville / Olifantsfontein North", coords: { lat: -25.9550, lon: 28.2250 }, distHint: "13.5 km straight out" },
  { label: "Birchleigh / Kempton Park Border", coords: { lat: -26.0350, lon: 28.2450 }, distHint: "18.2 km straight out" },
  { label: "Grand Central / Halfway House", coords: { lat: -25.9860, lon: 28.1410 }, distHint: "11.0 km straight out" },
  { label: "Ivory Park Community Stadium", coords: { lat: -26.0022, lon: 28.1885 }, distHint: "2.5 km local" },
  { label: "Kaalfontein Train Station", coords: { lat: -25.9875, lon: 28.2045 }, distHint: "3.2 km local" },
  { label: "Ebony Park Shopping Centre", coords: { lat: -25.9912, lon: 28.1756 }, distHint: "4.0 km local" },
  { label: "Lord Khanyile Community Centre", coords: { lat: -26.0089, lon: 28.1963 }, distHint: "2.8 km local" },
];

function RouteMap({ r }: { r: Route }) {
  const lat0 = r.hub.lat, kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = r.points.map((p) => (p.lon - r.hub.lon) * kx), ys = r.points.map((p) => -(p.lat - lat0));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), pad = Math.max(maxX - minX, maxY - minY) * 0.1 || 0.001;
  return (
    <svg viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`} role="img" aria-label={`Map of ${r.name}`} className="ipac-map">
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth={pad / 12} strokeLinejoin="round" />
      <circle cx={0} cy={0} r={pad / 6} fill="var(--color-fg)" />
    </svg>
  );
}

export default function Routes({ distances, router }: { distances: number[]; router?: string }) {
  const [routeType, setRouteType] = useState<"oneWay" | "outAndBack" | "loops" | "pickup">("oneWay");
  const [km, setKm] = useState(5);
  const [hub, setHub] = useState<LatLon>(DEFAULT_HUB);
  const [loops, setLoops] = useState<Route[]>([]);
  const [i, setI] = useState(0);
  const [autoRoads, setAutoRoads] = useState(true);
  const [blocked, setBlocked] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<Route[]>([]);
  const [msg, setMsg] = useState("");
  const [roadBusy, setRoadBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Distant Long Run state
  const [destIndex, setDestIndex] = useState(0);
  const [customDest, setCustomDest] = useState<LatLon>(LONG_RUN_PRESETS[0].coords);
  const [ptpRoute, setPtpRoute] = useState<Route | null>(null);
  const [ptpName, setPtpName] = useState("");

  // Race Day Pick-up Transport state
  const [selectedVenueIdx, setSelectedVenueIdx] = useState(0);
  const [selectedAthletes, setSelectedAthletes] = useState<AthletePickupLocation[]>(
    ATHLETE_PICKUP_ROSTER.filter((a) => a.pickupReady)
  );
  const [departureTime, setDepartureTime] = useState("05:00");
  const [pickupPlan, setPickupPlan] = useState<OptimizedPickupSchedule | null>(null);
  const [transportMsg, setTransportMsg] = useState("");

  useEffect(() => { loadRoutes().then(setSaved); }, []);

  const cur = loops[i] as Route | undefined;

  const snapCurToRoads = async (targetRoute?: Route, index = i) => {
    const rToSnap = targetRoute ?? cur;
    if (!rToSnap) return;
    setRoadBusy(true);
    setMsg("");
    try {
      const r = await followRoads(rToSnap.hub, rToSnap.targetKm, rToSnap.variant, router || DEFAULT_ROUTER, (u) => fetch(u).then((x) => x.json()));
      setLoops((prev) => prev.map((x, k) => (k === index ? r : x)));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setRoadBusy(false);
    }
  };

  const genLoops = async () => {
    try {
      const l = generateLoops(hub, km);
      setLoops(l);
      setI(0);
      setMsg("");
      if (autoRoads && l[0]) {
        snapCurToRoads(l[0], 0);
      }
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const doReroute = () => {
    if (!cur) return;
    const n = reroute(loops, cur, blocked === "" ? undefined : +blocked);
    if (!n) return setMsg("No other loop avoids that direction. Try a different direction.");
    const nextIdx = loops.findIndex((r) => r.id === n.id);
    setI(nextIdx);
    setMsg("");
    if (autoRoads && !n.roads) {
      snapCurToRoads(n, nextIdx);
    }
  };

  // Measure Long Distance Straight Corridor (One-way or Out & Back)
  const measureStraightRoute = async () => {
    setRoadBusy(true);
    setMsg("");
    const end = destIndex === -1 ? customDest : LONG_RUN_PRESETS[destIndex].coords;
    try {
      const base = await routeBetween(hub, end, router || DEFAULT_ROUTER);
      if (routeType === "outAndBack") {
        // Double route by reversing points back to start
        const returnPoints = [...base.points].reverse().slice(1);
        const combined = [...base.points, ...returnPoints];
        const totalDist = base.lengthM * 2;
        const totalKm = Number((totalDist / 1000).toFixed(2));
        const outAndBackRoute: Route = {
          ...base,
          id: `out-back-${Date.now()}`,
          name: destIndex === -1 ? `Out & Back Route (${totalKm} km)` : `${LONG_RUN_PRESETS[destIndex].label} Out & Back (${totalKm} km)`,
          points: combined,
          lengthM: totalDist,
          targetKm: totalKm,
        };
        setPtpRoute(outAndBackRoute);
        setPtpName(outAndBackRoute.name);
      } else {
        const straightKm = (base.lengthM / 1000).toFixed(2);
        const straightRoute: Route = {
          ...base,
          name: destIndex === -1 ? `Straight Long Run (${straightKm} km)` : `${LONG_RUN_PRESETS[destIndex].label} Straight (${straightKm} km)`,
        };
        setPtpRoute(straightRoute);
        setPtpName(straightRoute.name);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setRoadBusy(false);
    }
  };

  // Calculate Shortest Pick-up Route
  const calculatePickupSchedule = () => {
    setRoadBusy(true);
    setMsg("");
    try {
      const plan = optimizePickupRoute(selectedAthletes, RACE_VENUES[selectedVenueIdx], departureTime, {
        label: "Ivory Park Depot / Freedom Drive",
        coords: hub,
      });
      setPickupPlan(plan);
      setTransportMsg(`Shortest pick-up route optimized: ${plan.stops.length} athlete stops, ${plan.totalDistanceKm} km total.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setRoadBusy(false);
    }
  };

  const persist = (r: Route[]) => { setSaved(r); saveRoutes(r); };

  const pickupRoute: Route | null = useMemo(() => {
    if (!pickupPlan) return null;
    return {
      id: "pickup-plan",
      hub: pickupPlan.startDepot.coords,
      targetKm: pickupPlan.totalDistanceKm,
      variant: 0,
      points: pickupPlan.routePoints,
      lengthM: pickupPlan.totalDistanceKm * 1000,
      roads: true,
      name: `Race Transport: ${pickupPlan.destination.name} (${pickupPlan.stops.length} Pickups)`,
    };
  }, [pickupPlan]);

  const shown = useMemo(() => {
    if (routeType === "loops") return cur;
    if (routeType === "pickup") return pickupRoute;
    return ptpRoute;
  }, [routeType, cur, ptpRoute, pickupRoute]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    if (routeType === "loops" && shown) {
      return [{ id: "hub", ...shown.hub, label: "Start / Hub", kind: "hub" }];
    }
    if (routeType === "pickup" && pickupPlan) {
      const pMarkers: MapMarker[] = [
        {
          id: "depot-start",
          lat: pickupPlan.startDepot.coords.lat,
          lon: pickupPlan.startDepot.coords.lon,
          label: `DEPOT (${pickupPlan.startDepot.departureTime})`,
          kind: "hub",
        },
      ];
      pickupPlan.stops.forEach((s) => {
        pMarkers.push({
          id: `stop-${s.stopNumber}`,
          lat: s.coords.lat,
          lon: s.coords.lon,
          label: `#${s.stopNumber} ${s.athleteName.split(" ")[0]} (${s.eta})`,
          kind: "dot",
        });
      });
      pMarkers.push({
        id: "race-finish",
        lat: pickupPlan.destination.coords.lat,
        lon: pickupPlan.destination.coords.lon,
        label: `FINISH: ${pickupPlan.destination.name.split(" ")[0]} (${pickupPlan.destination.arrivalEta})`,
        kind: "finish",
      });
      return pMarkers;
    }
    if ((routeType === "oneWay" || routeType === "outAndBack") && ptpRoute) {
      const end = destIndex === -1 ? customDest : LONG_RUN_PRESETS[destIndex].coords;
      return [
        { id: "start", ...hub, label: "START", kind: "start" },
        { id: "end", ...end, label: routeType === "outAndBack" ? "TURNAROUND" : "FINISH", kind: "finish" },
      ];
    }
    return [{ id: "hub", ...hub, label: "Start", kind: "hub" }];
  }, [routeType, shown, ptpRoute, pickupPlan, hub, destIndex, customDest]);

  return (
    <section className="ipac-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <h2>Long Run & Route Planner</h2>
        <div className="ipac-seg" role="group" aria-label="Route Mode">
          <button aria-pressed={routeType === "oneWay"} onClick={() => setRouteType("oneWay")}>Straight One-Way</button>
          <button aria-pressed={routeType === "outAndBack"} onClick={() => setRouteType("outAndBack")}>Out & Back</button>
          <button aria-pressed={routeType === "loops"} onClick={() => setRouteType("loops")}>Circuit Loop</button>
          <button aria-pressed={routeType === "pickup"} onClick={() => { setRouteType("pickup"); if (!pickupPlan) calculatePickupSchedule(); }}>Race Pick-up</button>
        </div>
      </div>

      <p className="ipac-hint" style={{ marginTop: "6px" }}>
        {routeType === "oneWay"
          ? "Run straight out to distant landmarks (Mall of Africa, Tembisa, Clayville, Kempton Park) without looping inside the neighborhood."
          : routeType === "outAndBack"
          ? "Run straight out along arterial roads to a distant turnaround point and return straight back."
          : routeType === "loops"
          ? "Generate closed road loops starting and finishing at the club hub."
          : "Calculate the shortest traveling route to pick up athletes across Ivory Park and arrive together at the race venue."}
      </p>

      {/* Start / Hub Location */}
      <details className="ipac-more-routes">
        <summary>Start Location Coordinates</summary>
        <div className="ipac-form">
          <label>Start Latitude<input type="number" step="any" value={hub.lat} onChange={(e) => setHub({ ...hub, lat: +e.target.value })} /></label>
          <label>Start Longitude<input type="number" step="any" value={hub.lon} onChange={(e) => setHub({ ...hub, lon: +e.target.value })} /></label>
          <button
            type="button"
            className="ipac-btn ipac-btn-quiet"
            onClick={() => navigator.geolocation?.getCurrentPosition(
              (p) => setHub({ lat: p.coords.latitude, lon: p.coords.longitude }),
              () => setMsg("Could not read your location.")
            )}
          >
            Use My Location as Start
          </button>
        </div>
      </details>

      {routeType === "loops" ? (
        <>
          <div className="ipac-chips" role="group" aria-label="Target distance" style={{ marginTop: "10px" }}>
            {distances.map((d) => (
              <button key={d} className="ipac-chip" aria-pressed={km === d} onClick={() => setKm(d)}>
                {d} km
              </button>
            ))}
            <label className="ipac-other">
              Other
              <input
                type="number"
                inputMode="decimal"
                min={0.5}
                max={100}
                step={0.5}
                value={km}
                aria-label="Target distance (km)"
                onChange={(e) => setKm(+e.target.value)}
              />
            </label>
          </div>

          <div style={{ margin: "10px 0 6px" }}>
            <label style={{ display: "flex", alignItems: "center", fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRoads}
                onChange={(e) => setAutoRoads(e.target.checked)}
              />
              Snap to real roads automatically (OpenStreetMap / OSRM)
            </label>
          </div>

          <button className="ipac-btn ipac-btn-hero" onClick={genLoops}>
            Generate {km} km Road Loops
          </button>
        </>
      ) : routeType === "pickup" ? (
        <div className="ipac-form" style={{ marginTop: "12px" }}>
          <div className="ipac-row2">
            <label>Destination Race Venue
              <select
                value={selectedVenueIdx}
                onChange={(e) => setSelectedVenueIdx(+e.target.value)}
              >
                {RACE_VENUES.map((v, idx) => (
                  <option key={v.id} value={idx}>{v.name} ({v.city} · ~{v.approxDistanceKm} km)</option>
                ))}
              </select>
            </label>
            <label>Depot Departure Time
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </label>
          </div>

          <label style={{ fontWeight: 700, margin: "6px 0 2px" }}>
            Athletes Needing Transport ({selectedAthletes.length} selected):
          </label>
          <div style={{ display: "grid", gap: "6px", maxHeight: "190px", overflowY: "auto", padding: "4px" }}>
            {ATHLETE_PICKUP_ROSTER.map((ath) => {
              const isSelected = selectedAthletes.some((a) => a.id === ath.id);
              return (
                <label key={ath.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", padding: "6px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.45)", border: "1px solid var(--color-glass-border)" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAthletes([...selectedAthletes, ath]);
                      else setSelectedAthletes(selectedAthletes.filter((a) => a.id !== ath.id));
                    }}
                  />
                  <span>
                    <b>{ath.name}</b> (#{ath.bib}) · <small style={{ color: "var(--color-muted)" }}>{ath.addressLabel}</small>
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className="ipac-btn ipac-btn-hero"
            disabled={roadBusy || selectedAthletes.length === 0}
            onClick={calculatePickupSchedule}
          >
            {roadBusy ? "Optimizing Shortest Path…" : `Optimize Shortest Pick-up Route (${selectedAthletes.length} Athletes)`}
          </button>
        </div>
      ) : (
        <div className="ipac-form" style={{ marginTop: "12px" }}>
          <label>Distant Destination
            <select
              value={destIndex}
              onChange={(e) => {
                const idx = +e.target.value;
                setDestIndex(idx);
                if (idx >= 0) setCustomDest(LONG_RUN_PRESETS[idx].coords);
              }}
            >
              {LONG_RUN_PRESETS.map((p, idx) => (
                <option key={p.label} value={idx}>{p.label} ({p.distHint})</option>
              ))}
              <option value={-1}>Custom GPS Coordinates</option>
            </select>
          </label>

          {destIndex === -1 && (
            <div className="ipac-row2">
              <label>Destination Lat<input type="number" step="any" value={customDest.lat} onChange={(e) => setCustomDest({ ...customDest, lat: +e.target.value })} /></label>
              <label>Destination Lon<input type="number" step="any" value={customDest.lon} onChange={(e) => setCustomDest({ ...customDest, lon: +e.target.value })} /></label>
            </div>
          )}

          <button
            className="ipac-btn ipac-btn-hero"
            disabled={roadBusy}
            onClick={measureStraightRoute}
          >
            {roadBusy ? "Calculating Road Corridor…" : routeType === "outAndBack" ? "Measure Out & Back Long Run" : "Measure Straight One-Way Long Run"}
          </button>
        </div>
      )}

      {msg && <p role="alert" className="ipac-err" style={{ marginTop: "8px" }}>{msg}</p>}

      {/* Render Map & Route Card */}
      {shown && (
        <div className="ipac-card" style={{ marginTop: "16px" }}>
          <div className="ipac-map-viewport">
            <ClubMap
              key={shown.id}
              label={`Map of ${shown.name}`}
              fallback={<RouteMap r={shown} />}
              line={shown.points}
              markers={mapMarkers}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen((v) => !v)}
              floatingContent={
                fullscreen ? (
                  <div className="ipac-floating-hud">
                    <div className="ipac-hud" style={{ margin: 0, width: "100%" }}>
                      <div className="ipac-hud-item">
                        <span className="ipac-hud-label">Route</span>
                        <b className="ipac-hud-val ipac-hud-highlight">{shown.name}</b>
                      </div>
                      <div className="ipac-hud-item">
                        <span className="ipac-hud-label">Road Distance</span>
                        <b className="ipac-hud-val">{(shown.lengthM / 1000).toFixed(2)} km</b>
                      </div>
                      <div className="ipac-hud-item">
                        <span className="ipac-hud-label">Pattern</span>
                        <b className="ipac-hud-val">{routeType === "oneWay" ? "One-Way" : routeType === "outAndBack" ? "Out & Back" : "Circuit"}</b>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          </div>

          <div style={{ marginTop: "8px" }}>
            <p style={{ margin: 0 }}>
              <b>{shown.name}</b> · <span style={{ color: "var(--color-hot)", fontWeight: 800 }}>{(shown.lengthM / 1000).toFixed(2)} km</span>
              {routeType === "loops" && ` · option ${i + 1} of ${loops.length}`}
            </p>
          </div>

          <p className="ipac-hint" style={{ marginTop: "4px" }}>
            {shown.roads
              ? "Follows real roads and arterial paths from OpenStreetMap. Route trace animates from Start to Finish."
              : "Straight-line guide. Tap Follow roads to snap to OpenStreetMap roads."}
          </p>

          {routeType === "loops" && !shown.roads && (
            <button className="ipac-btn ipac-btn-outline" disabled={roadBusy} onClick={() => snapCurToRoads()}>
              {roadBusy ? "Finding roads…" : "Follow roads (Snap to Streets)"}
            </button>
          )}

          {routeType === "loops" && (
            <div className="ipac-actions" style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button className="ipac-btn ipac-btn-quiet" onClick={() => { const next = (i + loops.length - 1) % loops.length; setI(next); if (autoRoads && !loops[next]?.roads) snapCurToRoads(loops[next], next); }}>
                Previous
              </button>
              <button className="ipac-btn ipac-btn-quiet" onClick={() => { const next = (i + 1) % loops.length; setI(next); if (autoRoads && !loops[next]?.roads) snapCurToRoads(loops[next], next); }}>
                Next
              </button>
            </div>
          )}

          {routeType === "loops" && (
            <div className="ipac-form" style={{ marginTop: "10px" }}>
              <label>Road blocked towards
                <select value={blocked} onChange={(e) => setBlocked(e.target.value)}>
                  <option value="">Anywhere (just give me another)</option>
                  {COMPASS.map(([n, b]) => <option key={b} value={b}>{n}</option>)}
                </select>
              </label>
              <button className="ipac-btn ipac-btn-outline" onClick={doReroute}>
                Reroute to Avoid Blocked Road
              </button>
            </div>
          )}

          {routeType === "pickup" && pickupPlan && (
            <div style={{ marginTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                  Shortest Pick-up Itinerary ({pickupPlan.stops.length} Stops · {pickupPlan.totalDistanceKm} km)
                </h3>
                <span className="ipac-rank-badge" style={{ fontSize: "0.85rem", padding: "2px 10px" }}>
                  Arrive {pickupPlan.destination.arrivalEta}
                </span>
              </div>

              <div className="ipac-tk-table-wrap" style={{ marginTop: "8px" }}>
                <table className="ipac-tk-table">
                  <thead>
                    <tr>
                      <th>Stop</th>
                      <th>Time</th>
                      <th>Athlete</th>
                      <th>Pickup Address / Landmark</th>
                      <th>Leg</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>Depot</b></td>
                      <td><b>{pickupPlan.startDepot.departureTime}</b></td>
                      <td>Depart Hub</td>
                      <td>{pickupPlan.startDepot.label}</td>
                      <td>Start</td>
                    </tr>
                    {pickupPlan.stops.map((s) => (
                      <tr key={s.stopNumber}>
                        <td><b style={{ color: "var(--color-navy)" }}>Stop #{s.stopNumber}</b></td>
                        <td><b>{s.eta}</b></td>
                        <td><b>{s.athleteName}</b> (#{s.bib})</td>
                        <td>{s.locationLabel}</td>
                        <td>{s.distanceFromPrevKm} km ({s.driveTimeMin}m)</td>
                      </tr>
                    ))}
                    <tr style={{ background: "rgba(5, 150, 105, 0.12)" }}>
                      <td><b>FINISH</b></td>
                      <td><b>{pickupPlan.destination.arrivalEta}</b></td>
                      <td><b>{pickupPlan.destination.name}</b></td>
                      <td>Arrive Race Venue</td>
                      <td>Total {pickupPlan.totalDistanceKm} km</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-primary"
                  style={{ fontSize: "0.85rem", minHeight: "38px" }}
                  onClick={async () => {
                    const text = formatTransportWhatsApp(pickupPlan);
                    if (navigator.clipboard) await navigator.clipboard.writeText(text);
                    setTransportMsg("Transport schedule copied for WhatsApp!");
                    setTimeout(() => setTransportMsg(""), 3500);
                  }}
                >
                  Share Pick-up Schedule to WhatsApp
                </button>
                {transportMsg && (
                  <span style={{ color: "var(--color-hot)", fontWeight: 700, fontSize: "0.85rem", alignSelf: "center" }}>
                    [Confirmed] {transportMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="ipac-form" style={{ marginTop: "10px" }}>
            <input
              aria-label="Route name"
              placeholder={routeType === "loops" ? "e.g. Ivory Park 15k Road Loop" : "e.g. Mall of Africa 14k Long Run"}
              value={routeType === "loops" ? name : ptpName}
              onChange={(e) => (routeType === "loops" ? setName(e.target.value) : setPtpName(e.target.value))}
            />
            <button
              className="ipac-btn ipac-btn-primary"
              disabled={routeType === "loops" ? !name.trim() : !ptpName.trim()}
              onClick={() => {
                const saveTitle = (routeType === "loops" ? name : ptpName).trim();
                persist([...saved, { ...shown, id: crypto.randomUUID(), name: saveTitle }]);
                if (routeType === "loops") setName("");
                else setPtpName("");
              }}
            >
              Save This Route for Live Tracking
            </button>
          </div>
        </div>
      )}

      {/* Saved Routes Section */}
      {saved.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <h2>Saved Club Routes</h2>
          <ul className="ipac-list">
            {saved.map((r) => (
              <li key={r.id}>
                <span className="ipac-who">
                  <b>{r.name} · {(r.lengthM / 1000).toFixed(2)} km</b>
                  <small>
                    {r.roads ? "Road-snapped" : "Straight guide"} · {r.checkedAt ? `checked & safe (${new Date(r.checkedAt).toLocaleDateString()})` : "not safety-checked yet"}
                  </small>
                </span>
                <button
                  className="ipac-btn ipac-btn-quiet"
                  aria-label={r.checkedAt ? `Unmark ${r.name}` : `Mark ${r.name} checked`}
                  onClick={() => persist(saved.map((x) => (x.id === r.id ? { ...x, checkedAt: x.checkedAt ? undefined : Date.now() } : x)))}
                >
                  {r.checkedAt ? "Unmark" : "Checked"}
                </button>
                <button
                  className="ipac-btn ipac-btn-outline"
                  aria-label={`Show ${r.name}`}
                  onClick={() => { setLoops([r]); setI(0); setRouteType("loops"); }}
                >
                  Show
                </button>
                <button
                  className="ipac-btn ipac-btn-quiet"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => persist(saved.filter((x) => x.id !== r.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
