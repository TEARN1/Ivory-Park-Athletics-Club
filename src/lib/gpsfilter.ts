import { haversineM, type LatLon, type TrackPoint } from "./geo";

/**
 * Phone GPS is good to a few metres at best, never centimetres. This file gets the most out of it:
 * 1. drop fixes the phone itself says are poor;
 * 2. smooth the rest with a small Kalman filter that trusts each fix by its reported accuracy;
 * 3. optionally measure along the planned route instead of along the wobbly trace;
 * 4. apply a per-phone correction learned on a measured distance (a track lap, a measured km).
 */
export const MAX_ACCURACY_M = 50;
export const accuracyLabel = (acc?: number) => (acc === undefined ? "unknown" : acc <= 8 ? "good" : acc <= 20 ? "fair" : "poor");

/** Simple GPS Kalman filter. `speedMs` is how fast the runner might change position (process noise). */
export function smoothTrack(raw: TrackPoint[], speedMs = 4): TrackPoint[] {
  const out: TrackPoint[] = []; let lat = 0, lon = 0, variance = -1, t = 0;
  for (const p of raw) {
    const acc = Math.max(1, p.acc ?? 10);
    if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) continue;
    if (variance < 0) { lat = p.lat; lon = p.lon; variance = acc * acc; t = p.t; }
    else {
      const dt = Math.max(0, p.t - t) / 1000; if (dt > 0) { variance += dt * speedMs * speedMs; t = p.t; }
      const k = variance / (variance + acc * acc);
      lat += k * (p.lat - lat); lon += k * (p.lon - lon); variance = (1 - k) * variance;
    }
    out.push({ lat, lon, t: p.t, acc: Math.sqrt(variance) });
  }
  return out;
}

/* ---------- measure along a route ---------- */
const M_PER_DEG = 111_320;
function toXY(p: LatLon, o: LatLon) { return { x: (p.lon - o.lon) * M_PER_DEG * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * M_PER_DEG }; }
/** Where a point falls on the route: metres from the start along the route, and how far off the line it is. */
export function snapToRoute(p: LatLon, route: LatLon[]): { along: number; offset: number } {
  if (route.length < 2) return { along: 0, offset: Infinity };
  const o = route[0], q = toXY(p, o); let best = { along: 0, offset: Infinity }, run = 0;
  for (let i = 1; i < route.length; i++) {
    const a = toXY(route[i - 1], o), b = toXY(route[i], o), dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy, seg = Math.sqrt(len2);
    const u = len2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2)) : 0;
    const off = Math.hypot(a.x + u * dx - q.x, a.y + u * dy - q.y);
    if (off < best.offset) best = { along: run + u * seg, offset: off };
    run += seg;
  }
  return best;
}
/**
 * Distance covered measured along the route. Progress only moves forward, and only while the runner
 * is within `maxOffsetM` of the line, so GPS wobble and short cut-backs do not add distance.
 * (A loop that passes the same spot twice should use the lap tools instead.)
 */
export function routeProgressM(track: LatLon[], route: LatLon[], maxOffsetM = 50): number {
  let best = 0;
  for (const p of track) { const s = snapToRoute(p, route); if (s.offset <= maxOffsetM && s.along > best && s.along - best < 600) best = s.along; }
  return best;
}

/* ---------- per-phone calibration ---------- */
/** Correction factor from running a measured distance. Kept between 0.85 and 1.15: anything else is a bad run, not the phone. */
export function calibrationFactor(measuredM: number, gpsM: number): number {
  if (!(measuredM > 0 && gpsM > 0)) throw new Error("Run the measured distance with GPS on first");
  const f = measuredM / gpsM;
  if (f < 0.85 || f > 1.15) throw new Error(`GPS said ${Math.round(gpsM)} m for ${Math.round(measuredM)} m. That is too far off to learn from. Try again in the open, away from buildings.`);
  return Math.round(f * 1000) / 1000;
}
export const pathM = (pts: LatLon[]) => pts.reduce((s, p, i) => (i ? s + haversineM(pts[i - 1], p) : 0), 0);
