import { describe, expect, it } from "vitest";
import { destination, type TrackPoint } from "./geo";
import { accuracyLabel, calibrationFactor, pathM, routeProgressM, smoothTrack, snapToRoute } from "./gpsfilter";
import { DEFAULT_HUB } from "./routes";
import { fmtTime } from "./session";

// A straight 1 km run east at 4 m/s, sampled each second, with seeded noise of about 6 m.
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
const truth: TrackPoint[] = [], noisy: TrackPoint[] = [];
for (let s = 0; s <= 250; s++) {
  const p = destination(DEFAULT_HUB, 90, s * 4); truth.push({ ...p, t: s * 1000 });
  const n = destination(destination(p, 0, rnd() * 6), 90, rnd() * 6); noisy.push({ ...n, t: s * 1000, acc: 6 });
}
describe("GPS smoothing", () => {
  it("brings a noisy trace much closer to the true distance", () => {
    const rawErr = Math.abs(pathM(noisy) - 1000), smoothErr = Math.abs(pathM(smoothTrack(noisy)) - 1000);
    expect(rawErr).toBeGreaterThan(300);            // zig-zag noise inflates raw phone distance a lot
    expect(smoothErr).toBeLessThan(rawErr / 4);
  });
  it("drops fixes the phone says are poor", () => {
    const bad = [...noisy.slice(0, 5), { ...destination(DEFAULT_HUB, 0, 500), t: 5500, acc: 80 }];
    expect(smoothTrack(bad)).toHaveLength(5);
    expect(accuracyLabel(4)).toBe("good"); expect(accuracyLabel(12)).toBe("fair"); expect(accuracyLabel(40)).toBe("poor");
  });
});
describe("measuring along the route", () => {
  const route = [DEFAULT_HUB, destination(DEFAULT_HUB, 90, 1000)];
  it("ignores sideways wobble", () => {
    expect(Math.abs(routeProgressM(noisy, route) - 1000)).toBeLessThan(10);
    const s = snapToRoute(destination(destination(DEFAULT_HUB, 90, 300), 0, 8), route); expect(s.along).toBeCloseTo(300, 0); expect(s.offset).toBeCloseTo(8, 0);
  });
  it("does not count points far off the route", () => {
    expect(routeProgressM([destination(DEFAULT_HUB, 0, 500)], route)).toBe(0);
  });
});
describe("calibration and timing display", () => {
  it("learns a sensible per-phone factor and rejects a bad run", () => {
    expect(calibrationFactor(400, 412)).toBeCloseTo(0.971, 3); expect(() => calibrationFactor(400, 600)).toThrow(/too far off/); expect(() => calibrationFactor(400, 0)).toThrow();
  });
  it("shows tenths for track work", () => { expect(fmtTime(65_480, true)).toBe("1:05.4"); expect(fmtTime(65_480)).toBe("1:05"); });
});
