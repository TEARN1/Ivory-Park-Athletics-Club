import { standings, type Session } from "./session";

/* ---------- members ---------- */
export type Gender = "F" | "M" | "X";
export interface Contact { name: string; phone: string }
export interface Note { id: string; at: number; text: string }
export interface PlanItem { id: string; day: string; text: string }
export interface Member {
  id: string; name: string; bib?: string; licenseNumber?: string; gender?: Gender; birthYear?: number;
  emergency?: Contact; guardian?: Contact; consentAt?: number;   // parent or guardian consent, needed under 18
  active: boolean; joinedAt: number; targetPaceSec?: number; notes: Note[]; plan: PlanItem[];
  updatedAt?: number;   // used to merge backups from two phones: the newer edit wins
}
export function newMember(name: string, extra: Partial<Member> = {}, now = Date.now()): Member {
  const n = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!n) throw new Error("Enter the runner's name");
  if (extra.birthYear !== undefined && !(extra.birthYear >= 1920 && extra.birthYear <= new Date(now).getFullYear())) throw new Error("Birth year looks wrong");
  return { id: crypto.randomUUID(), name: n, active: true, joinedAt: now, notes: [], plan: [], ...extra };
}
/** Age reached this year. Only the birth year is stored, so this can be one year high before the birthday. */
export const ageThisYear = (m: Pick<Member, "birthYear">, year: number) => (m.birthYear ? year - m.birthYear : undefined);
export const isMinor = (m: Member, year: number) => { const a = ageThisYear(m, year); return a !== undefined && a < 18; };
export const needsConsent = (m: Member, year: number) => isMinor(m, year) && !m.consentAt;
/** "Thandi Mokoena" -> "Thandi M." for anything shown in public. */
export function publicName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Runner";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
export const findMemberByName = (members: Member[], name: string) => {
  const k = name.trim().toLowerCase(); return k ? members.find((m) => m.name.toLowerCase() === k) : undefined;
};

/* ---------- age groups (common SA road-running groups; change here if your league differs) ---------- */
export const CATEGORIES: { id: string; label: string; from: number; to: number }[] = [
  { id: "junior", label: "Junior (under 20)", from: 0, to: 19 },
  { id: "senior", label: "Senior (20–39)", from: 20, to: 39 },
  { id: "veteran", label: "Veteran (40–49)", from: 40, to: 49 },
  { id: "master", label: "Master (50–59)", from: 50, to: 59 },
  { id: "grandmaster", label: "Grand master (60+)", from: 60, to: 200 },
];
export const categoryOf = (age?: number) => (age === undefined ? undefined : CATEGORIES.find((c) => age >= c.from && age <= c.to));
/**
 * Approximate age factor (1 = peak age). This is a simple club estimate,
 * NOT the official WMA age-grading tables, and must be labelled that way.
 */
export function ageFactor(age?: number): number {
  if (age === undefined) return 1;
  if (age < 20) return Math.max(0.8, 1 - 0.015 * (20 - age));
  if (age <= 34) return 1;
  return Math.max(0.5, 1 - 0.008 * (age - 34));
}
export const ageAdjustedMs = (ms: number, age?: number) => Math.round(ms * ageFactor(age));

/* ---------- results across history ---------- */
export interface Result { sessionId: string; date: string; distanceKm: number; ms: number; rank: number; of: number }
const races = (h: Session[]) => h.filter((s) => (s.mode ?? "race") === "race");
export function memberResults(history: Session[], memberId: string): Result[] {
  const out: Result[] = [];
  for (const s of races(history)) {
    const rows = standings(s), row = rows.find((r) => r.runner.memberId === memberId);
    if (row) out.push({ sessionId: s.id, date: s.date, distanceKm: s.distanceKm, ms: row.elapsedMs, rank: row.rank, of: rows.length });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function personalBests(results: Result[]): Result[] {
  const best = new Map<number, Result>();
  for (const r of results) { const b = best.get(r.distanceKm); if (!b || r.ms < b.ms) best.set(r.distanceKm, r); }
  return [...best.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}
/** Sessions the member was checked in to (finished or not), any mode. */
export const attendance = (history: Session[], memberId: string) => history.filter((s) => s.runners.some((r) => r.memberId === memberId)).map((s) => s.date).sort();

const DAY = 86400000;
export function weekIndex(date: string): number { // Monday-based weeks
  const t = Date.parse(date + "T00:00:00Z"), dow = (new Date(t).getUTCDay() + 6) % 7;
  return Math.floor((t - dow * DAY + 3 * DAY) / (7 * DAY));
}
/** Consecutive weeks with at least one session, counting back from this week (or last week if none yet this week). */
export function weekStreak(dates: string[], today: string): number {
  const weeks = new Set(dates.map(weekIndex)); let w = weekIndex(today);
  if (!weeks.has(w)) w--;
  let n = 0; while (weeks.has(w)) { n++; w--; }
  return n;
}
export interface Badge { id: string; label: string }
export function badges(history: Session[], memberId: string, today: string): Badge[] {
  const dates = attendance(history, memberId), res = memberResults(history, memberId), out: Badge[] = [];
  const streak = weekStreak(dates, today);
  if (dates.length >= 1) out.push({ id: "first", label: "First session" });
  for (const n of [5, 10, 25, 50, 100]) if (dates.length >= n) out.push({ id: `s${n}`, label: `${n} sessions` });
  for (const n of [4, 8, 12]) if (streak >= n) out.push({ id: `w${n}`, label: `${n}-week streak` });
  const last = res[res.length - 1];
  if (last && res.filter((r) => r.distanceKm === last.distanceKm).length > 1 && personalBests(res).some((b) => b.sessionId === last.sessionId)) out.push({ id: "pb", label: "New personal best" });
  if (res.some((r) => r.rank === 1)) out.push({ id: "win", label: "Won a session" });
  return out;
}

/* ---------- league and records ---------- */
export const PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2, 1]; // plus 1 point for every finish
export interface LeagueRow { memberId: string; name: string; points: number; runs: number; wins: number }
export function league(history: Session[], members: Member[], year: number): LeagueRow[] {
  const rows = new Map<string, LeagueRow>(), names = new Map(members.map((m) => [m.id, m.name]));
  for (const s of races(history)) {
    if (!s.date.startsWith(String(year))) continue;
    for (const r of standings(s)) {
      const id = r.runner.memberId; if (!id || !names.has(id)) continue;
      const row = rows.get(id) ?? { memberId: id, name: names.get(id)!, points: 0, runs: 0, wins: 0 };
      row.points += 1 + (PLACE_POINTS[r.rank - 1] ?? 0); row.runs++; if (r.rank === 1) row.wins++;
      rows.set(id, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}
export interface RecordRow { distanceKm: number; group: "All" | Gender; memberId: string; name: string; ms: number; date: string }
export function clubRecords(history: Session[], members: Member[]): RecordRow[] {
  const byId = new Map(members.map((m) => [m.id, m])), best = new Map<string, RecordRow>();
  for (const s of races(history)) for (const r of standings(s)) {
    const m = r.runner.memberId ? byId.get(r.runner.memberId) : undefined; if (!m) continue;
    for (const group of ["All", ...(m.gender ? [m.gender] : [])] as RecordRow["group"][]) {
      const k = `${s.distanceKm}|${group}`, cur = best.get(k);
      if (!cur || r.elapsedMs < cur.ms) best.set(k, { distanceKm: s.distanceKm, group, memberId: m.id, name: m.name, ms: r.elapsedMs, date: s.date });
    }
  }
  return [...best.values()].sort((a, b) => a.distanceKm - b.distanceKm || a.group.localeCompare(b.group));
}

/* ---------- whole-club data kept on the coach's phone ---------- */
export interface ClubEvent { id: string; date: string; time: string; title: string; distanceKm?: number; notes?: string }
export interface News { id: string; at: number; title: string; body: string; photo?: string }
export interface Sponsor { id: string; name: string; url?: string }
export interface CustomRecord {
  id: string;
  distanceKm: number;
  group: "All" | Gender;
  name: string;
  ms: number;
  date: string; // e.g. "2000" or "2000-06-15"
  notes?: string;
}
export interface ClubData { members: Member[]; events: ClubEvent[]; news: News[]; sponsors: Sponsor[]; records?: CustomRecord[] }
export const emptyClub = (): ClubData => ({ members: [], events: [], news: [], sponsors: [], records: [] });
export const fmtPaceInput = (sec?: number) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : "");
export function parsePace(text: string): number | undefined {
  const t = text.trim(); if (!t) return undefined;
  const m = t.match(/^(\d{1,2}):([0-5]\d)$/); if (!m) throw new Error("Write pace as minutes:seconds, like 5:30");
  const s = +m[1] * 60 + +m[2]; if (s < 120 || s > 1200) throw new Error("Pace should be between 2:00 and 20:00 per km"); return s;
}

/** Parses time like "14:28" or "1:04:15" into milliseconds. */
export function parseTimeToMs(text: string): number {
  const t = text.trim();
  if (!t) throw new Error("Enter a record time (e.g. 14:28 or 1:04:15)");
  const parts = t.split(":").map(Number);
  if (parts.some(isNaN)) throw new Error("Invalid time format. Use MM:SS or HH:MM:SS");
  if (parts.length === 2) {
    const [min, sec] = parts;
    return (min * 60 + sec) * 1000;
  }
  if (parts.length === 3) {
    const [hr, min, sec] = parts;
    return (hr * 3600 + min * 60 + sec) * 1000;
  }
  throw new Error("Use MM:SS (e.g. 14:28) or HH:MM:SS (e.g. 1:04:15)");
}
