import qrcode from "qrcode-generator";
import { kvGet, kvSet } from "./store";

const trim = (u: string) => u.replace(/\/$/, "");
export const isHttpUrl = (u: string) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } };

/** Link a runner opens. It carries the server address so the runner needs no set-up. */
export const joinLink = (appUrl: string, code: string, server: string) => `${appUrl}?join=${encodeURIComponent(code)}&server=${encodeURIComponent(trim(server))}`;
export function parseJoinParams(search: string): { code: string; server: string } | null {
  const q = new URLSearchParams(search), code = (q.get("join") ?? "").toUpperCase(), server = q.get("server") ?? "";
  return /^[A-Z0-9]{4,8}$/.test(code) && isHttpUrl(server) ? { code, server: trim(server) } : null;
}
export function qrSvg(text: string): string {
  const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const localDate = today;

async function call<T>(server: string, path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(trim(server) + path, init); } catch { throw new Error("Cannot reach the club server. Check your connection."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any).error ?? `The server said ${r.status}`);
  return j as T;
}
const coach = (token: string) => ({ "content-type": "application/json", authorization: `Bearer ${token}` });
const open = { "content-type": "application/json" };

export interface Program { code: string; date: string; distanceKm: number; open?: boolean }
export const openProgram = (server: string, token: string, date: string, distanceKm: number) => call<{ code: string }>(server, "/programs", { method: "POST", headers: coach(token), body: JSON.stringify({ date, distanceKm }) });
export const closeProgram = (server: string, token: string, code: string) => call<{ ok: true }>(server, `/programs/${code}/close`, { method: "POST", headers: coach(token), body: "{}" });
export const fetchJoiners = (server: string, token: string, code: string) => call<{ id: string; name: string; bib: string | null }[]>(server, `/programs/${code}/joiners`, { headers: coach(token) });
export const assignBibs = (server: string, token: string, code: string, assignments: Record<string, string>) => call<{ ok: true }>(server, `/programs/${code}/assign`, { method: "POST", headers: coach(token), body: JSON.stringify({ assignments }) });
export const listToday = (server: string, date: string) => call<Program[]>(server, `/programs?date=${date}`);
export const getProgram = (server: string, code: string) => call<Program>(server, `/programs/${code}`);
export const joinProgram = (server: string, code: string, name: string, deviceId: string) => call<{ joinerId: string; bib: string | null }>(server, `/programs/${code}/join`, { method: "POST", headers: open, body: JSON.stringify({ name, deviceId }) });
export const myJoin = (server: string, code: string, joinerId: string) => call<{ name: string; bib: string | null; open: boolean }>(server, `/programs/${code}/me?joinerId=${encodeURIComponent(joinerId)}`);

export interface Joined { server: string; code: string; joinerId: string; name: string; date: string; distanceKm: number }
export const loadJoined = () => kvGet<Joined>("joined");
export const saveJoined = (j: Joined | null) => kvSet("joined", j);
export async function deviceId(): Promise<string> {
  let id = await kvGet<string>("deviceId"); if (!id) { id = crypto.randomUUID(); await kvSet("deviceId", id); } return id;
}
