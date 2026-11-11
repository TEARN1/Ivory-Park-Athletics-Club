import { bearingDeg, destination, pathLengthM, type LatLon } from "./geo";
/** Ivory Park, Midrand (approximate town centre). The coach should set the real club hub. */
export const DEFAULT_HUB: LatLon = { lat: -25.9967, lon: 28.2 };
export interface Route { id: string; name: string; hub: LatLon; points: LatLon[]; lengthM: number; targetKm: number; variant: number }
export const MAX_VARIANTS = 15;

function rng(seed: number) { let x = seed * 2654435761 >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

/** Loop variant: a closed polygon through the hub, scaled by bisection until its length matches the target. */
export function makeLoop(hub: LatLon, targetKm: number, variant: number): Route {
  const rand = rng(variant + 1), sides = 3 + (variant % 4), rot = (variant * 137.5) % 360;
  const shape = Array.from({ length: sides }, (_, i) => ({ b: rot + (360 / sides) * (i + 1), k: 0.75 + rand() * 0.5 }));
  const build = (scale: number) => [hub, ...shape.map((s) => destination(hub, s.b, scale * s.k)), hub];
  let lo = 1, hi = targetKm * 1000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; (pathLengthM(build(mid)) < targetKm * 1000 ? (lo = mid) : (hi = mid)); }
  const points = build((lo + hi) / 2);
  return { id: `${targetKm}-${variant}`, name: `${targetKm} km loop ${variant + 1}`, hub, points, lengthM: pathLengthM(points), targetKm, variant };
}
export function generateLoops(hub: LatLon, targetKm: number, count = MAX_VARIANTS): Route[] {
  if (!(targetKm >= 0.5 && targetKm <= 100)) throw new Error("Distance must be between 0.5 and 100 km");
  return Array.from({ length: Math.min(count, MAX_VARIANTS) }, (_, v) => makeLoop(hub, targetKm, v));
}
const bearingGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** True if any leg of the route heads within `halfWidth` degrees of the blocked bearing. */
export function usesBearing(r: Route, blocked: number, halfWidth = 35): boolean {
  return r.points.slice(1).some((p, i) => bearingGap(bearingDeg(r.points[i], p), blocked) <= halfWidth);
}
/** One-touch Reroute: next loop of the same distance that avoids the blocked direction (if given). */
export function reroute(all: Route[], current: Route, blockedBearing?: number): Route | undefined {
  const n = all.length;
  for (let step = 1; step < n; step++) {
    const c = all[(all.findIndex((r) => r.id === current.id) + step) % n];
    if (blockedBearing === undefined || !usesBearing(c, blockedBearing)) return c;
  }
  return undefined;
}
