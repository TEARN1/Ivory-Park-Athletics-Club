import { useEffect, useState, type ReactNode } from "react";
import { sessionCsv } from "../lib/csv";
import * as C from "../lib/club";
import * as S from "../lib/session";
import { shareOrSave, resultsImage } from "../lib/shareImage";
import { spokenTime } from "../lib/sound";
import { loadHistory } from "../lib/store";
import * as W from "../lib/workout";
import { Confirm, download } from "../ui";

type Act = (f: (x: S.Session) => S.Session) => void;
export interface SessionProps {
  s: S.Session; act: Act; now: number; pending: number; serverOn: boolean;
  toast: (msg: string, undo?: () => void) => void;
  onEnd: (ended: S.Session) => void; onNew: (keepRunners: boolean) => void;
  distances: number[]; joinSlot: ReactNode;
  members: C.Member[]; onSaveMember: (r: S.Runner) => void;
  onStart: () => void; announce: (kind: "finishes" | "laps", text: string) => void; safetyPaceSec: number; logo: string;
}

export default function Session(p: SessionProps) {
  const ph = S.phase(p.s);
  return ph === "setup" ? <Setup {...p} /> : ph === "running" ? <Running {...p} /> : <Done {...p} />;
}

/* ---------- 1. Set up ---------- */
function Setup({ s, act, pending, serverOn, distances, joinSlot, members, onSaveMember, onStart }: SessionProps) {
  const [qty, setQty] = useState(20), [name, setName] = useState(""), [bib, setBib] = useState(S.nextBib(s)), [buddy, setBuddy] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string; bib: string } | null>(null), [hist, setHist] = useState<S.Session[]>([]);
  useEffect(() => { loadHistory().then(setHist); }, [pending]);
  useEffect(() => { setBib(S.nextBib(s)); }, [s.runners.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = s.runners.length, yr = new Date().getFullYear();
  const notIn = members.filter((m) => m.active && !s.runners.some((r) => r.memberId === m.id));
  const regulars = notIn.filter((m) => !C.needsConsent(m, yr)), blocked = notIn.filter((m) => C.needsConsent(m, yr));
  return (
    <>
      <TypeCard s={s} act={act} distances={distances} />
      <GroupsCard s={s} act={act} />

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
                <span className="ipac-who"><b>{r.name || `Bib ${r.bib}`}</b>{r.buddyId && <small>Runs with {S.label(s.runners.find((q) => q.id === r.buddyId) ?? r)}</small>}
                  {(s.groups?.length ?? 0) > 0 && <select className="ipac-groupsel" aria-label={`Pace group for ${S.label(r)}`} value={r.groupId ?? ""} onChange={(e) => act((x) => W.setGroup(x, r.id, e.target.value || undefined))}>
                    <option value="">No pace group</option>{s.groups!.map((g) => <option key={g.id} value={g.id}>{g.name} ({C.fmtPaceInput(g.paceSec)}/km)</option>)}</select>}</span>
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
        <button className="ipac-btn ipac-btn-hero" disabled={!n} onClick={onStart}>{n ? `Start for ${n} runner${n > 1 ? "s" : ""}` : "Add a runner to start"}</button>
      </div></div>
    </>
  );
}

/* ---------- 2. Race on ---------- */
function useWakeLock() {
  useEffect(() => { // keep the screen awake while timing
    let lock: any; const get = async () => { try { lock = await (navigator as any).wakeLock?.request("screen"); } catch { /* not allowed */ } };
    get(); const vis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", vis); return () => { document.removeEventListener("visibilitychange", vis); lock?.release?.().catch(() => {}); };
  }, []);
}
const spokenName = (r: S.Runner) => r.name.trim() ? r.name.trim().split(/\s+/)[0] : `Bib ${r.bib}`;
function Running(p: SessionProps) {
  useWakeLock();
  return p.s.mode === "reps" ? <RepsRunning {...p} /> : <RaceRunning {...p} />;
}
function RaceRunning({ s, act, now, toast, onEnd, announce, members, safetyPaceSec }: SessionProps) {
  const left = S.stillRunning(s), rows = S.standings(s), median = S.groupMedianPace(s), total = s.runners.length, laps = s.mode === "laps" ? s.laps : undefined;
  const memberPace = (r: S.Runner) => members.find((m) => m.id === r.memberId)?.targetPaceSec;
  const tap = (r: S.Runner) => {
    navigator.vibrate?.(30); const t = Date.now();
    if (laps) {
      const next = W.lapTap(s, r.id, t), marks = next.marks?.[r.id] ?? [], split = W.lapSplits(marks).at(-1) ?? 0, target = W.targetPaceFor(s, r.id, memberPace(r));
      act(() => next);
      const cue = target ? `, ${W.paceCue(split, laps.km, target).text}` : "", lap = marks.length;
      toast(`${S.label(r)} lap ${lap}: ${S.fmtTime(split)}${cue}`, () => act((x) => W.undoLap(x, r.id)));
      announce("laps", `${spokenName(r)}, ${lap === laps.count ? "finished" : `lap ${lap}`}, ${spokenTime(split)}${cue}`);
      return;
    }
    act((x) => S.finish(x, r.id, t));
    const place = S.standings(S.finish(s, r.id, t)).find((x) => x.runner.id === r.id);
    toast(`${S.label(r)} finished`, () => act((x) => S.undoFinish(x, r.id)));
    if (place) announce("finishes", `${spokenName(r)}, ${S.ordinal(place.rank)}, ${spokenTime(place.elapsedMs)}`);
  };
  return (
    <>
      <section className="ipac-clockcard" aria-label="Race clock">
        <div className="ipac-live"><i /> {laps ? `Laps · ${laps.count} x ${laps.km * 1000} m` : `Race clock · ${s.distanceKm} km`}</div>
        <div className="ipac-clock" role="timer">{S.fmtTime(now - s.startedAt!)}</div>
        <div className="ipac-prog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={rows.length} aria-label="Runners home"><span style={{ width: `${(rows.length / total) * 100}%` }} /></div>
        <div className="ipac-clockfoot"><span>{rows.length} of {total} home</span><span>Median pace {S.fmtPace(median)}</span></div>
      </section>

      <SafetyCard s={s} now={now} members={members} safetyPaceSec={safetyPaceSec} />
      {left.length > 0 ? (
        <section>
          <h2 className="ipac-sub">{laps ? "Tap a runner each time they finish a lap" : "Tap a runner as they cross the line"}</h2>
          <div className={`ipac-tiles${left.length > 8 ? " ipac-tiles-many" : ""}`}>{left.map((r) => (
            <button key={r.id} className="ipac-tile" aria-label={laps ? `Lap for ${S.label(r)}` : `Finish ${S.label(r)}`} onClick={() => tap(r)}>
              <b>{r.bib || "–"}</b>{r.name && <span>{r.name}</span>}
              {laps && <small className="ipac-lapcount">Lap {W.lapsDone(s, r.id) + 1} of {laps.count}</small>}
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
function Done({ s, act, onNew, logo, toast }: SessionProps) {
  const rows = S.standings(s), out = S.stillRunning(s), median = S.groupMedianPace(s), [busy, setBusy] = useState(false);
  const share = async () => { setBusy(true); try { const how = await shareOrSave(await resultsImage(s, logo), `ipac-results-${s.date}.png`); toast(how === "saved" ? "Results image saved" : "Results image ready to share"); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } };
  return (
    <>
      <section className="ipac-card">
        <h2>Results · {s.mode === "reps" && s.reps ? `${s.reps.count} x ${s.reps.km * 1000} m` : s.mode === "laps" && s.laps ? `${s.laps.count} laps of ${s.laps.km * 1000} m` : `${s.distanceKm} km`}</h2>
        <div className="ipac-stats">
          <div><b>{rows.length}/{s.runners.length}</b><span>finished</span></div>
          <div><b>{rows[0] ? S.fmtTime(rows[0].elapsedMs) : "–"}</b><span>fastest</span></div>
          <div><b>{S.fmtPace(median)}</b><span>median pace</span></div>
        </div>
      </section>
      {s.mode && s.mode !== "race" && <WorkoutTable s={s} />}
      {s.mode === "reps" ? null : rows.length ? <Standings s={s} act={act} podium /> : <p className="ipac-empty">No finishers were recorded.</p>}
      {out.length > 0 && <section className="ipac-card"><h2>Did not finish</h2><p>{out.map((r) => S.label(r)).join(", ")}</p></section>}

      <section className="ipac-card ipac-next">
        <button className="ipac-btn ipac-btn-hero" onClick={() => onNew(true)}>New session, same runners</button>
        {s.mode !== "reps" && <button className="ipac-btn ipac-btn-outline" onClick={share} disabled={!rows.length || busy}>{busy ? "Making image…" : "Share results image"}</button>}
        <button className="ipac-btn ipac-btn-outline" onClick={() => download(`ipac-${s.date}.csv`, sessionCsv(s))} disabled={!rows.length}>Download CSV</button>
        <div className="ipac-row2">
          <button className="ipac-btn ipac-btn-quiet" onClick={() => act((x) => S.resumeSession(x))}>Resume timing</button>
          <Confirm label="Start fresh" ask="Clear all runners?" onYes={() => onNew(false)} />
        </div>
        <p className="ipac-hint">This session is saved on this device. Shared images show first names and surname initials only.</p>
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

/* ---------- session type ---------- */
function TypeCard({ s, act, distances }: { s: S.Session; act: Act; distances: number[] }) {
  const mode = s.mode ?? "race";
  const [d, setD] = useState({ count: String(s.laps?.count ?? s.reps?.count ?? 8), m: String(Math.round((s.laps?.km ?? s.reps?.km ?? 0.4) * 1000)), rest: String(s.reps?.restSec ?? 90) });
  const apply = (m: "race" | "laps" | "reps") => act((x) => W.setMode(x, m, { count: +d.count, km: +d.m / 1000, restSec: +d.rest }));
  return (
    <section className="ipac-card">
      <h2>Today's session</h2>
      <div className="ipac-seg" role="group" aria-label="Session type">
        {([["race", "Race"], ["laps", "Laps"], ["reps", "Intervals"]] as const).map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => apply(k)}>{l}</button>)}
      </div>
      {mode === "race" ? (
        <div className="ipac-chips ipac-gap" role="group" aria-label="Distance">
          {distances.map((km) => <button key={km} className="ipac-chip" aria-pressed={s.distanceKm === km} onClick={() => act((x) => ({ ...x, distanceKm: km }))}>{km} km</button>)}
          <label className="ipac-other">Other
            <input type="number" inputMode="decimal" min={0.1} step={0.1} value={s.distanceKm} aria-label="Distance in km" onChange={(e) => act((x) => ({ ...x, distanceKm: Math.max(0.1, +e.target.value || 0.1) }))} /></label>
        </div>
      ) : (
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); apply(mode); }}>
          <div className={mode === "reps" ? "ipac-grid3" : "ipac-grid2"}>
            <label>{mode === "laps" ? "Laps" : "Reps"}<input inputMode="numeric" value={d.count} onChange={(e) => setD({ ...d, count: e.target.value.replace(/\D/g, "") })} /></label>
            <label>Metres each<input inputMode="numeric" value={d.m} onChange={(e) => setD({ ...d, m: e.target.value.replace(/\D/g, "") })} /></label>
            {mode === "reps" && <label>Rest (sec)<input inputMode="numeric" value={d.rest} onChange={(e) => setD({ ...d, rest: e.target.value.replace(/\D/g, "") })} /></label>}
          </div>
          <button className="ipac-btn ipac-btn-primary">Use {d.count || 0} x {d.m || 0} m{mode === "reps" ? `, ${d.rest || 0} s rest` : ""}</button>
          <p className="ipac-hint">{mode === "laps" ? `Set now: ${s.laps?.count} x ${(s.laps?.km ?? 0) * 1000} m (${s.distanceKm} km). Tap each runner every lap.` : `Set now: ${s.reps?.count} x ${(s.reps?.km ?? 0) * 1000} m with ${s.reps?.restSec} s rest. Everyone starts each rep together.`}</p>
        </form>
      )}
    </section>
  );
}

/* ---------- pace groups ---------- */
function GroupsCard({ s, act }: { s: S.Session; act: Act }) {
  const [f, setF] = useState({ name: "", pace: "" }), [err, setErr] = useState(""), groups = s.groups ?? [];
  return (
    <details className="ipac-card" open={groups.length > 0}>
      <summary>Pace groups {groups.length > 0 ? `(${groups.length})` : "(optional)"}</summary>
      {groups.length > 0 && <ul className="ipac-roster">{groups.map((g) => (
        <li key={g.id}><span className="ipac-who"><b>{g.name}</b><small>Target {C.fmtPaceInput(g.paceSec)} per km · {s.runners.filter((r) => r.groupId === g.id).length} runners</small></span>
          <Confirm label="Remove" ask="Remove group?" aria={`Remove ${g.name}`} onYes={() => act((x) => W.removeGroup(x, g.id))} /></li>))}</ul>}
      <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); try { const pace = C.parsePace(f.pace); if (!pace) throw new Error("Add a target pace, like 5:30"); act((x) => W.addGroup(x, f.name, pace)); setF({ name: "", pace: "" }); setErr(""); } catch (x) { setErr((x as Error).message); } }}>
        <div className="ipac-grid2"><label>Group name<input placeholder="Sub 25 min" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Target pace per km<input placeholder="5:00" inputMode="numeric" value={f.pace} onChange={(e) => setF({ ...f, pace: e.target.value })} /></label></div>
        {err && <p role="alert" className="ipac-err">{err}</p>}
        <button className="ipac-btn ipac-btn-outline" disabled={!f.name.trim()}>Add pace group</button>
      </form>
      <p className="ipac-hint">Pick each runner's group in the list below. Lap times are then compared with the group's pace, or the runner's own target pace from their profile.</p>
    </details>
  );
}

/* ---------- safety ---------- */
function SafetyCard({ s, now, members, safetyPaceSec }: { s: S.Session; now: number; members: C.Member[]; safetyPaceSec: number }) {
  const alerts = W.safetyAlerts(s, now, safetyPaceSec);
  if (!alerts.length) return null;
  return (
    <section className="ipac-safety" role="alert" aria-label="Runners to check on">
      <h2>Check on {alerts.length} runner{alerts.length > 1 ? "s" : ""}</h2>
      <ul>{alerts.map((a) => {
        const r = s.runners.find((x) => x.id === a.runnerId)!, m = members.find((x) => x.id === r.memberId), buddy = s.runners.find((x) => x.id === r.buddyId);
        const contact = m?.emergency?.phone ? m.emergency : m?.guardian?.phone ? m.guardian : undefined;
        return (
          <li key={a.runnerId}><b>{S.label(r)}</b><span>{a.reason}</span>
            {buddy && <span>Running with {S.label(buddy)}</span>}
            {contact ? <span className="ipac-contact">Emergency contact: {contact.name} · <span className="ipac-phone">{contact.phone}</span> <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>Call</a></span>
              : <span>No emergency contact saved{m ? "" : " (not a club runner)"}.</span>}
          </li>);
      })}</ul>
    </section>
  );
}

/* ---------- intervals ---------- */
function RepsRunning({ s, act, now, toast, onEnd, announce, members }: SessionProps) {
  const reps = s.reps!, k = W.repIndex(s), rest = W.resting(s), restLeft = rest ? Math.max(0, s.restUntil! - now) : 0;
  const waiting = s.runners.filter((r) => !W.repDoneBy(s, r.id)), memberPace = (r: S.Runner) => members.find((m) => m.id === r.memberId)?.targetPaceSec;
  useEffect(() => { if (!rest && W.repComplete(s)) { const n = W.endRep(s, Date.now()); if (S.phase(n) === "done") onEnd(n); else act(() => n); } }, [rest, s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rest && restLeft <= 0) { act((x) => W.nextRep(x, Date.now())); announce("laps", `Rep ${k + 2}, go`); } }, [rest, restLeft]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (r: S.Runner) => {
    navigator.vibrate?.(30); const next = W.repTap(s, r.id, Date.now()), t = next.marks?.[r.id]?.[k];
    if (t == null) return; act(() => next);
    const target = W.targetPaceFor(s, r.id, memberPace(r)), cue = target ? `, ${W.paceCue(t, reps.km, target).text}` : "";
    toast(`${S.label(r)} rep ${k + 1}: ${S.fmtTime(t)}${cue}`, () => act((x) => W.undoRep(x, r.id)));
    announce("laps", `${spokenName(r)}, ${spokenTime(t)}${cue}`);
  };
  return (
    <>
      <section className="ipac-clockcard" aria-label="Interval clock">
        <div className="ipac-live"><i /> {rest ? "Rest" : `Rep ${k + 1} of ${reps.count}`} · {reps.km * 1000} m</div>
        <div className="ipac-clock" role="timer">{rest ? S.fmtTime(restLeft + 999) : S.fmtTime(now - s.repStarts![k])}</div>
        <div className="ipac-prog" role="progressbar" aria-valuemin={0} aria-valuemax={reps.count} aria-valuenow={k + (rest ? 1 : 0)} aria-label="Reps done"><span style={{ width: `${((k + (rest ? 1 : 0)) / reps.count) * 100}%` }} /></div>
        <div className="ipac-clockfoot"><span>{rest ? `Next: rep ${k + 2} of ${reps.count}` : `${s.runners.length - waiting.length} of ${s.runners.length} done`}</span><span>{reps.restSec} s rest</span></div>
      </section>
      {rest ? (
        <button className="ipac-btn ipac-btn-hero" onClick={() => act((x) => W.nextRep(x, Date.now()))}>Start rep {k + 2} now</button>
      ) : (
        <section>
          <h2 className="ipac-sub">Tap each runner at the end of the rep</h2>
          <div className={`ipac-tiles${waiting.length > 8 ? " ipac-tiles-many" : ""}`}>{waiting.map((r) => (
            <button key={r.id} className="ipac-tile" aria-label={`Rep done for ${S.label(r)}`} onClick={() => tap(r)}><b>{r.bib || "–"}</b>{r.name && <span>{r.name}</span>}</button>))}</div>
        </section>
      )}
      <WorkoutTable s={s} />
      <div className="ipac-cta"><div className="ipac-cta-in">
        {rest ? <Confirm className="ipac-btn ipac-btn-outline ipac-btn-wide" label="End session" ask="End the session now?" onYes={() => onEnd(S.endSession(s, Date.now()))} />
          : <Confirm className="ipac-btn ipac-btn-outline ipac-btn-wide" label={`End rep ${k + 1}`} ask={`${waiting.length} not timed. End this rep?`} onYes={() => { const n = W.endRep(s, Date.now()); if (S.phase(n) === "done") onEnd(n); else act(() => n); }} />}
      </div></div>
    </>
  );
}
function WorkoutTable({ s }: { s: S.Session }) {
  const rows = W.workoutRows(s).filter((r) => r.times.length), n = s.mode === "reps" ? s.reps?.count ?? 0 : s.laps?.count ?? 0;
  if (!rows.length) return null;
  const by = new Map(s.runners.map((r) => [r.id, r]));
  return (
    <section className="ipac-card">
      <h2>{s.mode === "reps" ? "Rep times" : "Lap times"}</h2>
      <div className="ipac-tablewrap"><table className="ipac-wtable">
        <thead><tr><th scope="col">Runner</th>{Array.from({ length: n }, (_, i) => <th key={i} scope="col">{i + 1}</th>)}<th scope="col">Avg</th><th scope="col">Spread</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.runnerId}><th scope="row">{S.label(by.get(r.runnerId)!)}</th>
            {Array.from({ length: n }, (_, i) => { const t = r.times[i]; return <td key={i} className={t != null && t === r.best ? "ipac-best" : ""}>{t == null ? "–" : S.fmtTime(t)}</td>; })}
            <td>{r.avg ? S.fmtTime(r.avg) : "–"}</td><td>{r.spread !== undefined ? S.fmtTime(r.spread) : "–"}</td></tr>))}</tbody>
      </table></div>
      <p className="ipac-hint">Best time for each runner is highlighted. A small spread means even pacing.</p>
    </section>
  );
}
