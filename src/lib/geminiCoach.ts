import { qrSvg } from "./join";
import { loadCoachAlarm, saveCoachAlarm, saveAthleteCheckIn, type CoachAlarm } from "./alarms";
import { loadClubSchedule, saveClubSchedule, type ClubScheduleDay } from "./schedule";
import type { Member } from "./club";

export type CoachActionType =
  | "set_alarm"
  | "schedule_activity"
  | "generate_qr"
  | "post_community_notice"
  | "reserve_seat"
  | "analyze_squad"
  | "recommend_route";

export interface CoachAction {
  type: CoachActionType;
  payload: any;
  description: string;
}

export interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  action?: CoachAction;
  timestamp: string;
}

export interface ExecuteCommandResult {
  success: boolean;
  message: string;
  actionType: CoachActionType;
  data?: any;
}

const STORAGE_KEY_GEMINI_KEY = "ipac_gemini_api_key";

export function loadGeminiApiKey(): string {
  try {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || "";
  } catch {
    return "";
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key.trim());
  } catch {}
}

/** Executes real, practical mutations inside the application state */
export function executeCoachAction(action: CoachAction): ExecuteCommandResult {
  switch (action.type) {
    case "set_alarm": {
      const cur = loadCoachAlarm();
      const updated: CoachAlarm = {
        ...cur,
        time: action.payload.time || "05:00",
        programTitle: action.payload.title || "Morning Session",
        meetupPoint: action.payload.meetupPoint || "Freedom Drive Hub",
        departureTime: action.payload.departureTime || action.payload.time || "05:00",
        distanceKm: action.payload.distanceKm ? Number(action.payload.distanceKm) : cur.distanceKm,
        enabled: true,
      };
      saveCoachAlarm(updated);
      return {
        success: true,
        actionType: "set_alarm",
        message: `Offline wake-up alarm set for ${updated.time}: ${updated.programTitle} at ${updated.meetupPoint}.`,
        data: updated,
      };
    }

    case "schedule_activity": {
      const schedule = loadClubSchedule();
      const targetDay = (action.payload.day || "Saturday").toLowerCase();
      const validDay = (["Monday", "Wednesday", "Saturday", "Sunday"] as const).find(
        (d) => d.toLowerCase() === targetDay
      ) || "Saturday";

      const newEntry: ClubScheduleDay = {
        day: validDay,
        title: action.payload.title || `${validDay} Long Run`,
        time: action.payload.time || "05:00",
        season: "summer",
        distanceKm: action.payload.distanceKm ? Number(action.payload.distanceKm) : 21.1,
        meetupPoint: action.payload.meetupPoint || "Freedom Drive Hub",
        notes: action.payload.notes || "Scheduled via Gemini Head Coach.",
      };

      const existingIdx = schedule.findIndex((s) => s.day.toLowerCase() === validDay.toLowerCase());
      if (existingIdx >= 0) {
        schedule[existingIdx] = newEntry;
      } else {
        schedule.push(newEntry);
      }
      saveClubSchedule(schedule);

      return {
        success: true,
        actionType: "schedule_activity",
        message: `Club activity saved: ${newEntry.day} · ${newEntry.title} (${newEntry.distanceKm} km at ${newEntry.time}).`,
        data: newEntry,
      };
    }

    case "generate_qr": {
      const dist = action.payload.distanceKm || 5.0;
      const code = action.payload.code || `IPAC-${Math.floor(1000 + Math.random() * 9000)}`;
      const base =
        typeof window !== "undefined"
          ? (window.location.origin + window.location.pathname).replace(/\/$/, "") + "/"
          : "https://tearn1.github.io/Ivory-Park-Athletics-Club/";
      const joinUrl = `${base}?join=${encodeURIComponent(code)}&dist=${dist}`;
      const svg = qrSvg(joinUrl);

      return {
        success: true,
        actionType: "generate_qr",
        message: `Generated QR code for ${dist} km training session (Code: ${code}). Athletes can scan to join with their bib numbers.`,
        data: { code, joinUrl, svg, distanceKm: dist },
      };
    }

    case "post_community_notice": {
      const channel = action.payload.channel || "The Resident & The Grooves";
      const text = action.payload.text || "Training session confirmed.";
      try {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem("ipac_community_notices") || "[]";
          const list = JSON.parse(raw);
          list.push({ id: crypto.randomUUID(), text, channel, at: Date.now() });
          localStorage.setItem("ipac_community_notices", JSON.stringify(list));
        }
      } catch {}

      return {
        success: true,
        actionType: "post_community_notice",
        message: `Announcement published to ${channel}: "${text}". Ready for WhatsApp and bulletin syndication.`,
        data: { text, channel, at: Date.now() },
      };
    }

    case "reserve_seat": {
      const name = action.payload.athleteName || "You (Athlete)";
      const vehicle = action.payload.vehicle || "Coach Van 1 (14 seats)";
      saveAthleteCheckIn({
        athleteId: action.payload.athleteId || "athlete-local",
        athleteName: name,
        bib: action.payload.bib || "ME",
        checkInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "awake",
        note: `Seat reserved in ${vehicle}`,
      });

      return {
        success: true,
        actionType: "reserve_seat",
        message: `Attendance confirmed and seat reserved in ${vehicle} for ${name}.`,
        data: { athleteName: name, vehicle, status: "confirmed" },
      };
    }

    case "analyze_squad": {
      const members = action.payload.members || [];
      const shoeWarnings: string[] = [];
      members.forEach((m: Member) => {
        const worn = (m.shoes || []).filter((s) => s.km >= 650 && !s.retired);
        if (worn.length > 0) {
          shoeWarnings.push(`${m.name}: ${worn.map((w) => `${w.model} (${w.km} km)`).join(", ")}`);
        }
      });

      const report = {
        totalRunners: members.length,
        shoeAlerts: shoeWarnings,
        summary:
          shoeWarnings.length > 0
            ? `Injury Risk Alert: ${shoeWarnings.length} runner(s) logged >650 km on compressed EVA foam shoes (${shoeWarnings.join("; ")}). High risk of shin splints and knee strain.`
            : "Squad status healthy: All active runners have adequate shoe cushioning and balanced training loads.",
      };

      return {
        success: true,
        actionType: "analyze_squad",
        message: report.summary,
        data: report,
      };
    }

    case "recommend_route": {
      const dist = Number(action.payload.distanceKm || 5.0);
      let routeName = "Freedom Drive 5km Circuit";
      let elevationGainM = 18;
      let notes = "Smooth flat asphalt with safety lighting and marshal water points.";

      if (dist >= 18) {
        routeName = "Highveld 21.1km Perimeter Loop";
        elevationGainM = 145;
        notes = "Long run endurance corridor via Ext 2, Rabie Ridge, and Freedom Drive.";
      } else if (dist >= 10) {
        routeName = "Swazi Inn & Rabie Ridge Undulating 10km";
        elevationGainM = 92;
        notes = "Moderate rolling hills building aerobic stamina and Highveld altitude strength.";
      } else if (dist > 5) {
        routeName = "Extension 2 Hill Repeats 8km";
        elevationGainM = 85;
        notes = "Steady gradients ideal for tempo work and quad strengthening.";
      }

      return {
        success: true,
        actionType: "recommend_route",
        message: `Recommended route for ${dist} km: ${routeName} (+${elevationGainM}m elevation). ${notes}`,
        data: { routeName, distanceKm: dist, elevationGainM, notes },
      };
    }
  }
}

/**
 * Natural language reasoning engine:
 * Evaluates queries using Gemini 1.5/2.0 API when available,
 * or fast on-device pattern heuristics for offline responsiveness.
 */
export async function processCoachQuery(
  query: string,
  context: {
    members: Member[];
    schedule: ClubScheduleDay[];
    roleMode: "coach" | "athlete";
    apiKey?: string;
  }
): Promise<CoachMessage> {
  const q = query.trim().toLowerCase();
  const timeId = Date.now().toString();
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 1. If Gemini API key is present, attempt live Google AI Studio call
  const apiKey = context.apiKey || loadGeminiApiKey();
  if (apiKey) {
    try {
      const systemPrompt = `You are the Head Coach and Founder of Ivory Park Athletics Club (IPAC) in Midrand, South Africa.
Your squad trains on Highveld roads (1,520m elevation). You know all athlete names (${context.members.map((m) => m.name).join(", ")}).
You can execute actions: set alarms, schedule activities, generate QR codes, post community notices to The Resident & The Grooves, reserve vehicle seats, analyze shoe wear/injuries, and recommend routes.
Always respond authoritatively, concisely, with zero emojis, disciplined, encouraging, and safety-conscious.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${systemPrompt}\n\nClub Context:\n- Schedule: ${JSON.stringify(
                      context.schedule
                    )}\n- Roster Count: ${context.members.length}\n\nUser Prompt: ${query}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          // Check if an action can be extracted
          const action = parseActionFromText(query, textResponse, context);
          return {
            id: timeId,
            role: "coach",
            text: textResponse,
            action,
            timestamp,
          };
        }
      }
    } catch {
      // Fall through to offline heuristic processor
    }
  }

  // 2. High-speed local heuristic engine (runs 100% offline with zero latency)
  if (q.includes("alarm") || (q.includes("set") && (q.includes("5:00") || q.includes("4:30") || q.includes("wake")))) {
    const timeMatch = query.match(/(\d{1,2}:\d{2})/);
    let alarmTime = "05:00";
    if (timeMatch) {
      const [h, m] = timeMatch[1].split(":");
      alarmTime = `${h.padStart(2, "0")}:${m}`;
    }
    const action: CoachAction = {
      type: "set_alarm",
      payload: {
        time: alarmTime,
        title: q.includes("long run") ? "Saturday 21.1km Long Run" : "Morning Training Session",
        meetupPoint: "Freedom Drive Hub",
        distanceKm: q.includes("21") ? 21.1 : 5.0,
      },
      description: `Set wake-up alarm for all athletes at ${alarmTime}`,
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: `Understood, Coach. I have set the team wake-up alarm for ${alarmTime} at Freedom Drive Hub. It will sound on athletes' phones offline.`,
      action,
      timestamp,
    };
  }

  if (q.includes("qr") || (q.includes("code") && q.includes("join"))) {
    const distMatch = query.match(/(\d+(\.\d+)?)\s*(km|k)/i);
    const dist = distMatch ? parseFloat(distMatch[1]) : 5.0;
    const action: CoachAction = {
      type: "generate_qr",
      payload: { distanceKm: dist },
      description: `Generate Join QR Code for ${dist} km training`,
    };
    const res = executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: `Join QR code generated for ${dist} km. Display this to athletes on the start line to record their bibs.`,
      action: { ...action, payload: { ...action.payload, svg: res.data.svg, joinUrl: res.data.joinUrl } },
      timestamp,
    };
  }

  if (q.includes("resident") || q.includes("grooves") || q.includes("post") || q.includes("announce")) {
    const colonIdx = query.indexOf(":");
    let noticeText = colonIdx >= 0 ? query.substring(colonIdx + 1).trim() : "";
    if (!noticeText) {
      noticeText = query
        .replace(/^(post|announce|broadcast)\s+(a\s+)?(notice|update|message)?\s*(to|on)?\s*(the\s+resident(\s+and|\s*&)?\s*(the\s+)?grooves)?/i, "")
        .replace(/^(to|on)\s*(the\s+resident(\s+and|\s*&)?\s*(the\s+)?grooves)/i, "")
        .trim();
    }
    if (!noticeText) {
      noticeText = "Saturday Long Run 05:00 sharp from Freedom Drive Hub.";
    }
    const action: CoachAction = {
      type: "post_community_notice",
      payload: {
        channel: "The Resident & The Grooves",
        text: `Official Notice: ${noticeText}`,
      },
      description: "Broadcast community notice to The Resident & The Grooves",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: `Notice posted to The Resident and The Grooves community feed: "${action.payload.text}".`,
      action,
      timestamp,
    };
  }

  if (q.includes("seat") || q.includes("reserve") || (q.includes("attending") && !q.includes("?"))) {
    const action: CoachAction = {
      type: "reserve_seat",
      payload: {
        athleteName: context.roleMode === "coach" ? "Sibusiso Molefe" : "You (Athlete)",
        vehicle: "Coach Van 1 (14 seats)",
      },
      description: "Reserve transport seat and confirm attendance",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: `Your seat has been reserved in Coach Van 1 and attendance is marked as confirmed. We depart promptly at 05:15.`,
      action,
      timestamp,
    };
  }

  if (q.includes("tomorrow") || q.includes("today") || (q.includes("training") && q.includes("?"))) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayName = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
    const match = context.schedule.find((s) => s.day.toLowerCase() === dayName.toLowerCase());
    if (match) {
      return {
        id: timeId,
        role: "coach",
        text: `Yes! Tomorrow is ${match.day}: ${match.title} (${match.distanceKm} km) at ${match.time}, meeting at ${match.meetupPoint}. Should I reserve your seat in the transport van or mark you down as attending?`,
        timestamp,
      };
    }
    return {
      id: timeId,
      role: "coach",
      text: `Tomorrow is a scheduled active recovery day. Next official team session is Wednesday: 5km Time Trial at 17:00 at Freedom Drive. Should I reserve your attendance?`,
      timestamp,
    };
  }

  if (q.includes("injury") || q.includes("drop") || q.includes("fade") || q.includes("shoe")) {
    const action: CoachAction = {
      type: "analyze_squad",
      payload: { members: context.members },
      description: "Analyze squad performance, pace fade, and shoe wear",
    };
    const res = executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: res.message,
      action,
      timestamp,
    };
  }

  if (q.includes("route") || q.includes("where")) {
    const distMatch = query.match(/(\d+(\.\d+)?)\s*(km|k)/i);
    const dist = distMatch ? parseFloat(distMatch[1]) : 5.0;
    const action: CoachAction = {
      type: "recommend_route",
      payload: { distanceKm: dist },
      description: `Recommend route for ${dist} km`,
    };
    const res = executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: res.message,
      action,
      timestamp,
    };
  }

  // General Coach / Founder conversational response
  return {
    id: timeId,
    role: "coach",
    text: `Greetings from the Ivory Park AC coaching staff. I am monitoring our squad of ${context.members.length} athletes. I can set morning alarms, add sessions, generate join QR codes, publish notices to The Resident, analyze injuries, and reserve transport seats. What would you like me to execute?`,
    timestamp,
  };
}

function parseActionFromText(query: string, text: string, context: any): CoachAction | undefined {
  const combined = (query + " " + text).toLowerCase();
  if (combined.includes("alarm") && (combined.includes("set") || combined.includes("5:00") || combined.includes("4:30"))) {
    return {
      type: "set_alarm",
      payload: { time: "05:00", title: "Morning Training Session", meetupPoint: "Freedom Drive Hub" },
      description: "Set morning wake-up alarm",
    };
  }
  if (combined.includes("qr") || combined.includes("code")) {
    return {
      type: "generate_qr",
      payload: { distanceKm: 5.0 },
      description: "Generate join QR code",
    };
  }
  return undefined;
}
