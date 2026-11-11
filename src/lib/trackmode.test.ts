import { describe, expect, it } from "vitest";
import { destination, type LatLon, type TrackPoint } from "./geo";
import { DEFAULT_HUB } from "./routes";
import { trackRun } from "./tracker";
import { fitTrack, lapLength, laneRadius, markedDistance, markerSplits, trackDistance } from "./trackmode";

let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2, g = () => (rnd() + rnd() + rnd()) / 1.5;
/** A real-looking track: centre near Ivory Park, straights pointing 25 degrees east of north. Position at metres s along lane 1. */
const C = destination(DEFAULT_HUB, 45, 300), B = 25, R1 = 36.8, H = 84.39 / 2, BEND = Math.PI * R1;
function at(s0: number, offset = 0): LatLon {
  const s = ((s0 % 400) + 400) % 400, r = R1 + offset; let u: number, v: number;
  if (s < 84.39) { u = s - H; v = -r; } else if (s < 84.39 + BEND) { const t = (s - 84.39) / R1 - Math.PI / 2; u = H + r * Math.cos(t); v = r * Math.sin(t); }
  else if (s < 2 * 84.39 + BEND) { u = H - (s - 84.39 - BEND); v = r; } else { const t = (s - 2 * 84.39 - BEND) / R1 + Math.PI / 2; u = -H + r * Math.cos(t); v = r * Math.sin(t); }
  return destination(destination(C, B, u), B - 90, v); // v is to the left of the straight direction
}
function run(metres: number, speed: number, sd: number, startS = 30): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let t = 0; t * speed <= metres; t++) { const p = at(startS + t * speed), n = destination(destination(p, 0, g() * sd), 90, g() * sd); out.push({ ...n, t: t * 1000, acc: sd * 1.2 }); }
  return out;
}

describe("track geometry", () => {
  it("matches the World Athletics lane lengths", () => {
    expect(lapLength(1)).toBeCloseTo(400, 1); expect(lapLength(2)).toBeCloseTo(407.04, 1); expect(lapLength(8)).toBeCloseTo(453.03, 1); // = the 400 m stagger for lane 8 (about 53 m)
    expect(laneRadius(1)).toBeCloseTo(36.8, 5);
  });
});
describe("learning the track from one lap", () => {
  it("finds the centre within a few metres and the direction within a few degrees", () => {
    const f = fitTrack(run(420, 5, 4));
    const off = Math.hypot((f.center.lat - C.lat) * 111320, (f.center.lon - C.lon) * 111320 * Math.cos((C.lat * Math.PI) / 180));
    expect(off).toBeLessThan(3); const db = Math.min(Math.abs(f.bearing - B), Math.abs(f.bearing - B - 180)); expect(db).toBeLessThan(3);
  });
  it("refuses half a lap or a road run", () => {
    expect(() => fitTrack(run(180, 5, 4))).toThrow(/full lap/);
    expect(() => fitTrack(Array.from({ length: 80 }, (_, i) => ({ ...destination(DEFAULT_HUB, 90, i * 5), t: i })))).toThrow(/full lap/);
  });
});
describe("distance and laps on the track", () => {
  const place = fitTrack(run(420, 5, 4));
  it("4 laps (1620 m) with 5 m GPS noise: within 5 m, and the error does not grow with laps", () => {
    const pts = trackRun(run(1620, 5, 5)).points, r = trackDistance(pts, place, 1);
    expect(Math.abs(r.distanceM - 1620)).toBeLessThan(5); expect(r.laps).toHaveLength(4);
    for (const l of r.laps) expect(Math.abs(l.ms - 80_000)).toBeLessThan(2500); // 400 m at 5 m/s = 80 s
    const r10 = trackDistance(trackRun(run(4000, 5, 5)).points, place, 1); expect(Math.abs(r10.distanceM - 4000)).toBeLessThan(5);
  });
  it("uses the lane length (lane 3 is longer)", () => {
    const pts = trackRun(run(800, 5, 3)).points;
    expect(trackDistance(pts, place, 3).distanceM).toBeCloseTo(800 * lapLength(3) / 400, -1);
  });
  it("notices when the runner is not on the track", () => {
    const road = Array.from({ length: 60 }, (_, i) => ({ ...destination(C, 180, 300 + i * 4), t: i * 1000 }));
    expect(trackDistance(road, place).offTrack).toBe(true);
  });
});
describe("marker boards", () => {
  it("snaps to each measured board and gives exact splits", () => {
    const markers = [{ atMs: 300_000, distM: 1000 }, { atMs: 610_000, distM: 2000 }];
    expect(markedDistance(markers, 2_080, [1_030, 2_050])).toBe(2030);  // 30 m past the 2 km board by GPS
    expect(markedDistance([], 512, [])).toBe(512);
    expect(markerSplits(markers, 0).map((s) => s.ms)).toEqual([300_000, 310_000]); expect(markerSplits(markers, 0)[1].paceSecPerKm).toBe(310);
  });
});
import { pointOnTrack, trackOutline, along as alongFn } from "./trackmode";
import { DEMO_RUNNERS, demoDistance, demoPositions } from "./demo";
import { addPositions, liveFlags } from "./livemap";
describe("demo track", () => {
  const place = { center: C, bearing: B };
  it("points on the track sit on the lane line and the outline closes", () => {
    for (const s of [0, 50, 120, 200, 300, 399]) { const fit = trackDistance([{ ...pointOnTrack(place, 0), t: 0 }, { ...pointOnTrack(place, s), t: 1 }], place); expect(fit.offTrack).toBe(false); }
    const o = trackOutline(place); expect(o[0].lat).toBeCloseTo(o[o.length - 1].lat, 9); void alongFn;
  });
  it("demo runners lap at their own speeds, and runner E stops (flagged after 3 minutes)", () => {
    expect(demoDistance(DEMO_RUNNERS[0], 100)).toBeCloseTo(560); expect(demoDistance(DEMO_RUNNERS[4], 1000)).toBe(360);
    let trail = {}; for (let s = 0; s <= 300; s += 5) trail = addPositions(trail, demoPositions(place, s, s * 1000, 1), s * 1000);
    const f = liveFlags(trail, 300_000); expect(f["5"]).toBe("stopped"); expect(f["1"]).toBeUndefined();
  });
});
