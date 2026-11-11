import { useEffect, useState, type ReactNode } from "react";
import { sessionCsv } from "../lib/csv";
import * as C from "../lib/club";
import * as S from "../lib/session";
import { loadHistory } from "../lib/store";
import { Confirm, download } from "../ui";

type Act = (f: (x: S.Session) => S.Session) => void;
export interface SessionProps {
  s: S.Session; act: Act; now: number; pending: number; serverOn: boolean;
  toast: (msg: string, undo?: () => void) => void;
  onEnd: (ended: S.Session) => void; onNew: (keepRunners: boolean) => void;
  distances: number[]; joinSlot: ReactNode;
  members: C.Member[]; onSaveMember: (r: S.Runner) => void;
}

export default function Session(p: SessionProps) {
  const ph = S.phase(p.s);
  return ph === "setup" ? <Setup {...p} /> : ph === "running" ? <Running {...p} /> : <Done {...p} />;
}

/* ---------- 1. Set up ---------- */
function Setup({ s, act, pending, serverOn, distances, joinSlot, members, onSaveMember }: SessionProps) {
  const [qty, setQty] = useState(20), [name, setName] = useState(""), [bib, setBib] = useState(S.nextBib(s)), [buddy, setBuddy] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string; bib: string } | null>(null), [hist, setHist] = useState<S.Session[]>([]);
  useEffect(() => { loadHistory().then(setHist); }, [pending]);
  useEffect(() => { setBib(S.nextBib(s)); }, [s.runners.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = s.runners.length, yr = new Date().getFullYear();
  const notIn = members.filter((m) => m.active && !s.runners.some((r) => r.memberId === m.id));
  const regulars = notIn.filter((m) => !C.needsConsent(m, yr)), blocked = notIn.filter((m) => C.needsConsent(m, yr));
  return (
    <>
      <section className="ipac-card">
        <h2>Today's run</h2>
        <div className="ipac-chips" role="group" aria-label="Distance">
          {distances.map((d) => <button key={d} className="ipac-chip" aria-pressed={s.distanceKm === d} onClick={() => act((x) => ({ ...x, distanceKm: d }))}>{d} km</button>)}
          <label className="ipac-other">Other
            <input type="number" inputMode="decimal" min={0.1} step={0.1} value={s.distanceKm} aria-label="Distance in km" onChange={(e) => act((x) => ({ ...x, distanceKm: Math.max(0.1, +e.target.value || 0.1) }))} /></label>
        </div>
      </section>

      {joinSlot}

      <section className="ipac-card">
        <h2>Who is running? <span className="ipac-count">{n}</span></h2>
        <div className="ipac-quick">
          <label>Numbers only
            <input type="number" inputMode="numeric" min={1} max={200} value={qty} aria-label="How many runners" onChange={(e) => setQty(+e.target.value)} /></label>
          <button className="ipac-btn ipac-btn-outline" onClick={() => act((x) => S.addNumbered(x, qty))}>Add {qty || 0} numbered runners</button>
        </div>
        {regulars.length > 0 && <button className="ipac-btn ipac-btn-outline ipac-btn-wide ipac-regulars" onClick={() => act((x) => regulars.reduce((acc, m) => checkIn(acc, m, S.nextBib(acc)), x))}>Check in {regulars.length} club runner{regulars.length > 1 ? "s" : ""}</button>}
        {blocked.length > 0 && <p className="ipac-hint">Not checked in until a parent or guardian's consent is recorded: {blocked.map((m) => m.name).join(", ")}.</p>}
        <form className="ipac-add" onSubmit={(e) => {
          e.preventDefault();
          const mem = C.findMemberByName(members, name);
          act((x) => (mem ? checkIn(x, mem, bib, buddy || undefined) : S.addRunner(x, name, bib, buddy || undefined))); setName(""); setBuddy("");
        }}>
          <input className="ipac-bibin" aria-label="Bib number" inputMode="numeric" placeholder="Bib" value={bib} onChange={(e) => setBib(e.target.value)} />
          <input className="ipac-namein" aria-label="Name" placeholder="Name (optional)" autoComplete="off" list="ipac-members" value={name} onChange={(e) => setName(e.target.value)} />
          <datalist id="ipac-members">{members.filter((m) => m.active && !s.runners.some((r) => r.memberId === m.id)).map((m) => <option key={m.id} value={m.name} />)}</datalist>
          <button className="ipac-btn ipac-btn-primary" type="submit">Add runner</button>
          {n > 0 && (
            <details className="ipac-more">
              <summary>Runs without a phone? Pair with a buddy</summary>
              <select aria-label="Buddy with a phone" value={buddy} onChange={(e) => setBuddy(e.target.value)}>
                <option value="">No buddy</option>{s.runners.map((r) => <option key={r.id} value={r.id}>Runs with {S.label(r)}</option>)}
              </select>
            </details>
          )}
        </form>
        {n === 0 ? <p className="ipac-empty">Add each runner as they arrive. A bib number is enough, and the next one is filled in for you.</p> : (
          <ul className="ipac-roster">{s.runners.map((r) => (
            <li key={r.id}>
              {edit?.id === r.id ? (
                <form className="ipac-inline" onSubmit={(e) => { e.preventDefault(); act((x) => S.updateRunner(x, r.id, edit.name, edit.bib)); setEdit(null); }}>
                  <input aria-label="Edit bib" inputMode="numeric" value={edit.bib} onChange={(e) => setEdit({ ...edit, bib: e.target.value })} size={4} />
                  <input aria-label="Edit name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  <button className="ipac-btn ipac-btn-primary">Save</button>
                </form>
              ) : (<>
                <span className="ipac-bib">{r.bib || "–"}</span>
                <span className="ipac-who"><b>{r.name || `Bib ${r.bib}`}</b>{r.buddyId && <small>Runs with {S.label(s.runners.find((q) => q.id === r.buddyId) ?? r)}</small>}</span>
                {!r.memberId && members !== undefined && <button className="ipac-btn ipac-btn-quiet" aria-label={`Save ${S.label(r)} to the club`} onClick={() => onSaveMember(r)}>Save</button>}
                <button className="ipac-btn ipac-btn-quiet" aria-label={`Edit ${S.label(r)}`} onClick={() => setEdit({ id: r.id, name: r.name, bib: r.bib })}>Edit</button>
                <Confirm label="Remove" aria={`Remove ${S.label(r)}`} ask="Remove?" onYes={() => act((x) => S.removeRunner(x, r.id))} />
              </>)}
            </li>))}</ul>
        )}
      </section>

      {hist.length > 0 && (
        <details className="ipac-card ipac-past">
          <summary>Past sessions ({hist.length})</summary>
          <ul className="ipac-roster">{[...hist].reverse().map((h) => (
            <li key={h.id}><span className="ipac-who"><b>{h.date}</b><small>{h.distanceKm} km · {S.standings(h).length}/{h.runners.length} finished</small></span>
              <button className="ipac-btn ipac-btn-quiet" aria-label={`Download CSV for ${h.date}`} onClick={() => download(`ipac-${h.date}.csv`, sessionCsv(h))}>CSV</button></li>))}</ul>
        </details>
      )}
      <p className="ipac-hint">{pending > 0 ? `${pending} saved session(s) waiting to upload. ` : ""}{serverOn ? "Sessions upload when you are online." : "Sessions are kept on this device."}</p>

      <div className="ipac-cta"><div className="ipac-cta-in">
        <button className="ipac-btn ipac-btn-hero" disabled={!n} onClick={() => act((x) => S.start(x, Date.now()))}>{n ? `Start for ${n} runner${n > 1 ? "s" : ""}` : "Add a runner to start"}</button>
      </div></div>
    </>
  );
}

/* ---------- 2. Race on ---------- */
function Running({ s, act, now, toast, onEnd }: SessionProps) {
  const left = S.stillRunning(s), rows = S.standings(s), median = S.groupMedianPace(s), total = s.runners.length;
  useEffect(() => { // keep the screen awake while timing
    let lock: any; const get = async () => { try { lock = await (navigator as any).wakeLock?.request("screen"); } catch { /* not allowed */ } };
    get(); const vis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", vis); return () => { document.removeEventListener("visibilitychange", vis); lock?.release?.().catch(() => {}); };
  }, []);
  const tap = (r: S.Runner) => {
    navigator.vibrate?.(30); act((x) => S.finish(x, r.id, Date.now()));
    toast(`${S.label(r)} finished`, () => act((x) => S.undoFinish(x, r.id)));
  };
  return (
    <>
      <section className="ipac-clockcard" aria-label="Race clock">
        <div className="ipac-live"><i /> Race clock · {s.distanceKm} km</div>
        <div className="ipac-clock" role="timer">{S.fmtTime(now - s.startedAt!)}</div>
        <div className="ipac-prog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={rows.length} aria-label="Runners home"><span style={{ width: `${(rows.length / total) * 100}%` }} /></div>
        <div className="ipac-clockfoot"><span>{rows.length} of {total} home</span><span>Median pace {S.fmtPace(median)}</span></div>
      </section>

      {left.length > 0 ? (
        <section>
          <h2 className="ipac-sub">Tap a runner as they cross the line</h2>
          <div className={`ipac-tiles${left.length > 8 ? " ipac-tiles-many" : ""}`}>{left.map((r) => (
            <button key={r.id} className="ipac-tile" aria-label={`Finish ${S.label(r)}`} onClick={() => tap(r)}>
              <b>{r.bib || "–"}</b>{r.name && <span>{r.name}</span>}
              {r.buddyId && <small>with {S.label(s.runners.find((q) => q.id === r.buddyId) ?? r)}</small>}
            </button>))}</div>
        </section>
      ) : <p className="ipac-banner" role="status">Everyone is home. Check the times, then see the results.</p>}

      {rows.length > 0 && <section><h2 className="ipac-sub">Finished</h2><Standings s={s} act={act} /></section>}

      <div className="ipac-cta"><div className="ipac-cta-in">
        {left.length === 0
          ? <button className="ipac-btn ipac-btn-hero" onClick={() => onEnd(S.endSession(s, Date.now()))}>See results</button>
          : <Confirm className="ipac-btn ipac-btn-outline ipac-btn-wide" label="End session" ask={`${left.length} still running. End anyway?`} onYes={() => onEnd(S.endSession(s, Date.now()))} />}
      </div></div>
    </>
  );
}

/* ---------- 3. Results ---------- */
function Done({ s, act, onNew, onEnd }: SessionProps) {
  const rows = S.standings(s), out = S.stillRunning(s), median = S.groupMedianPace(s);
  return (
    <>
      <section className="ipac-card">
        <h2>Results · {s.distanceKm} km</h2>
        <div className="ipac-stats">
          <div><b>{rows.length}/{s.runners.length}</b><span>finished</span></div>
          <div><b>{rows[0] ? S.fmtTime(rows[0].elapsedMs) : "–"}</b><span>fastest</span></div>
          <div><b>{S.fmtPace(median)}</b><span>median pace</span></div>
        </div>
      </section>
      {rows.length ? <Standings s={s} act={act} podium /> : <p className="ipac-empty">No finishers were recorded.</p>}
      {out.length > 0 && <section className="ipac-card"><h2>Did not finish</h2><p>{out.map((r) => S.label(r)).join(", ")}</p></section>}

      <section className="ipac-card ipac-next">
        <button className="ipac-btn ipac-btn-hero" onClick={() => onNew(true)}>New session, same runners</button>
        <button className="ipac-btn ipac-btn-outline" onClick={() => download(`ipac-${s.date}.csv`, sessionCsv(s))} disabled={!rows.length}>Download CSV</button>
        <div className="ipac-row2">
          <button className="ipac-btn ipac-btn-quiet" onClick={() => act((x) => S.resumeSession(x))}>Resume timing</button>
          <Confirm label="Start fresh" ask="Clear all runners?" onYes={() => onNew(false)} />
        </div>
        <p className="ipac-hint">This session is saved on this device.</p>
      </section>
    </>
  );
}

/* ---------- shared leaderboard ---------- */
function Standings({ s, act, podium }: { s: S.Session; act: Act; podium?: boolean }) {
  const rows = S.standings(s), [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  return (
    <ol className="ipac-board">{rows.map((r) => (
      <li key={r.runner.id} className={podium && r.rank <= 3 ? `ipac-pod ipac-pod-${r.rank}` : ""}>
        <span className="ipac-rank">{S.ordinal(r.rank)}</span>
        <span className="ipac-who"><b>{S.label(r.runner)}</b><small>{S.fmtPace(r.paceSecPerKm)}{r.rank > 1 && ` · +${S.fmtTime(r.gapMs)}`}{rows.length > 1 && r.rank === rows.length && " · last"}</small></span>
        {edit?.id === r.runner.id ? (
          <form className="ipac-inline" onSubmit={(e) => { e.preventDefault(); act((x) => S.setFinishTime(x, r.runner.id, S.parseTime(edit.text))); setEdit(null); }}>
            <input aria-label="New time" inputMode="numeric" value={edit.text} onChange={(e) => setEdit({ id: edit.id, text: e.target.value })} size={7} />
            <button className="ipac-btn ipac-btn-primary">OK</button>
            <Confirm label="Remove" ask="Remove finish?" aria={`Undo finish for ${S.label(r.runner)}`} onYes={() => { act((x) => S.undoFinish(x, r.runner.id)); setEdit(null); }} />
          </form>
        ) : (<>
          <span className="ipac-time">{S.fmtTime(r.elapsedMs)}</span>
          <button className="ipac-btn ipac-btn-quiet" aria-label={`Fix time for ${S.label(r.runner)}`} onClick={() => setEdit({ id: r.runner.id, text: S.fmtTime(r.elapsedMs) })}>Fix</button>
        </>)}
      </li>))}</ol>
  );
}

/** Check a club runner in, using their usual bib when it is free. Under-18s need recorded consent. */
function checkIn(s: S.Session, m: C.Member, fallbackBib: string, buddyId?: string): S.Session {
  if (s.runners.some((r) => r.memberId === m.id)) throw new Error(`${m.name} is already checked in`);
  if (C.needsConsent(m, new Date().getFullYear())) throw new Error(`${m.name} is under 18. Record a parent or guardian's consent in Runners first.`);
  const bib = m.bib && !s.runners.some((r) => r.bib === m.bib) ? m.bib : fallbackBib;
  const n = S.addRunner(s, m.name, bib, buddyId);
  return { ...n, runners: n.runners.map((r, i) => (i === n.runners.length - 1 ? { ...r, memberId: m.id } : r)) };
}
