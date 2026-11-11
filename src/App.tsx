import { useCallback, useEffect, useRef, useState } from "react";
import logo from "./assets/logo.jpg";
import * as S from "./lib/session";
import type { Notice } from "./lib/live";
import { archive, flushOutbox, loadConfig, loadSession, pendingCount, saveSession, type Config } from "./lib/store";
import Club from "./tabs/Club";
import Live from "./tabs/Live";
import Routes from "./tabs/Routes";
import Session from "./tabs/Session";
import { Icons } from "./ui";

type Tab = "session" | "live" | "routes" | "club";
const NAV: [Tab, string][] = [["session", "Session"], ["live", "Live"], ["routes", "Routes"], ["club", "Club"]];
const PHASE_LABEL = { setup: "Setting up", running: "Race on", done: "Finished" };

export default function App() {
  const [s, setS] = useState<S.Session | null>(null), [tab, setTab] = useState<Tab>("session"), [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(""), [pending, setPending] = useState(0), [cfg, setCfg] = useState<Config>({ serverUrl: "", token: "" }), [notices, setNotices] = useState<Notice[]>([]);
  const [toast, setToast] = useState<{ id: number; msg: string; undo?: () => void } | null>(null);
  const ref = useRef<S.Session | null>(null), tid = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { loadSession().then((x) => { const v = x ?? S.newSession(); ref.current = v; setS(v); }); loadConfig().then(setCfg); }, []);
  useEffect(() => { if (s) saveSession(s); }, [s]);
  const running = s ? S.phase(s) === "running" : false;
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [running]);
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

  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(tid.current); setToast({ id: Date.now(), msg, undo }); tid.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const phNow = s ? S.phase(s) : "setup";
  useEffect(() => { if (phNow !== "running") setToast(null); }, [phNow]);
  if (!s) return <p className="ipac-loading">Loading…</p>;

  // Compute from a ref so async callbacks (GPS) never use a stale session.
  const act = (fn: (x: S.Session) => S.Session) => { try { const n = fn(ref.current!); ref.current = n; setS(n); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const ph = S.phase(s);
  const onEnd = async (ended: S.Session) => { act(() => ended); await archive(ended); setPending(await pendingCount()); flushOutbox().then((r) => setPending(r.pending)); };
  const onNew = (keep: boolean) => { const n = S.nextSession(s, keep); ref.current = n; setS(n); setTab("session"); window.scrollTo(0, 0); };

  return (
    <div className="ipac-shell">
      <header className="ipac-head"><div className="ipac-head-in">
        <img className="ipac-logo" src={logo} alt="Ivory Park Athletics Club logo" />
        <div className="ipac-title"><h1>Ivory Park Athletics Club</h1><p>{s.date} · {s.distanceKm} km · {s.runners.length} runner{s.runners.length === 1 ? "" : "s"}</p></div>
        <span className={`ipac-pill ipac-pill-${ph}`}>{PHASE_LABEL[ph]}</span>
      </div></header>

      <main className="ipac-main">
        {err && <p role="alert" className="ipac-err">{err}</p>}
        <div hidden={tab !== "session"}><Session s={s} act={act} now={now} pending={pending} serverOn={!!(cfg.serverUrl && cfg.token)} toast={showToast} onEnd={onEnd} onNew={onNew} /></div>
        <div hidden={tab !== "live"}><Live s={s} act={act} cfg={cfg} running={running} /></div>
        <div hidden={tab !== "routes"}><Routes /></div>
        <div hidden={tab !== "club"}><Club cfg={cfg} setCfg={setCfg} notices={notices} /></div>
      </main>

      {toast && tab === "session" && (
        <div className="ipac-toast" role="status" aria-live="polite" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}
      <nav className="ipac-nav" aria-label="Sections">
        {NAV.map(([t, l]) => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => { setTab(t); window.scrollTo(0, 0); }}>{Icons[t]}<span>{l}</span></button>)}
      </nav>
    </div>
  );
}
