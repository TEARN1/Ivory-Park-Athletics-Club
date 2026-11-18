import { describe, expect, it, beforeEach } from "vitest";
import {
  createAthleteProfile,
  getCurrentAthlete,
  listClubProfiles,
  logoutAthlete,
  quickSignIn,
  setCurrentAthlete,
} from "./auth";
import { processCoachQuery } from "./geminiCoach";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("Athlete Authentication & Profile Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads pre-seeded club profiles including Sipho and Thandi", () => {
    const profiles = listClubProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(6);
    const sipho = profiles.find((p) => p.name === "Sipho Dlamini");
    expect(sipho).toBeDefined();
    expect(sipho?.bib).toBe("12");
    expect(sipho?.best5k).toBe("19:35");

    const thandi = profiles.find((p) => p.name === "Thandi Mokoena");
    expect(thandi).toBeDefined();
    expect(thandi?.bib).toBe("11");
    expect(thandi?.best5k).toBe("22:15");
  });

  it("handles quick sign-in and sets active athlete", () => {
    expect(getCurrentAthlete()).toBeNull();
    const res = quickSignIn("profile-sipho-dlamini", "1212");
    expect(res.ok).toBe(true);
    expect(res.profile?.name).toBe("Sipho Dlamini");

    const active = getCurrentAthlete();
    expect(active?.name).toBe("Sipho Dlamini");
    expect(active?.bib).toBe("12");
  });

  it("rejects sign-in with incorrect PIN", () => {
    const res = quickSignIn("profile-sipho-dlamini", "9999");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Incorrect PIN");
    expect(getCurrentAthlete()).toBeNull();
  });

  it("creates a new athlete profile and assigns bib", async () => {
    const newAthlete = await createAthleteProfile({
      name: "Mandla Khanyile",
      section: "Rabie Ridge Ascent",
      ageGroup: "Senior (20-39)",
      best5k: "20:45",
      shoeModel: "Nike Pegasus 40",
    });

    expect(newAthlete.id).toBeDefined();
    expect(newAthlete.name).toBe("Mandla Khanyile");
    expect(newAthlete.section).toBe("Rabie Ridge Ascent");
    expect(newAthlete.bib).toBeDefined();

    const active = getCurrentAthlete();
    expect(active?.name).toBe("Mandla Khanyile");

    // Profile must be in list
    const list = listClubProfiles();
    expect(list.some((p) => p.name === "Mandla Khanyile")).toBe(true);
  });

  it("logs out active athlete cleanly", () => {
    quickSignIn("profile-thandi-mokoena");
    expect(getCurrentAthlete()?.name).toBe("Thandi Mokoena");

    logoutAthlete();
    expect(getCurrentAthlete()).toBeNull();
  });

  it("processes private coach query for signed-in athlete", async () => {
    const sipho = listClubProfiles().find((p) => p.name === "Sipho Dlamini");
    expect(sipho).toBeDefined();

    const reply = await processCoachQuery("What are my current personal bests and shoes?", {
      schedule: [],
      roleMode: "athlete",
      athlete: sipho,
    });

    expect(reply.text).toContain("Sanibonani Sipho Dlamini");
    expect(reply.text).toContain("19:35");
    expect(reply.text).toContain("41:10");
    expect(reply.text).toContain("Puma Deviate Nitro");
    expect(reply.text).toContain("The Resident & The Gruvs");
  });
});
