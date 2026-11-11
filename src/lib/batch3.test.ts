import { describe, expect, it } from "vitest";
import * as C from "./club";
import { buildBundle, esc, renderClubPage, renderResultsPage, sanitizeBundle } from "./publicSite";
import * as S from "./session";
import { applyShared, emptyTiming, localChanges, timingReduce } from "./timing";

describe("shared timing", () => {
  it("keeps the earliest time and notes real disagreements", () => {
    let t = timingReduce(emptyTiming(), { type: "finish", bib: "4", ms: 1000, by: "a", at: 0 }); expect(t.finishes).toEqual({}); // not started
    t = timingReduce(t, { type: "start", at: 50_000 }); t = timingReduce(t, { type: "start", at: 99_000 }); expect(t.startedAt).toBe(50_000);
    t = timingReduce(t, { type: "finish", bib: "4", ms: 600_400, by: "a", at: 1 });
    t = timingReduce(t, { type: "finish", bib: "4", ms: 600_900, by: "b", at: 2 }); expect(t.conflicts).toEqual([]);           // within a second
    t = timingReduce(t, { type: "finish", bib: "4", ms: 598_000, by: "b", at: 3 }); expect(t.finishes["4"]).toEqual({ ms: 598_000, by: "b" });
    expect(t.conflicts).toEqual([{ bib: "4", kept: 598_000, other: 600_400, at: 3 }]);
    t = timingReduce(t, { type: "finish", bib: "4", ms: 601_000, by: "b", at: 4 }); expect(t.finishes["4"].ms).toBe(601_000);    // same phone corrects itself
    expect(timingReduce(t, { type: "finish", bib: "<x>", ms: 1, by: "a", at: 0 })).toBe(t);
    expect(timingReduce(t, { type: "undo", bib: "4" }).finishes).toEqual({});
  });
  it("merges into a phone's session: start on the local clock, new bibs added, remote undo removed", () => {
    let s = S.addRunner(S.newSession(5), "Thandi", "1");
    let t = timingReduce(emptyTiming(), { type: "start", at: 100_000 });
    t = timingReduce(t, { type: "finish", bib: "1", ms: 900_000, by: "a", at: 0 }); t = timingReduce(t, { type: "finish", bib: "9", ms: 950_000, by: "b", at: 0 });
    const a = applyShared(s, t, 2_000, []); s = a.session;
    expect(s.startedAt).toBe(98_000); expect(s.runners.map((r) => r.bib)).toEqual(["1", "9"]); expect(S.standings(s).map((r) => r.elapsedMs)).toEqual([900_000, 950_000]);
    const b = applyShared(s, timingReduce(t, { type: "undo", bib: "9" }), 2_000, a.seen);
    expect(S.standings(b.session).map((r) => r.runner.bib)).toEqual(["1"]); expect(b.seen).toEqual(["1"]);
  });
});

describe("public club page", () => {
  const m = C.newMember("Thandi Mokoena", { emergency: { name: "Mom", phone: "0821234567" } });
  let s = S.addRunner({ ...S.newSession(5), date: "2026-11-10" }, "Thandi Mokoena", "1"); s.runners[0].memberId = m.id; s = S.start(s, 0); s = S.finish(s, s.runners[0].id, 1_500_000);
  const club: C.ClubData = { ...C.emptyClub(), members: [{ ...m, notes: [{ id: "n", at: 0, text: "private note" }] }], events: [{ id: "e1", date: "2026-11-14", time: "06:30", title: "Time trial", distanceKm: 5 }, { id: "old", date: "2026-01-01", time: "", title: "Old" }] };
  const b = buildBundle(club, [s], "2026-11-11");
  it("publishes only public facts", () => {
    const json = JSON.stringify(b);
    expect(json).toContain("Thandi M."); expect(json).not.toContain("Mokoena"); expect(json).not.toContain("0821234567"); expect(json).not.toContain("private note");
    expect(b.events.map((e) => e.id)).toEqual(["e1"]);
  });
  it("the server re-checks everything it is sent", () => {
    const evil = sanitizeBundle({ results: [{ id: "r", date: "2026-11-10", distanceKm: 5, rows: [{ place: "1st", name: "Thandi Mokoena", time: "25:00" }] }],
      news: [{ id: "n", at: 1, title: "Hi", body: "x", photo: "javascript:alert(1)" }], sponsors: [{ id: "s", name: "Spaza", url: "javascript:alert(1)" }], events: [{ id: "e", date: "soon", title: "x" }] });
    expect(evil.results[0].rows[0].name).toBe("Thandi M."); expect(evil.news[0].photo).toBeUndefined(); expect(evil.sponsors[0].url).toBeUndefined(); expect(evil.events).toEqual([]);
  });
  it("escapes everything in the HTML", () => {
    const html = renderClubPage(sanitizeBundle({ events: [{ id: "e", date: "2026-11-14", title: "<script>x</script>" }] }), { e: 3 });
    expect(html).not.toContain("<script>x"); expect(html).toContain("&lt;script&gt;"); expect(html).toContain("3 coming");
    expect(renderResultsPage(b, s.id)).toContain("Thandi M."); expect(renderResultsPage(b, "nope")).toBeUndefined(); expect(esc(`"'&`)).toBe("&quot;&#39;&amp;");
    expect(renderClubPage(undefined, {})).toContain("not been published");
  });
});

describe("bib keypad and local changes", () => {
  it("finishes by bib, adding unknown bibs, refusing doubles", () => {
    let s = S.start(S.addRunner(S.newSession(5), "A", "1"), 0);
    const a = S.finishByBib(s, " 1 ", 5000); expect(a.runner.name).toBe("A"); s = a.session;
    const b = S.finishByBib(s, "42", 6000); expect(b.runner.bib).toBe("42"); s = b.session;
    expect(() => S.finishByBib(s, "42", 7000)).toThrow(/already/); expect(() => S.finishByBib(s, "", 1)).toThrow();
    expect(S.finishesByBib(s)).toEqual({ "1": 5000, "42": 6000 });
  });
  it("only sends what this phone changed", () => {
    expect(localChanges({ "1": 5, "2": 6 }, { "1": 5, "2": 7, "3": 8 })).toEqual({ finish: [{ bib: "2", ms: 7 }, { bib: "3", ms: 8 }], undo: [] });
    expect(localChanges({ "1": 5 }, {})).toEqual({ finish: [], undo: ["1"] });
  });
});
