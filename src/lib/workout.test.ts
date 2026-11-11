import { describe, expect, it } from "vitest";
import * as S from "./session";
import * as W from "./workout";

const squad = () => { let s = S.newSession(5); for (const n of ["A", "B"]) s = S.addRunner(s, n, String(s.runners.length + 1)); return s; };
describe("laps", () => {
  it("records each lap, finishes on the last, and undoes", () => {
    let s = W.setMode(squad(), "laps", { count: 3, km: 0.4 }); expect(s.distanceKm).toBe(1.2);
    s = S.start(s, 0); const a = s.runners[0].id;
    s = W.lapTap(s, a, 90_000); s = W.lapTap(s, a, 185_000); expect(s.finishes[a]).toBeUndefined();
    s = W.lapTap(s, a, 275_000); expect(s.finishes[a]).toBe(275_000); expect(W.lapTap(s, a, 400_000)).toBe(s);
    expect(W.lapSplits(s.marks![a])).toEqual([90_000, 95_000, 90_000]);
    s = W.undoLap(s, a); expect(s.finishes[a]).toBeUndefined(); expect(W.lapsDone(s, a)).toBe(2);
  });
  it("refuses bad set-ups and changes after the start", () => {
    expect(() => W.setMode(squad(), "laps", { count: 0, km: 0.4 })).toThrow(); expect(() => W.setMode(squad(), "reps", { count: 6, km: 0.4, restSec: 5000 })).toThrow();
    expect(() => W.setMode(S.start(squad(), 0), "race")).toThrow();
  });
});
describe("interval reps", () => {
  it("times each rep from its own start, rests, and ends after the last rep", () => {
    let s = W.setMode(squad(), "reps", { count: 2, km: 0.4, restSec: 60 }); s = W.startReps(s, 1000);
    const [a, b] = s.runners.map((r) => r.id);
    s = W.repTap(s, a, 76_000); s = W.repTap(s, a, 99_000); expect(s.marks![a]).toEqual([75_000]);
    expect(W.repComplete(s)).toBe(false); s = W.repTap(s, b, 81_000); expect(W.repComplete(s)).toBe(true);
    s = W.endRep(s, 82_000); expect(s.restUntil).toBe(142_000); expect(W.repTap(s, a, 90_000)).toBe(s);   // no taps while resting
    s = W.nextRep(s, 142_000); s = W.repTap(s, b, 220_000); expect(s.marks![b]).toEqual([80_000, 78_000]);
    s = W.endRep(s, 230_000); expect(S.phase(s)).toBe("done");                                             // a missed rep 2: stays empty
    const rows = W.workoutRows(s); expect(rows[1]).toMatchObject({ avg: 79_000, best: 78_000, spread: 2_000 }); expect(rows[0].times).toEqual([75_000]);
  });
});
describe("pace and safety", () => {
  it("phrases pace cues for the runner", () => {
    expect(W.paceCue(312_000, 1, 300).text).toBe("12 seconds behind target"); expect(W.paceCue(119_000, 0.4, 300).text).toBe("1 second ahead of target");
    expect(W.paceCue(300_000, 1, 300).text).toBe("on target");
  });
  it("group pace wins over the runner's own target", () => {
    let s = W.addGroup(squad(), "Sub 25", 300); s = W.setGroup(s, s.runners[0].id, s.groups![0].id);
    expect(W.targetPaceFor(s, s.runners[0].id, 330)).toBe(300); expect(W.targetPaceFor(s, s.runners[1].id, 330)).toBe(330);
    s = W.removeGroup(s, s.groups![0].id); expect(s.runners[0].groupId).toBeUndefined();
  });
  it("flags runners out too long or far behind", () => {
    let s = S.newSession(5); for (const n of ["A", "B", "C", "D"]) s = S.addRunner(s, n, n); s = S.start(s, 0);
    const [a, b, c] = s.runners.map((r) => r.id); s = S.finish(s, a, 1_500_000); s = S.finish(s, b, 1_600_000);
    expect(W.safetyAlerts(s, 1_700_000)).toEqual([]);
    expect(W.safetyAlerts(s, 2_100_000).map((x) => x.reason)).toEqual([expect.stringMatching(/behind the group/), expect.stringMatching(/behind the group/)]);
    s = S.finish(s, c, 1_650_000); expect(W.safetyAlerts(s, 3_700_000)[0].reason).toMatch(/Still out after 62 min/);
  });
});
