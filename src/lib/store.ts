import type { Session } from "./session";
import { cleanPrefs, type Prefs } from "./prefs";
// Offline storage: IndexedDB with localStorage fallback. Sessions that still need
// uploading are queued in an outbox and flushed when the browser comes online.
const DB = "ipac", STORE = "kv";
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const q = indexedDB.open(DB, 1);
  q.onupgradeneeded = () => q.result.createObjectStore(STORE);
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
});
export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  } catch { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(value, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  } catch { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
}
export const loadSession = () => kvGet<Session>("current");
export const saveSession = (s: Session) => kvSet("current", s);

export interface Config { serverUrl: string; token: string; router?: string }
/** Built-in server address. "same-origin" means the server sits behind the same address as the app (the droplet set-up). */
export const defaultServer = () => { const v = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? ""; return v === "same-origin" ? location.origin : v; };
export const loadConfig = async (): Promise<Config> => { const c = await kvGet<Config>("config"); return c ? { ...c, serverUrl: c.serverUrl || defaultServer() } : { serverUrl: defaultServer(), token: "" }; };
export const saveConfig = (c: Config) => kvSet("config", c);
export const loadHistory = async () => (await kvGet<Session[]>("history")) ?? [];
export async function archive(s: Session) {
  await kvSet("history", [...(await loadHistory()).filter((x) => x.id !== s.id), s].slice(-200));
  const box = (await kvGet<Session[]>("outbox")) ?? [];
  await kvSet("outbox", [...box.filter((x) => x.id !== s.id), s]);
}
export const pendingCount = async () => ((await kvGet<Session[]>("outbox")) ?? []).length;
/** Uploads queued sessions to the club server. Needs a server URL and the coach token. */
export async function flushOutbox(): Promise<{ sent: number; pending: number }> {
  const box = (await kvGet<Session[]>("outbox")) ?? [], cfg = await loadConfig();
  if (!cfg.serverUrl || !cfg.token || !navigator.onLine) return { sent: 0, pending: box.length };
  const left: Session[] = []; let sent = 0;
  for (const s of box) {
    // GPS tracks stay on the device; only results are uploaded.
    const { tracks: _t, ...lean } = s;
    try {
      const r = await fetch(cfg.serverUrl.replace(/\/$/, "") + "/sync", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` }, body: JSON.stringify(lean) });
      if (r.ok) sent++; else left.push(s);
    } catch { left.push(s); }
  }
  await kvSet("outbox", left); return { sent, pending: left.length };
}
export const loadRoutes = async () => (await kvGet<import("./routes").Route[]>("routes")) ?? [];
export const saveRoutes = (r: import("./routes").Route[]) => kvSet("routes", r);
export const loadPrefs = async () => cleanPrefs(await kvGet<Partial<Prefs>>("prefs"));
export const savePrefs = (p: Prefs) => kvSet("prefs", p);
export const loadClub = async (): Promise<import("./club").ClubData> => ({ ...(await import("./club")).emptyClub(), ...((await kvGet<import("./club").ClubData>("club")) ?? {}) });
export const saveClub = (c: import("./club").ClubData) => kvSet("club", c);
