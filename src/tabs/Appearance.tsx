import { useState } from "react";
import { COUNTDOWNS, DEFAULT_DISTANCES, PALETTES, QUIET_AFTER, SAFETY_PACES, TIME_CALLS, parseDistances, type Mode, type Prefs, type SoundPrefs } from "../lib/prefs";
import { beep, say } from "../lib/sound";

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

/** Race-day sound, voice and safety settings. Everything can be turned down or off. */
export function SoundSettings({ prefs, setPrefs }: { prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  const s = prefs.sound, set = (patch: Partial<SoundPrefs>) => setPrefs({ ...prefs, sound: { ...s, ...patch } });
  const seg = (label: string, values: number[], cur: number, fmt: (v: number) => string, key: keyof SoundPrefs) => (
    <><p className="ipac-label">{label}</p>
      <div className="ipac-seg ipac-seg-wrap" role="group" aria-label={label}>{values.map((v) => <button key={v} aria-pressed={cur === v} onClick={() => set({ [key]: v } as Partial<SoundPrefs>)}>{fmt(v)}</button>)}</div></>);
  const tog = (key: "beeps" | "voice" | "finishes" | "laps", label: string, disabled = false) => (
    <label className="ipac-check"><input type="checkbox" checked={s[key]} disabled={disabled} onChange={(e) => set({ [key]: e.target.checked })} /> {label}</label>);
  return (
    <section className="ipac-card">
      <h2>Sound and voice</h2>
      {seg("Countdown before the start", COUNTDOWNS, s.countdownSec, (v) => (v ? `${v} s` : "Off"), "countdownSec")}
      {tog("beeps", "Beeps")}
      {tog("voice", "Voice announcements")}
      {tog("finishes", "Say name, place and time at the finish", !s.voice)}
      {tog("laps", "Say lap and rep times, with target pace", !s.voice)}
      {seg("Call out the race time", TIME_CALLS, s.timeCallMin, (v) => (v ? `Every ${v} min` : "Never"), "timeCallMin")}
      {s.timeCallMin > 0 && seg("Stop calling the time after", QUIET_AFTER, s.quietAfterMin, (v) => (v ? `${v} min` : "Never stop"), "quietAfterMin")}
      <p className="ipac-hint">Time calls can feel like nagging on long runs. Call less often, stop after a while, or switch them off.</p>
      <button className="ipac-btn ipac-btn-outline" onClick={() => { if (s.beeps) beep(); if (s.voice) say("Thandi, first, 18 minutes 42 seconds"); }}>Test sound</button>
      <h2 className="ipac-h2gap">Safety</h2>
      {seg("Flag a runner still out slower than", SAFETY_PACES, s.safetyPaceSec, (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}/km`, "safetyPaceSec")}
      <p className="ipac-hint">Runners are also flagged when most of the group is home and they are well behind the last finisher. Their emergency contact shows on the timer screen.</p>
    </section>
  );
}
