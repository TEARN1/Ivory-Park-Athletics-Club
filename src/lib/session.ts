export interface Runner { id: string; name: string; bib: string; buddyId?: string }
export interface Session {
  id: string; date: string; distanceKm: number;
  runners: Runner[];
  startedAt?: number;                 // epoch ms
  finishes: Record<string, number>;   // runnerId -> elapsed ms
  tracks?: Record<string, import("./geo").TrackPoint[]>;  // GPS points per runner (device-held)
  room?: string;                      // live-session code for relay
  endedAt?: number;                   // coach pressed End session
}
export interface Row { runner: Runner; elapsedMs: number; rank: number; paceSecPerKm: number; gapMs: number }

export const newSession = (distanceKm = 5, now = new Date()): Session => ({
  id: crypto.randomUUID(), date: now.toISOString().slice(0, 10), distanceKm, runners: [], finishes: {},
});

export function addRunner(s: Session, name: string, bib: string, buddyId?: string): Session {
  const n = name.trim(), b = bib.trim();
  if (!n && !b) throw new Error("Enter a name or a bib number");
  if (b && s.runners.some((r) => r.bib === b)) throw new Error(`Bib ${b} is already taken`);
  return { ...s, runners: [...s.runners, { id: crypto.randomUUID(), name: n, bib: b, buddyId }] };
}
export const removeRunner = (s: Session, id: string): Session => {
  const { [id]: _drop, ...finishes } = s.finishes;
  return { ...s, finishes, runners: s.runners.filter((r) => r.id !== id).map((r) => (r.buddyId === id ? { ...r, buddyId: undefined } : r)) };
};
export const setBuddy = (s: Session, id: string, buddyId?: string): Session => {
  if (buddyId === id) throw new Error("A runner cannot be their own buddy");
  return { ...s, runners: s.runners.map((r) => (r.id === id ? { ...r, buddyId } : r)) };
};
export const start = (s: Session, now: number): Session => (s.startedAt !== undefined ? s : { ...s, startedAt: now });
export function finish(s: Session, id: string, now: number): Session {
  if (s.startedAt === undefined || s.endedAt !== undefined || s.finishes[id] !== undefined) return s;
  return { ...s, finishes: { ...s.finishes, [id]: Math.max(0, now - s.startedAt) } };
}
export const undoFinish = (s: Session, id: string): Session => {
  const { [id]: _drop, ...finishes } = s.finishes; return { ...s, finishes };
};

export function standings(s: Session): Row[] {
  const done = s.runners.filter((r) => s.finishes[r.id] !== undefined)
    .sort((a, b) => s.finishes[a.id] - s.finishes[b.id]);
  const lead = done.length ? s.finishes[done[0].id] : 0;
  return done.map((runner, i) => ({
    runner, rank: i + 1, elapsedMs: s.finishes[runner.id],
    paceSecPerKm: s.finishes[runner.id] / 1000 / s.distanceKm, gapMs: s.finishes[runner.id] - lead,
  }));
}
export function updateRunner(s: Session, id: string, name: string, bib: string): Session {
  const n = name.trim(), b = bib.trim();
  if (!n && !b) throw new Error("Enter a name or a bib number");
  if (b && s.runners.some((r) => r.id !== id && r.bib === b)) throw new Error(`Bib ${b} is already taken`);
  return { ...s, runners: s.runners.map((r) => (r.id === id ? { ...r, name: n, bib: b } : r)) };
}
/** Coach correction for a finish tapped late or early. */
export function setFinishTime(s: Session, id: string, elapsedMs: number): Session {
  if (!(elapsedMs >= 0) || s.finishes[id] === undefined) throw new Error("Pick a finished runner and a valid time");
  return { ...s, finishes: { ...s.finishes, [id]: Math.round(elapsedMs) } };
}
export function parseTime(text: string): number {
  const p = text.trim().split(":").map(Number);
  if (!p.length || p.length > 3 || p.some((x) => !isFinite(x) || x < 0)) throw new Error("Use m:ss or h:mm:ss");
  return p.reduce((a, x) => a * 60 + x, 0) * 1000;
}
export function addTrackPoint(s: Session, id: string, p: import("./geo").TrackPoint): Session {
  const tr = s.tracks?.[id] ?? [];
  return { ...s, tracks: { ...s.tracks, [id]: [...tr, p].slice(-20000) } };
}
export const stillRunning = (s: Session) => s.runners.filter((r) => s.finishes[r.id] === undefined);

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const a = [...xs].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export const groupMedianPace = (s: Session) => median(standings(s).map((r) => r.paceSecPerKm));

export function ordinal(n: number): string {
  const v = n % 100; if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
}
export function fmtPace(secPerKm?: number): string {
  if (secPerKm === undefined || !isFinite(secPerKm)) return "–";
  const t = Math.round(secPerKm); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}/km`;
}
export function fmtTime(ms: number): string {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export const label = (r: Runner) => [r.bib && `#${r.bib}`, r.name].filter(Boolean).join(" ");

export type Phase = "setup" | "running" | "done";
export const phase = (s: Session): Phase => (s.startedAt === undefined ? "setup" : s.endedAt === undefined ? "running" : "done");
export const endSession = (s: Session, now: number): Session => (s.startedAt === undefined ? s : { ...s, endedAt: s.endedAt ?? now });
export const resumeSession = (s: Session): Session => ({ ...s, endedAt: undefined });
/** Next week's session: same squad (optional), clean clock and results. */
export function nextSession(s: Session, keepRunners: boolean): Session {
  const n = newSession(s.distanceKm);
  return keepRunners ? { ...n, runners: s.runners.map((r) => ({ ...r })), room: s.room } : n;
}
export function nextBib(s: Session): string {
  const nums = s.runners.map((r) => parseInt(r.bib, 10)).filter(Number.isFinite);
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/** Add `count` runners that only have a bib number, continuing from the next free number. */
export function addNumbered(s: Session, count: number): Session {
  const n = Math.floor(count);
  if (!(n >= 1 && n <= 200)) throw new Error("Pick between 1 and 200 runners");
  const taken = new Set(s.runners.map((r) => r.bib)); let next = parseInt(nextBib(s), 10); const add: Runner[] = [];
  while (add.length < n) { const b = String(next++); if (!taken.has(b)) add.push({ id: crypto.randomUUID(), name: "", bib: b }); }
  return { ...s, runners: [...s.runners, ...add] };
}
