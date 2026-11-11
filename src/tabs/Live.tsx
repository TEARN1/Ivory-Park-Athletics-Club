import { useEffect, useRef, useState } from "react";
import type * as C from "../lib/club";
import { splits, trackDistanceM, type LatLon } from "../lib/geo";
import type { LiveJoin, useLive } from "../lib/live";
import { liveFlags, type Trail } from "../lib/livemap";
import type { Route } from "../lib/routes";
import * as S from "../lib/session";
import type { Config } from "../lib/store";

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
  const lastSent = useRef(0);

  useEffect(() => {
    if (!gps) return;
    if (!("geolocation" in navigator)) { setGpsErr("This device has no GPS."); setGps(false); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = sRef.current, r = cur.runners.find((x) => relayKey(x) === myKey);
        setGpsErr("");
        if (Date.now() - lastSent.current > 5000) { lastSent.current = Date.now(); sendRef.current({ type: "pos", lat: p.coords.latitude, lon: p.coords.longitude }); } // shared with the coach's map
        if (cur.startedAt === undefined || !r) return;
        act((x) => S.addTrackPoint(x, r.id, { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now() - cur.startedAt! }));
      },
      (e) => { // only permission loss stops tracking; a missing fix is temporary and the watch keeps trying
        if (e.code === 1) { setGpsErr("Location permission was denied."); setGps(false); } else setGpsErr("Searching for a GPS signal…");
      },
      { enableHighAccuracy: true, maximumAge: 2000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [gps, myKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (k?: string) => { const r = s.runners.find((x) => relayKey(x) === k); return r ? S.label(r) : k ? `#${k}` : "nobody"; };
  const track = mine ? s.tracks?.[mine.id] ?? [] : [], sp = splits(track);
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
      {mine && <p>{(trackDistanceM(track) / 1000).toFixed(2)} km · {track.length} points{!running && " (distance starts when the timer starts)"}</p>}
      {sp.length > 0 && <ol>{sp.map((x) => <li key={x.km}>{x.partial ? "last part" : `km ${x.km}`}: {S.fmtTime(x.ms)} ({S.fmtPace(x.paceSecPerKm)})</li>)}</ol>}
      <p className="ipac-hint">Your GPS trail stays on this phone. Only your latest position is shared while you are in a live room.</p>
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
      {svg ?? <p className="ipac-empty">Runners appear here when they join the room, pick their name and turn on GPS tracking.</p>}
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
