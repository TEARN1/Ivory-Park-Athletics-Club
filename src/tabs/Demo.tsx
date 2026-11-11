import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_RUNNERS, demoPositions } from "../lib/demo";
import type { LatLon, TrackPoint } from "../lib/geo";
import { addPositions, liveFlags, type Seen, type Trail } from "../lib/livemap";
import { DEFAULT_HUB } from "../lib/routes";
import { fmtTime } from "../lib/session";
import { fmtMetres } from "../lib/tracker";
import { trackDistance, trackOutline, type TrackPlace } from "../lib/trackmode";
import ClubMap from "./ClubMap";

/** Try the map, automatic laps and safety flags with example runners on a demo track. Nothing is sent anywhere. */
export default function Demo() {
  const [place, setPlace] = useState<Pick<TrackPlace, "center" | "bearing">>({ center: DEFAULT_HUB, bearing: 0 });
  const [running, setRunning] = useState(false), [x, setX] = useState(5), [sec, setSec] = useState(0), [msg, setMsg] = useState("");
  const [pos, setPos] = useState<Seen[]>([]), [trail, setTrail] = useState<Trail>({}), hist = useRef<Record<string, TrackPoint[]>>({});
  const outline = useMemo(() => trackOutline(place), [place]);
  const reset = () => { setRunning(false); setSec(0); setPos([]); setTrail({}); hist.current = {}; };
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => {
      const n = s + x, at = n * 1000, p = demoPositions(place, n, at);
      for (const q of p) (hist.current[q.runnerId] ??= []).push({ lat: q.lat, lon: q.lon, t: at, acc: 3 });
      setPos(p); setTrail((tr) => addPositions(tr, p, at, 600_000)); return n;
    }), 1000);
    return () => clearInterval(t);
  }, [running, x, place]);
  const flags = liveFlags(trail, sec * 1000);
  const rows = DEMO_RUNNERS.map((r) => { const d = trackDistance(hist.current[r.bib] ?? [], place); return { ...r, dist: d.distanceM, laps: d.laps, flag: flags[r.bib] }; }).sort((a, b) => b.dist - a.dist);
  const useMe = () => navigator.geolocation?.getCurrentPosition((p) => { reset(); setPlace({ center: { lat: p.coords.latitude, lon: p.coords.longitude }, bearing: 0 }); setMsg("Demo track placed where you are."); },
    () => setMsg("Could not read your location, so the demo stays at the club hub."), { enableHighAccuracy: false, timeout: 10000 });
  return (
    <>
      <section className="ipac-card">
        <h2>Demo track</h2>
        <p className="ipac-hint">Six example runners (not real people) on a 400 m track, so you can try the map, automatic laps and safety alerts. Runner E stops after 90 seconds to show a "check on" alert. Nothing is sent anywhere.</p>
        <div className="ipac-row2">
          <button className="ipac-btn ipac-btn-hero ipac-demo-go" onClick={() => setRunning(!running)}>{running ? "Pause" : sec ? "Carry on" : "Start the demo"}</button>
        </div>
        <div className="ipac-seg" role="group" aria-label="Demo speed">{[1, 5, 20].map((v) => <button key={v} aria-pressed={x === v} onClick={() => setX(v)}>{v}× speed</button>)}</div>
        <div className="ipac-row2">
          <button className="ipac-btn ipac-btn-outline" onClick={useMe}>Put the track where I am</button>
          <button className="ipac-btn ipac-btn-quiet" onClick={() => { reset(); setPlace({ ...place, bearing: (place.bearing + 30) % 180 }); }}>Turn the track</button>
          {sec > 0 && <button className="ipac-btn ipac-btn-quiet" onClick={reset}>Reset</button>}
        </div>
        {msg && <p role="status" className="ipac-hint">{msg}</p>}
        <p className="ipac-demo-clock" role="timer">{fmtTime(sec * 1000)}</p>
        <ClubMap label="Demo track map" line={outline} fallback={<DemoDrawing outline={outline} pos={pos} flags={flags} />}
          markers={pos.map((p) => ({ id: p.runnerId, lat: p.lat, lon: p.lon, label: p.runnerId, kind: flags[p.runnerId] ? "alert" : p.runnerId === rows[0]?.bib ? "lead" : "dot" }))} />
      </section>
      {Object.keys(flags).length > 0 && (
        <section className="ipac-safety" role="alert"><h2>Check on {Object.keys(flags).length}</h2>
          <ul>{Object.entries(flags).map(([b, f]) => <li key={b}><b>#{b} {DEMO_RUNNERS.find((r) => r.bib === b)?.name}</b><span>{f === "stopped" ? "Has not moved for 3 minutes" : "No GPS signal for 2 minutes"}</span><span>In real use, their emergency contact shows here.</span></li>)}</ul>
        </section>)}
      <section className="ipac-card">
        <h2>Standings</h2>
        <ol className="ipac-board">{rows.map((r, i) => (
          <li key={r.bib} className={i === 0 && r.dist > 0 ? "ipac-pod ipac-pod-1" : ""}>
            <span className="ipac-rank">#{r.bib}</span>
            <span className="ipac-who"><b>{r.name}{r.flag ? " · check on" : ""}</b><small>{r.laps.length} lap{r.laps.length === 1 ? "" : "s"}{r.laps.length ? ` · last ${fmtTime(r.laps[r.laps.length - 1].ms, true)}` : ""}</small></span>
            <span className="ipac-time">{fmtMetres(r.dist)}</span>
          </li>))}</ol>
        <p className="ipac-hint">Distances and laps here use the same track maths as real runs, on positions with about 3 m of GPS-like wobble added.</p>
      </section>
    </>
  );
}

function DemoDrawing({ outline, pos, flags }: { outline: LatLon[]; pos: Seen[]; flags: Record<string, string> }) {
  const lat0 = outline[0].lat, k = Math.cos((lat0 * Math.PI) / 180), X = (p: LatLon) => p.lon * k, Y = (p: LatLon) => -p.lat;
  const xs = outline.map(X), ys = outline.map(Y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY), pad = span * 0.12, r = span / 30;
  return (
    <svg className="ipac-map" viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`} role="img" aria-label={`Demo track with ${pos.length} runners`}>
      <polyline points={outline.map((p) => `${X(p)},${Y(p)}`).join(" ")} fill="none" className="ipac-maproute" strokeWidth={r * 1.4} />
      {pos.map((p) => <g key={p.runnerId}><circle cx={X(p)} cy={Y(p)} r={r} className={flags[p.runnerId] ? "ipac-mapdot-alert" : "ipac-mapdot"} strokeWidth={r / 3} />
        <text x={X(p)} y={Y(p) - r * 1.5} fontSize={r * 1.6} textAnchor="middle" className="ipac-maplabel">{p.runnerId}</text></g>)}
    </svg>
  );
}
