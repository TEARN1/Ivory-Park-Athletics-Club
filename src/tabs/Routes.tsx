import { useEffect, useMemo, useState } from "react";
import { DEFAULT_HUB, DEFAULT_ROUTER, followRoads, generateLoops, reroute, routeBetween, type Route } from "../lib/routes";
import { loadRoutes, saveRoutes } from "../lib/store";
import ClubMap, { type MapMarker } from "./ClubMap";
import type { LatLon } from "../lib/geo";
import {
  ATHLETE_PICKUP_ROSTER,
  DEFAULT_VEHICLES,
  RACE_VENUES,
  formatTransportWhatsApp,
  googleMapsDriverRoute,
  optimizeMultiVehicleSchedule,
  type AthletePickupLocation,
  type OptimizedPickupSchedule,
  type TransportVehicle,
  type VehiclePickupPlan,
} from "../lib/transport";

const COMPASS = [
  ["North", 0],
  ["North-east", 45],
  ["East", 90],
  ["South-east", 135],
  ["South", 180],
  ["South-west", 225],
  ["West", 270],
  ["North-west", 315],
] as const;

const LONG_RUN_PRESETS: { label: string; coords: LatLon; distHint: string }[] = [
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

function RouteMapFallback({ r }: { r: Route }) {
  const lat0 = r.hub.lat,
    kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = r.points.map((p) => (p.lon - r.hub.lon) * kx),
    ys = r.points.map((p) => -(p.lat - lat0));
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys),
    pad = Math.max(maxX - minX, maxY - minY) * 0.1 || 0.001;
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
      role="img"
      aria-label={`Map of ${r.name}`}
      className="ipac-map"
    >
      <polyline
        points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={pad / 12}
        strokeLinejoin="round"
      />
      <circle cx={0} cy={0} r={pad / 6} fill="var(--color-fg)" />
    </svg>
  );
}

export default function Routes({ distances, router }: { distances: number[]; router?: string }) {
  // Default to circuit loops so an active Ivory Park route renders immediately on load
  const [routeType, setRouteType] = useState<"loops" | "outAndBack" | "oneWay" | "pickup">("loops");
  const [km, setKm] = useState(5);
  const [hub, setHub] = useState<LatLon>(DEFAULT_HUB);
  const [loops, setLoops] = useState<Route[]>(() => generateLoops(DEFAULT_HUB, 5));
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
  const [departureTime, setDepartureTime] = useState("04:30");
  const [activeVehicles, setActiveVehicles] = useState<TransportVehicle[]>(DEFAULT_VEHICLES);
  const [multiPlans, setMultiPlans] = useState<VehiclePickupPlan[] | null>(null);
  const [activeVehiclePlanIdx, setActiveVehiclePlanIdx] = useState(0);
  const [pickupPlan, setPickupPlan] = useState<OptimizedPickupSchedule | null>(null);
  const [transportMsg, setTransportMsg] = useState("");
  const [gpsLockStatus, setGpsLockStatus] = useState("");

  useEffect(() => {
    loadRoutes().then(setSaved);
  }, []);

  const cur = loops[i] as Route | undefined;

  const snapCurToRoads = async (targetRoute?: Route, index = i) => {
    const rToSnap = targetRoute ?? cur;
    if (!rToSnap) return;
    setRoadBusy(true);
    setMsg("");
    try {
      const r = await followRoads(
        rToSnap.hub,
        rToSnap.targetKm,
        rToSnap.variant,
        router || DEFAULT_ROUTER,
        (u) => fetch(u).then((x) => x.json())
      );
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
  const measureStraightRoute = async (targetType = routeType) => {
    setRoadBusy(true);
    setMsg("");
    const end = destIndex === -1 ? customDest : LONG_RUN_PRESETS[destIndex].coords;
    try {
      const base = await routeBetween(hub, end, router || DEFAULT_ROUTER);
      if (targetType === "outAndBack") {
        const returnPoints = [...base.points].reverse().slice(1);
        const combined = [...base.points, ...returnPoints];
        const totalDist = base.lengthM * 2;
        const totalKm = Number((totalDist / 1000).toFixed(2));
        const outAndBackRoute: Route = {
          ...base,
          id: `out-back-${Date.now()}`,
          name:
            destIndex === -1
              ? `Out & Back Route (${totalKm} km)`
              : `${LONG_RUN_PRESETS[destIndex].label} Out & Back (${totalKm} km)`,
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
          name:
            destIndex === -1
              ? `Straight Long Run (${straightKm} km)`
              : `${LONG_RUN_PRESETS[destIndex].label} Straight (${straightKm} km)`,
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

  // Calculate Multi-Vehicle Shortest Pick-up Route
  const calculatePickupSchedule = () => {
    setRoadBusy(true);
    setMsg("");
    try {
      const venue = RACE_VENUES[selectedVenueIdx];
      const plans = optimizeMultiVehicleSchedule(activeVehicles, selectedAthletes, venue, departureTime);
      setMultiPlans(plans);
      if (plans.length > 0) {
        setPickupPlan(plans[activeVehiclePlanIdx]?.schedule || plans[0].schedule);
      }
      const totalStops = plans.reduce((acc, p) => acc + p.schedule.stops.length, 0);
      setTransportMsg(
        `Shortest pick-up routes calculated across ${plans.length} transports (${totalStops} athlete stops total).`
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setRoadBusy(false);
    }
  };

  const lockLiveGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsLockStatus("Geolocation not available on this device.");
      return;
    }
    setGpsLockStatus("Acquiring hardware GPS lock (forcing zero cached radius)...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const acc = Math.round(pos.coords.accuracy);
        setGpsLockStatus(`Hardware GPS locked: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)} (+/-${acc}m accuracy)`);
        setSelectedAthletes((prev) => {
          const myBib = "00";
          const exists = prev.find((a) => a.id === "pickup-my-gate");
          if (exists) {
            return prev.map((a) =>
              a.id === "pickup-my-gate" ? { ...a, coords, addressLabel: `My Gate (GPS +/-${acc}m)` } : a
            );
          }
          return [
            ...prev,
            {
              id: "pickup-my-gate",
              name: "My Live Location",
              bib: myBib,
              addressLabel: `My Gate (GPS +/-${acc}m)`,
              coords,
              contactPhone: "+27 82 000 0000",
              pickupReady: true,
            },
          ];
        });
      },
      (err) => {
        setGpsLockStatus(`GPS lock error: ${err.message}.`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const persist = (r: Route[]) => {
    setSaved(r);
    saveRoutes(r);
  };

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
    return ptpRoute || cur;
  }, [routeType, cur, ptpRoute, pickupRoute]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    if (routeType === "loops" && shown) {
      return [{ id: "hub", ...shown.hub, label: "Ivory Park Hub", kind: "hub" }];
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
    if ((routeType === "oneWay" || routeType === "outAndBack") && shown) {
      const end = destIndex === -1 ? customDest : LONG_RUN_PRESETS[destIndex].coords;
      return [
        { id: "start", ...hub, label: "START", kind: "start" },
        { id: "end", ...end, label: routeType === "outAndBack" ? "TURNAROUND" : "FINISH", kind: "finish" },
      ];
    }
    return [{ id: "hub", ...hub, label: "Start", kind: "hub" }];
  }, [routeType, shown, pickupPlan, hub, destIndex, customDest]);

  // Highveld Hydration & Pacing Intel
  const routeDistKm = shown ? shown.lengthM / 1000 : km;
  const timeAt415 = Math.round(routeDistKm * 255);
  const timeAt445 = Math.round(routeDistKm * 285);
  const timeAt530 = Math.round(routeDistKm * 330);
  const fmtMinSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  return (
    <div className="ipac-map-view-shell">
      {/* 1. HERO MAP CARD (FRONT & CENTER) */}
      <section className="ipac-card ipac-map-card">
        <div className="ipac-map-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Ivory Park Highveld Routes</h2>
            <p className="ipac-hint" style={{ margin: "2px 0 0" }}>
              {shown?.name || "Verified Paved Roads & Highveld Corridors"} ·{" "}
              <b style={{ color: "var(--color-hot)" }}>{routeDistKm.toFixed(2)} km</b>
            </p>
          </div>
          <div className="ipac-map-actions">
            <span className="ipac-rank-badge" style={{ fontSize: "0.82rem", padding: "3px 10px" }}>
              {routeType === "loops"
                ? `Loop ${i + 1} of ${loops.length}`
                : routeType === "outAndBack"
                ? "Out & Back"
                : routeType === "oneWay"
                ? "Straight Out"
                : "Race Pick-up"}
            </span>
          </div>
        </div>

        {/* Hero Map Viewport */}
        <div className="ipac-map-viewport">
          <ClubMap
            key={shown ? shown.id : "initial-club-map"}
            label={`Map of ${shown?.name || "Ivory Park AC Routes"}`}
            fallback={shown ? <RouteMapFallback r={shown} /> : <div>Loading route...</div>}
            line={shown?.points}
            markers={mapMarkers}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            floatingContent={
              fullscreen && shown ? (
                <div className="ipac-floating-hud">
                  <div className="ipac-floating-stat">
                    <span className="ipac-floating-stat-label">Route</span>
                    <span>{shown.name}</span>
                  </div>
                  <div className="ipac-floating-stat">
                    <span className="ipac-floating-stat-label">Dist</span>
                    <span style={{ color: "var(--color-hot)" }}>{(shown.lengthM / 1000).toFixed(2)} km</span>
                  </div>
                  <div className="ipac-floating-stat">
                    <span className="ipac-floating-stat-label">Type</span>
                    <span>{routeType}</span>
                  </div>
                </div>
              ) : null
            }
          />
        </div>

        {/* Route Mode Switcher: 4-Column Balanced Grid */}
        <div className="ipac-seg ipac-seg-route" role="group" aria-label="Route Mode" style={{ marginTop: "14px" }}>
          <button
            type="button"
            aria-pressed={routeType === "loops"}
            onClick={() => setRouteType("loops")}
          >
            Circuit Loop
          </button>
          <button
            type="button"
            aria-pressed={routeType === "outAndBack"}
            onClick={() => {
              setRouteType("outAndBack");
              if (!ptpRoute) measureStraightRoute("outAndBack");
            }}
          >
            Out &amp; Back
          </button>
          <button
            type="button"
            aria-pressed={routeType === "oneWay"}
            onClick={() => {
              setRouteType("oneWay");
              if (!ptpRoute) measureStraightRoute("oneWay");
            }}
          >
            Straight Corridor
          </button>
          <button
            type="button"
            aria-pressed={routeType === "pickup"}
            onClick={() => {
              setRouteType("pickup");
              if (!pickupPlan) calculatePickupSchedule();
            }}
          >
            Race Day Fleet
          </button>
        </div>

        {/* Mode-Specific Streamlined Controls */}
        <div style={{ marginTop: "12px" }}>
          {routeType === "loops" ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <div className="ipac-chips" role="group" aria-label="Target distance">
                {distances.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="ipac-chip"
                    aria-pressed={km === d}
                    onClick={() => {
                      setKm(d);
                      const l = generateLoops(hub, d);
                      setLoops(l);
                      setI(0);
                      if (autoRoads && l[0]) snapCurToRoads(l[0], 0);
                    }}
                  >
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

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-hero"
                  disabled={roadBusy}
                  onClick={genLoops}
                  style={{ flex: "1 1 180px" }}
                >
                  {roadBusy ? "Snapping to Streets..." : `Generate ${km} km Road Loop`}
                </button>
                {loops.length > 1 && (
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-quiet"
                    onClick={() => {
                      const next = (i + 1) % loops.length;
                      setI(next);
                      if (autoRoads && !loops[next]?.roads) snapCurToRoads(loops[next], next);
                    }}
                  >
                    Next Loop Variant ({i + 1}/{loops.length})
                  </button>
                )}
                {shown && !shown.roads && (
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-outline"
                    disabled={roadBusy}
                    onClick={() => snapCurToRoads()}
                  >
                    {roadBusy ? "Tracing..." : "Snap to Streets"}
                  </button>
                )}
              </div>
            </div>
          ) : routeType === "outAndBack" || routeType === "oneWay" ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                Select Distant Highveld Landmark:
                <select
                  value={destIndex}
                  onChange={(e) => {
                    const idx = +e.target.value;
                    setDestIndex(idx);
                    if (idx >= 0) setCustomDest(LONG_RUN_PRESETS[idx].coords);
                  }}
                  style={{ marginTop: "4px" }}
                >
                  {LONG_RUN_PRESETS.map((p, idx) => (
                    <option key={p.label} value={idx}>
                      {p.label} ({p.distHint})
                    </option>
                  ))}
                  <option value={-1}>Custom GPS Coordinates</option>
                </select>
              </label>

              {destIndex === -1 && (
                <div className="ipac-row2">
                  <label>
                    Destination Lat
                    <input
                      type="number"
                      step="any"
                      value={customDest.lat}
                      onChange={(e) => setCustomDest({ ...customDest, lat: +e.target.value })}
                    />
                  </label>
                  <label>
                    Destination Lon
                    <input
                      type="number"
                      step="any"
                      value={customDest.lon}
                      onChange={(e) => setCustomDest({ ...customDest, lon: +e.target.value })}
                    />
                  </label>
                </div>
              )}

              <button
                type="button"
                className="ipac-btn ipac-btn-hero"
                disabled={roadBusy}
                onClick={() => measureStraightRoute(routeType)}
              >
                {roadBusy
                  ? "Measuring Highveld Arterial Roads..."
                  : routeType === "outAndBack"
                  ? `Measure Out & Back (${LONG_RUN_PRESETS[destIndex]?.label || "Custom"})`
                  : `Measure Straight Corridor (${LONG_RUN_PRESETS[destIndex]?.label || "Custom"})`}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              <div className="ipac-row2">
                <label>
                  Race Venue
                  <select
                    value={selectedVenueIdx}
                    onChange={(e) => setSelectedVenueIdx(+e.target.value)}
                  >
                    {RACE_VENUES.map((v, idx) => (
                      <option key={v.id} value={idx}>
                        {v.name} ({v.city} · ~{v.approxDistanceKm} km)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Depot Departure Time
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </label>
              </div>

              {/* Fleet Badges & GPS Fix */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                {DEFAULT_VEHICLES.map((v) => {
                  const isActive = activeVehicles.some((x) => x.id === v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className="ipac-chip"
                      aria-pressed={isActive}
                      onClick={() => {
                        if (isActive && activeVehicles.length > 1) {
                          setActiveVehicles(activeVehicles.filter((x) => x.id !== v.id));
                        } else if (!isActive) {
                          setActiveVehicles([...activeVehicles, v]);
                        }
                      }}
                      style={{ fontSize: "0.8rem", padding: "4px 10px", minHeight: "36px" }}
                    >
                      {v.name} ({v.capacity} seats)
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="ipac-btn ipac-btn-quiet"
                  style={{ minHeight: "36px", padding: "4px 10px", fontSize: "0.8rem" }}
                  onClick={lockLiveGps}
                  title="Lock hardware GPS coordinates for athlete gate pickup"
                >
                  Lock My Exact Gate (GPS)
                </button>
              </div>
              {gpsLockStatus && (
                <small style={{ color: "var(--p-ctl-d, #0f5132)", fontWeight: 700 }}>{gpsLockStatus}</small>
              )}

              <button
                type="button"
                className="ipac-btn ipac-btn-hero"
                disabled={roadBusy || selectedAthletes.length === 0}
                onClick={calculatePickupSchedule}
              >
                {roadBusy
                  ? "Optimizing Fleet Itineraries..."
                  : `Calculate Shortest Pick-up Route (${activeVehicles.length} Transports · ${selectedAthletes.length} Athletes)`}
              </button>
            </div>
          )}
        </div>

        {msg && <p role="alert" className="ipac-err" style={{ marginTop: "10px" }}>{msg}</p>}

        {/* Save Route Action */}
        {shown && (
          <div className="ipac-form" style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                aria-label="Route name"
                placeholder={routeType === "loops" ? "e.g. Ivory Park 15k Road Loop" : "e.g. Mall of Africa 14k Long Run"}
                value={routeType === "loops" ? name : ptpName}
                onChange={(e) => (routeType === "loops" ? setName(e.target.value) : setPtpName(e.target.value))}
                style={{ flex: "1 1 200px" }}
              />
              <button
                type="button"
                className="ipac-btn ipac-btn-primary"
                disabled={routeType === "loops" ? !name.trim() : !ptpName.trim()}
                onClick={() => {
                  const saveTitle = (routeType === "loops" ? name : ptpName).trim();
                  persist([...saved, { ...shown, id: crypto.randomUUID(), name: saveTitle }]);
                  if (routeType === "loops") setName("");
                  else setPtpName("");
                }}
              >
                Save Route for Squad
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. ATHLETE & COACH COURSE GUIDANCE CARD */}
      <section className="ipac-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>How Athletes &amp; Coaches Use This Map</h3>
            <p className="ipac-hint" style={{ margin: "2px 0 0" }}>
              Practical Highveld navigation, race transport, and squad safety guide.
            </p>
          </div>
          <span className="ipac-rank-badge" style={{ fontSize: "0.8rem", padding: "2px 8px" }}>
            Club Guidelines
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginTop: "12px" }}>
          <div style={{ padding: "10px 12px", background: "rgba(42, 48, 144, 0.08)", borderRadius: "12px", border: "1px solid var(--color-glass-border)" }}>
            <b style={{ color: "var(--color-navy)", fontSize: "0.88rem", display: "block" }}>1. Pre-Run Preparation</b>
            <span style={{ fontSize: "0.82rem", color: "var(--color-fg)", display: "block", marginTop: "4px" }}>
              Select your distance to inspect elevation gain, road conditions, and water point stations before setting off.
            </span>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(5, 150, 105, 0.08)", borderRadius: "12px", border: "1px solid var(--color-glass-border)" }}>
            <b style={{ color: "#059669", fontSize: "0.88rem", display: "block" }}>2. In-Run Live Navigation</b>
            <span style={{ fontSize: "0.82rem", color: "var(--color-fg)", display: "block", marginTop: "4px" }}>
              Tap <b>GPS</b> (Find Me) to lock your location. Follow animated directional arrows along safe paved corridors to avoid getting lost.
            </span>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(232, 24, 32, 0.08)", borderRadius: "12px", border: "1px solid var(--color-glass-border)" }}>
            <b style={{ color: "var(--color-hot)", fontSize: "0.88rem", display: "block" }}>3. Away Race Day Transport</b>
            <span style={{ fontSize: "0.82rem", color: "var(--color-fg)", display: "block", marginTop: "4px" }}>
              Athletes view exact gate pickup times; drivers launch one-click Google Maps turn-by-turn navigation across Ivory Park.
            </span>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(245, 158, 11, 0.08)", borderRadius: "12px", border: "1px solid var(--color-glass-border)" }}>
            <b style={{ color: "#d97706", fontSize: "0.88rem", display: "block" }}>4. Coach Live Oversight</b>
            <span style={{ fontSize: "0.82rem", color: "var(--color-fg)", display: "block", marginTop: "4px" }}>
              Coaches switch to the <b>Live</b> tab to monitor real-time split markers, pace fades, and athlete SOS distress beacons.
            </span>
          </div>
        </div>
      </section>

      {/* 3. ROUTE INTEL & HIGHVELD CONDITIONS SUMMARY */}
      {shown && (
        <section className="ipac-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Highveld Pace &amp; Water Station Targets</h3>
              <p className="ipac-hint" style={{ margin: "2px 0 0" }}>
                Target completion splits and hydration checkpoints for {routeDistKm.toFixed(2)} km.
              </p>
            </div>
            <span className="ipac-rank-badge" style={{ fontSize: "0.82rem", padding: "2px 8px" }}>
              1,520m Altitude
            </span>
          </div>

          <div className="ipac-hud" style={{ marginTop: "12px" }}>
            <div className="ipac-hud-item">
              <span className="ipac-hud-label">Squad Tempo (4:15/km)</span>
              <b className="ipac-hud-val ipac-hud-highlight">{fmtMinSec(timeAt415)}</b>
            </div>
            <div className="ipac-hud-item">
              <span className="ipac-hud-label">Squad Steady (4:45/km)</span>
              <b className="ipac-hud-val">{fmtMinSec(timeAt445)}</b>
            </div>
            <div className="ipac-hud-item">
              <span className="ipac-hud-label">Squad Long Run (5:30/km)</span>
              <b className="ipac-hud-val">{fmtMinSec(timeAt530)}</b>
            </div>
            <div className="ipac-hud-item">
              <span className="ipac-hud-label">Verified Roads</span>
              <b className="ipac-hud-val" style={{ color: "#059669" }}>{shown.roads ? "Snapped" : "Direct"}</b>
            </div>
          </div>

          <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(255, 255, 255, 0.45)", borderRadius: "12px", border: "1px solid var(--color-glass-border)" }}>
            <b style={{ fontSize: "0.86rem", color: "var(--color-navy)", display: "block", marginBottom: "4px" }}>
              Highveld Hydration &amp; Checkpoint Stations:
            </b>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.82rem" }}>
              <span><b>Start:</b> Ivory Park AC Hub (0.0 km)</span>
              <span>-&gt; <b>Water Point 1:</b> Swazi Inn ({Math.min(4.0, Number((routeDistKm * 0.35).toFixed(1)))} km)</span>
              {routeDistKm >= 8 && <span>-&gt; <b>Water Point 2:</b> Freedom Drive ({Number((routeDistKm * 0.65).toFixed(1))} km)</span>}
              <span>-&gt; <b>Finish:</b> {routeDistKm.toFixed(1)} km</span>
            </div>
          </div>
        </section>
      )}

      {/* 4. RACE DAY PICKUP ITINERARY (IF ACTIVE) */}
      {routeType === "pickup" && pickupPlan && (
        <section className="ipac-card">
          {multiPlans && multiPlans.length > 1 && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {multiPlans.map((p, idx) => (
                <button
                  key={p.vehicle.id}
                  type="button"
                  className="ipac-chip"
                  aria-pressed={activeVehiclePlanIdx === idx}
                  onClick={() => {
                    setActiveVehiclePlanIdx(idx);
                    setPickupPlan(p.schedule);
                  }}
                  style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                >
                  <b>{p.vehicle.name}</b> ({p.seatUtilization.used}/{p.seatUtilization.total} Seats)
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
              {multiPlans && multiPlans[activeVehiclePlanIdx]
                ? `${multiPlans[activeVehiclePlanIdx].vehicle.name} · ${pickupPlan.stops.length} Stops (${pickupPlan.totalDistanceKm} km)`
                : `Shortest Pick-up Itinerary (${pickupPlan.stops.length} Stops · ${pickupPlan.totalDistanceKm} km)`}
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

          <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href={googleMapsDriverRoute(pickupPlan)}
              target="_blank"
              rel="noopener noreferrer"
              className="ipac-btn ipac-btn-hero"
              style={{ fontSize: "0.85rem", minHeight: "38px", display: "inline-flex", alignItems: "center" }}
            >
              Open in Google Maps (Driver Navigation)
            </a>
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
              Copy WhatsApp Schedule
            </button>
            {transportMsg && (
              <span style={{ color: "var(--color-hot)", fontWeight: 700, fontSize: "0.85rem", alignSelf: "center" }}>
                [Confirmed] {transportMsg}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 5. COLLAPSIBLE ADVANCED SETTINGS */}
      <details className="ipac-card ipac-more-routes">
        <summary style={{ fontWeight: 700, cursor: "pointer", fontSize: "0.92rem" }}>
          Advanced Route &amp; Hub Settings (Custom GPS &amp; Road Blockages)
        </summary>
        <div className="ipac-form" style={{ marginTop: "12px" }}>
          <div className="ipac-row2">
            <label>
              Start Latitude
              <input
                type="number"
                step="any"
                value={hub.lat}
                onChange={(e) => setHub({ ...hub, lat: +e.target.value })}
              />
            </label>
            <label>
              Start Longitude
              <input
                type="number"
                step="any"
                value={hub.lon}
                onChange={(e) => setHub({ ...hub, lon: +e.target.value })}
              />
            </label>
          </div>

          <button
            type="button"
            className="ipac-btn ipac-btn-quiet"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(
                (p) => setHub({ lat: p.coords.latitude, lon: p.coords.longitude }),
                () => setMsg("Could not read your location.")
              )
            }
          >
            Use My Location as Start Hub
          </button>

          {routeType === "loops" && (
            <div style={{ marginTop: "10px" }}>
              <label>
                Avoid Road Blockage Direction
                <select value={blocked} onChange={(e) => setBlocked(e.target.value)}>
                  <option value="">Anywhere (just generate another loop)</option>
                  {COMPASS.map(([n, b]) => (
                    <option key={b} value={b}>{n}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ marginTop: "6px" }}
                onClick={doReroute}
              >
                Reroute Around Blocked Direction
              </button>
            </div>
          )}
        </div>
      </details>

      {/* 6. SAVED CLUB ROUTES */}
      {saved.length > 0 && (
        <section className="ipac-card">
          <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Saved Club Routes</h3>
          <ul className="ipac-list">
            {saved.map((r) => (
              <li key={r.id}>
                <span className="ipac-who">
                  <b>{r.name} · {(r.lengthM / 1000).toFixed(2)} km</b>
                  <small>
                    {r.roads ? "Road-snapped" : "Straight guide"} ·{" "}
                    {r.checkedAt
                      ? `checked & safe (${new Date(r.checkedAt).toLocaleDateString()})`
                      : "not safety-checked yet"}
                  </small>
                </span>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-quiet"
                  aria-label={r.checkedAt ? `Unmark ${r.name}` : `Mark ${r.name} checked`}
                  onClick={() =>
                    persist(
                      saved.map((x) =>
                        x.id === r.id ? { ...x, checkedAt: x.checkedAt ? undefined : Date.now() } : x
                      )
                    )
                  }
                >
                  {r.checkedAt ? "Unmark" : "Checked"}
                </button>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-outline"
                  aria-label={`Show ${r.name}`}
                  onClick={() => {
                    setLoops([r]);
                    setI(0);
                    setRouteType("loops");
                  }}
                >
                  Show
                </button>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-quiet"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => persist(saved.filter((x) => x.id !== r.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
