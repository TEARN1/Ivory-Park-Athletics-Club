import { useCallback, useEffect, useState } from "react";
import { deviceId, getProgram, joinProgram, listToday, loadJoined, localDate, myJoin, saveJoined, type Joined, type Program } from "../lib/join";
import { kvGet, kvSet, type Config } from "../lib/store";
import type { ClubEvent } from "../lib/club";
import { Confirm } from "../ui";

/** Runner landing: pick the run that is open today and join it. */
export default function Today({ cfg, deepLink }: { cfg: Config; deepLink: { code: string; server: string } | null }) {
  const server = deepLink?.server ?? cfg.serverUrl;
  return <><TodayRun cfg={cfg} deepLink={deepLink} /><Upcoming server={server} /></>;
}
function TodayRun({ cfg, deepLink }: { cfg: Config; deepLink: { code: string; server: string } | null }) {
  const server = deepLink?.server ?? cfg.serverUrl;
  const [joined, setJoined] = useState<Joined | null>(null), [me, setMe] = useState<{ bib: string | null; open: boolean } | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null), [name, setName] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { loadJoined().then((j) => setJoined(j && j.date === localDate() ? j : null)); kvGet<string>("myName").then((n) => n && setName(n)); }, []);

  const refresh = useCallback(async () => {
    if (!server) return; setErr("");
    try { setPrograms(deepLink ? [await getProgram(server, deepLink.code)] : await listToday(server, localDate())); }
    catch (e) { setPrograms([]); setErr((e as Error).message); }
  }, [server, deepLink]);
  useEffect(() => { if (!joined) refresh(); }, [joined, refresh]);

  useEffect(() => { // wait for the coach to give this runner a bib
    if (!joined) return; let live = true;
    const tick = () => myJoin(joined.server, joined.code, joined.joinerId).then((m) => live && setMe(m)).catch(() => {});
    tick(); const t = setInterval(tick, 4000); return () => { live = false; clearInterval(t); };
  }, [joined]);

  const join = async (p: Program) => {
    setBusy(p.code); setErr("");
    try {
      const r = await joinProgram(server, p.code, name, await deviceId());
      const j: Joined = { server, code: p.code, joinerId: r.joinerId, name: name.trim(), date: p.date, distanceKm: p.distanceKm };
      await saveJoined(j); await kvSet("myName", name.trim()); setMe({ bib: r.bib, open: true }); setJoined(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };

  if (joined) return (
    <section className="ipac-card ipac-youre-in">
      <h2>You're in</h2>
      <p>{joined.name} · today's {joined.distanceKm} km run</p>
      {me?.bib ? <><div className="ipac-bigbib" aria-label={`Your bib number is ${me.bib}`}>{me.bib}</div><p className="ipac-hint">Your bib number. Tell the timekeeper this number when you finish.</p></>
        : <p className="ipac-wait" role="status">Waiting for the coach to give you a bib number…</p>}
      <Confirm label="Leave this run" ask="Leave this run?" onYes={async () => { await saveJoined(null); setJoined(null); setMe(null); }} />
    </section>
  );
  if (!server) return (
    <section className="ipac-card">
      <h2>Today at Ivory Park AC</h2>
      <p className="ipac-hint">To join a live training run or race, ask your coach for today's join QR code or link and scan it with this phone.</p>
      <div className="ipac-training-schedule" style={{ marginTop: "14px" }}>
        <h3 style={{ fontSize: "1.05rem", margin: "0 0 8px" }}>Weekly Training Schedule</h3>
        <ul className="ipac-list" style={{ fontSize: "0.88rem" }}>
          <li><b>Tuesday &amp; Thursday:</b> 17:30 · Track Intervals &amp; Speedwork</li>
          <li><b>Saturday:</b> 06:30 · Official 5km Time Trial (Freedom Drive)</li>
          <li><b>Sunday:</b> 06:00 · Community Long Run (10km / 15km / 21km)</li>
        </ul>
        <p className="ipac-hint" style={{ marginTop: "8px" }}>Meeting Point: Ivory Park Athletics Hub / Freedom Drive</p>
      </div>
    </section>
  );
  return (
    <section className="ipac-card">
      <h2>Today's runs</h2>
      {deepLink && <p className="ipac-hint">Joining through {new URL(server).host}</p>}
      <label className="ipac-namefield">Your name<input aria-label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naledi" /></label>
      {programs === null ? <p className="ipac-hint">Looking for today's run…</p> : programs.length === 0 ? <p className="ipac-empty">No run is open for joining today. Ask your coach to open it, then check again.</p> : (
        <ul className="ipac-programs">{programs.map((p) => (
          <li key={p.code}>
            <span className="ipac-who"><b>{p.distanceKm} km run</b><small>{p.date === localDate() ? "Today" : p.date} · code {p.code}{p.open === false && " · closed"}</small></span>
            <button className="ipac-btn ipac-btn-hero ipac-join-btn" disabled={!name.trim() || busy === p.code || p.open === false} onClick={() => join(p)}>{busy === p.code ? "Joining…" : "Join this run"}</button>
          </li>))}</ul>)}
      {err && <p role="alert" className="ipac-err">{err}</p>}
      <button className="ipac-btn ipac-btn-quiet" onClick={refresh}>Check again</button>
    </section>
  );
}

/** Coming up: time trials and long runs. Runners say whether they're coming (one answer per phone). */
function Upcoming({ server }: { server: string }) {
  const [events, setEvents] = useState<ClubEvent[]>([]), [counts, setCounts] = useState<Record<string, number>>({}), [mine, setMine] = useState<Record<string, boolean>>({});
  const [name, setName] = useState(""), [err, setErr] = useState("");
  const load = useCallback(() => { if (server) fetch(server.replace(/\/$/, "") + "/public.json").then((r) => r.json()).then((j) => { setEvents(j.bundle?.events ?? []); setCounts(j.counts ?? {}); }).catch(() => {}); }, [server]);
  useEffect(() => { load(); kvGet<Record<string, boolean>>("rsvps").then((r) => r && setMine(r)); kvGet<string>("myName").then((n) => n && setName(n)); }, [load]);
  const answer = async (e: ClubEvent, coming: boolean) => {
    if (!name.trim()) { setErr("Type your name first"); return; }
    try {
      const r = await fetch(`${server.replace(/\/$/, "")}/events/${e.id}/rsvp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, coming, deviceId: await deviceId() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not save your answer");
      const m = { ...mine, [e.id]: coming }; setMine(m); kvSet("rsvps", m); kvSet("myName", name.trim()); setCounts({ ...counts, [e.id]: j.coming }); setErr("");
    } catch (x) { setErr((x as Error).message === "Failed to fetch" ? "Cannot reach the club server." : (x as Error).message); }
  };
  if (!server || !events.length) return null;
  return (
    <section className="ipac-card">
      <h2>Coming up</h2>
      {(!name.trim() || Object.keys(mine).length === 0) && <label className="ipac-namefield">Your name<input aria-label="Your name for events" value={name} onChange={(e) => setName(e.target.value)} /></label>}
      <ul className="ipac-programs">{events.map((e) => (
        <li key={e.id}><span className="ipac-who"><b>{e.title}</b><small>{e.date} {e.time}{e.distanceKm ? ` · ${e.distanceKm} km` : ""} · {counts[e.id] ?? 0} coming</small>{e.notes && <small>{e.notes}</small>}</span>
          <div className="ipac-seg" role="group" aria-label={`Are you coming to ${e.title}?`}>
            <button aria-pressed={mine[e.id] === true} onClick={() => answer(e, true)}>I'm coming</button>
            <button aria-pressed={mine[e.id] === false} onClick={() => answer(e, false)}>Can't make it</button>
          </div></li>))}</ul>
      {err && <p role="alert" className="ipac-err">{err}</p>}
    </section>
  );
}
