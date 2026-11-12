import { useEffect, useMemo, useRef, useState } from "react";
import type * as C from "../lib/club";
import { haversineM, splits, type LatLon, type TrackPoint } from "../lib/geo";
import type { LiveJoin, useLive } from "../lib/live";
import { liveFlags, type Trail } from "../lib/livemap";
import { MAX_ACCURACY_M, accuracyLabel, calibrationFactor, routeProgressM } from "../lib/gpsfilter";
import { fmtMetres, gpsReady, trackRun } from "../lib/tracker";
import { fitTrack, lapLength, markedDistance, markerSplits, trackDistance, type Marker, type TrackPlace } from "../lib/trackmode";
import { kvGet, kvSet } from "../lib/store";
import ClubMap, { type MapMarker } from "./ClubMap";
import type { Route } from "../lib/routes";
import type { Config } from "../lib/store";
import * as S from "../lib/session";
import { say } from "../lib/sound";
import {
  COMMON_RACE_DISTANCES,
  calcPaceDelta,
  calcPaceFromTime,
  calcTimeFromPace,
  fmtDuration,
  fmtPace,
  generateSplitTargets,
  parseDuration,
  parsePace,
  type PaceDelta,
} from "../lib/racePacing";

/** Relay key shared across devices (local runner ids differ per device). */
export const relayKey = (r: S.Runner) => r.bib || r.name;
type Live = ReturnType<typeof useLive>;

interface Props {
  s: S.Session;
  act: (f: (x: S.Session) => S.Session) => void;
  cfg: Config;
  running: boolean;
  live: Live;
  join: LiveJoin | null;
  setJoin: (j: LiveJoin | null) => void;
  trail: Trail;
  members: C.Member[];
  routes: Route[];
}

export default function Live({ s, act, cfg, running, live, join, setJoin, trail, members, routes }: Props) {
  const [room, setRoom] = useState(join?.room ?? s.room ?? "");
  const [me, setMe] = useState(join?.me ?? "");
  const [gps, setGps] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [simField, setSimField] = useState(false);

  // Target Pacing State
  const [targetDistM, setTargetDistM] = useState(10000);
  const [targetTimeStr, setTargetTimeStr] = useState("00:45:00");
  const [targetPaceStr, setTargetPaceStr] = useState("4:30");
  const [audioPacing, setAudioPacing] = useState(true);
  const lastAnnouncedKm = useRef(0);

  // Community Share State
  const [copiedShare, setCopiedShare] = useState(false);

  const myKey = join?.me ?? me;
  const mine = s.runners.find((r) => relayKey(r) === myKey);
  const sRef = useRef(s);
  sRef.current = s;
  const sendRef = useRef(live.send);
  sendRef.current = live.send;
  const lastSent = useRef(0);
  const fixes = useRef<TrackPoint[]>([]);

  const [acc, setAcc] = useState<number | undefined>();
  const [cal, setCal] = useState(1);
  const [calM, setCalM] = useState("400");
  const [calMsg, setCalMsg] = useState("");
  const [runRoute, setRunRoute] = useState("");
  const [, bump] = useState(0);

  const [where, setWhere] = useState<"road" | "track">("road");
  const [lane, setLane] = useState(1);
  const [place, setPlace] = useState<TrackPlace | null>(null);
  const [fitMsg, setFitMsg] = useState("");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [gpsAt, setGpsAt] = useState<number[]>([]);
  const [boardM, setBoardM] = useState(1000);

  // Map center point (follows GPS fix)
  const [centerPt, setCenterPt] = useState<LatLon | undefined>();

  useEffect(() => {
    kvGet<number>("gpsCal").then((f) => f && setCal(f));
    kvGet<TrackPlace>("trackPlace").then((p) => p && setPlace(p));
    kvGet<"road" | "track">("runWhere").then((w) => w && setWhere(w));
    kvGet<number>("runLane").then((l) => l && setLane(l));
  }, []);

  useEffect(() => {
    if (gps) {
      setMarkers([]);
      setGpsAt([]);
    }
  }, [gps, s.id]);

  // Geolocation watch
  useEffect(() => {
    if (!gps || paused) return;
    if (!("geolocation" in navigator)) {
      setGpsErr("This device has no GPS sensor.");
      setGps(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = sRef.current;
        const r = cur.runners.find((x) => relayKey(x) === myKey);
        const a = p.coords.accuracy;
        const fix = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          acc: a,
          speed: p.coords.speed,
          heading: p.coords.heading,
        };

        setGpsErr("");
        setAcc(a);
        fixes.current.push({ ...fix, t: Date.now() });
        setCenterPt({ lat: fix.lat, lon: fix.lon });
        bump((n) => n + 1);

        if (a > MAX_ACCURACY_M) return; // filter poor fixes

        if (Date.now() - lastSent.current > 4000) {
          lastSent.current = Date.now();
          sendRef.current({ type: "pos", lat: p.coords.latitude, lon: p.coords.longitude });
        }

        if (cur.startedAt === undefined || !r) return;
        act((x) => S.addTrackPoint(x, r.id, { ...fix, t: Date.now() - cur.startedAt! }));
      },
      (e) => {
        if (e.code === 1) {
          setGpsErr("Location permission was denied. Please allow GPS access in settings.");
          setGps(false);
        } else {
          setGpsErr("Searching for GPS satellite signal…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [gps, paused, myKey, act]);

  // Calculations for current run metrics
  const track = mine ? s.tracks?.[mine.id] ?? [] : [];
  const src = track.length ? track : gps ? fixes.current : [];
  const run = useMemo(() => trackRun(src), [Math.floor(src.length / 3), src === track]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = routes.find((r) => r.id === runRoute);
  const roadM = route ? routeProgressM(run.points, route.points) : run.distanceM * cal;
  const onTrack = where === "track" && place ? trackDistance(run.points, place, lane) : null;
  const distM = onTrack ? onTrack.distanceM : markedDistance(markers, roadM, gpsAt);
  const sp = onTrack ? [] : splits(run.points);

  const elapsedMs = s.startedAt ? Date.now() - s.startedAt : run.movingMs;
  const speedMs = run.movingMs > 0 ? run.distanceM / (run.movingMs / 1000) : 0;
  const currentSpeedKmH = (speedMs * 3.6).toFixed(1);
  const currentPace = speedMs > 0.5 ? S.fmtPace(1000 / speedMs) : "--:-- /km";

  // Target Pacing Calculations
  const targetPaceSec = parsePace(targetPaceStr) ?? 270;
  const targetTimeSec = parseDuration(targetTimeStr) ?? 2700;

  const onDistanceChange = (m: number) => {
    setTargetDistM(m);
    const newSec = Math.round((m / 1000) * targetPaceSec);
    setTargetTimeStr(fmtDuration(newSec));
  };

  const onTargetTimeChange = (timeStr: string) => {
    setTargetTimeStr(timeStr);
    const sec = parseDuration(timeStr);
    if (sec && targetDistM > 0) {
      const pace = calcPaceFromTime(targetDistM, sec);
      setTargetPaceStr(fmtPace(pace));
    }
  };

  const onTargetPaceChange = (paceStr: string) => {
    setTargetPaceStr(paceStr);
    const pace = parsePace(paceStr);
    if (pace && targetDistM > 0) {
      const sec = calcTimeFromPace(targetDistM, pace);
      setTargetTimeStr(fmtDuration(sec));
    }
  };

  const pacingDelta: PaceDelta = useMemo(() => {
    return calcPaceDelta(distM, elapsedMs, targetPaceSec);
  }, [distM, elapsedMs, targetPaceSec]);

  // Audio Voice km split announcements
  useEffect(() => {
    if (!audioPacing || distM < 1000) return;
    const currentKm = Math.floor(distM / 1000);
    if (currentKm > lastAnnouncedKm.current) {
      lastAnnouncedKm.current = currentKm;
      const leadStr = pacingDelta.ahead
        ? `${Math.abs(pacingDelta.deltaSec)} seconds ahead of target pace`
        : pacingDelta.deltaSec > 0
        ? `${pacingDelta.deltaSec} seconds behind target pace`
        : "right on target pace";
      say(`Kilometer ${currentKm}. Pace is ${currentPace}. You are ${leadStr}.`);
    }
  }, [distM, audioPacing, pacingDelta, currentPace]);

  // Simulated field of runners for simultaneous tracking
  const [simTick, setSimTick] = useState(0);
  useEffect(() => {
    if (!simField) return;
    const timer = setInterval(() => setSimTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [simField]);

  const simulatedRunners = useMemo(() => {
    if (!simField) return [];
    const baseNames = [
      { id: "sim-1", name: "Sibusiso Molefe", bib: "12", speed: 4.25, baseM: 1400 },
      { id: "sim-2", name: "Katlego Dlamini", bib: "07", speed: 4.05, baseM: 1350 },
      { id: "sim-3", name: "Thabo Mokoena", bib: "24", speed: 3.85, baseM: 1280 },
      { id: "sim-4", name: "Lerato Khumalo", bib: "18", speed: 3.65, baseM: 1190 },
      { id: "sim-5", name: "Naledi Sithole", bib: "31", speed: 3.45, baseM: 1100 },
    ];

    return baseNames.map((r, i) => {
      const curDist = r.baseM + Math.round(r.speed * simTick);
      const curSpeedKmH = (r.speed * 3.6).toFixed(1);
      const curPace = S.fmtPace(1000 / r.speed);
      const gapToLeader = i === 0 ? "Leader" : `+${Math.max(1, Math.round((baseNames[0].baseM + baseNames[0].speed * simTick - curDist) / r.speed))}s`;
      const gapToNext = i === 0 ? "-" : `+${Math.max(1, Math.round(((baseNames[i - 1].baseM + baseNames[i - 1].speed * simTick) - curDist) / r.speed))}s`;

      return {
        ...r,
        distM: curDist,
        speedKmH: curSpeedKmH,
        pace: curPace,
        gapLeader: gapToLeader,
        gapNext: gapToNext,
        status: "Moving",
      };
    });
  }, [simField, simTick]);

  // Map markers: Sleek, compact pins
  const allMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [];
    const myFix = fixes.current[fixes.current.length - 1];

    if (myFix) {
      list.push({
        id: "me",
        lat: myFix.lat,
        lon: myFix.lon,
        label: "YOU",
        kind: "me",
      });
    }

    if (simField && myFix) {
      simulatedRunners.forEach((sr, idx) => {
        list.push({
          id: sr.id,
          lat: myFix.lat + (idx + 1) * 0.0003,
          lon: myFix.lon + (idx + 1) * 0.0003,
          label: `#${idx + 2} ${sr.name.split(" ")[0]}`,
          kind: "rank",
        });
      });
    }

    // Live room positions
    if (live.state?.positions) {
      live.state.positions.forEach((p) => {
        if (p.runnerId !== myKey) {
          list.push({
            id: p.runnerId,
            lat: p.lat,
            lon: p.lon,
            label: p.runnerId,
            kind: "rank",
          });
        }
      });
    }

    return list;
  }, [simField, simulatedRunners, live.state?.positions, myKey]);

  const mapLine = route?.points ?? (fixes.current.length > 1 ? fixes.current : undefined);

  // Tracking control actions
  const startTracking = () => {
    setGpsErr("");
    fixes.current = [];
    setGps(true);
    setPaused(false);
  };

  const togglePause = () => {
    setPaused((p) => !p);
  };

  const stopAndReset = () => {
    setGps(false);
    setPaused(false);
    fixes.current = [];
  };

  // Community broadcast text
  const shareText = `*Ivory Park Athletics Club - Community Training Alert*\nJoin our live squad at Ivory Park!\nTarget Distance: ${(targetDistM / 1000).toFixed(1)} km | Pacing: ${targetPaceStr} /km\nTrack live and connect with the squad: ${window.location.origin || window.location.href}`;

  return (
    <>
      {/* ====================================================================
          1. LIVE STREET MAP & GPS TRACKER CARD
          ==================================================================== */}
      <section className="ipac-card ipac-map-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Live Street Map &amp; Tracking</h2>
            <p className="ipac-hint" style={{ margin: "2px 0 0" }}>
              High-precision GPS vector map with animated route flow and live pacer metrics.
            </p>
          </div>
          <span className={`ipac-gpsq ipac-gpsq-${accuracyLabel(acc)}`} role="status">
            GPS {acc === undefined ? (gps ? "Searching…" : "Standby") : `±${Math.round(acc)} m (${accuracyLabel(acc)})`}
          </span>
        </div>

        {gpsErr && <p role="alert" className="ipac-err" style={{ marginTop: "8px" }}>{gpsErr}</p>}

        {/* Map Viewport */}
        <div className="ipac-map-viewport" style={{ marginTop: "10px" }}>
          <ClubMap
            label="Live athletics track and route map"
            fallback={<div className="ipac-hint" style={{ padding: "20px", textAlign: "center" }}>Street map offline. GPS tracking active.</div>}
            center={centerPt}
            line={mapLine}
            markers={allMarkers}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            floatingContent={
              fullscreen ? (
                <>
                  <div className="ipac-floating-hud">
                    <div className="ipac-floating-stat">
                      <span className="ipac-hud-highlight">{fmtMetres(distM)}</span>
                      <small className="ipac-floating-stat-label">Dist</small>
                    </div>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <div className="ipac-floating-stat">
                      <span>{currentPace}</span>
                      <small className="ipac-floating-stat-label">Pace</small>
                    </div>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <div className="ipac-floating-stat">
                      <span>{S.fmtTime(elapsedMs)}</span>
                      <small className="ipac-floating-stat-label">Time</small>
                    </div>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <div className="ipac-floating-stat">
                      <span className={pacingDelta.ahead ? "ipac-tk-status-moving" : "ipac-tk-status-stopped"}>
                        {pacingDelta.formattedDelta}
                      </span>
                      <small className="ipac-floating-stat-label">Pacer</small>
                    </div>
                  </div>

                  <div className="ipac-floating-bottom-bar">
                    {!gps ? (
                      <button type="button" className="ipac-btn ipac-btn-primary" onClick={startTracking}>
                        Start Tracking
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`ipac-btn ${paused ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                          onClick={togglePause}
                        >
                          {paused ? "Resume" : "Pause"}
                        </button>
                        <button type="button" className="ipac-btn ipac-btn-danger" onClick={stopAndReset}>
                          Finish
                        </button>
                      </>
                    )}
                    {centerPt && (
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-quiet"
                        onClick={() => setCenterPt({ ...centerPt })}
                      >
                        Recenter
                      </button>
                    )}
                  </div>
                </>
              ) : null
            }
          />
        </div>

        {/* Live Metrics HUD */}
        <div className="ipac-hud" style={{ marginTop: "10px" }}>
          <div className="ipac-hud-item">
            <span className="ipac-hud-label">Distance</span>
            <b className="ipac-hud-val ipac-hud-highlight">{fmtMetres(distM)}</b>
          </div>
          <div className="ipac-hud-item">
            <span className="ipac-hud-label">Current Pace</span>
            <b className="ipac-hud-val">{currentPace}</b>
          </div>
          <div className="ipac-hud-item">
            <span className="ipac-hud-label">Moving Time</span>
            <b className="ipac-hud-val">{S.fmtTime(elapsedMs)}</b>
          </div>
          <div className="ipac-hud-item">
            <span className="ipac-hud-label">Target Split Delta</span>
            <b className={`ipac-hud-val ${pacingDelta.ahead ? "ipac-tk-status-moving" : "ipac-tk-status-stopped"}`}>
              {pacingDelta.formattedDelta}
            </b>
          </div>
        </div>

        {/* Reasonable, Non-Huge Tracking Action Buttons */}
        <div className="ipac-tracker-actions">
          {!gps ? (
            <button
              type="button"
              className="ipac-btn ipac-btn-primary ipac-track-btn"
              onClick={startTracking}
            >
              Start Tracking Run
            </button>
          ) : (
            <div className="ipac-tracker-btn-row">
              <button
                type="button"
                className={`ipac-btn ${paused ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                onClick={togglePause}
              >
                {paused ? "Resume Run" : "Pause Tracking"}
              </button>
              <button
                type="button"
                className="ipac-btn ipac-btn-danger"
                onClick={stopAndReset}
              >
                Finish &amp; Reset
              </button>
            </div>
          )}
        </div>

        {gps && (
          <p className="ipac-hint" style={{ textAlign: "center", marginTop: "8px" }}>
            {paused ? "Run paused." : "GPS tracking active. Position is recorded and smoothed continuously."}
          </p>
        )}
      </section>

      {/* ====================================================================
          2. TARGET RACE PACER & DYNAMIC SPLIT CALCULATOR
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Race Target Pacer &amp; Split Calculator</h3>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Set your target finish time or required pace to generate exact km split targets.
            </p>
          </div>
          <span className="ipac-rank-badge" style={{ fontSize: "0.9rem", padding: "3px 12px" }}>
            {targetPaceStr} /km
          </span>
        </div>

        <div className="ipac-form" style={{ marginTop: "12px" }}>
          <div className="ipac-chips" role="group" aria-label="Race Distance">
            {COMMON_RACE_DISTANCES.map((d) => (
              <button
                key={d.distanceM}
                type="button"
                className="ipac-chip"
                aria-pressed={targetDistM === d.distanceM}
                onClick={() => onDistanceChange(d.distanceM)}
              >
                {d.label.split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="ipac-row2" style={{ marginTop: "8px" }}>
            <label>
              Target Finish Time (hh:mm:ss)
              <input
                type="text"
                value={targetTimeStr}
                onChange={(e) => onTargetTimeChange(e.target.value)}
                placeholder="00:45:00"
                style={{ fontWeight: 700 }}
              />
            </label>
            <label>
              Required Average Pace (m:ss /km)
              <input
                type="text"
                value={targetPaceStr}
                onChange={(e) => onTargetPaceChange(e.target.value)}
                placeholder="4:30"
                style={{ fontWeight: 700 }}
              />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer", marginTop: "4px" }}>
            <input
              type="checkbox"
              checked={audioPacing}
              onChange={(e) => setAudioPacing(e.target.checked)}
            />
            Spoken Voice Split Guidance (Announces pace &amp; target delta at each km)
          </label>
        </div>

        {/* Milestone Split Targets Table */}
        <details className="ipac-more-routes" style={{ marginTop: "12px" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>
            View {(targetDistM / 1000).toFixed(0)} km Split Milestones Schedule
          </summary>
          <div className="ipac-tk-table-wrap" style={{ marginTop: "8px" }}>
            <table className="ipac-tk-table">
              <thead>
                <tr>
                  <th>Km</th>
                  <th>Split Target</th>
                  <th>Cumulative Time</th>
                  <th>Target Pace</th>
                </tr>
              </thead>
              <tbody>
                {generateSplitTargets(targetDistM, targetPaceSec).slice(0, 15).map((sp) => (
                  <tr key={sp.km}>
                    <td><b>Km {sp.km}</b></td>
                    <td>{sp.splitTime}</td>
                    <td><b>{sp.cumulativeTime}</b></td>
                    <td>{sp.pace} /km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* ====================================================================
          3. SIMULTANEOUS MULTI-RUNNER TIMEKEEPER RACE BOARD
          ==================================================================== */}
      <section className="ipac-card ipac-timekeeper-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Timekeeper Live Race Board</h3>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Simultaneous tracking of all athletes: positions, speeds, splits, and gaps.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className={`ipac-btn ${simField ? "ipac-btn-primary" : "ipac-btn-quiet"}`}
              style={{ minHeight: "32px", padding: "2px 10px", fontSize: "0.78rem" }}
              onClick={() => setSimField((v) => !v)}
            >
              {simField ? "Stop Simulation" : "Simulate Field"}
            </button>
            <span className="ipac-rank-badge">
              {simField ? `${simulatedRunners.length + 1} Runners` : "Live Standby"}
            </span>
          </div>
        </div>

        <p className="ipac-hint" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
          Swipe table horizontally on mobile to view full splits and gap metrics.
        </p>

        <div className="ipac-tk-table-wrap" style={{ marginTop: "8px" }}>
          <table className="ipac-tk-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Runner</th>
                <th>Distance</th>
                <th>Speed</th>
                <th>Status</th>
                <th>Pace</th>
                <th>Gap to Leader</th>
                <th>Gap to Next</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "rgba(42, 48, 144, 0.15)" }}>
                <td className="ipac-tk-rank ipac-tk-rank-1">#1</td>
                <td><b>{mine ? S.label(mine) : (myKey || "You")}</b> (Current)</td>
                <td><b>{fmtMetres(distM)}</b></td>
                <td>{currentSpeedKmH} km/h</td>
                <td>
                  <span className={+currentSpeedKmH > 0.5 ? "ipac-tk-status-moving" : "ipac-tk-status-stopped"}>
                    {+currentSpeedKmH > 0.5 ? "Moving" : "Stopped"}
                  </span>
                </td>
                <td>{currentPace}</td>
                <td>Leader</td>
                <td>-</td>
              </tr>
              {simField && simulatedRunners.map((sr, idx) => (
                <tr key={sr.id}>
                  <td className="ipac-tk-rank">#{idx + 2}</td>
                  <td><b>{sr.name}</b> (Bib #{sr.bib})</td>
                  <td><b>{fmtMetres(sr.distM)}</b></td>
                  <td>{sr.speedKmH} km/h</td>
                  <td><span className="ipac-tk-status-moving">{sr.status}</span></td>
                  <td>{sr.pace}</td>
                  <td>{sr.gapLeader}</td>
                  <td>{sr.gapNext}</td>
                </tr>
              ))}
              {!simField && s.runners.filter((r) => relayKey(r) !== myKey).map((r, idx) => (
                <tr key={r.id}>
                  <td className="ipac-tk-rank">#{idx + 2}</td>
                  <td><b>{S.label(r)}</b></td>
                  <td>{fmtMetres(distM * 0.9)}</td>
                  <td>-- km/h</td>
                  <td><span className="ipac-tk-status-stopped">Standby</span></td>
                  <td>--:-- /km</td>
                  <td>--</td>
                  <td>--</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ====================================================================
          4. COMMUNITY BROADCAST & EVENT ALERTS CARD
          ==================================================================== */}
      <section className="ipac-card ipac-broadcast-card">
        <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Broadcast Run to Community</h3>
        <p className="ipac-hint" style={{ margin: "2px 0 10px" }}>
          Alert Ivory Park runners and sports enthusiasts across The Gruvs, The Resident, and WhatsApp.
        </p>
        <div className="ipac-row2">
          <button
            type="button"
            className="ipac-btn ipac-btn-primary"
            onClick={() => {
              const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
              window.open(url, "_blank");
            }}
          >
            Share on WhatsApp Groups
          </button>
          <button
            type="button"
            className="ipac-btn ipac-btn-outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2500);
              } catch {}
            }}
          >
            {copiedShare ? "Schedule Copied" : "Copy Schedule Text"}
          </button>
        </div>
      </section>
    </>
  );
}
