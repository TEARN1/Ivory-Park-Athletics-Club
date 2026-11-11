import { useState } from "react";
import { DEFAULT_DISTANCES, PALETTES, parseDistances, type Mode, type Prefs } from "../lib/prefs";

const MODES: [Mode, string][] = [["auto", "Auto"], ["light", "Day"], ["dark", "Night"]];
export default function Appearance({ prefs, setPrefs }: { prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  const [text, setText] = useState(prefs.distances.join(", ")), [err, setErr] = useState(""), [saved, setSaved] = useState(false);
  const save = (list: number[]) => { setPrefs({ ...prefs, distances: list }); setText(list.join(", ")); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <section className="ipac-card">
      <h2>Appearance</h2>
      <p className="ipac-label">Day or night</p>
      <div className="ipac-seg" role="group" aria-label="Day or night">
        {MODES.map(([m, l]) => <button key={m} aria-pressed={prefs.mode === m} onClick={() => setPrefs({ ...prefs, mode: m })}>{l}</button>)}
      </div>
      <p className="ipac-label">Colours</p>
      <div className="ipac-swatches" role="group" aria-label="Colours">
        {PALETTES.map((p) => (
          <button key={p.id} className="ipac-swatch" aria-pressed={prefs.palette === p.id} onClick={() => setPrefs({ ...prefs, palette: p.id })}>
            <i style={{ background: `linear-gradient(135deg,${p.a} 0 55%,${p.b} 55%)` }} />{p.name}
          </button>))}
      </div>
      <h2 className="ipac-h2gap">Distance shortcuts</h2>
      <form onSubmit={(e) => { e.preventDefault(); try { save(parseDistances(text)); setErr(""); } catch (x) { setErr((x as Error).message); } }}>
        <label className="ipac-namefield">Distances in km, separated by commas
          <input aria-label="Distance shortcuts" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="2.4, 5, 8, 10" /></label>
        {err && <p role="alert" className="ipac-err">{err}</p>}
        <div className="ipac-row2"><button className="ipac-btn ipac-btn-primary">{saved ? "Saved" : "Save shortcuts"}</button>
          <button type="button" className="ipac-btn ipac-btn-quiet" onClick={() => { setErr(""); save(DEFAULT_DISTANCES); }}>Reset</button></div>
      </form>
      <p className="ipac-hint">These appear as buttons when you set up a run and plan routes. You can always type any other distance.</p>
    </section>
  );
}
