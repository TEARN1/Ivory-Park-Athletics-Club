export type Mode = "auto" | "light" | "dark";
export type Palette = "club" | "pitch" | "dusk";
export interface SoundPrefs {
  countdownSec: number;   // 0 = start at once
  beeps: boolean; voice: boolean;
  finishes: boolean;      // say name, place and time at the finish
  laps: boolean;          // say lap and rep times (with target pace cue)
  timeCallMin: number;    // 0 = never call the time
  quietAfterMin: number;  // stop time calls after this many minutes (0 = keep calling)
  safetyPaceSec: number;  // flag runners slower than this for the whole distance
}
export const COUNTDOWNS = [0, 3, 5, 10], TIME_CALLS = [0, 1, 2, 5, 10], QUIET_AFTER = [0, 10, 20, 30, 60], SAFETY_PACES = [600, 720, 900, 1200];
export const defaultSound = (): SoundPrefs => ({ countdownSec: 5, beeps: true, voice: true, finishes: true, laps: true, timeCallMin: 5, quietAfterMin: 0, safetyPaceSec: 720 });
export interface Prefs { mode: Mode; palette: Palette; distances: number[]; sound: SoundPrefs }
export const PALETTES: { id: Palette; name: string; a: string; b: string }[] = [
  { id: "club", name: "Club (logo colours)", a: "#2a3090", b: "#e81820" },
  { id: "pitch", name: "Pitch", a: "#0f5132", b: "#c2410c" },
  { id: "dusk", name: "Dusk", a: "#4c1d95", b: "#be185d" },
];
export const DEFAULT_DISTANCES = [1, 3, 5, 10, 21.1];
export const defaultPrefs = (): Prefs => ({ mode: "auto", palette: "club", distances: DEFAULT_DISTANCES, sound: defaultSound() });

/** "2.4, 5, 8" -> [2.4, 5, 8]. Throws a message the coach can act on. */
export function parseDistances(text: string): number[] {
  const parts = text.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one distance, like 5 or 2.4");
  const nums = parts.map((x) => Number(x.replace(",", ".")));
  const bad = parts.find((_, i) => !(nums[i] >= 0.1 && nums[i] <= 100));
  if (bad) throw new Error(`"${bad}" is not a distance between 0.1 and 100 km`);
  const out = [...new Set(nums.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
  if (out.length > 8) throw new Error("Use at most 8 shortcuts");
  return out;
}
export const cleanPrefs = (raw: Partial<Prefs> | undefined): Prefs => {
  const d = defaultPrefs();
  return {
    mode: (["auto", "light", "dark"] as const).includes(raw?.mode as Mode) ? (raw!.mode as Mode) : d.mode,
    palette: PALETTES.some((p) => p.id === raw?.palette) ? (raw!.palette as Palette) : d.palette,
    sound: cleanSound(raw?.sound),
    distances: Array.isArray(raw?.distances) && raw!.distances.length && raw!.distances.every((n) => typeof n === "number" && n >= 0.1 && n <= 100) ? raw!.distances.slice(0, 8) : d.distances,
  };
};
export function applyPrefs(p: Prefs, root: HTMLElement = document.documentElement) {
  if (p.mode === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", p.mode);
  root.setAttribute("data-palette", p.palette);
}
function cleanSound(raw: Partial<SoundPrefs> | undefined): SoundPrefs {
  const d = defaultSound(), r = raw ?? {}, pick = (v: unknown, ok: number[], dv: number) => (ok.includes(v as number) ? (v as number) : dv), bool = (v: unknown, dv: boolean) => (typeof v === "boolean" ? v : dv);
  return { countdownSec: pick(r.countdownSec, COUNTDOWNS, d.countdownSec), beeps: bool(r.beeps, d.beeps), voice: bool(r.voice, d.voice), finishes: bool(r.finishes, d.finishes), laps: bool(r.laps, d.laps),
    timeCallMin: pick(r.timeCallMin, TIME_CALLS, d.timeCallMin), quietAfterMin: pick(r.quietAfterMin, QUIET_AFTER, d.quietAfterMin), safetyPaceSec: pick(r.safetyPaceSec, SAFETY_PACES, d.safetyPaceSec) };
}
/** Minute mark to announce when the clock passes it between two ticks, or null. */
export function timeCallDue(prevMs: number, nowMs: number, everyMin: number, quietAfterMin: number): number | null {
  if (!everyMin || nowMs <= prevMs) return null;
  const step = everyMin * 60000, mark = Math.floor(nowMs / step) * step;
  if (mark <= prevMs || mark === 0) return null;
  const min = mark / 60000; return quietAfterMin && min > quietAfterMin ? null : min;
}
