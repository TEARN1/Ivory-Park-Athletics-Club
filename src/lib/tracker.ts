import type { LatLon, TrackPoint } from "./geo";

/**
 * Distance from phone GPS, done as carefully as a phone allows.
 * - A constant-velocity Kalman filter in local metres fuses each position (trusted by its reported
 *   accuracy) with the phone's Doppler speed and heading, which is much steadier than the positions.
 * - A backward (Rauch-Tung-Striebel) pass then smooths the whole run, so corners are not cut short.
 * - While the runner is standing still, no distance is added (GPS drift otherwise invents metres).
 * Phones are still only accurate to a few metres per position; this reduces the error in the total.
 */
export interface Fix extends TrackPoint { speed?: number | null; heading?: number | null }
export interface TrackResult { points: TrackPoint[]; distanceM: number; movingMs: number; stoppedMs: number }

const M = 111_320, rad = Math.PI / 180;
type V4 = number[]; type M4 = number[][];
const I4 = (): M4 => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
const mul = (a: M4, b: M4): M4 => a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const T = (a: M4): M4 => a[0].map((_, j) => a.map((r) => r[j]));
const add = (a: M4, b: M4): M4 => a.map((r, i) => r.map((v, j) => v + b[i][j]));
const sub = (a: M4, b: M4): M4 => a.map((r, i) => r.map((v, j) => v - b[i][j]));
const mv = (a: M4, v: V4): V4 => a.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
function inv4(m: M4): M4 { // Gauss-Jordan; covariance matrices here are always well conditioned
  const n = 4, a = m.map((r, i) => [...r, ...I4()[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]]; const d = a[c][c] || 1e-12;
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; }
  }
  return a.map((r) => r.slice(n));
}

export interface TrackOptions { accel?: number; speedSigma?: number; maxAccuracy?: number; stillSpeed?: number }
export function trackRun(fixes: Fix[], o: TrackOptions = {}): TrackResult {
  const accel = o.accel ?? 1.5, sv = o.speedSigma ?? 0.4, maxAcc = o.maxAccuracy ?? 25, still = o.stillSpeed ?? 0.5;
  const use = fixes.filter((f) => (f.acc ?? 10) <= maxAcc).sort((a, b) => a.t - b.t);
  if (use.length < 2) return { points: use.map(({ lat, lon, t, acc }) => ({ lat, lon, t, acc })), distanceM: 0, movingMs: 0, stoppedMs: 0 };
  const o0 = use[0], kx = M * Math.cos(o0.lat * rad);
  const toX = (p: LatLon) => [(p.lon - o0.lon) * kx, (p.lat - o0.lat) * M];

  // forward pass, keeping what the backward pass needs
  const xs: V4[] = [], Ps: M4[] = [], xp: V4[] = [], Pp: M4[] = [], Fs: M4[] = [];
  let x: V4 = [...toX(o0), 0, 0], P: M4 = [[(o0.acc ?? 10) ** 2, 0, 0, 0], [0, (o0.acc ?? 10) ** 2, 0, 0], [0, 0, 25, 0], [0, 0, 0, 25]];
  for (let i = 0; i < use.length; i++) {
    const f = use[i], dt = i ? Math.max(0.001, (f.t - use[i - 1].t) / 1000) : 0;
    const F: M4 = [[1, 0, dt, 0], [0, 1, 0, dt], [0, 0, 1, 0], [0, 0, 0, 1]];
    const q = accel * accel, dt2 = (dt ** 4) / 4, dt3 = (dt ** 3) / 2, dtt = dt * dt;
    const Q: M4 = [[dt2 * q, 0, dt3 * q, 0], [0, dt2 * q, 0, dt3 * q], [dt3 * q, 0, dtt * q, 0], [0, dt3 * q, 0, dtt * q]];
    if (i) { x = mv(F, x); P = add(mul(mul(F, P), T(F)), Q); }
    xp.push(x); Pp.push(P); Fs.push(F);
    // measurement: position, plus velocity when the phone gives Doppler speed
    const [mx, my] = toX(f), r = Math.max(1, f.acc ?? 10) ** 2, rows: { h: V4; z: number; r: number }[] = [
      { h: [1, 0, 0, 0], z: mx, r }, { h: [0, 1, 0, 0], z: my, r }];
    if (typeof f.speed === "number" && f.speed >= 0) {
      if (typeof f.heading === "number" && !Number.isNaN(f.heading) && f.speed >= still) {
        rows.push({ h: [0, 0, 1, 0], z: f.speed * Math.sin(f.heading * rad), r: sv * sv }, { h: [0, 0, 0, 1], z: f.speed * Math.cos(f.heading * rad), r: sv * sv });
      } else if (f.speed < still) rows.push({ h: [0, 0, 1, 0], z: 0, r: sv * sv }, { h: [0, 0, 0, 1], z: 0, r: sv * sv });
    }
    for (const m of rows) { // sequential scalar updates (measurements are independent)
      const Ph = mv(P, m.h), s = m.h.reduce((acc, v, k) => acc + v * Ph[k], 0) + m.r, k = Ph.map((v) => v / s);
      const innov = m.z - m.h.reduce((acc, v, j) => acc + v * x[j], 0);
      x = x.map((v, j) => v + k[j] * innov); P = P.map((row, a) => row.map((v, b) => v - k[a] * Ph[b]));
    }
    xs.push(x); Ps.push(P);
  }
  // backward pass (RTS)
  const sm: V4[] = new Array(use.length); sm[use.length - 1] = xs[use.length - 1]; let Psm = Ps[use.length - 1];
  for (let i = use.length - 2; i >= 0; i--) {
    const C = mul(mul(Ps[i], T(Fs[i + 1])), inv4(Pp[i + 1]));
    sm[i] = xs[i].map((v, j) => v + mv(C, sm[i + 1].map((s, k) => s - xp[i + 1][k]))[j]);
    Psm = add(Ps[i], mul(mul(C, sub(Psm, Pp[i + 1])), T(C)));
  }
  // distance only while moving
  let dist = 0, moving = 0, stopped = 0;
  const points: TrackPoint[] = sm.map((s, i) => ({ lat: o0.lat + s[1] / M, lon: o0.lon + s[0] / kx, t: use[i].t, acc: Math.sqrt(Ps[i][0][0]) }));
  for (let i = 1; i < sm.length; i++) {
    const dt = (use[i].t - use[i - 1].t), v = Math.hypot(sm[i][2], sm[i][3]);
    if (v < still) { stopped += dt; continue; }
    dist += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]); moving += dt;
  }
  return { points, distanceM: dist, movingMs: moving, stoppedMs: stopped };
}

/** "843 m", "5 023 m". Whole metres: the honest resolution, not the accuracy. */
export const fmtMetres = (m: number) => `${Math.round(m).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} m`;
/** Good enough to start a timed run? */
export const gpsReady = (acc?: number) => acc !== undefined && acc <= 10;
