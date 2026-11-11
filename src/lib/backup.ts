import type { ClubData } from "./club";
import type { Prefs } from "./prefs";
import type { Route } from "./routes";
import type { Session } from "./session";

/** Everything worth keeping, in one file. The coach token is never included. */
export interface BackupData { current?: Session; history: Session[]; club: ClubData; routes: Route[]; prefs?: Prefs }
export interface Backup { app: "ipac"; version: 1; at: number; data: BackupData }
export const makeBackup = (data: BackupData, now = Date.now()): Backup => ({ app: "ipac", version: 1, at: now, data });

export function parseBackup(text: string): Backup {
  let j: any; try { j = JSON.parse(text); } catch { throw new Error("This file is not a backup from the club app"); }
  if (j?.app !== "ipac" || j.version !== 1 || typeof j.data !== "object") throw new Error("This file is not a backup from the club app");
  const d = j.data, club = d.club ?? {};
  if (!Array.isArray(d.history) || !Array.isArray(d.routes ?? []) || !Array.isArray(club.members ?? [])) throw new Error("The backup file is damaged");
  return { app: "ipac", version: 1, at: Number(j.at) || 0, data: { current: d.current, history: d.history, routes: d.routes ?? [], prefs: d.prefs,
    club: { members: club.members ?? [], events: club.events ?? [], news: club.news ?? [], sponsors: club.sponsors ?? [] } } };
}
const union = <T extends { id: string }>(a: T[], b: T[], prefer: (x: T, y: T) => T) => {
  const m = new Map(a.map((x) => [x.id, x])); for (const y of b) { const x = m.get(y.id); m.set(y.id, x ? prefer(x, y) : y); } return [...m.values()];
};
const sessionScore = (s: Session) => [(s.endedAt ?? 0) > 0 ? 1 : 0, Object.keys(s.finishes ?? {}).length, s.endedAt ?? 0];
const better = (x: Session, y: Session) => { const a = sessionScore(x), b = sessionScore(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? x : y; return x; };
/**
 * Combine this phone's data with a backup from another phone: nothing is lost, and when both
 * have the same runner or session, the more recent or more complete copy is kept.
 */
export function mergeData(local: BackupData, incoming: BackupData): BackupData {
  return {
    current: local.current, prefs: local.prefs,
    history: union(local.history, incoming.history, better).sort((a, b) => a.date.localeCompare(b.date)),
    routes: union(local.routes, incoming.routes, (x, y) => ((y.checkedAt ?? 0) > (x.checkedAt ?? 0) ? y : x)),
    club: {
      members: union(local.club.members, incoming.club.members, (x, y) => ((y.updatedAt ?? y.joinedAt) > (x.updatedAt ?? x.joinedAt) ? y : x)),
      events: union(local.club.events, incoming.club.events, (x) => x),
      news: union(local.club.news, incoming.club.news, (x, y) => (y.at > x.at ? y : x)),
      sponsors: union(local.club.sponsors, incoming.club.sponsors, (x) => x),
    },
  };
}
