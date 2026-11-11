import { describe, expect, it } from "vitest";
import { destination, haversineM, type LatLon } from "./geo";
import { pathM, smoothTrack } from "./gpsfilter";
import { DEFAULT_HUB } from "./routes";
import { fmtMetres, gpsReady, trackRun, type Fix } from "./tracker";

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
const gauss = () => (rnd() + rnd() + rnd()) / 1.5; // roughly normal, sd about 1
/** Simulated phone: position noise `posSd` metres, Doppler speed noise 0.3 m/s, heading noise 5 degrees, one fix per second. */
function phone(path: (t: number) => { p: LatLon; v: number; h: number }, secs: number, posSd = 5): Fix[] {
  const out: Fix[] = [];
  for (let s = 0; s <= secs; s++) {
    const { p, v, h } = path(s), n = destination(destination(p, 0, gauss() * posSd), 90, gauss() * posSd);
    out.push({ ...n, t: s * 1000, acc: posSd * 1.2, speed: Math.max(0, v + gauss() * 0.3), heading: v > 0.5 ? h + gauss() * 5 : null });
  }
  return out;
}
const straight = (t: number) => ({ p: destination(DEFAULT_HUB, 90, t * 4), v: 4, h: 90 });
// 400 m track: two 84.39 m straights and two 36.5 m radius bends, run at 5 m/s
const R = 36.5, S = 84.39, LAP = 2 * S + 2 * Math.PI * R;
function track(t: number) {
  let d = (t * 5) % LAP; const c1 = DEFAULT_HUB, c2 = destination(DEFAULT_HUB, 90, S);
  if (d < S) return { p: destination(destination(c1, 180, R), 90, d), v: 5, h: 90 };
  d -= S; if (d < Math.PI * R) { const a = d / R; return { p: destination(c2, 180 - (a * 180) / Math.PI, R), v: 5, h: (90 - (a * 180) / Math.PI + 360) % 360 }; }
  d -= Math.PI * R; if (d < S) return { p: destination(destination(c2, 0, R), 270, d), v: 5, h: 270 };
  d -= S; const a = d / R; return { p: destination(c1, 360 - (a * 180) / Math.PI, R), v: 5, h: (270 - (a * 180) / Math.PI + 360) % 360 };
}

describe("tracking accuracy (simulated phone, 5 m position noise)", () => {
  it("1 km straight: within 1% (raw GPS is far worse)", () => {
    const f = phone(straight, 250), r = trackRun(f);
    expect(Math.abs(pathM(f) - 1000)).toBeGreaterThan(200);
    expect(Math.abs(r.distanceM - 1000)).toBeLessThan(10);
  });
  it("2 laps of a 400 m track: within 2%, better than the simple filter", () => {
    const f = phone(track, Math.round((2 * LAP) / 5)), r = trackRun(f);
    expect(Math.abs(r.distanceM - 800)).toBeLessThan(16);
    expect(Math.abs(r.distanceM - 800)).toBeLessThan(Math.abs(pathM(smoothTrack(f)) - 800));
  });
  it("standing still for a minute adds almost nothing", () => {
    const f = phone(() => ({ p: DEFAULT_HUB, v: 0, h: 0 }), 60), r = trackRun(f);
    expect(pathM(f)).toBeGreaterThan(200); expect(r.distanceM).toBeLessThan(3); expect(r.stoppedMs).toBeGreaterThan(50_000);
  });
  it("works without Doppler speed too (older phones), just less well", () => {
    const f = phone(straight, 250).map(({ speed: _s, heading: _h, ...x }) => x), r = trackRun(f);
    expect(Math.abs(r.distanceM - 1000)).toBeLessThan(30);
  });
  it("smoothed path stays near the true path", () => {
    const f = phone(straight, 100), r = trackRun(f);
    const worst = Math.max(...r.points.map((p, i) => haversineM(p, straight(i).p))); expect(worst).toBeLessThan(6);
  });
  it("ignores GPS glitches that jump faster than any runner", () => {
    const f = phone(straight, 100); f.splice(50, 0, { ...destination(f[49], 0, 250), t: f[49].t + 400, acc: 6 });   // 250 m jump in 0.4 s
    expect(Math.abs(trackRun(f).distanceM - 400)).toBeLessThan(10);
    const gap = phone(straight, 100).filter((x) => x.t < 20_000 || x.t > 60_000);                                    // 40 s with no signal (tunnel)
    expect(Math.abs(trackRun(gap).distanceM - 400)).toBeLessThan(15);                                               // the jump after the gap is kept
  });
  it("formats metres and the ready signal", () => {
    expect(fmtMetres(5023.4)).toBe("5 023 m"); expect(fmtMetres(843)).toBe("843 m"); expect(gpsReady(8)).toBe(true); expect(gpsReady(14)).toBe(false); expect(gpsReady(undefined)).toBe(false);
  });
});
