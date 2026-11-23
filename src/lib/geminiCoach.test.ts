import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeCoachAction,
  processCoachQuery,
  sanitizeTurnsForGemini,
  validateGeminiApiKey,
  type CoachMessage,
} from "./geminiCoach";
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

  describe("Authentic Ivory Park Athletics Club Squad Queries", () => {
    it("answers inquiry about Siyavuya Thomas (The Original Coach)", async () => {
      const res = await processCoachQuery("Who is Siyavuya Thomas?", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Siyavuya Thomas is The Original Coach and Founder");
      expect(res.text).toContain("Ivory Park Athletics Club");
    });

    it("answers inquiry about Asemahle Nkwali (Team IT Lead)", async () => {
      const res = await processCoachQuery("Tell me about Asemahle Nkwali and his 4km race", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Asemahle Nkwali is our Team IT Lead");
      expect(res.text).toContain("19:12");
      expect(res.text).toContain("R550");
    });

    it("answers inquiry about Timekeeper Lympson Maifo", async () => {
      const res = await processCoachQuery("Who is our timekeeper Lympson Maifo?", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Lympson Maifo is Ivory Park Athletics Club's official Timekeeper");
      expect(res.text).toContain("20:42");
    });

    it("provides Monday course results for 09/11/2026", async () => {
      const res = await processCoachQuery("What were the Monday course results on 09/11/2026?", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Monday Course Results (09/11/2026)");
      expect(res.text).toContain("Neo Mafa: 15:04");
      expect(res.text).toContain("Kingsley Mogadime: 18:01");
      expect(res.text).toContain("Asemahle Nkwali: 19:12");
      expect(res.text).toContain("Seopela Mokiri: 21:42");
      expect(res.text).toContain("Oscar Notshweleka: 22:21");
      expect(res.text).toContain("Lympson Maifo");
    });

    it("provides member transport and contributions ledger", async () => {
      const res = await processCoachQuery("Show me the club contributions and transport subs ledger", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Joseph Phasha: R200");
      expect(res.text).toContain("Mpho Chaba: R200");
      expect(res.text).toContain("Evidence Maphoru: R200");
      expect(res.text).toContain("Asemahle Nkwali: R550");
      expect(res.text).toContain("Wendy Kganyago: R200");
      expect(res.text).toContain("Total Collected: R1,350");
    });

    it("provides 5km road championship leaderboard with George Mmonwa 18:21", async () => {
      const res = await processCoachQuery("Who won the 5km road race championship?", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("George Mmonwa: 18:21");
      expect(res.text).toContain("Club Champion");
      expect(res.text).toContain("Sibusekile Skhosana: 18:35");
      expect(res.text).toContain("Bennet Molefe: 18:37");
      expect(res.text).toContain("Jan Diale: 18:52");
    });

    it("recognizes other registered squad members such as Donald Mathipa", async () => {
      const res = await processCoachQuery("Tell me about Donald Mathipa", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Ivory Park Athletics Club squad members");
    });

    it("provides 5km squad time trial results for Sam Matlou and Sibusiso Msibi", async () => {
      const res = await processCoachQuery("Show the 5km squad time trial times for Sam Matlou and Msibi", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Sam Matlou: 22:20");
      expect(res.text).toContain("Sibusiso Msibi: 22:21");
      expect(res.text).toContain("Neo Mafa: 22:48");
      expect(res.text).toContain("Siyabanga Ndaba: 23:26");
      expect(res.text).toContain("Gift Molefe: 24:09");
      expect(res.text).toContain("Khutso Masekwameng: 26:58");
    });

    it("answers inquiry about Oscar Notshweleka in the 6km course", async () => {
      const res = await processCoachQuery("How did Oscar Notshweleka perform?", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Oscar Notshweleka");
      expect(res.text).toContain("22:21");
    });

    it("personalizes greeting when Asemahle Nkwali is authenticated", async () => {
      const res = await processCoachQuery("Sawubona coach", {
        members: [],
        schedule: loadClubSchedule(),
        roleMode: "athlete",
        athlete: {
          id: "profile-asemahle-nkwali",
          name: "Asemahle Nkwali",
          bib: "4",
          phone: "078-555-0404",
          pin: "0404",
          role: "athlete",
          ageGroup: "Senior (20-39)",
          gender: "M",
          section: "Freedom Drive Hub",
          best4k: "19:12",
          targetPace: "4:48/km",
          createdAt: 1731900000000,
          updatedAt: 1731900000000,
        },
      });
      expect(res.text).toContain("Sanibonani Asemahle! Good to have our Team IT Lead on the line.");
    });
  });

  describe("sanitizeTurnsForGemini (multi-turn alternation & formatting)", () => {
    it("drops leading model welcome greeting so turn 0 is always user", () => {
      const history: CoachMessage[] = [
        {
          id: "1",
          role: "coach",
          text: "Sanibonani! Welcome to Ivory Park AC.",
          timestamp: "08:00",
        },
      ];
      const contents = sanitizeTurnsForGemini(history, "Who is the fastest runner?");
      expect(contents.length).toBe(1);
      expect(contents[0].role).toBe("user");
      expect(contents[0].parts[0].text).toBe("Who is the fastest runner?");
    });

    it("strictly alternates turns by merging consecutive identical roles", () => {
      const history: CoachMessage[] = [
        { id: "1", role: "coach", text: "Welcome", timestamp: "08:00" },
        { id: "2", role: "user", text: "First question", timestamp: "08:01" },
        { id: "3", role: "user", text: "Second question follow up", timestamp: "08:02" },
        { id: "4", role: "coach", text: "Coach answer 1", timestamp: "08:03" },
        { id: "5", role: "coach", text: "Coach answer 2 additional note", timestamp: "08:04" },
      ];
      const contents = sanitizeTurnsForGemini(history, "Latest query");
      // Turn 0 must be user (merged question 1 & 2)
      expect(contents[0].role).toBe("user");
      expect(contents[0].parts.length).toBe(2);
      // Turn 1 must be model (merged coach answer 1 & 2)
      expect(contents[1].role).toBe("model");
      expect(contents[1].parts.length).toBe(2);
      // Turn 2 must be user (latest query)
      expect(contents[2].role).toBe("user");
      expect(contents[2].parts[0].text).toBe("Latest query");
    });

    it("parses image attachments as inlineData", () => {
      const dataUri = "data:image/jpeg;base64,TU0AKgAAAAgA";
      const contents = sanitizeTurnsForGemini([], "Inspect my shoe", dataUri);
      expect(contents.length).toBe(1);
      expect(contents[0].role).toBe("user");
      expect(contents[0].parts[0].inlineData).toEqual({
        mimeType: "image/jpeg",
        data: "TU0AKgAAAAgA",
      });
      expect(contents[0].parts[1].text).toBe("Inspect my shoe");
    });
  });

  describe("validateGeminiApiKey", () => {
    it("returns invalid for blank or empty key", async () => {
      const res = await validateGeminiApiKey("");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Please enter an API key");
    });

    it("returns valid when Gemini endpoint responds 200 OK", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "pong" }] } }],
        }),
      } as any);

      try {
        const res = await validateGeminiApiKey("AIzaSyFakeKeyValid1234567890123456789");
        expect(res.valid).toBe(true);
        expect(res.model).toBe("gemini-2.0-flash");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("returns friendly error when Google returns API key not valid", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 400,
            message: "API key not valid. Please pass a valid API key.",
            status: "INVALID_ARGUMENT",
          },
        }),
      } as any);

      try {
        const res = await validateGeminiApiKey("AIzaSyInvalidKey123");
        expect(res.valid).toBe(false);
        expect(res.error).toContain("API key is not valid");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("conversational readiness and diagnostics", () => {
    it("responds to 'test' or 'is this working' with confirmation", async () => {
      const res = await processCoachQuery("Is this working?", {
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Yes, loud and clear!");
      expect(res.source).toBe("local");
    });

    it("responds to 'who are you' with identity and role", async () => {
      const res = await processCoachQuery("Who are you?", {
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Head Coach and Founder AI for Ivory Park Athletics Club");
    });

    it("responds to 'help' or 'what can you do' with squad capabilities", async () => {
      const res = await processCoachQuery("What can you do?", {
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("Here is what I can do for you and the squad:");
    });

    it("responds to 'why are you not working' with helpful diagnostic guidance", async () => {
      const res = await processCoachQuery("The AI does not seem to be working", {
        schedule: loadClubSchedule(),
        roleMode: "coach",
      });
      expect(res.text).toContain("I am right here and ready to coach!");
    });
  });

  describe("live cloud vs local fallback execution", () => {
    it("marks response as source: cloud when Gemini API call succeeds", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Hello runner, your Highveld training looks strong today." }] } }],
        }),
      } as any);

      try {
        const res = await processCoachQuery("How is my pacing today?", {
          apiKey: "AIzaSyTest123",
          schedule: loadClubSchedule(),
          roleMode: "athlete",
        });
        expect(res.source).toBe("cloud");
        expect(res.modelUsed).toBe("gemini-2.0-flash");
        expect(res.text).toBe("Hello runner, your Highveld training looks strong today.");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("gracefully falls back to local engine with cloudError note when fetch fails", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));

      try {
        const res = await processCoachQuery("Who is Siyavuya Thomas?", {
          apiKey: "AIzaSyTest123",
          schedule: loadClubSchedule(),
          roleMode: "coach",
        });
        expect(res.source).toBe("local");
        expect(res.modelUsed).toBe("Highveld Local Engine");
        expect(res.cloudError).toBe("Network connection lost");
        expect(res.text).toContain("Siyavuya Thomas is The Original Coach and Founder");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
