import { useCallback, useEffect, useRef, useState } from "react";
import logo from "./assets/logo.jpg";
import { assignBibs, closeProgram, fetchJoiners, parseJoinParams } from "./lib/join";
import type { Notice } from "./lib/live";
import { applyPrefs, defaultPrefs, type Prefs } from "./lib/prefs";
import * as S from "./lib/session";
import { archive, flushOutbox, loadConfig, loadPrefs, loadSession, pendingCount, savePrefs, saveSession, type Config } from "./lib/store";
import Club from "./tabs/Club";
import JoinPanel from "./tabs/JoinPanel";
import Live from "./tabs/Live";
import Routes from "./tabs/Routes";
import Session from "./tabs/Session";
import Today from "./tabs/Today";
import { Confirm, Icons } from "./ui";

type Tab = "today" | "session" | "live" | "routes" | "club";
const NAV: [Tab, string][] = [["today", "Today"], ["session", "Session"], ["live", "Live"], ["routes", "Routes"], ["club", "Club"]];
const PHASE_LABEL = { setup: "Setting up", running: "Race on", done: "Finished" };
const STAGES: [S.Phase, string][] = [["setup", "Set up"], ["running", "Race on"], ["done", "Results"]];
const deepLink = parseJoinParams(location.search);
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export default function App() {
  const [s, setS] = useState<S.Session | null>(null), [tab, setTab] = useState<Tab>(deepLink ? "today" : "session"), [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(""), [pending, setPending] = useState(0), [cfg, setCfg] = useState<Config>({ serverUrl: "", token: "" }), [notices, setNotices] = useState<Notice[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs()), [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string; undo?: () => void } | null>(null);
  const ref = useRef<S.Session | null>(null), tid = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadSession().then((x) => { const v = x ?? S.newSession(); ref.current = v; setS(v); });
    loadConfig().then((c) => { setCfg(c); if (!deepLink && !c.token && c.serverUrl) setTab("today"); });
    loadPrefs().then((p) => { setPrefsState(p); applyPrefs(p); });
  }, []);
  const setPrefs = (p: Prefs) => { setPrefsState(p); applyPrefs(p); savePrefs(p); };
  const isNight = prefs.mode === "dark" || (prefs.mode === "auto" && prefersDark());
  useEffect(() => { if (s) saveSession(s); }, [s]);
  const ph = s ? S.phase(s) : "setup", prog = s?.program?.code;
  useEffect(() => { if (ph !== "running") return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [ph]);
  useEffect(() => {
    const sync = () => flushOutbox().then((r) => setPending(r.pending));
    pendingCount().then(setPending); sync(); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync);
  }, [cfg]);
  useEffect(() => {
    if (!cfg.serverUrl) return;
    const pull = () => fetch(cfg.serverUrl.replace(/\/$/, "") + "/notices").then((r) => r.json()).then(setNotices).catch(() => {});
    pull(); const t = setInterval(pull, 60000); return () => clearInterval(t);
  }, [cfg.serverUrl]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 5000); return () => clearTimeout(t); }, [err]);
  useEffect(() => { if (ph !== "running") setToast(null); }, [ph]);
  useEffect(() => { if (!sheet) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [sheet]);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(tid.current); setToast({ id: Date.now(), msg, undo }); tid.current = setTimeout(() => setToast(null), 6000);
  }, []);

  // Coach: pull in people who joined through the link or QR, and give each the next free bib.
  useEffect(() => {
    if (!prog || !cfg.serverUrl || !cfg.token) return;
    const tick = async () => {
      if (!ref.current || S.phase(ref.current) !== "setup") return;
      try {
        const plan = S.planJoins(ref.current, await fetchJoiners(cfg.serverUrl, cfg.token, prog));
        if (!Object.keys(plan.assignments).length) return;
        if (plan.added) { ref.current = plan.session; setS(plan.session); showToast(`${plan.added} runner${plan.added > 1 ? "s" : ""} joined`); }
        await assignBibs(cfg.serverUrl, cfg.token, prog, plan.assignments);
      } catch { /* offline or server asleep: try again in a few seconds */ }
    };
    tick(); const t = setInterval(tick, 5000); return () => clearInterval(t);
  }, [prog, cfg.serverUrl, cfg.token, showToast]);
  // Joining closes when the race starts.
  useEffect(() => {
    if (!prog || ph === "setup") return;
    if (cfg.serverUrl && cfg.token) closeProgram(cfg.serverUrl, cfg.token, prog).catch(() => {});
    const n = S.setProgram(ref.current!); ref.current = n; setS(n);
  }, [prog, ph]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <p className="ipac-loading">Loading…</p>;
  // Compute from a ref so async callbacks (GPS, polling) never use a stale session.
  const act = (fn: (x: S.Session) => S.Session) => { try { const n = fn(ref.current!); ref.current = n; setS(n); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const onEnd = async (ended: S.Session) => { act(() => ended); await archive(ended); setPending(await pendingCount()); flushOutbox().then((r) => setPending(r.pending)); };
  const onNew = (keep: boolean) => { const n = S.nextSession(s, keep); ref.current = n; setS(n); setTab("session"); setSheet(false); window.scrollTo(0, 0); };
  const go = (t: Tab) => { setTab(t); setSheet(false); window.scrollTo(0, 0); };
  const joinPanel = (bare?: boolean) => <JoinPanel s={s} act={act} cfg={cfg} bare={bare} />;

  return (
    <div className="ipac-shell">
      <header className="ipac-head"><div className="ipac-head-in">
        <img className="ipac-logo" src={logo} alt="Ivory Park Athletics Club logo" />
        <div className="ipac-title"><h1>Ivory Park Athletics Club</h1><p>{s.date} · {s.distanceKm} km</p></div>
        <button className="ipac-themebtn" aria-label={isNight ? "Switch to day theme" : "Switch to night theme"} onClick={() => setPrefs({ ...prefs, mode: isNight ? "light" : "dark" })}>{isNight ? Icons.sun : Icons.moon}</button>
      </div>
        <button className={`ipac-status ipac-status-${ph}`} aria-haspopup="dialog" aria-label={`Session status: ${PHASE_LABEL[ph]}. Open options`} onClick={() => setSheet(true)}>
          <span className="ipac-dot" aria-hidden="true" />
          <b>{PHASE_LABEL[ph]}</b>
          <span>{ph === "running" ? `${S.fmtTime(now - s.startedAt!)} · ${S.standings(s).length}/${s.runners.length} home` : `${s.runners.length} runner${s.runners.length === 1 ? "" : "s"}${prog ? " · open to join" : ""}`}</span>
          <span className="ipac-chev" aria-hidden="true">Options ▾</span>
        </button>
      </header>

      <main className="ipac-main">
        {err && <p role="alert" className="ipac-err">{err}</p>}
        <div hidden={tab !== "today"}><Today cfg={cfg} deepLink={deepLink} /></div>
        <div hidden={tab !== "session"}><Session s={s} act={act} now={now} pending={pending} serverOn={!!(cfg.serverUrl && cfg.token)} toast={showToast} onEnd={onEnd} onNew={onNew} distances={prefs.distances} joinSlot={joinPanel()} /></div>
        <div hidden={tab !== "live"}><Live s={s} act={act} cfg={cfg} running={ph === "running"} /></div>
        <div hidden={tab !== "routes"}><Routes distances={prefs.distances} /></div>
        <div hidden={tab !== "club"}><Club cfg={cfg} setCfg={setCfg} notices={notices} prefs={prefs} setPrefs={setPrefs} /></div>
      </main>

      {toast && (
        <div className="ipac-toast" role="status" aria-live="polite" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}

      {sheet && (
        <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="ipac-sheet" role="dialog" aria-modal="true" aria-label="Session status">
            <div className="ipac-sheet-head"><h2>Session status</h2><button className="ipac-btn ipac-btn-quiet" autoFocus aria-label="Close session status" onClick={() => setSheet(false)}>Close</button></div>
            <ol className="ipac-stages" aria-label="Stages">{STAGES.map(([k, l], i) => <li key={k} aria-current={k === ph ? "step" : undefined} className={STAGES.findIndex(([x]) => x === ph) > i ? "ipac-stage-done" : ""}>{l}</li>)}</ol>
            {ph === "setup" && (<>
              <p className="ipac-hint">{s.runners.length ? `${s.runners.length} runner${s.runners.length > 1 ? "s are" : " is"} ready.` : "Add runners, or open the run for joiners, then start."}</p>
              {joinPanel(true)}
              <button className="ipac-btn ipac-btn-hero" disabled={!s.runners.length} onClick={() => { act((x) => S.start(x, Date.now())); go("session"); }}>{s.runners.length ? "Start race" : "Add a runner to start"}</button>
            </>)}
            {ph === "running" && (<>
              <p className="ipac-hint">The clock is running: {S.fmtTime(now - s.startedAt!)}. {S.stillRunning(s).length} still out.</p>
              <button className="ipac-btn ipac-btn-hero" onClick={() => go("session")}>Go to the race clock</button>
              <Confirm className="ipac-btn ipac-btn-outline ipac-btn-wide" label="End session" ask={`${S.stillRunning(s).length} still running. End anyway?`} onYes={() => { onEnd(S.endSession(s, Date.now())); go("session"); }} />
            </>)}
            {ph === "done" && (<>
              <p className="ipac-hint">The session is finished and saved on this device.</p>
              <button className="ipac-btn ipac-btn-hero" onClick={() => go("session")}>See results</button>
              <button className="ipac-btn ipac-btn-outline" onClick={() => onNew(true)}>New session, same runners</button>
            </>)}
          </div>
        </div>
      )}

      <nav className="ipac-nav" aria-label="Sections">
        {NAV.map(([t, l]) => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>{Icons[t]}<span>{l}</span></button>)}
      </nav>
    </div>
  );
}
