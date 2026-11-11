import { haversineM, type LatLon } from "./geo";

export interface Seen extends LatLon { runnerId: string; at: number }
export type Trail = Record<string, Seen[]>;
/** Keep the last few minutes of each runner's positions as they arrive from the room. */
export function addPositions(trail: Trail, positions: Seen[], now: number, keepMs = 600_000): Trail {
  const out: Trail = {};
  for (const [id, list] of Object.entries(trail)) out[id] = list.filter((p) => now - p.at <= keepMs);
  for (const p of positions) { const l = out[p.runnerId] ?? []; if (!l.length || l[l.length - 1].at !== p.at) out[p.runnerId] = [...l, p]; }
  return out;
}
export type Flag = "stopped" | "no-signal";
/**
 * No signal: nothing heard for 2 minutes. Stopped: heard from, but within 25 m for the last 3 minutes.
 * Both are prompts to check on the runner, not proof that something is wrong.
 */
export function liveFlags(trail: Trail, now: number, o = { staleMs: 120_000, stoppedMs: 180_000, stoppedM: 25 }): Record<string, Flag> {
  const flags: Record<string, Flag> = {};
  for (const [id, list] of Object.entries(trail)) {
    const last = list[list.length - 1]; if (!last) continue;
    if (now - last.at > o.staleMs) { flags[id] = "no-signal"; continue; }
    const recent = list.filter((p) => last.at - p.at <= o.stoppedMs);
    if (list[0].at <= last.at - o.stoppedMs && recent.every((p) => haversineM(p, last) < o.stoppedM)) flags[id] = "stopped";
  }
  return flags;
}
