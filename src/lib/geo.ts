export interface LatLon { lat: number; lon: number }
export interface TrackPoint extends LatLon { t: number }   // t = ms since session start
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
export function destination(a: LatLon, bearing: number, meters: number): LatLon {
  const d = meters / R, br = rad(bearing), la = rad(a.lat), lo = rad(a.lon);
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
  const lo2 = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: deg(la2), lon: ((deg(lo2) + 540) % 360) - 180 };
}
export const pathLengthM = (pts: LatLon[]) => pts.reduce((s, p, i) => (i ? s + haversineM(pts[i - 1], p) : 0), 0);

/** Drop GPS jitter: ignore points whose implied speed exceeds 12 m/s (a sprinter's top speed) or that move <2 m. */
export function cleanTrack(pts: TrackPoint[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last) { out.push(p); continue; }
    const dt = (p.t - last.t) / 1000, d = haversineM(last, p);
    if (dt <= 0 || d < 2 || d / dt > 12) continue;
    out.push(p);
  }
  return out;
}
export interface Split { km: number; ms: number; paceSecPerKm: number; partial: boolean }
/** Per-kilometre splits (interpolated at each km mark); a final partial split is flagged. */
export function splits(raw: TrackPoint[]): Split[] {
  const pts = cleanTrack(raw); const out: Split[] = [];
  let dist = 0, nextKm = 1, lastMark = pts[0]?.t ?? 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = haversineM(pts[i - 1], pts[i]);
    while (seg > 0 && dist + seg >= nextKm * 1000) {
      const f = (nextKm * 1000 - dist) / seg, t = pts[i - 1].t + f * (pts[i].t - pts[i - 1].t);
      out.push({ km: nextKm, ms: t - lastMark, paceSecPerKm: (t - lastMark) / 1000, partial: false });
      lastMark = t; nextKm++;
    }
    dist += seg;
  }
  const rest = dist - (nextKm - 1) * 1000, last = pts[pts.length - 1];
  if (last && rest >= 50) { const ms = last.t - lastMark; out.push({ km: nextKm, ms, paceSecPerKm: ms / 1000 / (rest / 1000), partial: true }); }
  return out;
}
export const trackDistanceM = (raw: TrackPoint[]) => pathLengthM(cleanTrack(raw));
