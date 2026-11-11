import { describe, expect, it } from "vitest";
import { destination, haversineM, splits, cleanTrack, pathLengthM, type TrackPoint } from "./geo";
import { initialRelay, relayReduce } from "./relay";
import { DEFAULT_HUB, generateLoops, reroute, usesBearing } from "./routes";
import { sessionCsv } from "./csv";
import * as S from "./session";

const steady = (paceSecPerKm: number, km: number): TrackPoint[] => {
  const o = { lat: -26, lon: 28 }; const pts: TrackPoint[] = [];
  for (let m = 0; m <= km * 1000; m += 10) { const p = destination(o, 90, m); pts.push({ ...p, t: (m / 1000) * paceSecPerKm * 1000 }); }
  return pts;
};
describe("geo", () => {
  it("haversine ~ 111 km per degree latitude", () => expect(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeGreaterThan(111000));
  it("splits a steady 5:00/km run into 2 full km plus a partial", () => {
    const sp = splits(steady(300, 2.5));
    expect(sp.slice(0, 2).map((x) => Math.round(x.paceSecPerKm))).toEqual([300, 300]);
    expect(sp[2].partial).toBe(true); expect(Math.round(sp[2].paceSecPerKm)).toBe(300);
  });
  it("drops teleporting GPS jumps", () => {
    const pts = steady(300, 0.5); pts.splice(10, 0, { lat: -25, lon: 28, t: pts[9].t + 1000 });
    expect(cleanTrack(pts).some((p) => p.lat === -25)).toBe(false);
  });
});
describe("relay", () => {
  it("only the lead can pass, only others can take, take needs an offer", () => {
    let r = relayReduce(initialRelay(), { type: "setLead", runnerId: "a", at: 0 });
    expect(relayReduce(r, { type: "take", runnerId: "b", at: 1 }).leadId).toBe("a");
    expect(relayReduce(r, { type: "pass", runnerId: "b" }).offeredBy).toBeUndefined();
    r = relayReduce(r, { type: "pass", runnerId: "a" });
    expect(relayReduce(r, { type: "take", runnerId: "a", at: 2 }).leadId).toBe("a");
    r = relayReduce(r, { type: "take", runnerId: "b", at: 3 });
    expect(r.leadId).toBe("b"); expect(r.offeredBy).toBeUndefined(); expect(r.history.map((h) => h.runnerId)).toEqual(["a", "b"]);
  });
});
describe("routes", () => {
  it("makes 15 loops within 1% of the target, all closed at the hub", () => {
    for (const km of [5, 20, 50]) {
      const rs = generateLoops(DEFAULT_HUB, km); expect(rs).toHaveLength(15);
      for (const r of rs) { expect(Math.abs(r.lengthM / 1000 - km) / km).toBeLessThan(0.01); expect(r.points[0]).toEqual(r.points.at(-1)); expect(pathLengthM(r.points)).toBe(r.lengthM); }
    }
  });
  it("rejects silly distances", () => { expect(() => generateLoops(DEFAULT_HUB, 0)).toThrow(); expect(() => generateLoops(DEFAULT_HUB, 500)).toThrow(); });
  it("reroute keeps distance and avoids a blocked direction", () => {
    const rs = generateLoops(DEFAULT_HUB, 10); const next = reroute(rs, rs[0], 90)!;
    expect(next.id).not.toBe(rs[0].id); expect(usesBearing(next, 90)).toBe(false); expect(next.targetKm).toBe(10);
  });
});
describe("csv + edits", () => {
  it("escapes formulas and commas", () => {
    let s = S.newSession(5); s = S.addRunner(s, '=HYPERLINK("x"), Bob', "9"); s = S.start(s, 0); s = S.finish(s, s.runners[0].id, 1_500_000);
    const csv = sessionCsv(s); expect(csv).toContain(`"'=HYPERLINK(""x""), Bob"`); expect(csv.split("\n")[1].startsWith("1st,9,")).toBe(true);
  });
  it("edits a runner and a finish time", () => {
    let s = S.newSession(5); s = S.addRunner(s, "A", "1"); s = S.addRunner(s, "B", "2"); s = S.start(s, 0); const [a] = s.runners; s = S.finish(s, a.id, 600000);
    s = S.setFinishTime(s, a.id, S.parseTime("9:30")); expect(s.finishes[a.id]).toBe(570000);
    expect(() => S.updateRunner(s, a.id, "A", "2")).toThrow(); expect(() => S.parseTime("x")).toThrow();
  });
});
