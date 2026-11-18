import { describe, expect, it } from "vitest";
import { processCoachQuery, type CoachMessage } from "./geminiCoach";
import { loadClubSchedule } from "./schedule";

describe("20 Running Questions Evaluation for AI Coach", () => {
  const schedule = loadClubSchedule();
  const baseContext = {
    schedule,
    roleMode: "coach" as const,
  };

  const questions = [
    {
      num: 1,
      q: "Who dropped pace or faded on the last run?",
      expectTopic: "pace drop",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Thabo Mokoena");
        expect(m.text).toContain("Rabie Ridge");
        expect(m.report).toBeDefined();
        expect(m.report?.type).toBe("pace_drop");
      },
    },
    {
      num: 2,
      q: "What are the squad's recent finishing times and past data?",
      expectTopic: "results and past finishing times",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Sipho Dlamini");
        expect(m.text).toContain("Thandi Mokoena");
        expect(m.report).toBeDefined();
        expect(m.report?.type).toBe("results");
      },
    },
    {
      num: 3,
      q: "Can you set an alarm for the squad for 05:00 tomorrow morning?",
      expectTopic: "set alarm",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("05:00");
        expect(m.action?.type).toBe("set_alarm");
        expect(m.action?.payload.time).toBe("05:00");
      },
    },
    {
      num: 4,
      q: "Schedule our Saturday 21.1km long run starting from Freedom Drive Hub",
      expectTopic: "schedule activity",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Saturday Long Run");
        expect(m.action?.type).toBe("schedule_activity");
        expect(m.action?.payload.distanceKm).toBe(21.1);
      },
    },
    {
      num: 5,
      q: "Generate a start-line QR code for a 10km session so athletes can join",
      expectTopic: "join QR code",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Join QR code generated");
        expect(m.action?.type).toBe("generate_qr");
        expect(m.action?.payload.distanceKm).toBe(10.0);
      },
    },
    {
      num: 6,
      q: "Post a bulletin to The Resident and The Grooves about our morning run",
      expectTopic: "community notice",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("The Resident and The Grooves");
        expect(m.action?.type).toBe("post_community_notice");
      },
    },
    {
      num: 7,
      q: "Reserve a seat for me in the transport van for the away race",
      expectTopic: "seat reservation",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("reserved in Coach Van 1");
        expect(m.action?.type).toBe("reserve_seat");
      },
    },
    {
      num: 8,
      q: "Is there training tomorrow or should I rest?",
      expectTopic: "training schedule check",
      verify: (m: CoachMessage) => {
        expect(m.text).toMatch(/tomorrow/i);
        expect(m.text).toMatch(/reserve/i);
      },
    },
    {
      num: 9,
      q: "How is Sipho Dlamini performing in training?",
      expectTopic: "athlete profile Sipho",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Sipho Dlamini");
        expect(m.text).toContain("19:35");
        expect(m.text).toContain("3:55/km");
      },
    },
    {
      num: 10,
      q: "Tell me how Thandi Mokoena is doing with her training",
      expectTopic: "athlete profile Thandi",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Thandi Mokoena");
        expect(m.text).toContain("22:15");
        expect(m.text).toContain("4:27/km");
      },
    },
    {
      num: 11,
      q: "Can you inspect my shoe tread wear and check if my shoes need replacement?",
      expectTopic: "shoe wear scan",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Shoe wear inspection");
        expect(m.action?.type).toBe("shoe_scan");
        expect(m.action?.payload.shoeModel).toContain("Puma Velocity");
      },
    },
    {
      num: 12,
      q: "How should I adjust my 5:00/km pace for the 28°C Highveld heat and altitude?",
      expectTopic: "weather pace adjuster",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Highveld environmental pacing");
        expect(m.action?.type).toBe("weather_pace");
        expect(m.action?.payload.adjustedPace).toBe("5:16/km");
      },
    },
    {
      num: 13,
      q: "Can you generate a 15km perimeter route with GPX coordinates and elevation profile?",
      expectTopic: "GPX route generator",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Route mapped");
        expect(m.action?.type).toBe("gpx_route");
        expect(m.action?.payload.gpxData).toContain("<gpx");
      },
    },
    {
      num: 14,
      q: "What is my morning readiness score and should I run hard today?",
      expectTopic: "readiness score",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Readiness score");
        expect(m.action?.type).toBe("readiness_score");
        expect(m.action?.payload.score).toBe(8.2);
      },
    },
    {
      num: 15,
      q: "Predict my 10km, half marathon, Soweto, and Comrades race times based on my 19:35 5k PB",
      expectTopic: "race prediction",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Championship race projections");
        expect(m.action?.type).toBe("race_prediction");
        expect(m.action?.payload.predictions.length).toBeGreaterThanOrEqual(4);
      },
    },
    {
      num: 16,
      q: "Who should we select for our 4-leg relay squad and in what order?",
      expectTopic: "relay squad selector",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Relay roster finalized");
        expect(m.action?.type).toBe("relay_selector");
        expect(m.action?.payload.legs.length).toBe(4);
      },
    },
    {
      num: 17,
      q: "Calculate my 5-zone heart rate and lactate threshold targets for a 192 BPM max HR",
      expectTopic: "heart rate zones",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("heart rate targets");
        expect(m.action?.type).toBe("hr_zones");
        expect(m.action?.payload.zones.length).toBe(5);
      },
    },
    {
      num: 18,
      q: "What should I eat before and after a long run on the Highveld?",
      expectTopic: "nutrition fueling guide",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Fueling & Nutrition Guide");
        expect(m.action?.type).toBe("nutrition_guide");
        expect(m.action?.payload.preRunMeal).toContain("Mabele");
      },
    },
    {
      num: 19,
      q: "Can you format a WhatsApp broadcast message for our Saturday morning run?",
      expectTopic: "WhatsApp broadcast",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("WhatsApp announcement formatted");
        expect(m.action?.type).toBe("post_community_notice");
      },
    },
    {
      num: 20,
      q: "My shin hurts after running down Rabie Ridge, what should I do?",
      expectTopic: "injury symptom triage",
      verify: (m: CoachMessage) => {
        expect(m.text).toContain("Injury Assessment Protocol");
        expect(m.action?.type).toBe("injury_triage");
        expect(m.action?.payload.suspectedCondition).toContain("Shin Splints");
      },
    },
  ];

  for (const item of questions) {
    it(`Question ${item.num}: "${item.q}" (${item.expectTopic})`, async () => {
      const reply = await processCoachQuery(item.q, baseContext);
      expect(reply).toBeDefined();
      expect(reply.role).toBe("coach");
      expect(reply.text.length).toBeGreaterThan(20);
      item.verify(reply);
    });
  }
});
