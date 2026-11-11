import { useEffect, useState } from "react";
import * as S from "./lib/session";
import { flushOutbox, loadSession, pendingCount, queueForSync, saveSession, syncConfigured } from "./lib/store";

type Tab = "checkin" | "timer" | "results";

export default function App() {
  const [s, setS] = useState<S.Session | null>(null);
  const [tab, setTab] = useState<Tab>("checkin");
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(0);

  useEffect(() => { loadSession().then((x) => setS(x ?? S.newSession())); }, []);
  useEffect(() => { if (s) saveSession(s); }, [s]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => {
    const sync = () => flushOutbox().then((r) => setPending(r.pending));
    pendingCount().then(setPending); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync);
  }, []);

  if (!s) return <p className="ipac-loading">Loading…</p>;
  const act = (fn: (x: S.Session) => S.Session) => { try { setS(fn(s)); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const running = s.startedAt !== undefined;
  const rows = S.standings(s), median = S.groupMedianPace(s);

  return (
    <div className="ipac-app">
      <header className="ipac-head">
        <h1>Ivory Park Athletics Club</h1>
        <p>{s.date} · {s.distanceKm} km · {s.runners.length} runners</p>
      </header>
      <nav className="ipac-tabs" aria-label="Sections">
        {(["checkin", "timer", "results"] as Tab[]).map((t) => (
          <button key={t} aria-current={tab === t} onClick={() => setTab(t)}>{{ checkin: "Check-in", timer: "Timer", results: "Results" }[t]}</button>
        ))}
      </nav>
      {err && <p role="alert" className="ipac-err">{err}</p>}

      {tab === "checkin" && <CheckIn s={s} act={act} locked={running} />}

      {tab === "timer" && (
        <section>
          <div className="ipac-clock" aria-live="off">{running ? S.fmtTime(now - s.startedAt!) : "0:00"}</div>
          {!running
            ? <button className="ipac-big" disabled={!s.runners.length} onClick={() => act((x) => S.start(x, Date.now()))}>Start for everyone</button>
            : <p className="ipac-hint">Tap a runner when they cross the line.</p>}
          {running && (
            <ul className="ipac-list">
              {S.stillRunning(s).map((r) => (
                <li key={r.id}><button className="ipac-finish" onClick={() => act((x) => S.finish(x, r.id, Date.now()))}>
                  <b>{S.label(r)}</b>{r.buddyId && <small> · with {S.label(s.runners.find((q) => q.id === r.buddyId)!)}</small>}
                </button></li>
              ))}
            </ul>
          )}
          {running && !S.stillRunning(s).length && <p>Everyone is home. See Results.</p>}
        </section>
      )}

      {tab === "results" && (
        <section>
          <p>Group median pace: <b>{S.fmtPace(median)}</b> · Finished {rows.length}/{s.runners.length}</p>
          <table className="ipac-table">
            <thead><tr><th>Rank</th><th>Runner</th><th>Time</th><th>Pace</th><th>Gap</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.runner.id}>
                  <td>{S.ordinal(r.rank)}{rows.length > 1 && r.rank === rows.length ? " (last)" : ""}</td>
                  <td>{S.label(r.runner)}</td><td>{S.fmtTime(r.elapsedMs)}</td><td>{S.fmtPace(r.paceSecPerKm)}</td>
                  <td>{r.rank === 1 ? "–" : `+${S.fmtTime(r.gapMs)}`}</td>
                  <td><button aria-label={`Undo finish for ${S.label(r.runner)}`} onClick={() => act((x) => S.undoFinish(x, r.runner.id))}>Undo</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="ipac-hint">No finishers yet.</p>}
          <div className="ipac-actions">
            <button onClick={async () => { await queueForSync(s); setPending(await pendingCount()); setS(S.newSession(s.distanceKm)); setTab("checkin"); }}
              disabled={!running}>Save session &amp; start a new one</button>
          </div>
          <p className="ipac-hint">{pending} saved session(s) on this device. {syncConfigured ? "They upload when you are online." : "Club server not connected yet; data stays on this device."}</p>
        </section>
      )}
    </div>
  );
}

function CheckIn({ s, act, locked }: { s: S.Session; act: (f: (x: S.Session) => S.Session) => void; locked: boolean }) {
  const [name, setName] = useState(""), [bib, setBib] = useState(""), [buddy, setBuddy] = useState("");
  return (
    <section>
      <label>Distance (km)
        <input type="number" min={0.1} step={0.1} value={s.distanceKm} disabled={locked}
          onChange={(e) => act((x) => ({ ...x, distanceKm: Math.max(0.1, +e.target.value || 0.1) }))} />
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
      <ul className="ipac-list">
        {s.runners.map((r) => (
          <li key={r.id}>{S.label(r)}{r.buddyId ? ` · buddy ${S.label(s.runners.find((q) => q.id === r.buddyId)!)}` : ""}
            <button aria-label={`Remove ${S.label(r)}`} onClick={() => act((x) => S.removeRunner(x, r.id))}>×</button></li>
        ))}
      </ul>
    </section>
  );
}
