import { useEffect, useRef, useState } from "react";
import type * as C from "../lib/club";
import { splits, type LatLon } from "../lib/geo";
import type { LiveJoin, useLive } from "../lib/live";
import { liveFlags, type Trail } from "../lib/livemap";
import { MAX_ACCURACY_M, accuracyLabel, calibrationFactor, routeProgressM } from "../lib/gpsfilter";
import { fmtMetres, gpsReady, trackRun } from "../lib/tracker";
import { fitTrack, lapLength, markedDistance, markerSplits, trackDistance, type Marker, type TrackPlace } from "../lib/trackmode";
import { useMemo } from "react";
import { kvGet, kvSet } from "../lib/store";
import ClubMap from "./ClubMap";
import type { Route } from "../lib/routes";
import type { Config } from "../lib/store";
import type { TrackPoint } from "../lib/geo";
import * as S from "../lib/session";

/** Relay key shared across devices (local runner ids differ per device). */
export const relayKey = (r: S.Runner) => r.bib || r.name;
type Live = ReturnType<typeof useLive>;
interface Props {
  s: S.Session; act: (f: (x: S.Session) => S.Session) => void; cfg: Config; running: boolean;
  live: Live; join: LiveJoin | null; setJoin: (j: LiveJoin | null) => void; trail: Trail; members: C.Member[]; routes: Route[];
}

export default function Live({ s, act, cfg, running, live, join, setJoin, trail, members, routes }: Props) {
  const [room, setRoom] = useState(join?.room ?? s.room ?? ""), [me, setMe] = useState(join?.me ?? ""), [gps, setGps] = useState(false), [gpsErr, setGpsErr] = useState("");
  const lead = live.state?.relay.leadId, offered = live.state?.relay.offeredBy, myKey = join?.me ?? me;
  const mine = s.runners.find((r) => relayKey(r) === myKey);
  const sRef = useRef(s); sRef.current = s;
  const sendRef = useRef(live.send); sendRef.current = live.send;
  const lastSent = useRef(0), fixes = useRef<TrackPoint[]>([]);
  const [acc, setAcc] = useState<number | undefined>(), [cal, setCal] = useState(1), [calM, setCalM] = useState("400"), [calMsg, setCalMsg] = useState(""), [runRoute, setRunRoute] = useState(""), [, bump] = useState(0);
  const [where, setWhere] = useState<"road" | "track">("road"), [lane, setLane] = useState(1), [place, setPlace] = useState<TrackPlace | null>(null), [fitMsg, setFitMsg] = useState("");
  const [markers, setMarkers] = useState<Marker[]>([]), [gpsAt, setGpsAt] = useState<number[]>([]), [boardM, setBoardM] = useState(1000);
  useEffect(() => { kvGet<number>("gpsCal").then((f) => f && setCal(f)); kvGet<TrackPlace>("trackPlace").then((p) => p && setPlace(p)); kvGet<"road" | "track">("runWhere").then((w) => w && setWhere(w)); kvGet<number>("runLane").then((l) => l && setLane(l)); }, []);
  useEffect(() => { if (gps) { setMarkers([]); setGpsAt([]); } }, [gps, s.id]);

  useEffect(() => {
    if (!gps) return;
    if (!("geolocation" in navigator)) { setGpsErr("This device has no GPS."); setGps(false); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = sRef.current, r = cur.runners.find((x) => relayKey(x) === myKey), a = p.coords.accuracy;
        const fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: a, speed: p.coords.speed, heading: p.coords.heading };
        setGpsErr(""); setAcc(a); fixes.current.push({ ...fix, t: Date.now() }); bump((n) => n + 1);
        if (a > MAX_ACCURACY_M) return; // too rough to use or share
        if (Date.now() - lastSent.current > 5000) { lastSent.current = Date.now(); sendRef.current({ type: "pos", lat: p.coords.latitude, lon: p.coords.longitude }); } // shared with the coach's map
        if (cur.startedAt === undefined || !r) return;
        act((x) => S.addTrackPoint(x, r.id, { ...fix, t: Date.now() - cur.startedAt! }));
      },
      (e) => { // only permission loss stops tracking; a missing fix is temporary and the watch keeps trying
        if (e.code === 1) { setGpsErr("Location permission was denied."); setGps(false); } else setGpsErr("Searching for a GPS signal…");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }); // full accuracy while running; turn tracking off after to save battery
    return () => navigator.geolocation.clearWatch(id);
  }, [gps, myKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (k?: string) => { const r = s.runners.find((x) => relayKey(x) === k); return r ? S.label(r) : k ? `#${k}` : "nobody"; };
  const track = mine ? s.tracks?.[mine.id] ?? [] : [], src = track.length ? track : gps ? fixes.current : [];
  const run = useMemo(() => trackRun(src), [Math.floor(src.length / 3), src === track]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = routes.find((r) => r.id === runRoute), roadM = route ? routeProgressM(run.points, route.points) : run.distanceM * cal;
  const onTrack = where === "track" && place ? trackDistance(run.points, place, lane) : null;
  const distM = onTrack ? onTrack.distanceM : markedDistance(markers, roadM, gpsAt);
  const sp = onTrack ? [] : splits(run.points), lapsSeen = useRef(0);
  useEffect(() => { const n = onTrack?.laps.length ?? 0; if (n > lapsSeen.current) navigator.vibrate?.([60, 40, 60]); lapsSeen.current = n; }, [onTrack?.laps.length]);
  const setWhereSaved = (w: "road" | "track") => { setWhere(w); kvSet("runWhere", w); };
  const whoAmI = (
    <label>Who am I?
      <select value={myKey} onChange={(e) => setMe(e.target.value)} disabled={!!join}>
        <option value="">{cfg.serverUrl ? "Coach / watching only" : "Pick your name"}</option>
        {s.runners.map((r) => <option key={r.id} value={relayKey(r)}>{S.label(r)}</option>)}
      </select>
    </label>
  );
  const gpsCard = (
    <section className="ipac-card">
      <h2>My run</h2>
      <label className="ipac-check"><input type="checkbox" checked={gps} disabled={!myKey} onChange={(e) => { setGpsErr(""); setGps(e.target.checked); }} /> Track my run with GPS{join ? " and share my position with the coach" : ""}</label>
      {!myKey && <p className="ipac-hint">Pick your name above first.</p>}
      {gpsErr && <p role="alert" className="ipac-err">{gpsErr}</p>}
      {gps && <p className={`ipac-gpsq ipac-gpsq-${accuracyLabel(acc)}`} role="status">GPS {acc === undefined ? "searching…" : `±${Math.round(acc)} m (${accuracyLabel(acc)})`}{acc !== undefined && (gpsReady(acc) ? " · ready to run" : " · wait in the open until it is ±10 m or better")}</p>}
      <div className="ipac-seg" role="group" aria-label="Where are you running?">
        <button aria-pressed={where === "road"} onClick={() => setWhereSaved("road")}>Road</button>
        <button aria-pressed={where === "track"} onClick={() => setWhereSaved("track")}>Track</button>
      </div>
      {where === "track" && <TrackPanel place={place} lane={lane} setLane={(l) => { setLane(l); kvSet("runLane", l); }} msg={fitMsg}
        learn={() => { try { const f = fitTrack(run.points.length >= 20 ? run.points : smoothSource(fixes.current)); setPlace(f); kvSet("trackPlace", f); setFitMsg(`Track saved. Your lap sits within about ±${Math.max(1, Math.round(f.rms))} m of the lane line.`); } catch (x) { setFitMsg((x as Error).message); } }}
        forget={() => { setPlace(null); kvSet("trackPlace", null); setFitMsg("Track forgotten. Run one lap and learn it again."); }} />}
      {where === "road" && routes.length > 0 && <label>Measure along a route<select value={runRoute} onChange={(e) => setRunRoute(e.target.value)}><option value="">No, follow my GPS trace</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
      {(mine || gps) && <p className="ipac-dist"><b>{fmtMetres(distM)}</b><small>{onTrack ? `track, lane ${lane}` : markers.length ? `from the ${fmtMetres(markers[markers.length - 1].distM)} board` : route ? "along the route" : cal !== 1 ? `calibrated ×${cal}` : "GPS"} · moving {S.fmtTime(run.movingMs)}{run.stoppedMs > 5000 ? ` · stopped ${S.fmtTime(run.stoppedMs)} (not counted)` : ""}{!running ? " · counting starts when the timer starts" : ""}</small></p>}
      {onTrack?.offTrack && <p role="alert" className="ipac-err">You seem to be off the track. Switch to Road, or learn the track again.</p>}
      {onTrack && onTrack.laps.length > 0 && <ol className="ipac-laps">{onTrack.laps.map((l) => <li key={l.lap}>Lap {l.lap}: <b>{S.fmtTime(l.ms, true)}</b> ({S.fmtPace(l.ms / 1000 / (lapLength(lane) / 1000))})</li>)}</ol>}
      {where === "road" && gps && (
        <div className="ipac-boards">
          <button className="ipac-btn ipac-btn-hero" onClick={() => { navigator.vibrate?.(40); setMarkers([...markers, { atMs: Date.now(), distM: (markers.length + 1) * boardM }]); setGpsAt([...gpsAt, roadM]); }}>I'm at the {fmtMetres((markers.length + 1) * boardM)} board</button>
          <label className="ipac-inline">Boards every<select aria-label="Distance between boards" value={boardM} onChange={(e) => setBoardM(+e.target.value)} disabled={markers.length > 0}>{[200, 400, 500, 1000, 2000].map((m) => <option key={m} value={m}>{fmtMetres(m)}</option>)}</select>
            {markers.length > 0 && <button className="ipac-btn ipac-btn-quiet" onClick={() => { setMarkers(markers.slice(0, -1)); setGpsAt(gpsAt.slice(0, -1)); }}>Undo board</button>}</label>
          {markers.length > 0 && <ol className="ipac-laps">{markerSplits(markers, src[0] ? (src === track ? (s.startedAt ?? Date.now()) : src[0].t) : Date.now()).map((x) => <li key={x.distM}>{fmtMetres(x.distM)}: <b>{S.fmtTime(x.ms, true)}</b> ({S.fmtPace(x.paceSecPerKm)})</li>)}</ol>}
          <p className="ipac-hint">On a loop with measured boards, tap as you pass each one: the distance snaps to the exact board and the splits between boards are exact.</p>
        </div>)}
      {sp.length > 0 && <ol>{sp.map((x) => <li key={x.km}>{x.partial ? "last part" : `km ${x.km}`}: {S.fmtTime(x.ms)} ({S.fmtPace(x.paceSecPerKm)})</li>)}</ol>}
      <p className="ipac-hint">Each GPS position is good to a few metres, not centimetres. The app drops fixes worse than {MAX_ACCURACY_M} m, combines positions with the phone's Doppler speed, smooths the whole run, and adds nothing while you stand still. Expect a total within about 1% on open roads; for exact distances, run Laps on a measured track. Your GPS trail stays on this phone.</p>
      {gps && (
        <details className="ipac-more">
          <summary>Calibrate this phone on a measured distance</summary>
          <p className="ipac-hint">Tap Start, run exactly a measured distance in the open (a 400 m track lap in lane 1, or a measured km), then tap Done. Away from buildings works best.</p>
          <div className="ipac-grid2">
            <label>Measured metres<input inputMode="numeric" value={calM} onChange={(e) => setCalM(e.target.value.replace(/\D/g, ""))} /></label>
            <span className="ipac-hint">So far: {fmtMetres(trackRun(fixes.current).distanceM)} by GPS</span>
          </div>
          <div className="ipac-row2">
            <button className="ipac-btn ipac-btn-outline" onClick={() => { fixes.current = []; setCalMsg("Started. Run the measured distance now."); bump((n) => n + 1); }}>Start</button>
            <button className="ipac-btn ipac-btn-primary" onClick={() => { try { const f = calibrationFactor(+calM, trackRun(fixes.current).distanceM); setCal(f); kvSet("gpsCal", f); setCalMsg(`Saved. This phone's GPS distances are now multiplied by ${f}.`); } catch (x) { setCalMsg((x as Error).message); } }}>Done</button>
            {cal !== 1 && <button className="ipac-btn ipac-btn-quiet" onClick={() => { setCal(1); kvSet("gpsCal", 1); setCalMsg("Calibration cleared."); }}>Clear</button>}
          </div>
          {calMsg && <p role="status" className="ipac-hint">{calMsg}</p>}
        </details>)}
    </section>
  );
  if (!cfg.serverUrl) return <><section className="ipac-card"><h2>Live</h2><p className="ipac-hint">The live map, relay and shared timing need the club server. Add its address in the Club tab. GPS tracking works without it.</p>{whoAmI}</section>{gpsCard}</>;

  const conflicts = live.state?.timing.conflicts ?? [];
  return (
    <>
      <section className="ipac-card">
        <h2>Live room</h2>
        <div className="ipac-form">
          {whoAmI}
          <label>Room code<input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={8} disabled={!!join} placeholder="e.g. IPARK" /></label>
          <button className="ipac-btn ipac-btn-primary" disabled={!room} onClick={() => { if (join) setJoin(null); else { setJoin({ room, me, share: false }); act((x) => ({ ...x, room })); } }}>{join ? "Leave room" : "Join room"}</button>
        </div>
        {join && <p aria-live="polite">Connection: {live.status}{live.error && <span className="ipac-err"> · {live.error}</span>}</p>}
        {join && cfg.token && (
          <label className="ipac-check"><input type="checkbox" checked={join.share} onChange={(e) => setJoin({ ...join, share: e.target.checked })} /> Share timing with other timekeepers in this room</label>)}
        {join?.share && <p className="ipac-hint">Every timekeeper with the coach token in room {join.room} shares one race clock. Taps from all phones are combined; the earliest time for a bib wins. Race sessions only.</p>}
      </section>

      {join?.share && conflicts.length > 0 && (
        <section className="ipac-card">
          <h2>Timekeepers disagree</h2>
          <ul className="ipac-roster">{conflicts.slice(-8).reverse().map((c, i) => (
            <li key={i}><span className="ipac-who"><b>#{c.bib}: kept {S.fmtTime(c.kept)}</b><small>Another phone had {S.fmtTime(c.other)} ({Math.round((c.other - c.kept) / 1000)} s later). Fix the time in Session if needed.</small></span></li>))}</ul>
        </section>)}

      {live.state && <LiveMap live={live} trail={trail} name={name} s={s} members={members} routes={routes} />}

      {live.state && (
        <section className="ipac-card">
          <h2>Relay</h2>
          <div className="ipac-lead"><small>In front</small><b>{name(lead)}</b></div>
          {offered && <p role="status" className="ipac-banner">{name(offered)} is passing the lead. Tap Take to run in front.</p>}
          <div className="ipac-relay">
            <button className="ipac-pass" disabled={!myKey || lead !== myKey || !!offered} onClick={() => live.send({ type: "pass" })}>Pass Over</button>
            <button className="ipac-take" disabled={!myKey || !offered || lead === myKey} onClick={() => live.send({ type: "take" })}>Take</button>
          </div>
          {cfg.token && <div className="ipac-actions">
            <select aria-label="Set lead" value="" onChange={(e) => e.target.value && live.send({ type: "setLead", runnerId: e.target.value })}>
              <option value="">Set lead…</option>{s.runners.map((r) => <option key={r.id} value={relayKey(r)}>{S.label(r)}</option>)}
            </select></div>}
          <p className="ipac-hint">In the room: {(live.state.runners as string[]).map(name).join(", ") || "no runners yet"}</p>
        </section>
      )}
      {gpsCard}
    </>
  );
}

/** Every runner who shares GPS, drawn to scale around the hub. No map tiles, so it works on very little data. */
function LiveMap({ live, trail, name, s, members, routes }: { live: Live; trail: Trail; name: (k?: string) => string; s: S.Session; members: C.Member[]; routes: Route[] }) {
  const [routeId, setRouteId] = useState(""), [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10_000); return () => clearInterval(t); }, []);
  const now = Date.now() + live.offset, pos = live.state?.positions ?? [], flags = liveFlags(trail, now), lead = live.state?.relay.leadId;
  const route = routes.find((r) => r.id === routeId);
  const pts: LatLon[] = [...pos, ...(route?.points ?? [])];
  const contactFor = (key: string) => { const r = s.runners.find((x) => relayKey(x) === key), m = members.find((x) => x.id === r?.memberId); return m?.emergency?.phone ? m.emergency : m?.guardian?.phone ? m.guardian : undefined; };
  let svg = null;
  if (pts.length) {
    const lat0 = pts[0].lat, kx = Math.cos((lat0 * Math.PI) / 180), X = (p: LatLon) => p.lon * kx, Y = (p: LatLon) => -p.lat;
    const xs = pts.map(X), ys = pts.map(Y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 0.002), pad = span * 0.12, r = span / 45;
    svg = (
      <svg className="ipac-map" viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`} role="img" aria-label={`Map with ${pos.length} runner${pos.length === 1 ? "" : "s"}`}>
        {route && <polyline points={route.points.map((p) => `${X(p)},${Y(p)}`).join(" ")} fill="none" className="ipac-maproute" strokeWidth={r / 2} />}
        {pos.map((p) => (
          <g key={p.runnerId}>
            <circle cx={X(p)} cy={Y(p)} r={r} className={flags[p.runnerId] ? "ipac-mapdot-alert" : p.runnerId === lead ? "ipac-mapdot-lead" : "ipac-mapdot"} strokeWidth={r / 3} />
            <text x={X(p)} y={Y(p) - r * 1.5} fontSize={r * 1.6} textAnchor="middle" className="ipac-maplabel">{p.runnerId}</text>
          </g>))}
      </svg>);
  }
  const alerts = Object.entries(flags);
  return (
    <section className="ipac-card">
      <h2>Live map</h2>
      {routes.length > 0 && <select aria-label="Show a saved route" value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">No route shown</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
      {svg ? <ClubMap label={`Live map with ${pos.length} runner${pos.length === 1 ? "" : "s"}`} fallback={svg} line={route?.points}
        markers={pos.map((p) => ({ id: p.runnerId, lat: p.lat, lon: p.lon, label: p.runnerId, kind: flags[p.runnerId] ? "alert" : p.runnerId === lead ? "lead" : "dot" }))} />
        : <p className="ipac-empty">Runners appear here when they join the room, pick their name and turn on GPS tracking.</p>}
      {alerts.length > 0 && (
        <div className="ipac-safety" role="alert"><h2>Check on {alerts.length}</h2><ul>{alerts.map(([k, f]) => {
          const c = contactFor(k);
          return <li key={k}><b>{name(k)}</b><span>{f === "stopped" ? "Has not moved for 3 minutes" : "No GPS signal for 2 minutes"}</span>
            {c ? <span className="ipac-contact">Emergency contact: {c.name} · <span className="ipac-phone">{c.phone}</span> <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>Call</a></span> : <span>No emergency contact saved.</span>}</li>;
        })}</ul></div>)}
      {pos.length > 0 && <ul className="ipac-roster">{pos.map((p) => (
        <li key={p.runnerId}><span className="ipac-who"><b>{name(p.runnerId)}{p.runnerId === lead ? " · in front" : ""}</b><small>Seen {Math.max(0, Math.round((now - p.at) / 1000))} s ago</small></span></li>))}</ul>}
      <p className="ipac-hint">A stopped or silent runner may simply be resting or out of signal. Check before you worry.</p>
    </section>
  );
}

const smoothSource = (fixes: TrackPoint[]) => trackRun(fixes).points;
/** Track set-up: pick a lane; learn the track once from one lap of GPS. */
function TrackPanel({ place, lane, setLane, learn, forget, msg }: { place: TrackPlace | null; lane: number; setLane: (l: number) => void; learn: () => void; forget: () => void; msg: string }) {
  return (
    <div className="ipac-trackpanel">
      <label>Lane<select aria-label="Lane" value={lane} onChange={(e) => setLane(+e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map((l) => <option key={l} value={l}>Lane {l} · {lapLength(l).toFixed(2)} m a lap</option>)}</select></label>
      {place ? <p className="ipac-hint">Track learned. Distance comes from where you are on the track, so it stays accurate lap after lap. Laps count by themselves from where you start.</p>
        : <p className="ipac-hint">First time on this track: turn on GPS, run one full lap in lane 1, then tap Learn this track. You only do this once.</p>}
      <div className="ipac-row2">
        <button className="ipac-btn ipac-btn-primary" onClick={learn}>{place ? "Learn it again" : "Learn this track"}</button>
        {place && <button className="ipac-btn ipac-btn-quiet" onClick={forget}>Forget track</button>}
      </div>
      {msg && <p role="status" className="ipac-hint">{msg}</p>}
      <p className="ipac-hint">Made for standard 400 m tracks. Lane lengths follow World Athletics rules.</p>
    </div>
  );
}
