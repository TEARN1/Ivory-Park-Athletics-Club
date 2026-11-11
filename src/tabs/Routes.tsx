import { useEffect, useMemo, useState } from "react";
import { DEFAULT_HUB, DEFAULT_ROUTER, MAX_VARIANTS, followRoads, generateLoops, reroute, type Route } from "../lib/routes";
import { loadRoutes, saveRoutes } from "../lib/store";
import ClubMap from "./ClubMap";

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

export default function Routes({ distances, router }: { distances: number[]; router?: string }) {
  const [km, setKm] = useState(5), [hub, setHub] = useState(DEFAULT_HUB), [loops, setLoops] = useState<Route[]>([]), [i, setI] = useState(0);
  const [blocked, setBlocked] = useState(""), [name, setName] = useState(""), [saved, setSaved] = useState<Route[]>([]), [msg, setMsg] = useState("");
  useEffect(() => { loadRoutes().then(setSaved); }, []);
  const cur = loops[i] as Route | undefined, [roadBusy, setRoadBusy] = useState(false);
  const roads = async () => {
    if (!cur) return; setRoadBusy(true); setMsg("");
    try { const r = await followRoads(cur.hub, cur.targetKm, cur.variant, router || DEFAULT_ROUTER, (u) => fetch(u).then((x) => x.json())); setLoops(loops.map((x, k) => (k === i ? r : x))); }
    catch (e) { setMsg((e as Error).message); } finally { setRoadBusy(false); }
  };
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
        {distances.map((d) => <button key={d} className="ipac-chip" aria-pressed={km === d} onClick={() => setKm(d)}>{d} km</button>)}
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
          <ClubMap key={shown.id} label={`Map of ${shown.name}`} fallback={<RouteMap r={shown} />} line={shown.points} markers={[{ id: "hub", ...shown.hub, label: "Start", kind: "hub" }]} />
          <p><b>{shown.name}</b> · {(shown.lengthM / 1000).toFixed(2)} km · option {i + 1} of {loops.length}</p>
          <p className="ipac-hint">{shown.roads ? "Follows roads and paths from OpenStreetMap. Still walk it once to check traffic and safety." : "Straight-line guide. Tap Follow roads to fit it to real roads and paths."}</p>
          {!shown.roads && <button className="ipac-btn ipac-btn-outline" disabled={roadBusy} onClick={roads}>{roadBusy ? "Finding roads…" : "Follow roads"}</button>}
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
        <li key={r.id}><span className="ipac-who"><b>{r.name} · {(r.lengthM / 1000).toFixed(2)} km</b><small>{r.roads ? "Follows roads" : "Straight-line guide"} · {r.checkedAt ? `checked and safe (${new Date(r.checkedAt).toLocaleDateString()})` : "not checked yet"}</small></span>
          <button className="ipac-btn ipac-btn-quiet" aria-label={r.checkedAt ? `Unmark ${r.name} as checked` : `Mark ${r.name} as checked and safe`} onClick={() => persist(saved.map((x) => (x.id === r.id ? { ...x, checkedAt: x.checkedAt ? undefined : Date.now() } : x)))}>{r.checkedAt ? "Unmark" : "Checked"}</button>
          <button aria-label={`Show ${r.name}`} onClick={() => { setLoops([r]); setI(0); }}>Show</button>
          <button aria-label={`Delete ${r.name}`} onClick={() => persist(saved.filter((x) => x.id !== r.id))}>×</button></li>))}</ul></>}
    </section>
  );
}
