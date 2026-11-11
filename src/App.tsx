import { useEffect, useRef, useState } from "react";
import * as S from "./lib/session";
import type { Notice } from "./lib/live";
import { archive, flushOutbox, loadConfig, loadSession, pendingCount, saveSession, type Config } from "./lib/store";
import Club from "./tabs/Club";
import Live from "./tabs/Live";
import Results from "./tabs/Results";
import Routes from "./tabs/Routes";

type Tab = "checkin" | "timer" | "live" | "results" | "routes" | "club";
const TABS: [Tab, string][] = [["checkin", "Check-in"], ["timer", "Timer"], ["live", "Live"], ["results", "Results"], ["routes", "Routes"], ["club", "Club"]];

export default function App() {
  const [s, setS] = useState<S.Session | null>(null), [tab, setTab] = useState<Tab>("checkin"), [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(""), [pending, setPending] = useState(0), [cfg, setCfg] = useState<Config>({ serverUrl: "", token: "" }), [notices, setNotices] = useState<Notice[]>([]);
  const ref = useRef<S.Session | null>(null);

  useEffect(() => { loadSession().then((x) => { const v = x ?? S.newSession(); ref.current = v; setS(v); }); loadConfig().then(setCfg); }, []);
  useEffect(() => { if (s) saveSession(s); }, [s]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => {
    const sync = () => flushOutbox().then((r) => setPending(r.pending));
    pendingCount().then(setPending); sync(); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync);
  }, [cfg]);
  useEffect(() => {
    if (!cfg.serverUrl) return;
    const pull = () => fetch(cfg.serverUrl.replace(/\/$/, "") + "/notices").then((r) => r.json()).then(setNotices).catch(() => {});
    pull(); const t = setInterval(pull, 60000); return () => clearInterval(t);
  }, [cfg.serverUrl]);

  if (!s) return <p className="ipac-loading">Loading…</p>;
  // Compute from a ref so async callbacks (GPS) never use a stale session.
  const act = (fn: (x: S.Session) => S.Session) => { try { const n = fn(ref.current!); ref.current = n; setS(n); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const running = s.startedAt !== undefined, left = S.stillRunning(s);
  const archiveNow = async () => { await archive(s); setPending(await pendingCount()); flushOutbox().then((r) => setPending(r.pending)); const n = S.newSession(s.distanceKm); ref.current = n; setS(n); setTab("checkin"); };

  return (
    <div className="ipac-app">
      <header className="ipac-head"><h1>Ivory Park Athletics Club</h1><p>{s.date} · {s.distanceKm} km · {s.runners.length} runners</p></header>
      <nav className="ipac-tabs" aria-label="Sections">
        {TABS.map(([t, l]) => <button key={t} aria-current={tab === t} onClick={() => setTab(t)}>{l}</button>)}
      </nav>
      {err && <p role="alert" className="ipac-err">{err}</p>}
      {tab === "checkin" && <CheckIn s={s} act={act} locked={running} />}
      {tab === "timer" && (
        <section>
          <div className="ipac-clock">{running ? S.fmtTime(now - s.startedAt!) : "0:00"}</div>
          {!running
            ? <button className="ipac-big" disabled={!s.runners.length} onClick={() => act((x) => S.start(x, Date.now()))}>Start for everyone</button>
            : <p className="ipac-hint">Tap a runner when they cross the line.</p>}
          {running && <ul className="ipac-list">{left.map((r) => (
            <li key={r.id}><button className="ipac-finish" onClick={() => act((x) => S.finish(x, r.id, Date.now()))}>
              <b>{S.label(r)}</b>{r.buddyId && <small> · with {S.label(s.runners.find((q) => q.id === r.buddyId)!)}</small>}</button></li>))}</ul>}
          {running && !left.length && <p>Everyone is home. See Results.</p>}
        </section>
      )}
      <div hidden={tab !== "live"}><Live s={s} act={act} cfg={cfg} running={running} /></div>
      {tab === "results" && <Results s={s} act={act} onArchive={archiveNow} pending={pending} serverOn={!!(cfg.serverUrl && cfg.token)} />}
      <div hidden={tab !== "routes"}><Routes /></div>
      {tab === "club" && <Club cfg={cfg} setCfg={setCfg} notices={notices} />}
    </div>
  );
}

function CheckIn({ s, act, locked }: { s: S.Session; act: (f: (x: S.Session) => S.Session) => void; locked: boolean }) {
  const [name, setName] = useState(""), [bib, setBib] = useState(""), [buddy, setBuddy] = useState(""), [edit, setEdit] = useState<{ id: string; name: string; bib: string } | null>(null);
  return (
    <section>
      <label>Distance (km)
        <input type="number" min={0.1} step={0.1} value={s.distanceKm} disabled={locked} onChange={(e) => act((x) => ({ ...x, distanceKm: Math.max(0.1, +e.target.value || 0.1) }))} />
      </label>
      <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); act((x) => S.addRunner(x, name, bib, buddy || undefined)); setName(""); setBib(""); setBuddy(""); }}>
        <input placeholder="Name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Bib" aria-label="Bib number" value={bib} onChange={(e) => setBib(e.target.value)} />
        <select aria-label="Buddy with a phone" value={buddy} onChange={(e) => setBuddy(e.target.value)}>
          <option value="">No buddy needed</option>
          {s.runners.map((r) => <option key={r.id} value={r.id}>Runs with {S.label(r)}</option>)}
        </select>
        <button type="submit">Add runner</button>
      </form>
      <ul className="ipac-list">{s.runners.map((r) => (
        <li key={r.id}>{edit?.id === r.id
          ? <form onSubmit={(e) => { e.preventDefault(); act((x) => S.updateRunner(x, r.id, edit.name, edit.bib)); setEdit(null); }}>
              <input aria-label="Edit name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <input aria-label="Edit bib" value={edit.bib} onChange={(e) => setEdit({ ...edit, bib: e.target.value })} size={4} /><button>Save</button></form>
          : <>{S.label(r)}{r.buddyId ? ` · buddy ${S.label(s.runners.find((q) => q.id === r.buddyId)!)}` : ""}
              <button aria-label={`Edit ${S.label(r)}`} onClick={() => setEdit({ id: r.id, name: r.name, bib: r.bib })}>Edit</button>
              <button aria-label={`Remove ${S.label(r)}`} onClick={() => act((x) => S.removeRunner(x, r.id))}>×</button></>}</li>))}</ul>
    </section>
  );
}
