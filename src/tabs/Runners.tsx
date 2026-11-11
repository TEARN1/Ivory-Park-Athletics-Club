import { useMemo, useState } from "react";
import * as C from "../lib/club";
import * as S from "../lib/session";
import { Confirm } from "../ui";

type Props = { club: C.ClubData; setClub: (c: C.ClubData) => void; history: S.Session[]; today: string };
const year = (today: string) => +today.slice(0, 4);

export default function Runners(p: Props) {
  const [view, setView] = useState<"members" | "league" | "records">("members"), [open, setOpen] = useState<string | null>(null);
  const member = p.club.members.find((m) => m.id === open);
  if (member) return <Profile {...p} m={member} back={() => setOpen(null)} />;
  return (
    <>
      <div className="ipac-seg" role="group" aria-label="Runner views">
        {(["members", "league", "records"] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{{ members: "Runners", league: "League", records: "Records" }[v]}</button>)}
      </div>
      {view === "members" && <Members {...p} openMember={setOpen} />}
      {view === "league" && <League {...p} />}
      {view === "records" && <Records {...p} />}
    </>
  );
}

function Members({ club, setClub, history, today, openMember }: Props & { openMember: (id: string) => void }) {
  const [q, setQ] = useState(""), [f, setF] = useState({ name: "", gender: "", birthYear: "", bib: "" }), [err, setErr] = useState("");
  const yr = year(today), k = q.trim().toLowerCase();
  const list = club.members.filter((m) => !k || m.name.toLowerCase().includes(k) || m.bib === k).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (C.findMemberByName(club.members, f.name)) throw new Error(`${f.name.trim()} is already in the list`);
      const m = C.newMember(f.name, { gender: (f.gender || undefined) as C.Gender | undefined, birthYear: f.birthYear ? +f.birthYear : undefined, bib: f.bib.trim() || undefined });
      setClub({ ...club, members: [...club.members, m] }); setF({ name: "", gender: "", birthYear: "", bib: "" }); setErr("");
    } catch (x) { setErr((x as Error).message); }
  };
  return (
    <>
      <section className="ipac-card">
        <h2>Club runners <span className="ipac-count">{club.members.length}</span></h2>
        <details className="ipac-more" open={!club.members.length}>
          <summary>Add a runner to the club</summary>
          <form className="ipac-form" onSubmit={add}>
            <label>Full name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" /></label>
            <div className="ipac-grid3">
              <label>Gender<select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Not given</option><option value="F">Female</option><option value="M">Male</option><option value="X">Other</option></select></label>
              <label>Birth year<input inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2008" /></label>
              <label>Usual bib<input inputMode="numeric" value={f.bib} onChange={(e) => setF({ ...f, bib: e.target.value })} /></label>
            </div>
            {err && <p role="alert" className="ipac-err">{err}</p>}
            <button className="ipac-btn ipac-btn-primary" disabled={!f.name.trim()}>Add runner</button>
          </form>
        </details>
        {club.members.length > 5 && <input aria-label="Search runners" placeholder="Search by name or bib" value={q} onChange={(e) => setQ(e.target.value)} />}
        {!club.members.length ? <p className="ipac-empty">Add the runners who come regularly. Their times, personal bests and badges build up from each session.</p> : (
          <ul className="ipac-roster">{list.map((m) => {
            const age = C.ageThisYear(m, yr), att = C.attendance(history, m.id).length;
            return (
              <li key={m.id}>
                <button className="ipac-rowbtn" onClick={() => openMember(m.id)} aria-label={`Open ${m.name}`}>
                  <span className="ipac-bib">{m.bib || "–"}</span>
                  <span className="ipac-who"><b>{m.name}</b><small>{[C.categoryOf(age)?.label, `${att} session${att === 1 ? "" : "s"}`, !m.active && "inactive"].filter(Boolean).join(" · ")}</small>
                    <span className="ipac-flags">
                      {C.needsConsent(m, yr) && <em className="ipac-flag ipac-flag-warn">Consent needed</em>}
                      {!m.emergency?.phone && <em className="ipac-flag">No emergency contact</em>}
                    </span></span>
                </button>
              </li>);
          })}</ul>)}
      </section>
    </>
  );
}

function Profile({ m, club, setClub, history, today, back }: Props & { m: C.Member; back: () => void }) {
  const yr = year(today), age = C.ageThisYear(m, yr), cat = C.categoryOf(age);
  const save = (patch: Partial<C.Member>) => setClub({ ...club, members: club.members.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) });
  const res = useMemo(() => C.memberResults(history, m.id), [history, m.id]);
  const pbs = C.personalBests(res), att = C.attendance(history, m.id), streak = C.weekStreak(att, today), bdg = C.badges(history, m.id, today);
  const [d, setD] = useState({ name: m.name, gender: m.gender ?? "", birthYear: m.birthYear ? String(m.birthYear) : "", bib: m.bib ?? "", pace: C.fmtPaceInput(m.targetPaceSec) });
  const [ec, setEc] = useState(m.emergency ?? { name: "", phone: "" }), [gd, setGd] = useState(m.guardian ?? { name: "", phone: "" });
  const [note, setNote] = useState(""), [plan, setPlan] = useState({ day: "", text: "" }), [err, setErr] = useState(""), [ok, setOk] = useState("");
  const done = (msg: string) => { setErr(""); setOk(msg); setTimeout(() => setOk(""), 2000); };
  const saveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const probe = C.newMember(d.name, { birthYear: d.birthYear ? +d.birthYear : undefined });
      save({ name: probe.name, gender: (d.gender || undefined) as C.Gender | undefined, birthYear: probe.birthYear, bib: d.bib.trim() || undefined, targetPaceSec: C.parsePace(d.pace) }); done("Details saved");
    } catch (x) { setErr((x as Error).message); }
  };
  const distances = [...new Set(res.map((r) => r.distanceKm))].sort((a, b) => a - b);
  const [chartKm, setChartKm] = useState<number | undefined>(distances[0]);
  return (
    <>
      <button className="ipac-btn ipac-btn-quiet ipac-back" onClick={back}>‹ All runners</button>
      <section className="ipac-card ipac-profilehead">
        <span className="ipac-bib ipac-bib-lg">{m.bib || "–"}</span>
        <div><h2>{m.name}</h2><p className="ipac-hint">{[cat?.label, age !== undefined && `about ${age}`, m.gender && { F: "Female", M: "Male", X: "Other" }[m.gender]].filter(Boolean).join(" · ") || "Add a birth year to see the age group"}</p></div>
      </section>
      {C.needsConsent(m, yr) && <p className="ipac-err" role="alert">Under 18: record a parent or guardian's consent below before this runner joins sessions.</p>}

      <section className="ipac-card">
        <div className="ipac-stats">
          <div><b>{att.length}</b><span>sessions</span></div>
          <div><b>{streak}</b><span>week streak</span></div>
          <div><b>{res.filter((r) => r.rank === 1).length}</b><span>wins</span></div>
        </div>
        {bdg.length > 0 && <ul className="ipac-badges" aria-label="Badges">{bdg.map((b) => <li key={b.id}>{b.label}</li>)}</ul>}
      </section>

      <section className="ipac-card">
        <h2>Personal bests</h2>
        {!pbs.length ? <p className="ipac-empty">No finished races yet.</p> : (
          <ul className="ipac-roster">{pbs.map((r) => (
            <li key={r.distanceKm}><span className="ipac-who"><b>{r.distanceKm} km · {S.fmtTime(r.ms)}</b>
              <small>{r.date} · {S.fmtPace(r.ms / 1000 / r.distanceKm)}{age !== undefined && ` · age-adjusted ${S.fmtTime(C.ageAdjustedMs(r.ms, age))}`}</small></span></li>))}</ul>)}
        {age !== undefined && pbs.length > 0 && <p className="ipac-hint">Age-adjusted times use a simple club estimate, not the official WMA age-grading tables.</p>}
        {distances.length > 0 && <>
          <h2 className="ipac-h2gap">Progress</h2>
          {distances.length > 1 && <div className="ipac-chips" role="group" aria-label="Progress distance">{distances.map((k) => <button key={k} className="ipac-chip" aria-pressed={chartKm === k} onClick={() => setChartKm(k)}>{k} km</button>)}</div>}
          <Progress results={res.filter((r) => r.distanceKm === (chartKm ?? distances[0]))} km={chartKm ?? distances[0]} />
        </>}
      </section>

      <section className="ipac-card">
        <h2>Details</h2>
        <form className="ipac-form" onSubmit={saveDetails}>
          <label>Full name<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
          <div className="ipac-grid3">
            <label>Gender<select value={d.gender} onChange={(e) => setD({ ...d, gender: e.target.value })}><option value="">Not given</option><option value="F">Female</option><option value="M">Male</option><option value="X">Other</option></select></label>
            <label>Birth year<input inputMode="numeric" value={d.birthYear} onChange={(e) => setD({ ...d, birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
            <label>Usual bib<input inputMode="numeric" value={d.bib} onChange={(e) => setD({ ...d, bib: e.target.value })} /></label>
          </div>
          <label>Target pace per km<input inputMode="numeric" placeholder="5:30" value={d.pace} onChange={(e) => setD({ ...d, pace: e.target.value })} /></label>
          <button className="ipac-btn ipac-btn-primary">Save details</button>
        </form>
        <label className="ipac-check"><input type="checkbox" checked={m.active} onChange={(e) => save({ active: e.target.checked })} /> Active member</label>
      </section>

      <section className="ipac-card">
        <h2>Safety</h2>
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); save({ emergency: ec.name || ec.phone ? { name: ec.name.trim(), phone: ec.phone.trim() } : undefined }); done("Emergency contact saved"); }}>
          <p className="ipac-label">Emergency contact</p>
          <div className="ipac-grid2"><label>Name<input value={ec.name} onChange={(e) => setEc({ ...ec, name: e.target.value })} /></label><label>Phone<input inputMode="tel" value={ec.phone} onChange={(e) => setEc({ ...ec, phone: e.target.value })} /></label></div>
          <button className="ipac-btn ipac-btn-outline">Save emergency contact</button>
        </form>
        {C.isMinor(m, yr) && (
          <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); save({ guardian: { name: gd.name.trim(), phone: gd.phone.trim() } }); done("Guardian saved"); }}>
            <p className="ipac-label">Parent or guardian (under 18)</p>
            <div className="ipac-grid2"><label>Name<input value={gd.name} onChange={(e) => setGd({ ...gd, name: e.target.value })} /></label><label>Phone<input inputMode="tel" value={gd.phone} onChange={(e) => setGd({ ...gd, phone: e.target.value })} /></label></div>
            <button className="ipac-btn ipac-btn-outline">Save guardian</button>
            <label className="ipac-check"><input type="checkbox" disabled={!m.guardian?.name} checked={!!m.consentAt} onChange={(e) => save({ consentAt: e.target.checked ? Date.now() : undefined })} />
              Parent or guardian agreed to this runner taking part{m.consentAt ? ` (recorded ${new Date(m.consentAt).toLocaleDateString()})` : ""}</label>
          </form>)}
      </section>

      <section className="ipac-card">
        <h2>Training plan</h2>
        {m.plan.length > 0 && <ul className="ipac-roster">{m.plan.map((it) => <li key={it.id}><span className="ipac-who"><b>{it.day}</b><small>{it.text}</small></span><Confirm label="Remove" ask="Remove?" aria={`Remove ${it.day} plan`} onYes={() => save({ plan: m.plan.filter((x) => x.id !== it.id) })} /></li>)}</ul>}
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); if (!plan.day.trim() || !plan.text.trim()) return; save({ plan: [...m.plan, { id: crypto.randomUUID(), day: plan.day.trim().slice(0, 30), text: plan.text.trim().slice(0, 200) }] }); setPlan({ day: "", text: "" }); }}>
          <div className="ipac-grid2"><label>Day<input placeholder="Tuesday" value={plan.day} onChange={(e) => setPlan({ ...plan, day: e.target.value })} /></label><label>Workout<input placeholder="6 x 400 m, 90 s rest" value={plan.text} onChange={(e) => setPlan({ ...plan, text: e.target.value })} /></label></div>
          <button className="ipac-btn ipac-btn-outline" disabled={!plan.day.trim() || !plan.text.trim()}>Add to plan</button>
        </form>
      </section>

      <section className="ipac-card">
        <h2>Coach notes</h2>
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; save({ notes: [{ id: crypto.randomUUID(), at: Date.now(), text: note.trim().slice(0, 500) }, ...m.notes] }); setNote(""); }}>
          <textarea aria-label="New coach note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong finish today; work on arm swing." />
          <button className="ipac-btn ipac-btn-outline" disabled={!note.trim()}>Add note</button>
        </form>
        {m.notes.length > 0 && <ul className="ipac-roster">{m.notes.map((n) => <li key={n.id}><span className="ipac-who"><small>{new Date(n.at).toLocaleDateString()}</small><span>{n.text}</span></span><Confirm label="Delete" ask="Delete?" aria="Delete note" onYes={() => save({ notes: m.notes.filter((x) => x.id !== n.id) })} /></li>)}</ul>}
        <p className="ipac-hint">Notes stay on this phone. They are never shown publicly.</p>
      </section>
      {err && <p role="alert" className="ipac-err">{err}</p>}{ok && <p role="status" className="ipac-ok">{ok}</p>}
      <Confirm className="ipac-btn ipac-btn-quiet" label="Remove runner from the club" ask={`Remove ${m.name}? Past results stay.`} onYes={() => { setClub({ ...club, members: club.members.filter((x) => x.id !== m.id) }); back(); }} />
    </>
  );
}

/** One series (this runner at one distance): 2px line, 8px markers, a tooltip per point, the best time labelled. */
function Progress({ results, km }: { results: C.Result[]; km: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (results.length < 2) return <p className="ipac-hint">One more {km} km run and a progress line appears here.</p>;
  const W = 320, H = 150, L = 46, R = 12, T = 14, B = 26;
  const ms = results.map((r) => r.ms), lo = Math.min(...ms), hi = Math.max(...ms), pad = Math.max(5000, (hi - lo) * 0.15);
  const y0 = lo - pad, y1 = hi + pad, x = (i: number) => L + (i * (W - L - R)) / (results.length - 1), y = (v: number) => T + ((v - y0) / (y1 - y0)) * (H - T - B); // faster = higher up
  const best = ms.indexOf(lo), ticks = [lo, hi];
  return (
    <figure className="ipac-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${km} km times over ${results.length} runs. Best ${S.fmtTime(lo)}.`}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="ipac-grid" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="ipac-axis">{S.fmtTime(v)}</text></g>)}
        <polyline fill="none" className="ipac-line" points={results.map((r, i) => `${x(i)},${y(r.ms)}`).join(" ")} />
        {results.map((r, i) => (
          <g key={r.sessionId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <circle cx={x(i)} cy={y(r.ms)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(r.ms)} r={i === best ? 5 : 4} className={i === best ? "ipac-dotbest" : "ipac-dotpt"} />
          </g>))}
        <text x={x(best)} y={y(lo) - 9} textAnchor="middle" className="ipac-axis ipac-axisstrong">PB</text>
        <text x={L} y={H - 6} className="ipac-axis">{results[0].date}</text><text x={W - R} y={H - 6} textAnchor="end" className="ipac-axis">{results[results.length - 1].date}</text>
      </svg>
      <figcaption className="ipac-hint" aria-live="polite">{hover !== null ? `${results[hover].date}: ${S.fmtTime(results[hover].ms)} (${S.ordinal(results[hover].rank)} of ${results[hover].of})` : "Higher is faster. Tap a point for the time."}</figcaption>
    </figure>
  );
}

function League({ club, history, today }: Props) {
  const yr = year(today), rows = C.league(history, club.members, yr);
  return (
    <section className="ipac-card">
      <h2>{yr} league</h2>
      <p className="ipac-hint">1 point for every finish, plus {C.PLACE_POINTS.join(", ")} for 1st to {C.PLACE_POINTS.length}th. Club members in races only.</p>
      {!rows.length ? <p className="ipac-empty">No league points yet this year. Add runners to the club and pick them when you check in.</p> : (
        <ol className="ipac-board">{rows.map((r, i) => (
          <li key={r.memberId} className={i === 0 ? "ipac-pod ipac-pod-1" : ""}><span className="ipac-rank">{S.ordinal(i + 1)}</span>
            <span className="ipac-who"><b>{r.name}</b><small>{r.runs} run{r.runs === 1 ? "" : "s"} · {r.wins} win{r.wins === 1 ? "" : "s"}</small></span><span className="ipac-time">{r.points}<small> pts</small></span></li>))}</ol>)}
    </section>
  );
}

function Records({ club, history }: Props) {
  const rows = C.clubRecords(history, club.members), kms = [...new Set(rows.map((r) => r.distanceKm))];
  const G = { All: "Overall", F: "Women", M: "Men", X: "Other" } as const;
  return (
    <section className="ipac-card">
      <h2>Club records</h2>
      {!kms.length ? <p className="ipac-empty">Records appear once club members finish races.</p> : kms.map((k) => (
        <div key={k} className="ipac-recgroup"><p className="ipac-label">{k} km</p>
          <ul className="ipac-roster">{rows.filter((r) => r.distanceKm === k).map((r) => (
            <li key={r.group}><span className="ipac-who"><b>{G[r.group]}: {S.fmtTime(r.ms)}</b><small>{r.name} · {r.date}</small></span></li>))}</ul></div>))}
    </section>
  );
}
