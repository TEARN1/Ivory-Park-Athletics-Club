import { useEffect, useState } from "react";
import { makeBackup, mergeData, parseBackup, type BackupData } from "../lib/backup";
import * as C from "../lib/club";
import { localDate } from "../lib/join";
import { kvSet, loadClub, loadHistory, loadPrefs, loadRoutes, loadSession, type Config } from "../lib/store";
import { Confirm, download } from "../ui";

export interface PublishState { at?: number; error?: string }
type Props = { club: C.ClubData; setClub: (c: C.ClubData) => void; cfg: Config; publish: PublishState; publishNow: () => void };

/** Events, news, sponsors and the public club page. All of it is kept on this phone and published to the server. */
export default function ClubAdmin({ club, setClub, cfg, publish, publishNow }: Props) {
  const today = localDate(), coach = !!(cfg.serverUrl && cfg.token), base = cfg.serverUrl.replace(/\/$/, "");
  const [ev, setEv] = useState({ date: today, time: "06:30", title: "", km: "", notes: "" }), [news, setNews] = useState({ title: "", body: "", photo: "" }), [sp, setSp] = useState({ name: "", url: "" });
  const [err, setErr] = useState(""), [counts, setCounts] = useState<Record<string, number>>({}), [names, setNames] = useState<Record<string, string[]>>({});
  useEffect(() => { if (cfg.serverUrl) fetch(base + "/public.json").then((r) => r.json()).then((j) => setCounts(j.counts ?? {})).catch(() => {}); }, [cfg.serverUrl, publish.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = async (id: string) => { try { const r = await fetch(`${base}/events/${id}/rsvps`, { headers: { authorization: `Bearer ${cfg.token}` } }); const j = await r.json(); setNames({ ...names, [id]: (j as { name: string; coming: boolean }[]).filter((x) => x.coming).map((x) => x.name) }); } catch { setErr("Cannot reach the club server."); } };
  const upcoming = club.events.filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <>
      <section className="ipac-card">
        <h2>Events</h2>
        {upcoming.length > 0 ? <ul className="ipac-roster">{upcoming.map((e) => (
          <li key={e.id}><span className="ipac-who"><b>{e.title}</b><small>{e.date} {e.time}{e.distanceKm ? ` · ${e.distanceKm} km` : ""} · {counts[e.id] ?? 0} coming</small>
            {names[e.id] && <small>{names[e.id].join(", ") || "Nobody yet"}</small>}</span>
            {coach && <button className="ipac-btn ipac-btn-quiet" aria-label={`Who is coming to ${e.title}`} onClick={() => who(e.id)}>Who</button>}
            <Confirm label="Remove" ask="Remove?" aria={`Remove ${e.title}`} onYes={() => setClub({ ...club, events: club.events.filter((x) => x.id !== e.id) })} /></li>))}</ul>
          : <p className="ipac-empty">No upcoming events. Add time trials and long runs so runners can say they're coming.</p>}
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); if (!ev.title.trim()) return; setClub({ ...club, events: [...club.events, { id: crypto.randomUUID(), date: ev.date, time: ev.time, title: ev.title.trim().slice(0, 80), distanceKm: +ev.km > 0 ? +ev.km : undefined, notes: ev.notes.trim().slice(0, 300) || undefined }] }); setEv({ ...ev, title: "", notes: "" }); }}>
          <label>What<input placeholder="Saturday time trial" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} /></label>
          <div className="ipac-grid3"><label>Date<input type="date" value={ev.date} min={today} onChange={(e) => setEv({ ...ev, date: e.target.value })} /></label>
            <label>Time<input type="time" value={ev.time} onChange={(e) => setEv({ ...ev, time: e.target.value })} /></label>
            <label>km<input inputMode="decimal" value={ev.km} onChange={(e) => setEv({ ...ev, km: e.target.value })} /></label></div>
          <label>Notes<input placeholder="Meet at the hall" value={ev.notes} onChange={(e) => setEv({ ...ev, notes: e.target.value })} /></label>
          <button className="ipac-btn ipac-btn-outline" disabled={!ev.title.trim()}>Add event</button>
        </form>
      </section>

      <section className="ipac-card">
        <h2>News and photos</h2>
        {club.news.length > 0 && <ul className="ipac-roster">{[...club.news].sort((a, b) => b.at - a.at).map((n) => (
          <li key={n.id}>{n.photo && <img className="ipac-thumb" src={n.photo} alt="" />}<span className="ipac-who"><b>{n.title}</b><small>{new Date(n.at).toLocaleDateString()}</small></span>
            <Confirm label="Remove" ask="Remove?" aria={`Remove ${n.title}`} onYes={() => setClub({ ...club, news: club.news.filter((x) => x.id !== n.id) })} /></li>))}</ul>}
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); if (!news.title.trim()) return; setClub({ ...club, news: [...club.news, { id: crypto.randomUUID(), at: Date.now(), title: news.title.trim().slice(0, 100), body: news.body.trim().slice(0, 2000), photo: news.photo || undefined }] }); setNews({ title: "", body: "", photo: "" }); }}>
          <label>Headline<input value={news.title} onChange={(e) => setNews({ ...news, title: e.target.value })} /></label>
          <label>Story<textarea value={news.body} onChange={(e) => setNews({ ...news, body: e.target.value })} /></label>
          <label>Photo (optional)<input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setNews({ ...news, photo: await shrinkPhoto(f) }); } catch (x) { setErr((x as Error).message); } }} /></label>
          {news.photo && <img className="ipac-preview" src={news.photo} alt="Photo to publish" />}
          <p className="ipac-hint">Only post photos of people who agreed, and never of under-18s without a parent's consent.</p>
          <button className="ipac-btn ipac-btn-outline" disabled={!news.title.trim()}>Add news</button>
        </form>
      </section>

      <section className="ipac-card">
        <h2>Sponsors</h2>
        {club.sponsors.length > 0 && <ul className="ipac-roster">{club.sponsors.map((s) => <li key={s.id}><span className="ipac-who"><b>{s.name}</b>{s.url && <small>{s.url}</small>}</span><Confirm label="Remove" ask="Remove?" aria={`Remove ${s.name}`} onYes={() => setClub({ ...club, sponsors: club.sponsors.filter((x) => x.id !== s.id) })} /></li>)}</ul>}
        <form className="ipac-form" onSubmit={(e) => { e.preventDefault(); if (!sp.name.trim()) return; let url: string | undefined = sp.url.trim(); if (url && !/^https?:\/\//i.test(url)) url = "https://" + url; setClub({ ...club, sponsors: [...club.sponsors, { id: crypto.randomUUID(), name: sp.name.trim().slice(0, 60), url: url || undefined }] }); setSp({ name: "", url: "" }); }}>
          <div className="ipac-grid2"><label>Name<input value={sp.name} onChange={(e) => setSp({ ...sp, name: e.target.value })} /></label><label>Website<input inputMode="url" value={sp.url} onChange={(e) => setSp({ ...sp, url: e.target.value })} /></label></div>
          <button className="ipac-btn ipac-btn-outline" disabled={!sp.name.trim()}>Add sponsor</button>
        </form>
      </section>

      <section className="ipac-card">
        <h2>Club web page</h2>
        {!coach ? <p className="ipac-hint">Publishing needs the club server and the coach token (Club server settings above).</p> : (<>
          <p>Address: <span className="ipac-phone">{base}/club</span> · <a href={`${base}/club`} target="_blank" rel="noopener">Open</a></p>
          <p className="ipac-hint">Events, news, sponsors and the last 10 race results, with first names and surname initials only. No contacts, ages or notes. Updates by itself when you change anything here.{publish.at ? ` Last published ${new Date(publish.at).toLocaleTimeString()}.` : ""}</p>
          {publish.error && <p role="alert" className="ipac-err">{publish.error}</p>}
          <button className="ipac-btn ipac-btn-outline" onClick={publishNow}>Publish now</button>
          <p className="ipac-hint">The free server forgets everything when it restarts. Publishing again (or opening this app) puts it back.</p>
        </>)}
      </section>
      <BackupCard />
      {err && <p role="alert" className="ipac-err">{err}</p>}
    </>
  );
}

function BackupCard() {
  const [msg, setMsg] = useState(""), [err, setErr] = useState(""), [pending, setPending] = useState<BackupData | null>(null);
  const gather = async (): Promise<BackupData> => ({ current: await loadSession(), history: await loadHistory(), club: await loadClub(), routes: await loadRoutes(), prefs: await loadPrefs() });
  const write = async (d: BackupData) => { await kvSet("history", d.history); await kvSet("club", d.club); await kvSet("routes", d.routes); if (d.prefs) await kvSet("prefs", d.prefs); if (d.current) await kvSet("current", d.current); location.reload(); };
  return (
    <section className="ipac-card">
      <h2>Backup and restore</h2>
      <p className="ipac-hint">Save everything (runners, sessions, routes, events, settings) to one file. Keep it somewhere safe, or open it on a second phone. The coach token is never in the file.</p>
      <button className="ipac-btn ipac-btn-primary" onClick={async () => { download(`ipac-backup-${localDate()}.json`, JSON.stringify(makeBackup(await gather())), "application/json"); setMsg("Backup saved."); }}>Download backup</button>
      <label className="ipac-filepick">Restore from a backup file
        <input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPending(parseBackup(await f.text()).data); setErr(""); } catch (x) { setErr((x as Error).message); } e.target.value = ""; }} /></label>
      {pending && (
        <div className="ipac-restore">
          <p>The file has {pending.club.members.length} runners and {pending.history.length} sessions.</p>
          <button className="ipac-btn ipac-btn-primary" onClick={async () => write(mergeData(await gather(), pending))}>Combine with this phone</button>
          <Confirm className="ipac-btn ipac-btn-outline" label="Replace everything on this phone" ask="Replace all data on this phone?" onYes={() => write(pending)} />
          <p className="ipac-hint">Combine keeps everything from both phones; where both changed the same runner, the newer change wins.</p>
        </div>)}
      {msg && <p role="status" className="ipac-ok">{msg}</p>}{err && <p role="alert" className="ipac-err">{err}</p>}
    </section>
  );
}

/** Make a phone photo small enough to publish (longest side 1000 px, JPEG, under ~350 KB). */
async function shrinkPhoto(f: File): Promise<string> {
  const img = new Image(), url = URL.createObjectURL(f); img.src = url;
  try { await img.decode(); } catch { throw new Error("That file is not a photo this phone can read."); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  const k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.75, 0.6, 0.45]) { const d = c.toDataURL("image/jpeg", q); if (d.length < 380_000) return d; }
  throw new Error("That photo is too large. Try a smaller one.");
}
