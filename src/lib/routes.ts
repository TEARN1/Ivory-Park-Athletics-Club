import { bearingDeg, destination, pathLengthM, type LatLon } from "./geo";
/** Ivory Park, Midrand (approximate town centre). The coach should set the real club hub. */
export const DEFAULT_HUB: LatLon = { lat: -25.9967, lon: 28.2 };
export interface Route { id: string; name: string; hub: LatLon; points: LatLon[]; lengthM: number; targetKm: number; variant: number; roads?: boolean; checkedAt?: number }
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

/** Default foot-routing service (OpenStreetMap data, OSRM API). Coaches can point the app at another one. */
export const DEFAULT_ROUTER = "https://routing.openstreetmap.de/routed-foot";
export type FetchJson = (url: string) => Promise<any>;
/**
 * Turn a guide loop into one that follows real footpaths and roads. Roads add distance,
 * so the shape is resized and asked again until the road distance is within 4% of the target.
 */
export async function followRoads(hub: LatLon, targetKm: number, variant: number, router: string, fetchJson: FetchJson): Promise<Route> {
  let want = targetKm, best: Route | undefined;
  for (let i = 0; i < 4; i++) {
    const loop = makeLoop(hub, want, variant), coords = loop.points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    let j: any;
    try { j = await fetchJson(`${router.replace(/\/$/, "")}/route/v1/foot/${coords}?overview=full&geometries=geojson`); }
    catch { throw new Error("Cannot reach the routing service. Check your connection, or keep the guide loop."); }
    const r = j?.code === "Ok" ? j.routes?.[0] : undefined;
    if (!r?.geometry?.coordinates?.length) throw new Error("The routing service found no roads for this loop. Try another loop or move the hub.");
    const points: LatLon[] = r.geometry.coordinates.map(([lon, lat]: [number, number]) => ({ lat, lon })), km = r.distance / 1000;
    const cand: Route = { ...loop, id: `${targetKm}-${variant}-roads`, name: `${targetKm} km road loop ${variant + 1}`, points, lengthM: r.distance, targetKm, roads: true };
    if (!best || Math.abs(km - targetKm) < Math.abs(best.lengthM / 1000 - targetKm)) best = cand;
    if (Math.abs(km - targetKm) / targetKm <= 0.04) break;
    want = (want * targetKm) / km;
  }
  return best!;
}

/** Route along real roads between any start and end points. */
export async function routeBetween(
  start: LatLon,
  end: LatLon,
  router: string = DEFAULT_ROUTER,
  fetchJson: FetchJson = (u) => fetch(u).then((x) => x.json())
): Promise<Route> {
  const coords = `${start.lon.toFixed(6)},${start.lat.toFixed(6)};${end.lon.toFixed(6)},${end.lat.toFixed(6)}`;
  let j: any;
  try {
    j = await fetchJson(`${router.replace(/\/$/, "")}/route/v1/foot/${coords}?overview=full&geometries=geojson`);
  } catch {
    throw new Error("Cannot reach the routing service. Check your connection.");
  }
  const r = j?.code === "Ok" ? j.routes?.[0] : undefined;
  if (!r?.geometry?.coordinates?.length) {
    throw new Error("The routing service found no walkable roads between these points.");
  }
  const points: LatLon[] = r.geometry.coordinates.map(([lon, lat]: [number, number]) => ({ lat, lon }));
  return {
    id: `ptp-${Date.now()}`,
    name: `Road Route (${(r.distance / 1000).toFixed(2)} km)`,
    hub: start,
    points,
    lengthM: r.distance,
    targetKm: Number((r.distance / 1000).toFixed(2)),
    variant: 0,
    roads: true,
  };
}
