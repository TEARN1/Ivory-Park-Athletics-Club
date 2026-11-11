import { useEffect, useState } from "react";
import type { Notice } from "../lib/live";
import { saveConfig, type Config } from "../lib/store";

export default function Club({ cfg, setCfg, notices }: { cfg: Config; setCfg: (c: Config) => void; notices: Notice[] }) {
  const [draft, setDraft] = useState(cfg), [msg, setMsg] = useState(""), [text, setText] = useState("");
  const [g, setG] = useState({ name: "", contact: "", consent: false }), [guests, setGuests] = useState<any[]>([]);
  const base = cfg.serverUrl.replace(/\/$/, ""), hdr = { "content-type": "application/json", authorization: `Bearer ${cfg.token}` };
  const call = async (path: string, init?: RequestInit) => {
    try { const r = await fetch(base + path, init); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? `Server said ${r.status}`); return j; }
    catch (e) { setMsg((e as Error).message === "Failed to fetch" ? "Cannot reach the club server." : (e as Error).message); return null; }
  };
  const loadGuests = async () => { if (cfg.token) { const j = await call("/guests", { headers: hdr }); if (j) setGuests(j); } };
  useEffect(() => { if (cfg.serverUrl && cfg.token) loadGuests(); }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section>
      <h2>Club server</h2>
      <div className="ipac-form">
        <input aria-label="Server address" placeholder="https://your-club-server" value={draft.serverUrl} onChange={(e) => setDraft({ ...draft, serverUrl: e.target.value })} />
        <input aria-label="Coach token" type="password" placeholder="Coach token (coaches only)" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
        <button onClick={() => { saveConfig(draft); setCfg(draft); setMsg("Saved on this device."); }}>Save</button>
      </div>
      <p className="ipac-hint">The coach token is kept on this device only. Do not enter it on a shared phone.</p>
      {msg && <p role="status">{msg}</p>}

      <h2>Club notices</h2>
      {notices.length === 0 ? <p className="ipac-hint">No notices yet.</p> : <ul className="ipac-list">{[...notices].reverse().map((n) => <li key={n.id}>{n.text}<br /><small>{new Date(n.at).toLocaleString()}</small></li>)}</ul>}
      {cfg.token && cfg.serverUrl && (
        <div className="ipac-form">
          <textarea aria-label="New notice" maxLength={280} placeholder="e.g. Time trial Saturday 6:30, 5 km loop" value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={!text.trim()} onClick={async () => { if (await call("/notices", { method: "POST", headers: hdr, body: JSON.stringify({ text }) })) { setText(""); setMsg("Notice sent to everyone who has the app open."); } }}>Send notice</button>
        </div>
      )}

      <h2>Guest list</h2>
      {cfg.serverUrl ? (
        <form className="ipac-form" onSubmit={async (e) => { e.preventDefault(); if (await call("/guests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(g) })) { setG({ name: "", contact: "", consent: false }); setMsg("Thank you. You are on the club's guest list."); loadGuests(); } }}>
          <input aria-label="Guest name" placeholder="Name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} />
          <input aria-label="Guest contact" placeholder="Phone or email" value={g.contact} onChange={(e) => setG({ ...g, contact: e.target.value })} />
          <label><input type="checkbox" checked={g.consent} onChange={(e) => setG({ ...g, consent: e.target.checked })} /> I agree the club may contact me about time trials and long runs. I can ask to be removed any time.</label>
          <button disabled={!g.name.trim() || !g.consent}>Join guest list</button>
        </form>
      ) : <p className="ipac-hint">Add the club server address to use the guest list.</p>}
      {guests.length > 0 && <ul className="ipac-list">{guests.map((x) => <li key={x.id}>{x.name} · {x.contact || "no contact"}<button aria-label={`Remove ${x.name}`} onClick={async () => { if (await call(`/guests/${x.id}`, { method: "DELETE", headers: hdr })) loadGuests(); }}>Remove</button></li>)}</ul>}
      <p className="ipac-hint">Notices appear in the app. SMS and phone push messages are not set up.</p>
    </section>
  );
}
