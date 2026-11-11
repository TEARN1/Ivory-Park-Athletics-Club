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
});
