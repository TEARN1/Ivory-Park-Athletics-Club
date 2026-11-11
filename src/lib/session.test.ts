import { describe, expect, it } from "vitest";
import * as S from "./session";

const base = () => {
  let s = S.newSession(5);
  s = S.addRunner(s, "Thandi", "1"); s = S.addRunner(s, "Sipho", "2"); s = S.addRunner(s, "Lerato", "3");
  return s;
};
describe("session", () => {
  it("rejects duplicate bibs and empty entries", () => {
    const s = base();
    expect(() => S.addRunner(s, "X", "1")).toThrow();
    expect(() => S.addRunner(s, " ", " ")).toThrow();
  });
  it("ignores finishes before start and double finishes", () => {
    let s = base(); const id = s.runners[0].id;
    expect(S.finish(s, id, 1000).finishes).toEqual({});
    s = S.start(s, 0); s = S.finish(s, id, 900_000); s = S.finish(s, id, 999_999);
    expect(s.finishes[id]).toBe(900_000);
  });
  it("ranks, paces and gaps", () => {
    let s = S.start(base(), 0); const [a, b, c] = s.runners;
    s = S.finish(s, b.id, 1_500_000); s = S.finish(s, a.id, 1_200_000);
    const rows = S.standings(s);
    expect(rows.map((r) => r.runner.name)).toEqual(["Thandi", "Sipho"]);
    expect(S.fmtPace(rows[0].paceSecPerKm)).toBe("4:00/km");
    expect(rows[1].gapMs).toBe(300_000);
    expect(S.stillRunning(s).map((r) => r.id)).toEqual([c.id]);
    expect(S.groupMedianPace(s)).toBe(270);
  });
  it("formats ordinals and times", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(S.ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd"]);
    expect(S.fmtTime(65_000)).toBe("1:05"); expect(S.fmtTime(3_725_000)).toBe("1:02:05");
  });
  it("buddy links clear when the buddy is removed", () => {
    let s = base(); const [a, b] = s.runners;
    s = S.setBuddy(s, a.id, b.id); s = S.removeRunner(s, b.id);
    expect(s.runners[0].buddyId).toBeUndefined();
    expect(() => S.setBuddy(s, a.id, a.id)).toThrow();
  });
  it("moves through setup, running and done; no finishes after the end", () => {
    let s = S.start(base(), 100); expect(S.phase(base())).toBe("setup"); expect(S.phase(s)).toBe("running");
    s = S.endSession(s, 500); expect(S.phase(s)).toBe("done");
    expect(S.finish(s, s.runners[0].id, 900).finishes).toEqual({});
    s = S.resumeSession(s); expect(S.phase(s)).toBe("running");
    expect(S.endSession(base(), 1).endedAt).toBeUndefined();
  });
  it("next session keeps the squad but clears the clock and results", () => {
    let s = S.start(base(), 0); s = S.finish(s, s.runners[0].id, 1000); s = S.setBuddy(s, s.runners[1].id, s.runners[0].id);
    const n = S.nextSession(s, true);
    expect(n.id).not.toBe(s.id); expect(n.runners.map((r) => r.bib)).toEqual(["1", "2", "3"]); expect(n.runners[1].buddyId).toBe(s.runners[0].id);
    expect(n.startedAt).toBeUndefined(); expect(n.finishes).toEqual({}); expect(S.nextSession(s, false).runners).toEqual([]);
  });
  it("suggests the next free bib", () => {
    expect(S.nextBib(S.newSession())).toBe("1"); expect(S.nextBib(base())).toBe("4");
  });
  it("adds numbered runners from the next free bib", () => {
    const s = S.addNumbered(S.newSession(), 20);
    expect(s.runners).toHaveLength(20); expect(s.runners[0].bib).toBe("1"); expect(s.runners[19].bib).toBe("20");
    const t = S.addNumbered(S.addRunner(S.newSession(), "A", "5"), 3);
    expect(t.runners.map((r) => r.bib)).toEqual(["5", "6", "7", "8"]);
    expect(() => S.addNumbered(s, 0)).toThrow(); expect(() => S.addNumbered(s, 500)).toThrow();
  });
});
