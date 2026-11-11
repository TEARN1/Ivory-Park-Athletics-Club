import type { Session } from "./session";

/**
 * Several timekeepers on one race. The server keeps one shared copy; every phone merges it in.
 * Rule: the earliest time for a bib wins. If two phones differ by more than a second, the
 * coach sees a note so they can check it.
 */
export interface SharedTiming {
  startedAt?: number;                                         // server clock
  finishes: Record<string, { ms: number; by: string }>;        // bib -> time since start
  conflicts: { bib: string; kept: number; other: number; at: number }[];
}
export type TimingAction =
  | { type: "start"; at: number }
  | { type: "finish"; bib: string; ms: number; by: string; at: number }
  | { type: "undo"; bib: string }
  | { type: "reset" };
export const emptyTiming = (): SharedTiming => ({ finishes: {}, conflicts: [] });
const BIB = /^[0-9A-Za-z]{1,6}$/;

export function timingReduce(t: SharedTiming, a: TimingAction): SharedTiming {
  switch (a.type) {
    case "start": return t.startedAt !== undefined || !Number.isFinite(a.at) ? t : { ...t, startedAt: a.at };
    case "reset": return emptyTiming();
    case "undo": { if (!t.finishes[a.bib]) return t; const { [a.bib]: _x, ...rest } = t.finishes; return { ...t, finishes: rest }; }
    case "finish": {
      if (t.startedAt === undefined || !BIB.test(a.bib) || !(a.ms >= 0 && a.ms < 86_400_000)) return t;
      const cur = t.finishes[a.bib];
      if (!cur || cur.by === a.by) return { ...t, finishes: { ...t.finishes, [a.bib]: { ms: Math.round(a.ms), by: a.by } } };
      const kept = Math.min(cur.ms, a.ms), other = Math.max(cur.ms, a.ms);
      const conflicts = other - kept > 1000 ? [...t.conflicts, { bib: a.bib, kept, other, at: a.at }].slice(-50) : t.conflicts;
      return { ...t, finishes: { ...t.finishes, [a.bib]: kept === cur.ms ? cur : { ms: Math.round(a.ms), by: a.by } }, conflicts };
    }
  }
}

/**
 * Bring the shared copy into this phone's session. `offset` = server clock minus this phone's clock.
 * Runners the other timekeeper recorded but this phone lacks are added by bib.
 * A bib that was shared before and is now gone was undone on another phone, so it is removed here too.
 */
export function applyShared(s: Session, t: SharedTiming, offset: number, seenBefore: string[]): { session: Session; seen: string[] } {
  let cur = s;
  if (t.startedAt !== undefined && cur.startedAt === undefined) cur = { ...cur, startedAt: t.startedAt - offset };
  const runners = [...cur.runners], finishes = { ...cur.finishes };
  for (const [bib, f] of Object.entries(t.finishes)) {
    let r = runners.find((x) => x.bib === bib);
    if (!r) { r = { id: crypto.randomUUID(), name: "", bib }; runners.push(r); }
    finishes[r.id] = f.ms;
  }
  for (const bib of seenBefore) if (!t.finishes[bib]) { const r = runners.find((x) => x.bib === bib); if (r) delete finishes[r.id]; }
  return { session: { ...cur, runners, finishes }, seen: Object.keys(t.finishes) };
}

/** What this phone changed since it last matched the room: new or edited finishes to send, and undone ones. */
export function localChanges(before: Record<string, number>, now: Record<string, number>): { finish: { bib: string; ms: number }[]; undo: string[] } {
  return {
    finish: Object.entries(now).filter(([b, ms]) => before[b] !== ms).map(([bib, ms]) => ({ bib, ms })),
    undo: Object.keys(before).filter((b) => now[b] === undefined),
  };
}
