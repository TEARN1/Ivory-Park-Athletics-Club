import { describe, expect, it } from "vitest";
import * as C from "./club";
import * as S from "./session";

const m = (name: string, extra: Partial<C.Member> = {}) => C.newMember(name, extra, Date.parse("2026-01-01"));
function race(date: string, km: number, order: [string, number][], members: C.Member[]): S.Session {
  let s = { ...S.newSession(km), date };
  for (const [name] of order) { const mem = members.find((x) => x.name === name); s = S.addRunner(s, name, String(s.runners.length + 1)); s.runners[s.runners.length - 1].memberId = mem?.id; }
  s = S.start(s, 0); for (const [name, ms] of order) if (ms) s = S.finish(s, s.runners.find((r) => r.name === name)!.id, ms);
  return S.endSession(s, 1e9);
}
const A = m("Thandi Mokoena", { gender: "F", birthYear: 1990 }), B = m("Sipho Dlamini", { gender: "M", birthYear: 2010 }), Cc = m("Lerato", { gender: "F", birthYear: 1975 });
const members = [A, B, Cc];
const hist = [
  race("2026-01-05", 5, [["Thandi Mokoena", 1_500_000], ["Sipho Dlamini", 1_400_000], ["Lerato", 0]], members),
  race("2026-01-12", 5, [["Thandi Mokoena", 1_380_000], ["Sipho Dlamini", 1_450_000]], members),
  race("2026-01-19", 10, [["Lerato", 3_300_000], ["Thandi Mokoena", 3_000_000]], members),
];

describe("members", () => {
  it("validates names and birth years", () => {
    expect(() => m(" ")).toThrow(); expect(() => m("X", { birthYear: 1800 })).toThrow(); expect(m("  Naledi   M  ").name).toBe("Naledi M");
  });
  it("public names never show a full surname", () => {
    expect(C.publicName("Thandi Mokoena")).toBe("Thandi M."); expect(C.publicName("Lerato")).toBe("Lerato"); expect(C.publicName("  a b c ")).toBe("a C.");
  });
  it("flags under-18s without guardian consent", () => {
    expect(C.needsConsent(B, 2026)).toBe(true); expect(C.needsConsent({ ...B, consentAt: 1 }, 2026)).toBe(false); expect(C.needsConsent(A, 2026)).toBe(false);
    expect(C.needsConsent(m("No year"), 2026)).toBe(false);
  });
  it("places ages in groups and gives a gentle age factor", () => {
    expect(C.categoryOf(16)!.id).toBe("junior"); expect(C.categoryOf(36)!.id).toBe("senior"); expect(C.categoryOf(51)!.id).toBe("master"); expect(C.categoryOf(undefined)).toBeUndefined();
    expect(C.ageFactor(30)).toBe(1); expect(C.ageFactor(44)).toBeCloseTo(0.92); expect(C.ageAdjustedMs(1_000_000, 44)).toBe(920000);
  });
});
describe("history", () => {
  it("collects results, PBs and attendance", () => {
    const r = C.memberResults(hist, A.id); expect(r.map((x) => x.rank)).toEqual([2, 1, 1]);
    expect(C.personalBests(r).map((x) => [x.distanceKm, x.ms])).toEqual([[5, 1_380_000], [10, 3_000_000]]);
    expect(C.attendance(hist, Cc.id)).toEqual(["2026-01-05", "2026-01-19"]); // checked in even without finishing
  });
  it("counts week streaks back from this week", () => {
    expect(C.weekStreak(["2026-01-05", "2026-01-12", "2026-01-19"], "2026-01-21")).toBe(3);
    expect(C.weekStreak(["2026-01-05", "2026-01-12"], "2026-01-21")).toBe(2);    // nothing yet this week: count from last week
    expect(C.weekStreak(["2026-01-05"], "2026-01-21")).toBe(0);
    expect(C.weekIndex("2026-01-11")).toBe(C.weekIndex("2026-01-05")); expect(C.weekIndex("2026-01-12")).toBe(C.weekIndex("2026-01-05") + 1);
  });
  it("awards badges from real history only", () => {
    const ids = C.badges(hist, A.id, "2026-01-21").map((b) => b.id);
    expect(ids).toContain("first"); expect(ids).toContain("win"); expect(ids).not.toContain("s5"); expect(ids).not.toContain("w4");
  });
  it("scores the league: 1 per finish plus place points", () => {
    const t = C.league(hist, members, 2026);
    expect(t.map((x) => [x.name, x.points])).toEqual([["Thandi Mokoena", 8 + 1 + 10 + 1 + 10 + 1], ["Sipho Dlamini", 11 + 9], ["Lerato", 9]]);
    expect(C.league(hist, members, 2025)).toEqual([]);
  });
  it("keeps club records per distance, overall and by gender", () => {
    const r = C.clubRecords(hist, members);
    expect(r.find((x) => x.distanceKm === 5 && x.group === "All")!.name).toBe("Thandi Mokoena");
    expect(r.find((x) => x.distanceKm === 5 && x.group === "M")!.ms).toBe(1_400_000);
  });
});
