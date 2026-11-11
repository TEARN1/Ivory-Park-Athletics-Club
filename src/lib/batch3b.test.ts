import { describe, expect, it } from "vitest";
import { makeBackup, mergeData, parseBackup } from "./backup";
import * as C from "./club";
import { destination, pathLengthM } from "./geo";
import { addPositions, liveFlags } from "./livemap";
import { DEFAULT_HUB, followRoads } from "./routes";
import * as S from "./session";

describe("follow roads", () => {
  // Stand-in router: returns the straight path but says roads are 30% longer.
  const fake = async (url: string) => {
    const pts = url.split("/foot/")[1].split("?")[0].split(";").map((c) => { const [lon, lat] = c.split(",").map(Number); return { lat, lon }; });
    return { code: "Ok", routes: [{ distance: pathLengthM(pts) * 1.3, geometry: { coordinates: pts.map((p) => [p.lon, p.lat]) } }] };
  };
  it("resizes the loop until the road distance is within 4%", async () => {
    const r = await followRoads(DEFAULT_HUB, 5, 2, "https://router.example/", fake);
    expect(r.roads).toBe(true); expect(Math.abs(r.lengthM / 1000 - 5) / 5).toBeLessThanOrEqual(0.04);
  });
  it("explains failures in plain words", async () => {
    await expect(followRoads(DEFAULT_HUB, 5, 0, "x", async () => { throw new Error("net"); })).rejects.toThrow(/Cannot reach/);
    await expect(followRoads(DEFAULT_HUB, 5, 0, "x", async () => ({ code: "NoRoute" }))).rejects.toThrow(/no roads/);
  });
});
describe("live map flags", () => {
  const at = (id: string, m: number, t: number) => ({ runnerId: id, ...destination(DEFAULT_HUB, 90, m), at: t });
  it("spots runners who stopped or went quiet", () => {
    let tr = {} as ReturnType<typeof addPositions>;
    for (let t = 0; t <= 200_000; t += 20_000) tr = addPositions(tr, [at("moving", t / 100, t), at("still", 3 + (t % 40_000 ? 2 : 0), t)], t);
    tr = addPositions(tr, [at("quiet", 0, 0)], 0);
    const f = liveFlags(tr, 200_000); expect(f).toEqual({ still: "stopped", quiet: "no-signal" });
    expect(liveFlags(addPositions({}, [at("new", 0, 0)], 0), 10_000)).toEqual({});   // too soon to say
  });
});
describe("backup and two phones", () => {
  const mem = C.newMember("Thandi", {}, 1);
  const s1 = { ...S.newSession(5), id: "s1", date: "2026-11-01" };
  const local = { history: [s1], routes: [], club: { ...C.emptyClub(), members: [{ ...mem, bib: "1", updatedAt: 10 }] } };
  const phone2 = { history: [{ ...s1, endedAt: 99, startedAt: 0, finishes: { x: 1 } }, { ...S.newSession(5), id: "s2", date: "2026-11-08" }], routes: [], club: { ...C.emptyClub(), members: [{ ...mem, bib: "7", updatedAt: 20 }, C.newMember("Sipho")] } };
  it("round-trips through a file and refuses other files", () => {
    const b = makeBackup(local, 5); expect(parseBackup(JSON.stringify(b)).data.club.members[0].name).toBe("Thandi");
    expect(() => parseBackup("{}")).toThrow(/not a backup/); expect(() => parseBackup("nonsense")).toThrow(/not a backup/);
    expect(JSON.stringify(b)).not.toMatch(/token/i);
  });
  it("merges without losing anything and keeps the newer edit", () => {
    const m = mergeData(local, phone2);
    expect(m.history.map((s) => s.id)).toEqual(["s1", "s2"]); expect(m.history[0].endedAt).toBe(99);
    expect(m.club.members.map((x) => x.bib)).toEqual(["7", undefined]);
  });
});
