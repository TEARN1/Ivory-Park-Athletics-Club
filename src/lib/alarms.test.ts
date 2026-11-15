import { beforeEach, describe, expect, it } from "vitest";
import {
  checkAlarmDue,
  createAlarmShareParams,
  defaultCoachAlarm,
  formatAlarmWhatsApp,
  formatLocalDateStr,
  loadCoachAlarm,
  parseAlarmFromUrl,
  saveCoachAlarm,
  type CoachAlarm,
} from "./alarms";

// Memory storage polyfill for Vitest's Node environment
const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("alarms library", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads and saves default alarm in localStorage", () => {
    const d = loadCoachAlarm();
    expect(d.time).toBe("04:30");
    expect(d.enabled).toBe(true);

    const custom: CoachAlarm = {
      ...d,
      time: "05:15",
      programTitle: "Tempo Intervals",
      instructions: "Fast reps around Ext 2",
    };
    saveCoachAlarm(custom);

    const reloaded = loadCoachAlarm();
    expect(reloaded.time).toBe("05:15");
    expect(reloaded.programTitle).toBe("Tempo Intervals");
  });

  it("checks alarm due status correctly based on time and lastFiredDate", () => {
    const now = new Date(2026, 10, 15, 5, 0, 0); // 05:00 on Nov 15 2026
    const todayStr = formatLocalDateStr(now);

    const matchingAlarm: CoachAlarm = {
      ...defaultCoachAlarm(),
      time: "05:00",
      enabled: true,
      lastFiredDate: undefined,
    };
    expect(checkAlarmDue(matchingAlarm, now)).toBe(true);

    // If disabled
    expect(checkAlarmDue({ ...matchingAlarm, enabled: false }, now)).toBe(false);

    // If already fired today
    expect(checkAlarmDue({ ...matchingAlarm, lastFiredDate: todayStr }, now)).toBe(false);

    // If different minute
    expect(checkAlarmDue({ ...matchingAlarm, time: "05:01" }, now)).toBe(false);
  });

  it("encodes and parses alarm parameters from deep links", () => {
    const alarm: CoachAlarm = {
      id: "test-1",
      time: "05:45",
      enabled: true,
      programTitle: "Long Run 21K",
      meetupPoint: "Ext 7 Taxi Rank",
      departureTime: "06:00",
      instructions: "Hydration packs required",
      targetSquad: "seniors",
      soundTone: "siren",
      repeatDaily: false,
    };

    const qs = createAlarmShareParams(alarm);
    const parsed = parseAlarmFromUrl(`?${qs}`);
    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("05:45");
    expect(parsed?.programTitle).toBe("Long Run 21K");
    expect(parsed?.meetupPoint).toBe("Ext 7 Taxi Rank");
    expect(parsed?.departureTime).toBe("06:00");
    expect(parsed?.targetSquad).toBe("seniors");
    expect(parsed?.soundTone).toBe("siren");
  });

  it("formats WhatsApp alarm broadcast without emojis", () => {
    const alarm: CoachAlarm = {
      ...defaultCoachAlarm(),
      time: "04:45",
      programTitle: "Morning Hill Repeats",
      meetupPoint: "Freedom Drive",
    };

    const wa = formatAlarmWhatsApp(alarm, "https://ivorypark.athletics");
    expect(wa).toContain("IVORY PARK ATHLETICS CLUB");
    expect(wa).toContain("Scheduled Wake-Up: 04:45");
    expect(wa).toContain("Morning Hill Repeats");
    expect(wa).toContain("https://ivorypark.athletics/today?set_alarm=1");

    // Strictly ensure zero emojis exist
    expect(/[\uD800-\uDFFF]/.test(wa)).toBe(false);
    expect(/[\u2600-\u27BF]/.test(wa)).toBe(false);
  });
});
