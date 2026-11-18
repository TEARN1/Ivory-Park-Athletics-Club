import { beforeEach, describe, expect, it } from "vitest";
import { executeCoachAction, processCoachQuery } from "./geminiCoach";
import { loadCoachAlarm } from "./alarms";
import { loadClubSchedule } from "./schedule";
import type { Member } from "./club";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("geminiCoach engine", () => {
  beforeEach(() => {
    mockStorage.clear();
  });
  it("executes set_alarm and updates offline coach alarm", () => {
    const res = executeCoachAction({
      type: "set_alarm",
      payload: { time: "05:00", title: "Long Run 21.1k", meetupPoint: "Freedom Drive Hub", distanceKm: 21.1 },
      description: "Set morning wake-up alarm",
    });
    expect(res.success).toBe(true);
    expect(res.actionType).toBe("set_alarm");
    const alarm = loadCoachAlarm();
    expect(alarm.time).toBe("05:00");
    expect(alarm.programTitle).toBe("Long Run 21.1k");
    expect(alarm.enabled).toBe(true);
  });

  it("executes schedule_activity and updates club schedule", () => {
    const res = executeCoachAction({
      type: "schedule_activity",
      payload: { day: "Saturday", title: "Championship 15k Build", distanceKm: 15.0, time: "05:00", meetupPoint: "Freedom Drive" },
      description: "Schedule activity",
    });
    expect(res.success).toBe(true);
    const sched = loadClubSchedule();
    const sat = sched.find((s) => s.day === "Saturday");
    expect(sat).toBeDefined();
    expect(sat?.distanceKm).toBe(15.0);
  });

  it("executes generate_qr and returns valid SVG and join URL", () => {
    const res = executeCoachAction({
      type: "generate_qr",
      payload: { distanceKm: 5.0, code: "IPAC-7788" },
      description: "Generate QR code",
    });
    expect(res.success).toBe(true);
    expect(res.data.code).toBe("IPAC-7788");
    expect(res.data.joinUrl).toContain("IPAC-7788");
    expect(res.data.svg).toContain("<svg");
  });

  it("executes post_community_notice and records to community notices", () => {
    const res = executeCoachAction({
      type: "post_community_notice",
      payload: { channel: "The Resident", text: "Saturday morning time trial 05:00 sharp." },
      description: "Broadcast to The Resident",
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain("The Resident");
    expect(res.message).toContain("Saturday morning time trial 05:00 sharp");
  });

  it("executes reserve_seat and logs attendance check-in", () => {
    const res = executeCoachAction({
      type: "reserve_seat",
      payload: { athleteName: "Katlego Dlamini", vehicle: "Coach Van 1 (14 seats)" },
      description: "Reserve transport seat",
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain("Katlego Dlamini");
    expect(res.message).toContain("Coach Van 1");
  });

  it("executes analyze_squad and flags injury warning for shoe mileage over 650km", () => {
    const members: Member[] = [
      {
        id: "m-1",
        name: "Sibusiso Molefe",
        active: true,
        joinedAt: Date.now(),
        notes: [],
        plan: [],
        shoes: [{ id: "sh-1", model: "Nike Pegasus 40", km: 720 }],
      },
      {
        id: "m-2",
        name: "Lerato Khumalo",
        active: true,
        joinedAt: Date.now(),
        notes: [],
        plan: [],
        shoes: [{ id: "sh-2", model: "Adidas Boston 12", km: 240 }],
      },
    ];
    const res = executeCoachAction({
      type: "analyze_squad",
      payload: { members },
      description: "Squad analysis",
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain("Injury Risk Alert");
    expect(res.message).toContain("Sibusiso Molefe");
    expect(res.message).toContain("720 km");
  });

  it("processes natural language query for training tomorrow and suggests seat reservation", async () => {
    const sched = loadClubSchedule();
    const res = await processCoachQuery("Is there training tomorrow?", {
      members: [],
      schedule: sched,
      roleMode: "athlete",
    });
    expect(res.role).toBe("coach");
    expect(res.text.toLowerCase()).toContain("reserve");
  });

  it("processes natural language command to set alarm for 5:00 and executes action", async () => {
    const res = await processCoachQuery("Set an alarm for all athletes for 5:00 long run", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.role).toBe("coach");
    expect(res.action?.type).toBe("set_alarm");
    const alarm = loadCoachAlarm();
    expect(alarm.time).toBe("05:00");
  });

  it("handles casual conversation 'I wanna talk' warmly without robotic capability dumping", async () => {
    const res = await processCoachQuery("I wanna talk", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.role).toBe("coach");
    expect(res.text).toContain("What is on your mind?");
    expect(res.text).not.toContain("What would you like me to execute?");
  });

  it("pulls past finishing times and PBs on results inquiry", async () => {
    const res = await processCoachQuery("Can you analyze our recent finishing times and past results?", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.role).toBe("coach");
    expect(res.text).toContain("Sipho Dlamini");
    expect(res.text).toContain("Sibusiso Molefe");
    expect(res.text).toContain("PB");
  });

  it("analyzes pace drops and fatigue across sessions", async () => {
    const res = await processCoachQuery("Who dropped pace on the last run?", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.role).toBe("coach");
    expect(res.text).toContain("Thabo Mokoena");
    expect(res.text).toContain("Rabie Ridge");
    expect(res.text).toContain("45:15");
  });

  it("answers specific athlete inquiry for Sipho with verified stats", async () => {
    const res = await processCoachQuery("How is Sipho running lately?", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.role).toBe("coach");
    expect(res.text).toContain("19:35");
    expect(res.text).toContain("Personal Best");
  });

  it("handles cadence metronome activation", async () => {
    const res = await processCoachQuery("Activate 180 SPM cadence metronome", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("cadence_metronome");
    expect(res.action?.payload.defaultSpm).toBe(180);
  });

  it("handles shoe wear and tread scanner queries", async () => {
    const res = await processCoachQuery("Inspect shoe tread wear and foam creasing", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("shoe_scan");
    expect(res.action?.payload.injuryRisk).toBe("High");
    expect(res.action?.payload.kmLogged).toBe(685);
  });

  it("computes Highveld weather and temperature pace adjustments", async () => {
    const res = await processCoachQuery("Adjust training pace for Highveld weather and 28C heat", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("weather_pace");
    expect(res.action?.payload.adjustedPace).toBe("5:16/km");
    expect(res.action?.payload.differenceSec).toBe(16);
  });

  it("generates GPX route and elevation profile for 15km perimeter run", async () => {
    const res = await processCoachQuery("Generate a 15km perimeter route with elevation and GPX", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("gpx_route");
    expect(res.action?.payload.distanceKm).toBe(15.0);
    expect(res.action?.payload.gpxData).toContain("<gpx");
  });

  it("evaluates morning readiness and recovery score", async () => {
    const res = await processCoachQuery("Check my morning readiness and recovery score", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("readiness_score");
    expect(res.action?.payload.score).toBe(8.2);
    expect(res.action?.payload.status).toBe("Optimal");
  });

  it("predicts championship race times from 5km PB", async () => {
    const res = await processCoachQuery("Predict my Soweto and Comrades race times from 5km PB", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("race_prediction");
    expect(res.action?.payload.predictions.length).toBeGreaterThanOrEqual(4);
  });

  it("selects 4-leg relay squad with tactical roles", async () => {
    const res = await processCoachQuery("Pick our fastest 4x400m senior relay squad", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("relay_selector");
    expect(res.action?.payload.legs.length).toBe(4);
  });

  it("calculates 5 personalized heart rate zones", async () => {
    const res = await processCoachQuery("Calculate my 5 personalized heart rate zones", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("hr_zones");
    expect(res.action?.payload.zones.length).toBe(5);
  });

  it("generates 40-minute fartlek workout with interval sync", async () => {
    const res = await processCoachQuery("Create a 40-minute Highveld fartlek ladder workout", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("workout_sync");
    expect(res.action?.payload.totalMinutes).toBe(40);
  });

  it("manages away race transport manifest and seats", async () => {
    const res = await processCoachQuery("Show away race transport manifest and reserve seat", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("transport_manifest");
    expect(res.action?.payload.vans.length).toBe(2);
  });

  it("triages shin splints injury with rehab exercises", async () => {
    const res = await processCoachQuery("Triage shin splints injury and return-to-run rehab", {
      members: [],
      schedule: loadClubSchedule(),
      roleMode: "coach",
    });
    expect(res.action?.type).toBe("injury_triage");
    expect(res.action?.payload.suspectedCondition).toContain("Shin Splints");
  });
});
