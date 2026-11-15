import { useEffect, useState } from "react";
import type { Notice } from "../lib/live";
import type { Prefs } from "../lib/prefs";
import { saveConfig, type Config } from "../lib/store";
import Appearance, { SoundSettings } from "./Appearance";
import ClubAdmin, { type PublishState } from "./ClubAdmin";
import type { ClubData } from "../lib/club";

export default function Club({ cfg, setCfg, notices, prefs, setPrefs, club, setClub, publish, publishNow }: { cfg: Config; setCfg: (c: Config) => void; notices: Notice[]; prefs: Prefs; setPrefs: (p: Prefs) => void; club: ClubData; setClub: (c: ClubData) => void; publish: PublishState; publishNow: () => void }) {
  const [draft, setDraft] = useState(cfg), [msg, setMsg] = useState(""), [text, setText] = useState("");
  useEffect(() => { setDraft(cfg); }, [cfg]); // settings load after the first render
  const [g, setG] = useState({ name: "", contact: "", consent: false }), [guests, setGuests] = useState<any[]>([]);
  const base = cfg.serverUrl.replace(/\/$/, ""), hdr = { "content-type": "application/json", authorization: `Bearer ${cfg.token}` };
  const call = async (path: string, init?: RequestInit) => {
    try { const r = await fetch(base + path, init); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? `Server said ${r.status}`); return j; }
    catch (e) { setMsg((e as Error).message === "Failed to fetch" ? "Cannot reach the club server." : (e as Error).message); return null; }
  };
  const loadGuests = async () => { if (cfg.token) { const j = await call("/guests", { headers: hdr }); if (j) setGuests(j); } };
  useEffect(() => { if (cfg.serverUrl && cfg.token) loadGuests(); }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
    <Appearance prefs={prefs} setPrefs={setPrefs} />
    <SoundSettings prefs={prefs} setPrefs={setPrefs} />
    <section className="ipac-card">
      <div className="ipac-api-status-banner" style={{
        background: "rgba(57, 211, 83, 0.12)",
        border: "1px solid rgba(57, 211, 83, 0.35)",
        borderRadius: "14px",
        padding: "12px 14px",
        marginBottom: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <strong style={{ color: "var(--neon-green, #39d353)", fontSize: "0.92rem" }}>
            Offline Standalone Mode: Zero API Key Required
          </strong>
          <span className="ipac-badge" style={{ background: "rgba(57, 211, 83, 0.2)", color: "#39d353", fontSize: "0.75rem", padding: "2px 8px" }}>
            Active
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "0.82rem", opacity: 0.88, lineHeight: 1.45 }}>
          All map layers (OpenStreetMap, CARTO Dark Matter, OpenTopoMap, Esri Satellite), live GPS tracking, interval clocks, and PWA installs run 100% locally with zero external API keys or subscription accounts.
        </p>
      </div>

      <details>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Optional Self-Hosted Sync Server (No API Key Required)</summary>
      <div className="ipac-form" style={{ marginTop: "12px" }}>
        <input aria-label="Server address" placeholder="Optional Server URL (e.g. https://your-club-server)" value={draft.serverUrl} onChange={(e) => setDraft({ ...draft, serverUrl: e.target.value })} />
        <input aria-label="Coach token" type="password" placeholder="Optional Coach Passcode (Internal club access, not an API key)" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
        <input aria-label="Routing service" placeholder="Optional Router URL (Defaults to free OpenStreetMap)" value={draft.router ?? ""} onChange={(e) => setDraft({ ...draft, router: e.target.value.trim() || undefined })} />
        <button className="ipac-btn ipac-btn-primary" onClick={() => { saveConfig(draft); setCfg(draft); setMsg("Saved on this device."); }}>Save</button>
      </div>
      <p className="ipac-hint">This server setup is entirely optional for multi-device sync. No Google Maps, Mapbox, or third-party API key is needed.</p>
      </details>
      {msg && <p role="status" className="ipac-hint">{msg}</p>}
      <h2 style={{marginTop:16}}>Club notices</h2>
      {notices.length === 0 ? <p className="ipac-hint">No notices yet.</p> : <ul className="ipac-list">{[...notices].reverse().map((n) => <li key={n.id}>{n.text}<br /><small>{new Date(n.at).toLocaleString()}</small></li>)}</ul>}
      {cfg.token && cfg.serverUrl && (
        <div className="ipac-form">
          <textarea aria-label="New notice" maxLength={280} placeholder="e.g. Time trial Saturday 6:30, 5 km loop" value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={!text.trim()} onClick={async () => { if (await call("/notices", { method: "POST", headers: hdr, body: JSON.stringify({ text }) })) { setText(""); setMsg("Notice sent to everyone who has the app open."); } }}>Send notice</button>
        </div>
      )}

      <h2 style={{marginTop:16}}>Guest list</h2>
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
    <ClubAdmin club={club} setClub={setClub} cfg={cfg} publish={publish} publishNow={publishNow} />
    </>
  );
}
