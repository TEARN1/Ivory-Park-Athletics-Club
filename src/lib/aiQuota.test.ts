import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeProfileAiShare,
  getProfileAiShare,
  getSquadAiShareRoster,
  getTodayDateKey,
  isProfileAdmin,
  loadClubAiConfig,
  resetSingleAthleteShare,
  resetSquadAiShares,
  saveClubAiConfig,
} from "./aiQuota";
import { processCoachQuery, validateGeminiApiKey, saveGeminiApiKey, loadGeminiApiKey } from "./geminiCoach";
import { loadClubSchedule } from "./schedule";
import type { AthleteProfile } from "./auth";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("aiQuota module", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  const dummyAthlete: AthleteProfile = {
    id: "profile-test-sipho",
    name: "Sipho Dlamini",
    bib: "12",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Freedom Drive Hub",
    createdAt: 1000,
    updatedAt: 1000,
  };

  const adminCoach: AthleteProfile = {
    id: "profile-test-coach",
    name: "Siyavuya Thomas",
    bib: "1",
    role: "coach",
    titleNote: "The Original Coach",
    ageGroup: "Veteran (40-49)",
    gender: "M",
    section: "Freedom Drive Hub",
    createdAt: 1000,
    updatedAt: 1000,
  };

  const adminIT: AthleteProfile = {
    id: "profile-test-it",
    name: "Asemahle Nkwali",
    bib: "4",
    role: "athlete",
    titleNote: "Me, The IT of the team",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Freedom Drive Hub",
    createdAt: 1000,
    updatedAt: 1000,
  };

  it("identifies Coach and Team IT profiles as admins", () => {
    expect(isProfileAdmin(adminCoach)).toBe(true);
    expect(isProfileAdmin(adminIT)).toBe(true);
    expect(isProfileAdmin(dummyAthlete)).toBe(false);
    expect(isProfileAdmin(null)).toBe(false);
  });

  it("saves and loads club AI config catering for everyone", () => {
    saveClubAiConfig(
      { apiKey: "AIzaSyTestClubGlobalKey", defaultDailyLimit: 25 },
      adminIT
    );
    const cfg = loadClubAiConfig();
    expect(cfg.apiKey).toBe("AIzaSyTestClubGlobalKey");
    expect(cfg.defaultDailyLimit).toBe(25);
    expect(cfg.updatedBy).toContain("Asemahle Nkwali");
  });

  it("allocates separate fair shares to different athlete profiles", () => {
    saveClubAiConfig({ defaultDailyLimit: 5 });

    const shareSipho = getProfileAiShare(dummyAthlete);
    expect(shareSipho.usedToday).toBe(0);
    expect(shareSipho.dailyLimit).toBe(5);
    expect(shareSipho.remaining).toBe(5);
    expect(shareSipho.unlimited).toBe(false);

    const shareAdmin = getProfileAiShare(adminCoach);
    expect(shareAdmin.unlimited).toBe(true);
  });

  it("consumes share per profile independently", () => {
    saveClubAiConfig({ defaultDailyLimit: 2 });

    const c1 = consumeProfileAiShare(dummyAthlete);
    expect(c1.allowed).toBe(true);
    expect(c1.share.usedToday).toBe(1);
    expect(c1.share.remaining).toBe(1);

    const c2 = consumeProfileAiShare(dummyAthlete);
    expect(c2.allowed).toBe(true);
    expect(c2.share.usedToday).toBe(2);
    expect(c2.share.remaining).toBe(0);

    // Limit reached for dummyAthlete
    const c3 = consumeProfileAiShare(dummyAthlete);
    expect(c3.allowed).toBe(false);
    expect(c3.reason).toContain("reached for today");

    // Other athlete (e.g. admin or different runner) is unaffected
    const athlete2: AthleteProfile = {
      ...dummyAthlete,
      id: "profile-test-thandi",
      name: "Thandi Mokoena",
      bib: "11",
    };
    const cOther = consumeProfileAiShare(athlete2);
    expect(cOther.allowed).toBe(true);
    expect(cOther.share.usedToday).toBe(1);
  });

  it("resets athlete shares correctly", () => {
    saveClubAiConfig({ defaultDailyLimit: 2 });
    consumeProfileAiShare(dummyAthlete);
    consumeProfileAiShare(dummyAthlete);
    expect(getProfileAiShare(dummyAthlete).remaining).toBe(0);

    resetSingleAthleteShare(dummyAthlete.id);
    expect(getProfileAiShare(dummyAthlete).remaining).toBe(2);
  });

  it("builds squad AI share roster", () => {
    const roster = getSquadAiShareRoster([dummyAthlete, adminCoach]);
    expect(roster.length).toBe(2);
    expect(roster[0].name).toBe("Sipho Dlamini");
    expect(roster[1].name).toBe("Siyavuya Thomas");
    expect(roster[1].unlimited).toBe(true);
  });

  it("supports custom API link saving and loading", () => {
    saveGeminiApiKey("https://custom-gateway.ipac.internal/v1/chat", adminIT);
    const key = loadGeminiApiKey();
    expect(key).toBe("https://custom-gateway.ipac.internal/v1/chat");
    const cfg = loadClubAiConfig();
    expect(cfg.apiUrl).toBe("https://custom-gateway.ipac.internal/v1/chat");
  });

  it("validates empty input as invalid", async () => {
    const res = await validateGeminiApiKey("   ");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Please enter");
  });

  it("seamlessly routes athlete to Highveld Local Engine when daily share is exhausted", async () => {
    saveClubAiConfig({ defaultDailyLimit: 1 });
    consumeProfileAiShare(dummyAthlete); // 1 used out of 1

    const share = getProfileAiShare(dummyAthlete);
    expect(share.remaining).toBe(0);

    const sched = loadClubSchedule();
    const coachRes = await processCoachQuery("How is my pace?", {
      schedule: sched,
      roleMode: "athlete",
      athlete: dummyAthlete,
      apiKey: "AIzaSyTestKeyThatWontBeCalledBecauseQuotaExhausted",
    });

    expect(coachRes.source).toBe("local");
    expect(coachRes.text).toContain("[Highveld Fair Share Notice]");
    expect(coachRes.text).toContain("Switched to Highveld Local Engine so other squad members receive their fair share");
    expect(coachRes.quotaShare?.remaining).toBe(0);
  });
});
