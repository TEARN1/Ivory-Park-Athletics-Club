/**
 * Race Target Pacing and Split Calculator for Ivory Park Athletics Club.
 * Helps runners and coaches calculate exact average pace targets, split times,
 * and live pacing delta (ahead/behind schedule) to hit goal finish times.
 */

export interface RaceTarget {
  distanceM: number;
  targetTimeMs: number;
  targetPaceSecPerKm: number;
}

export interface SplitTarget {
  km: number;
  splitTimeMs: number;
  splitPaceStr: string;
  splitTime: string;
  cumulativeTime: string;
  pace: string;
}

export interface PaceDelta {
  diffSec: number;
  deltaSec: number;
  ahead: boolean;
  status: "ahead" | "behind" | "on_pace";
  formattedDelta: string;
  projectedFinishMs: number;
}

export const COMMON_RACE_DISTANCES = [
  { label: "5 km Time Trial", distanceM: 5000 },
  { label: "10 km Road Race", distanceM: 10000 },
  { label: "15 km Challenge", distanceM: 15000 },
  { label: "21.1 km Half Marathon", distanceM: 21097 },
  { label: "42.2 km Marathon", distanceM: 42195 },
];

/** Formats pace in seconds per km to "m:ss /km" */
export function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--:-- /km";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s < 10 ? "0" : ""}${s} /km`;
}

/** Converts "m:ss" string to seconds per km */
export function parsePace(paceStr: string): number | null {
  if (!paceStr || !paceStr.includes(":")) return null;
  const parts = paceStr.replace(/[^0-9:]/g, "").split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
      return m * 60 + s;
    }
  }
  return null;
}

/** Formats seconds or milliseconds to "hh:mm:ss" or "mm:ss" */
export function fmtDuration(secOrMs: number): string {
  const totalSec = Math.max(0, Math.round(secOrMs >= 100_000 ? secOrMs / 1000 : secOrMs));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Converts "hh:mm:ss" or "mm:ss" string to seconds */
export function parseDuration(durStr: string): number | null {
  if (!durStr) return null;
  const parts = durStr.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

/** Calculates target pace (seconds per km) from total distance and target time (seconds or ms) */
export function calcPaceFromTime(distanceM: number, targetTimeSecOrMs: number): number {
  if (distanceM <= 0 || targetTimeSecOrMs <= 0) return 0;
  const km = distanceM / 1000;
  const totalSec = targetTimeSecOrMs >= 100_000 ? targetTimeSecOrMs / 1000 : targetTimeSecOrMs;
  return Math.round(totalSec / km);
}

/** Calculates target time in seconds from distance and average pace */
export function calcTimeFromPace(distanceM: number, paceSecPerKm: number): number {
  if (distanceM <= 0 || paceSecPerKm <= 0) return 0;
  const km = distanceM / 1000;
  return Math.round(km * paceSecPerKm);
}

/** Computes live delta: whether the runner is ahead or behind target schedule */
export function calcPaceDelta(
  currentDistM: number,
  elapsedMs: number,
  targetPaceSecPerKm: number,
  totalDistanceM = 10000
): PaceDelta {
  if (currentDistM <= 10 || elapsedMs <= 1000 || targetPaceSecPerKm <= 0) {
    return {
      diffSec: 0,
      deltaSec: 0,
      ahead: true,
      status: "on_pace",
      formattedDelta: "On Pace",
      projectedFinishMs: calcTimeFromPace(totalDistanceM, targetPaceSecPerKm) * 1000,
    };
  }

  const expectedElapsedSec = (currentDistM / 1000) * targetPaceSecPerKm;
  const actualElapsedSec = elapsedMs / 1000;
  const diffSec = actualElapsedSec - expectedElapsedSec; // positive = behind, negative = ahead
  const roundDiff = Math.round(diffSec);

  const currentPaceSec = actualElapsedSec / (currentDistM / 1000);
  const projectedFinishMs = (totalDistanceM / 1000) * currentPaceSec * 1000;

  const absSec = Math.abs(roundDiff);
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  const timeStr = m > 0 ? `${m}m ${s < 10 ? "0" : ""}${s}s` : `${s}s`;

  if (diffSec < -2) {
    return {
      diffSec: roundDiff,
      deltaSec: roundDiff,
      ahead: true,
      status: "ahead",
      formattedDelta: `-${timeStr} Ahead`,
      projectedFinishMs,
    };
  }
  if (diffSec > 2) {
    return {
      diffSec: roundDiff,
      deltaSec: roundDiff,
      ahead: false,
      status: "behind",
      formattedDelta: `+${timeStr} Behind`,
      projectedFinishMs,
    };
  }
  return {
    diffSec: 0,
    deltaSec: 0,
    ahead: true,
    status: "on_pace",
    formattedDelta: "On Pace",
    projectedFinishMs,
  };
}

/** Generates milestone split markers (every 1km or 5km) */
export function generateSplitTargets(distanceM: number, targetPaceSecPerKm: number): SplitTarget[] {
  if (distanceM <= 0 || targetPaceSecPerKm <= 0) return [];
  const totalKm = Math.ceil(distanceM / 1000);
  const splits: SplitTarget[] = [];

  for (let k = 1; k <= totalKm; k++) {
    const kmDist = k === totalKm ? distanceM / 1000 : k;
    const splitTimeMs = kmDist * targetPaceSecPerKm * 1000;
    const splitSec = kmDist * targetPaceSecPerKm;
    const m = Math.floor(splitSec / 60);
    const s = Math.round(splitSec % 60);
    const cumStr = `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
    splits.push({
      km: Math.round(kmDist * 10) / 10,
      splitTimeMs,
      splitPaceStr: cumStr,
      splitTime: fmtPace(targetPaceSecPerKm),
      cumulativeTime: cumStr,
      pace: fmtPace(targetPaceSecPerKm),
    });
  }
  return splits;
}
