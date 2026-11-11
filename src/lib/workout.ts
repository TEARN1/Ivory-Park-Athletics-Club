import { median, phase, standings, stillRunning, type Session } from "./session";

/* ---------- set-up ---------- */
export function setMode(s: Session, mode: "race" | "laps" | "reps", opts?: { count?: number; km?: number; restSec?: number }): Session {
  if (s.startedAt !== undefined) throw new Error("Change the session type before the start");
  const count = Math.round(opts?.count ?? 0), km = opts?.km ?? 0, rest = Math.round(opts?.restSec ?? 90);
  if (mode === "race") return { ...s, mode, laps: undefined, reps: undefined };
  if (!(count >= 1 && count <= 50)) throw new Error("Choose between 1 and 50 laps or reps");
  if (!(km >= 0.05 && km <= 10)) throw new Error("Lap or rep distance should be between 0.05 and 10 km");
  if (mode === "laps") return { ...s, mode, laps: { count, km }, reps: undefined, distanceKm: round2(count * km) };
  if (!(rest >= 0 && rest <= 900)) throw new Error("Rest should be between 0 and 15 minutes");
  return { ...s, mode, reps: { count, km, restSec: rest }, laps: undefined, distanceKm: round2(count * km) };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
export function addGroup(s: Session, name: string, paceSec: number): Session {
  const n = name.trim().slice(0, 30); if (!n) throw new Error("Name the pace group");
  return { ...s, groups: [...(s.groups ?? []), { id: crypto.randomUUID(), name: n, paceSec }] };
}
export const removeGroup = (s: Session, id: string): Session => ({ ...s, groups: (s.groups ?? []).filter((g) => g.id !== id), runners: s.runners.map((r) => (r.groupId === id ? { ...r, groupId: undefined } : r)) });
export const setGroup = (s: Session, runnerId: string, groupId?: string): Session => ({ ...s, runners: s.runners.map((r) => (r.id === runnerId ? { ...r, groupId } : r)) });

/* ---------- laps ---------- */
export function lapTap(s: Session, id: string, now: number): Session {
  if (phase(s) !== "running" || s.mode !== "laps" || !s.laps || s.finishes[id] !== undefined) return s;
  const marks = [...(s.marks?.[id] ?? []), now - s.startedAt!];
  const done = marks.length >= s.laps.count;
  return { ...s, marks: { ...s.marks, [id]: marks }, finishes: done ? { ...s.finishes, [id]: marks[marks.length - 1]! } : s.finishes };
}
export function undoLap(s: Session, id: string): Session {
  const m = s.marks?.[id] ?? []; if (!m.length) return s;
  const { [id]: _f, ...finishes } = s.finishes;
  return { ...s, finishes, marks: { ...s.marks, [id]: m.slice(0, -1) } };
}
export const lapsDone = (s: Session, id: string) => (s.marks?.[id] ?? []).length;
/** Time of each lap from the elapsed marks. */
export const lapSplits = (marks: (number | null)[]) => marks.map((m, i) => (m ?? 0) - (i ? marks[i - 1] ?? 0 : 0));

/* ---------- interval reps ---------- */
export const repIndex = (s: Session) => (s.repStarts?.length ?? 0) - 1;
export const resting = (s: Session) => s.restUntil !== undefined;
export function startReps(s: Session, now: number): Session { // first rep starts with the session
  if (s.mode !== "reps" || s.startedAt !== undefined) return s;
  return { ...s, startedAt: now, repStarts: [now], restUntil: undefined };
}
export function repTap(s: Session, id: string, now: number): Session {
  const k = repIndex(s);
  if (phase(s) !== "running" || s.mode !== "reps" || k < 0 || resting(s) || s.marks?.[id]?.[k] != null) return s;
  const m = [...(s.marks?.[id] ?? [])]; while (m.length < k) m.push(null); m[k] = now - s.repStarts![k];
  return { ...s, marks: { ...s.marks, [id]: m } };
}
export function undoRep(s: Session, id: string): Session {
  const k = repIndex(s), m = [...(s.marks?.[id] ?? [])]; if (m[k] == null) return s; m[k] = null;
  return { ...s, marks: { ...s.marks, [id]: m } };
}
export const repDoneBy = (s: Session, id: string) => s.marks?.[id]?.[repIndex(s)] != null;
export const repComplete = (s: Session) => s.runners.every((r) => repDoneBy(s, r.id));
/** End the current rep: rest before the next one, or finish the session after the last. */
export function endRep(s: Session, now: number): Session {
  if (s.mode !== "reps" || !s.reps || resting(s) || phase(s) !== "running") return s;
  if (repIndex(s) + 1 >= s.reps.count) return { ...s, endedAt: now };
  return { ...s, restUntil: now + s.reps.restSec * 1000 };
}
export function nextRep(s: Session, now: number): Session {
  if (s.mode !== "reps" || !resting(s)) return s;
  return { ...s, restUntil: undefined, repStarts: [...(s.repStarts ?? []), now] };
}

/* ---------- summary ---------- */
export interface WorkRow { runnerId: string; times: (number | null)[]; avg?: number; best?: number; spread?: number }
export function workoutRows(s: Session): WorkRow[] {
  return s.runners.map((r) => {
    const raw = s.marks?.[r.id] ?? [], times = s.mode === "laps" ? lapSplits(raw) : raw;
    const ok = times.filter((t): t is number => t != null);
    return { runnerId: r.id, times, avg: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : undefined, best: ok.length ? Math.min(...ok) : undefined, spread: ok.length > 1 ? Math.max(...ok) - Math.min(...ok) : undefined };
  });
}

/* ---------- pace ---------- */
export function targetPaceFor(s: Session, runnerId: string, memberPace?: number): number | undefined {
  const r = s.runners.find((x) => x.id === runnerId), g = s.groups?.find((x) => x.id === r?.groupId);
  return g?.paceSec ?? memberPace;
}
/** Compare a split with the target for that distance. Positive diff = slower than target. */
export function paceCue(actualMs: number, km: number, targetSecPerKm: number): { diffSec: number; text: string } {
  const diff = Math.round(actualMs / 1000 - targetSecPerKm * km);
  const n = Math.abs(diff), unit = n === 1 ? "second" : "seconds";
  return { diffSec: diff, text: diff === 0 ? "on target" : diff < 0 ? `${n} ${unit} ahead of target` : `${n} ${unit} behind target` };
}

/* ---------- safety ---------- */
export interface Alert { runnerId: string; reason: string }
/**
 * Runners to check on. `slowPaceSec` is the slowest believable pace (default 12:00/km);
 * past that for the whole distance, or far behind the last finisher, a runner is flagged.
 */
export function safetyAlerts(s: Session, now: number, slowPaceSec = 720): Alert[] {
  if (phase(s) !== "running" || s.mode === "reps") return [];
  const elapsed = now - s.startedAt!, rows = standings(s), out = stillRunning(s), alerts: Alert[] = [];
  const limit = s.distanceKm * slowPaceSec * 1000, last = rows[rows.length - 1]?.elapsedMs, half = rows.length >= Math.ceil(s.runners.length / 2);
  const typical = median(rows.map((r) => r.elapsedMs));
  for (const r of out) {
    if (elapsed > limit) alerts.push({ runnerId: r.id, reason: `Still out after ${Math.round(elapsed / 60000)} min, slower than ${Math.floor(slowPaceSec / 60)}:${String(slowPaceSec % 60).padStart(2, "0")} per km` });
    else if (half && last !== undefined && typical !== undefined && elapsed > last * 1.25 && elapsed - last > 180000) alerts.push({ runnerId: r.id, reason: `Well behind the group: ${Math.round((elapsed - last) / 60000)} min after the last finisher` });
  }
  return alerts;
}
