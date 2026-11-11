import type { LatLon, TrackPoint } from "./geo";

/**
 * Standard 400 m track (World Athletics geometry): two 84.39 m straights and two bends with a
 * 36.50 m inner-kerb radius. Lane 1 is measured 0.30 m outside the kerb (exactly 400 m);
 * other lanes 0.20 m outside their inner line, with 1.22 m lanes.
 */
export const STRAIGHT = 84.39, KERB_R = 36.5, LANE_W = 1.22;
export const laneRadius = (lane: number) => (lane <= 1 ? KERB_R + 0.3 : KERB_R + LANE_W * (lane - 1) + 0.2);
export const lapLength = (lane: number) => 2 * STRAIGHT + 2 * Math.PI * laneRadius(lane);
const R1 = laneRadius(1), HALF = STRAIGHT / 2, BEND = Math.PI * R1, PERIM = 2 * STRAIGHT + 2 * BEND; // = 400 m

/** Where the track is: its centre and the direction of the straights (degrees from north). */
export interface TrackPlace { center: LatLon; bearing: number; rms: number }
const M = 111_320, rad = Math.PI / 180;
const xy = (p: LatLon, o: LatLon) => ({ x: (p.lon - o.lon) * M * Math.cos(o.lat * rad), y: (p.lat - o.lat) * M });

/** Point in track coordinates (u along the straights, v across) -> distance along the lane 1 line (0..400) and offset from it. */
export function along(u: number, v: number): { s: number; off: number } {
  if (Math.abs(u) <= HALF) { // on a straight
    if (v < 0) return { s: u + HALF, off: Math.abs(v + R1) };                       // bottom straight runs +u
    return { s: STRAIGHT + BEND + (HALF - u), off: Math.abs(v - R1) };               // top straight runs -u
  }
  const cx = u > 0 ? HALF : -HALF, a = Math.atan2(v, u - cx), r = Math.hypot(u - cx, v);
  if (u > 0) { const t = a + Math.PI / 2; return { s: STRAIGHT + t * R1, off: Math.abs(r - R1) }; }          // right bend, -90..90 deg
  let t = a - Math.PI / 2; if (t < 0) t += 2 * Math.PI; return { s: 2 * STRAIGHT + BEND + t * R1, off: Math.abs(r - R1) }; // left bend
}
function toTrack(p: LatLon, place: Pick<TrackPlace, "center" | "bearing">) {
  const q = xy(p, place.center), b = place.bearing * rad; // u = along the straights (bearing), v = 90 deg to the left
  return { u: q.x * Math.sin(b) + q.y * Math.cos(b), v: -q.x * Math.cos(b) + q.y * Math.sin(b) };
}
const offsets = (pts: LatLon[], c: LatLon, bearing: number) => pts.map((p) => { const t = toTrack(p, { center: c, bearing }); return along(t.u, t.v).off; });

/**
 * Learn where the track is from about one lap of GPS. Starts from the centre and the main direction of
 * the points, then refines centre and direction so the points sit on the lane 1 line.
 * Throws a plain message if the points do not look like a full lap of a standard track.
 */
export function fitTrack(pts: LatLon[]): TrackPlace {
  if (pts.length < 20) throw new Error("Run a full lap with GPS on first");
  const o = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length };
  const q = pts.map((p) => xy(p, o));
  let sxx = 0, syy = 0, sxy = 0; for (const p of q) { sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y; }
  const axis = 0.5 * Math.atan2(2 * sxy, sxx - syy); // angle of the long axis from east
  let best = { cx: 0, cy: 0, b: (90 - axis / rad + 360) % 180 }, cost = Infinity;
  const score = (cx: number, cy: number, b: number) => {
    const c = { lat: o.lat + cy / M, lon: o.lon + cx / (M * Math.cos(o.lat * rad)) };
    const d = offsets(pts, c, b).map((x) => Math.min(x, 15)); return d.reduce((s, x) => s + x * x, 0) / d.length; // capped: a few wild fixes cannot drag the fit
  };
  for (const b0 of [best.b, (best.b + 180) % 360]) for (const db of [-10, 0, 10]) { const c = score(0, 0, b0 + db); if (c < cost) { cost = c; best = { cx: 0, cy: 0, b: b0 + db }; } }
  for (const step of [8, 4, 2, 1, 0.5, 0.25]) { // pattern search on centre (m) and direction (deg)
    let moved = true;
    while (moved) {
      moved = false;
      for (const [dx, dy, db] of [[step, 0, 0], [-step, 0, 0], [0, step, 0], [0, -step, 0], [0, 0, step / 2], [0, 0, -step / 2]]) {
        const c = score(best.cx + dx, best.cy + dy, best.b + db); if (c < cost - 1e-9) { cost = c; best = { cx: best.cx + dx, cy: best.cy + dy, b: best.b + db }; moved = true; }
      }
    }
  }
  const center = { lat: o.lat + best.cy / M, lon: o.lon + best.cx / (M * Math.cos(o.lat * rad)) }, bearing = ((best.b % 360) + 360) % 360;
  const rms = Math.sqrt(cost);
  // a full lap should visit every part of the oval
  const seen = new Set(pts.map((p) => { const t = toTrack(p, { center, bearing }); return Math.floor(along(t.u, t.v).s / 40); }));
  if (rms > 8 || seen.size < 9) throw new Error("That does not look like a full lap of a 400 m track. Run one complete lap in lane 1 with GPS on, then try again.");
  return { center, bearing, rms };
}

export interface TrackLap { lap: number; ms: number; atMs: number }
export interface TrackRunResult { distanceM: number; laps: TrackLap[]; offTrack: boolean }
/**
 * Distance on the track from the runner's position on the oval, not from adding up GPS steps, so the
 * error stays at a few metres however many laps are run. Laps are counted from where the runner started.
 */
export function trackDistance(points: TrackPoint[], place: Pick<TrackPlace, "center" | "bearing">, lane = 1): TrackRunResult {
  if (points.length < 2) return { distanceM: 0, laps: [], offTrack: false };
  const scale = lapLength(lane) / PERIM, laps: TrackLap[] = [];
  let unwrapped = 0, prev = -1, start = 0, offCount = 0, dir = 0;
  const S: number[] = [];
  for (const p of points) {
    const t = toTrack(p, place), a = along(t.u, t.v); if (a.off > 15) offCount++;
    if (prev < 0) { prev = a.s; start = a.s; S.push(0); continue; }
    let d = a.s - prev; if (d > PERIM / 2) d -= PERIM; if (d < -PERIM / 2) d += PERIM;
    unwrapped += d; prev = a.s; S.push(unwrapped);
  }
  dir = unwrapped >= 0 ? 1 : -1; // tracks run anticlockwise, but either way works
  let lastLapAt = points[0].t, next = PERIM;
  for (let i = 1; i < S.length; i++) {
    const a0 = S[i - 1] * dir, a1 = S[i] * dir;
    while (a1 >= next && a0 < next) {
      const f = (next - a0) / (a1 - a0 || 1), at = points[i - 1].t + f * (points[i].t - points[i - 1].t);
      laps.push({ lap: laps.length + 1, ms: at - lastLapAt, atMs: at }); lastLapAt = at; next += PERIM;
      if (laps.length > 200) break;
    }
  }
  void start;
  return { distanceM: Math.max(0, unwrapped * dir) * scale, laps, offTrack: offCount > points.length / 3 };
}

/* ---------- marker boards on a measured road loop ---------- */
export interface Marker { atMs: number; distM: number }
/** Distance = the last board passed (exact) + GPS distance since that board. */
export function markedDistance(markers: Marker[], gpsNowM: number, gpsAtMarkersM: number[]): number {
  if (!markers.length) return gpsNowM;
  return markers[markers.length - 1].distM + Math.max(0, gpsNowM - gpsAtMarkersM[gpsAtMarkersM.length - 1]);
}
export function markerSplits(markers: Marker[], startMs: number) {
  return markers.map((m, i) => { const prevM = i ? markers[i - 1] : { atMs: startMs, distM: 0 }; return { distM: m.distM, ms: m.atMs - prevM.atMs, paceSecPerKm: (m.atMs - prevM.atMs) / 1000 / ((m.distM - prevM.distM) / 1000) }; });
}

/** The point at metres `s` along a lane (inverse of `along`), for drawing the track and for the demo. */
export function pointOnTrack(place: Pick<TrackPlace, "center" | "bearing">, s0: number, lane = 1): LatLon {
  const r = laneRadius(lane), bend = Math.PI * r, per = 2 * STRAIGHT + 2 * bend, s = ((s0 % per) + per) % per; let u: number, v: number;
  if (s < STRAIGHT) { u = s - HALF; v = -r; }
  else if (s < STRAIGHT + bend) { const a = (s - STRAIGHT) / r - Math.PI / 2; u = HALF + r * Math.cos(a); v = r * Math.sin(a); }
  else if (s < 2 * STRAIGHT + bend) { u = HALF - (s - STRAIGHT - bend); v = r; }
  else { const a = (s - 2 * STRAIGHT - bend) / r + Math.PI / 2; u = -HALF + r * Math.cos(a); v = r * Math.sin(a); }
  const b = place.bearing * rad, east = u * Math.sin(b) - v * Math.cos(b), north = u * Math.cos(b) + v * Math.sin(b);
  return { lat: place.center.lat + north / M, lon: place.center.lon + east / (M * Math.cos(place.center.lat * rad)) };
}
export const trackOutline = (place: Pick<TrackPlace, "center" | "bearing">, lane = 1, n = 120): LatLon[] =>
  Array.from({ length: n + 1 }, (_, i) => pointOnTrack(place, (i / n) * lapLength(lane), lane));
