export type Mode = "auto" | "light" | "dark";
export type Palette = "club" | "pitch" | "dusk";
export interface Prefs { mode: Mode; palette: Palette; distances: number[] }
export const PALETTES: { id: Palette; name: string; a: string; b: string }[] = [
  { id: "club", name: "Club (logo colours)", a: "#2a3090", b: "#e81820" },
  { id: "pitch", name: "Pitch", a: "#0f5132", b: "#c2410c" },
  { id: "dusk", name: "Dusk", a: "#4c1d95", b: "#be185d" },
];
export const DEFAULT_DISTANCES = [1, 3, 5, 10, 21.1];
export const defaultPrefs = (): Prefs => ({ mode: "auto", palette: "club", distances: DEFAULT_DISTANCES });

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
    distances: Array.isArray(raw?.distances) && raw!.distances.length && raw!.distances.every((n) => typeof n === "number" && n >= 0.1 && n <= 100) ? raw!.distances.slice(0, 8) : d.distances,
  };
};
export function applyPrefs(p: Prefs, root: HTMLElement = document.documentElement) {
  if (p.mode === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", p.mode);
  root.setAttribute("data-palette", p.palette);
}
