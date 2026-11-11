import { useEffect, useMemo, useState } from "react";
import { DEFAULT_HUB, MAX_VARIANTS, generateLoops, reroute, type Route } from "../lib/routes";
import { loadRoutes, saveRoutes } from "../lib/store";

const COMPASS = [["North", 0], ["North-east", 45], ["East", 90], ["South-east", 135], ["South", 180], ["South-west", 225], ["West", 270], ["North-west", 315]] as const;

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

export default function Routes() {
  const [km, setKm] = useState(5), [hub, setHub] = useState(DEFAULT_HUB), [loops, setLoops] = useState<Route[]>([]), [i, setI] = useState(0);
  const [blocked, setBlocked] = useState(""), [name, setName] = useState(""), [saved, setSaved] = useState<Route[]>([]), [msg, setMsg] = useState("");
  useEffect(() => { loadRoutes().then(setSaved); }, []);
  const cur = loops[i] as Route | undefined;
  const shown = useMemo(() => cur, [cur]);
  const gen = () => { try { const l = generateLoops(hub, km); setLoops(l); setI(0); setMsg(""); } catch (e) { setMsg((e as Error).message); } };
  const doReroute = () => {
    if (!cur) return;
    const n = reroute(loops, cur, blocked === "" ? undefined : +blocked);
    if (!n) return setMsg("No other loop avoids that direction. Try a different direction.");
    setI(loops.findIndex((r) => r.id === n.id)); setMsg("");
  };
  const persist = (r: Route[]) => { setSaved(r); saveRoutes(r); };
  return (
    <section className="ipac-card">
      <h2>Route planner</h2>
      <p className="ipac-hint">Guide loops are drawn as straight legs from the club hub and are not checked against real roads. Walk or drive a loop and adjust it before the group runs it.</p>
      <div className="ipac-chips" role="group" aria-label="Target distance">
        {[3, 5, 10, 15, 21.1, 42.2].map((d) => <button key={d} className="ipac-chip" aria-pressed={km === d} onClick={() => setKm(d)}>{d} km</button>)}
        <label className="ipac-other">Other<input type="number" inputMode="decimal" min={0.5} max={100} step={0.5} value={km} aria-label="Target distance (km)" onChange={(e) => setKm(+e.target.value)} /></label>
      </div>
      <details className="ipac-more-routes">
        <summary>Start and finish point</summary>
        <div className="ipac-form">
          <label>Hub latitude<input type="number" step="any" value={hub.lat} onChange={(e) => setHub({ ...hub, lat: +e.target.value })} /></label>
          <label>Hub longitude<input type="number" step="any" value={hub.lon} onChange={(e) => setHub({ ...hub, lon: +e.target.value })} /></label>
          <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setHub({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setMsg("Could not read your location."))}>Use my location as the hub</button>
        </div>
      </details>
      <button className="ipac-btn ipac-btn-hero" onClick={gen}>Generate {MAX_VARIANTS} loops</button>
      {msg && <p role="alert" className="ipac-err">{msg}</p>}
      {shown && (
        <div className="ipac-card">
          <RouteMap r={shown} />
          <p><b>{shown.name}</b> · {(shown.lengthM / 1000).toFixed(2)} km · option {i + 1} of {loops.length}</p>
          <div className="ipac-actions">
            <button onClick={() => setI((i + loops.length - 1) % loops.length)}>Previous</button>{" "}
            <button onClick={() => setI((i + 1) % loops.length)}>Next</button>
          </div>
          <div className="ipac-form">
            <label>Road blocked towards
              <select value={blocked} onChange={(e) => setBlocked(e.target.value)}>
                <option value="">Anywhere (just give me another)</option>
                {COMPASS.map(([n, b]) => <option key={b} value={b}>{n}</option>)}
              </select>
            </label>
            <button className="ipac-btn ipac-btn-hero" onClick={doReroute}>Reroute</button>
            <input aria-label="Route name" placeholder="Name, e.g. Ivory Park 5k Loop" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="ipac-btn ipac-btn-outline" disabled={!name.trim()} onClick={() => { persist([...saved, { ...shown, id: crypto.randomUUID(), name: name.trim() }]); setName(""); }}>Save this route</button>
          </div>
        </div>
      )}
      {saved.length > 0 && <><h2>Saved routes</h2><ul className="ipac-list">{saved.map((r) => (
        <li key={r.id}>{r.name} · {(r.lengthM / 1000).toFixed(2)} km
          <button aria-label={`Show ${r.name}`} onClick={() => { setLoops([r]); setI(0); }}>Show</button>
          <button aria-label={`Delete ${r.name}`} onClick={() => persist(saved.filter((x) => x.id !== r.id))}>×</button></li>))}</ul></>}
    </section>
  );
}
