import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAthleteChatHistory,
  createWelcomeMessage,
  loadAthleteChatHistory,
  saveAthleteChatHistory,
} from "./chatStorage";
import type { AthleteProfile } from "./auth";
import type { CoachMessage } from "./geminiCoach";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("Private Athlete Chat Storage & Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const athleteA: AthleteProfile = {
    id: "profile-sipho-dlamini",
    name: "Sipho Dlamini",
    bib: "12",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Freedom Drive Hub",
    best5k: "19:35",
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  };

  const athleteB: AthleteProfile = {
    id: "profile-thandi-mokoena",
    name: "Thandi Mokoena",
    bib: "11",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "F",
    section: "Swazi Inn Corridors",
    best5k: "22:15",
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  };

  it("creates personalized welcome message for signed-in athlete", () => {
    const welcome = createWelcomeMessage(athleteA);
    expect(welcome.text).toContain("Sanibonani Sipho Dlamini");
    expect(welcome.text).toContain("Freedom Drive Hub");
    expect(welcome.text).toContain("19:35");
  });

  it("creates general welcome message for guest", () => {
    const welcome = createWelcomeMessage(null);
    expect(welcome.text).toContain("Sanibonani! Head Coach and Founder here");
  });

  it("strictly isolates chats between two athletes", () => {
    // 1. Sipho saves a private message
    const siphoMsg: CoachMessage = {
      id: "msg-sipho-1",
      role: "user",
      text: "Coach, my hamstring feels slightly tight after the 19:35 5km run.",
      timestamp: "06:30",
    };
    saveAthleteChatHistory(athleteA, [siphoMsg]);

    // 2. Thandi saves her own private message
    const thandiMsg: CoachMessage = {
      id: "msg-thandi-1",
      role: "user",
      text: "Coach, I want to break 22 minutes on the next Swazi Inn time trial.",
      timestamp: "07:15",
    };
    saveAthleteChatHistory(athleteB, [thandiMsg]);

    // 3. Load Sipho's chats: must ONLY contain Sipho's messages
    const siphoHistory = loadAthleteChatHistory(athleteA);
    expect(siphoHistory.some((m) => m.text.includes("hamstring"))).toBe(true);
    expect(siphoHistory.some((m) => m.text.includes("break 22 minutes"))).toBe(false);

    // 4. Load Thandi's chats: must ONLY contain Thandi's messages
    const thandiHistory = loadAthleteChatHistory(athleteB);
    expect(thandiHistory.some((m) => m.text.includes("break 22 minutes"))).toBe(true);
    expect(thandiHistory.some((m) => m.text.includes("hamstring"))).toBe(false);

    // 5. Guest chats must also be isolated
    const guestHistory = loadAthleteChatHistory(null);
    expect(guestHistory.some((m) => m.text.includes("hamstring"))).toBe(false);
    expect(guestHistory.some((m) => m.text.includes("break 22 minutes"))).toBe(false);
  });

  it("clears private chat history on command", () => {
    const msg: CoachMessage = {
      id: "test-msg",
      role: "user",
      text: "Private secret message",
      timestamp: "12:00",
    };
    saveAthleteChatHistory(athleteA, [msg]);
    expect(loadAthleteChatHistory(athleteA).some((m) => m.text === "Private secret message")).toBe(true);

    clearAthleteChatHistory(athleteA);
    const afterClear = loadAthleteChatHistory(athleteA);
    expect(afterClear.some((m) => m.text === "Private secret message")).toBe(false);
    expect(afterClear.length).toBe(1); // reset to welcome message
  });
});
