import { useEffect, useRef, useState } from "react";
import { splits, trackDistanceM } from "../lib/geo";
import { useLive, wsUrl } from "../lib/live";
import * as S from "../lib/session";
import { fmtPace } from "../lib/session";
import type { Config } from "../lib/store";

/** Relay key shared across devices (local runner ids differ per device). */
export const relayKey = (r: S.Runner) => r.bib || r.name;

export default function Live({ s, act, cfg, running }: { s: S.Session; act: (f: (x: S.Session) => S.Session) => void; cfg: Config; running: boolean }) {
  const [room, setRoom] = useState(s.room ?? ""), [me, setMe] = useState(""), [joined, setJoined] = useState(false), [gps, setGps] = useState(false), [gpsErr, setGpsErr] = useState("");
  const url = joined && cfg.serverUrl && room ? wsUrl(cfg.serverUrl, room, me, cfg.token) : null;
  const live = useLive(url);
  const lead = live.state?.relay.leadId, offered = live.state?.relay.offeredBy;
  const mine = s.runners.find((r) => relayKey(r) === me);
  const sRef = useRef(s); sRef.current = s;
  const leadRef = useRef(lead); leadRef.current = lead;

  useEffect(() => {
    if (!gps) return;
    if (!("geolocation" in navigator)) { setGpsErr("This device has no GPS."); setGps(false); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = sRef.current, r = cur.runners.find((x) => relayKey(x) === me);
        if (cur.startedAt === undefined || !r) return;
        setGpsErr(""); const pt = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now() - cur.startedAt };
        act((x) => S.addTrackPoint(x, r.id, pt));
        if (leadRef.current === me) live.send({ type: "pos", lat: pt.lat, lon: pt.lon });
      },
      (e) => { // only permission loss stops tracking; a missing fix is temporary and the watch keeps trying
        if (e.code === 1) { setGpsErr("Location permission was denied."); setGps(false); } else setGpsErr("Searching for a GPS signal…");
      },
      { enableHighAccuracy: true, maximumAge: 2000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [gps, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = mine ? s.tracks?.[mine.id] ?? [] : [], sp = splits(track);
  const name = (k?: string) => { const r = s.runners.find((x) => relayKey(x) === k); return r ? S.label(r) : k ?? "nobody"; };
  const whoAmI = (
    <label>Who am I?
      <select value={me} onChange={(e) => setMe(e.target.value)} disabled={joined}>
        <option value="">{cfg.serverUrl ? "Coach / watching only" : "Pick your name"}</option>
        {s.runners.map((r) => <option key={r.id} value={relayKey(r)}>{S.label(r)}</option>)}
      </select>
    </label>
  );
  if (!cfg.serverUrl) return <section><p className="ipac-hint">Live relay needs the club server. Add its address in the Club tab. GPS tracking works without it.</p>{whoAmI}{gpsPanel()}</section>;

  function gpsPanel() {
    return (
      <div className="ipac-card">
        <label><input type="checkbox" checked={gps} disabled={!mine} onChange={(e) => { setGpsErr(""); setGps(e.target.checked); }} /> Track my run with GPS</label>
        {gpsErr && <p role="alert" className="ipac-err">{gpsErr}</p>}
        {mine && <p>{(trackDistanceM(track) / 1000).toFixed(2)} km · {track.length} points{!running && " (starts when the timer starts)"}</p>}
        {sp.length > 0 && <ol>{sp.map((x) => <li key={x.km}>{x.partial ? "last part" : `km ${x.km}`}: {S.fmtTime(x.ms)} ({fmtPace(x.paceSecPerKm)})</li>)}</ol>}
        <p className="ipac-hint">GPS points stay on this device and are not uploaded.</p>
      </div>
    );
  }
  return (
    <section>
      <div className="ipac-form">
        {whoAmI}
        <label>Room code<input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} maxLength={8} disabled={joined} placeholder="e.g. IPARK" /></label>
        <button className="ipac-btn ipac-btn-primary" onClick={() => { setJoined(!joined); act((x) => ({ ...x, room })); }} disabled={!room}>{joined ? "Leave room" : "Join room"}</button>
      </div>
      {joined && <p aria-live="polite">Connection: {live.status}{live.error && <span className="ipac-err"> · {live.error}</span>}</p>}
      {live.state && (
        <div className="ipac-card">
          <div className="ipac-lead"><small>In front</small><b>{name(lead)}</b></div>
          {offered && <p role="status" className="ipac-banner">{name(offered)} is passing the lead. Tap Take to run in front.</p>}
          <div className="ipac-relay">
            <button className="ipac-pass" disabled={!me || lead !== me || !!offered} onClick={() => live.send({ type: "pass" })}>Pass Over</button>
            <button className="ipac-take" disabled={!me || !offered || lead === me} onClick={() => live.send({ type: "take" })}>Take</button>
          </div>
          {cfg.token && <div className="ipac-actions">
            <button onClick={() => live.send({ type: "start" })}>Start room clock</button>{" "}
            <select aria-label="Set lead" value="" onChange={(e) => e.target.value && live.send({ type: "setLead", runnerId: e.target.value })}>
              <option value="">Set lead…</option>{s.runners.map((r) => <option key={r.id} value={relayKey(r)}>{S.label(r)}</option>)}
            </select></div>}
          {live.state.beacon && <p className="ipac-hint">Beacon from {name(live.state.beacon.runnerId)}: {live.state.beacon.lat.toFixed(5)}, {live.state.beacon.lon.toFixed(5)}</p>}
          <p className="ipac-hint">Who is in the room: {(live.state.runners as string[]).map(name).join(", ") || "no runners yet"}</p>
        </div>
      )}
      {gpsPanel()}
    </section>
  );
}
