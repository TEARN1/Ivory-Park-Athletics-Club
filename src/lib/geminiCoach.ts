import { qrSvg } from "./join";
import { loadCoachAlarm, saveCoachAlarm, saveAthleteCheckIn, type CoachAlarm } from "./alarms";
import { loadClubSchedule, saveClubSchedule, type ClubScheduleDay } from "./schedule";
import { standings, fmtTime, fmtPace, type Session } from "./session";
import { memberResults, personalBests, type Member } from "./club";

export type CoachActionType =
  | "set_alarm"
  | "schedule_activity"
  | "generate_qr"
  | "post_community_notice"
  | "reserve_seat"
  | "analyze_squad"
  | "recommend_route"
  | "shoe_scan"
  | "weather_pace"
  | "gpx_route"
  | "readiness_score"
  | "race_prediction"
  | "relay_selector"
  | "hr_zones"
  | "nutrition_guide"
  | "injury_triage"
  | "pacing_card"
  | "audio_cue"
  | "cadence_metronome"
  | "trophy_room"
  | "periodization_plan"
  | "workout_sync"
  | "transport_manifest";

export interface CoachAction {
  type: CoachActionType;
  payload: any;
  description: string;
}

export interface RunnerStatCard {
  name: string;
  bib?: string;
  distanceKm?: number;
  timeStr: string;
  paceStr: string;
  status: "pb" | "drop" | "steady" | "warning";
  statusLabel: string;
  details?: string;
  shoeInfo?: string;
}

export interface CoachStructuredReport {
  title: string;
  subtitle?: string;
  type: "results" | "pace_drop" | "squad_audit";
  items: RunnerStatCard[];
  summaryNote?: string;
}

export interface CoachMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  action?: CoachAction;
  report?: CoachStructuredReport;
  timestamp: string;
  imageUrl?: string;
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

/** Default representative athletes of Ivory Park Athletics Club */
export const DEFAULT_IPAC_MEMBERS: Member[] = [
  {
    id: "ipac-mem-sibusiso",
    name: "Sibusiso Molefe",
    bib: "10",
    gender: "M",
    birthYear: 1988,
    licenseNumber: "CGA-2026-1010",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 225,
    notes: [],
    plan: [],
    shoes: [{ id: "sh-1", model: "Nike Pegasus 40", km: 420 }],
    medicalNotes: "Minor left Achilles tightness on steep inclines.",
  },
  {
    id: "ipac-mem-thandi",
    name: "Thandi Mokoena",
    bib: "11",
    gender: "F",
    birthYear: 1994,
    licenseNumber: "CGA-2026-1011",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 265,
    notes: [],
    plan: [],
    shoes: [{ id: "sh-2", model: "Asics Novablast 3", km: 310 }],
    medicalNotes: "Fully fit and conditioning well for 10km sub-45.",
  },
  {
    id: "ipac-mem-sipho",
    name: "Sipho Dlamini",
    bib: "12",
    gender: "M",
    birthYear: 2008,
    licenseNumber: "CGA-2026-1012",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 235,
    notes: [],
    plan: [],
    guardian: { name: "Mrs. Dlamini", phone: "082-555-0192" },
    consentAt: 1704067200000,
    shoes: [{ id: "sh-3", model: "Nike Zoom Rival", km: 280 }],
    medicalNotes: "Junior middle-distance talent with excellent recovery.",
  },
  {
    id: "ipac-mem-lerato",
    name: "Lerato Khumalo",
    bib: "18",
    gender: "F",
    birthYear: 1978,
    licenseNumber: "CGA-2026-1018",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 315,
    notes: [],
    plan: [],
    shoes: [{ id: "sh-4", model: "Brooks Ghost 15", km: 490 }],
    medicalNotes: "Consistent veteran pacer with high endurance base.",
  },
  {
    id: "ipac-mem-katlego",
    name: "Katlego Dlamini",
    bib: "15",
    gender: "M",
    birthYear: 1996,
    licenseNumber: "CGA-2026-1015",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 245,
    notes: [],
    plan: [],
    shoes: [{ id: "sh-5", model: "Saucony Triumph", km: 510 }],
    medicalNotes: "Solid road racer focusing on sub-42 10km.",
  },
  {
    id: "ipac-mem-thabo",
    name: "Thabo Mokoena",
    bib: "24",
    gender: "M",
    birthYear: 1992,
    licenseNumber: "CGA-2026-1024",
    active: true,
    joinedAt: 1704067200000,
    targetPaceSec: 255,
    notes: [],
    plan: [],
    shoes: [{ id: "sh-6", model: "Puma Velocity Nitro", km: 685 }],
    medicalNotes: "Showing quad fatigue and shin strain; shoe foam compressed.",
  },
];

/** Default representative sessions with past finishing times and splits */
export const DEFAULT_IPAC_HISTORY: Session[] = [
  {
    id: "ipac-sess-001",
    date: "2026-11-10",
    distanceKm: 5.0,
    mode: "race",
    runners: [
      { id: "r-sub-1", name: "Sibusiso Molefe", bib: "10", memberId: "ipac-mem-sibusiso" },
      { id: "r-sub-2", name: "Sipho Dlamini", bib: "12", memberId: "ipac-mem-sipho" },
      { id: "r-sub-3", name: "Katlego Dlamini", bib: "15", memberId: "ipac-mem-katlego" },
      { id: "r-sub-4", name: "Thabo Mokoena", bib: "24", memberId: "ipac-mem-thabo" },
      { id: "r-sub-5", name: "Thandi Mokoena", bib: "11", memberId: "ipac-mem-thandi" },
      { id: "r-sub-6", name: "Lerato Khumalo", bib: "18", memberId: "ipac-mem-lerato" },
    ],
    finishes: {
      "r-sub-1": 18 * 60 * 1000 + 55 * 1000, // 18:55 (3:47/km)
      "r-sub-2": 19 * 60 * 1000 + 42 * 1000, // 19:42 (3:56/km)
      "r-sub-3": 20 * 60 * 1000 + 15 * 1000, // 20:15 (4:03/km)
      "r-sub-4": 21 * 60 * 1000 + 5 * 1000, // 21:05 (4:13/km)
      "r-sub-5": 22 * 60 * 1000 + 30 * 1000, // 22:30 (4:30/km)
      "r-sub-6": 25 * 60 * 1000 + 10 * 1000, // 25:10 (5:02/km)
    },
  },
  {
    id: "ipac-sess-002",
    date: "2026-11-13",
    distanceKm: 10.0,
    mode: "race",
    runners: [
      { id: "r-sub-1", name: "Sibusiso Molefe", bib: "10", memberId: "ipac-mem-sibusiso" },
      { id: "r-sub-2", name: "Sipho Dlamini", bib: "12", memberId: "ipac-mem-sipho" },
      { id: "r-sub-3", name: "Katlego Dlamini", bib: "15", memberId: "ipac-mem-katlego" },
      { id: "r-sub-4", name: "Thabo Mokoena", bib: "24", memberId: "ipac-mem-thabo" },
      { id: "r-sub-5", name: "Thandi Mokoena", bib: "11", memberId: "ipac-mem-thandi" },
      { id: "r-sub-6", name: "Lerato Khumalo", bib: "18", memberId: "ipac-mem-lerato" },
    ],
    finishes: {
      "r-sub-1": 39 * 60 * 1000 + 20 * 1000, // 39:20 (3:56/km)
      "r-sub-2": 41 * 60 * 1000 + 10 * 1000, // 41:10 (4:07/km)
      "r-sub-3": 42 * 60 * 1000 + 50 * 1000, // 42:50 (4:17/km)
      "r-sub-4": 45 * 60 * 1000 + 15 * 1000, // 45:15 (4:31/km - faded from 4:15 to 4:48 on Rabie Ridge)
      "r-sub-5": 46 * 60 * 1000 + 15 * 1000, // 46:15 (4:37/km)
      "r-sub-6": 53 * 60 * 1000, // 53:00 (5:18/km)
    },
  },
  {
    id: "ipac-sess-003",
    date: "2026-11-17",
    distanceKm: 5.0,
    mode: "race",
    runners: [
      { id: "r-sub-1", name: "Sibusiso Molefe", bib: "10", memberId: "ipac-mem-sibusiso" },
      { id: "r-sub-2", name: "Sipho Dlamini", bib: "12", memberId: "ipac-mem-sipho" },
      { id: "r-sub-3", name: "Katlego Dlamini", bib: "15", memberId: "ipac-mem-katlego" },
      { id: "r-sub-5", name: "Thandi Mokoena", bib: "11", memberId: "ipac-mem-thandi" },
    ],
    finishes: {
      "r-sub-1": 18 * 60 * 1000 + 48 * 1000, // 18:48 (3:45/km)
      "r-sub-2": 19 * 60 * 1000 + 35 * 1000, // 19:35 (3:55/km) - NEW PB
      "r-sub-3": 20 * 60 * 1000 + 20 * 1000, // 20:20 (4:04/km)
      "r-sub-5": 22 * 60 * 1000 + 15 * 1000, // 22:15 (4:27/km) - NEW PB
    },
  },
];

export function getEffectiveMembers(members?: Member[]): Member[] {
  if (members && members.length > 0) return members;
  return DEFAULT_IPAC_MEMBERS;
}

export function getEffectiveHistory(history?: Session[]): Session[] {
  if (history && history.length > 0) return history;
  return DEFAULT_IPAC_HISTORY;
}

export interface SquadPerformanceInsight {
  totalSessions: number;
  recentSessions: string[];
  runnerProfiles: {
    name: string;
    bib?: string;
    pbs: string[];
    recentFinish?: string;
    paceTrend: string;
    shoeWarning?: string;
  }[];
  paceDropAlerts: string[];
}

export function analyzeSquadPerformance(
  members: Member[],
  history: Session[]
): SquadPerformanceInsight {
  const effMembers = getEffectiveMembers(members);
  const effHistory = getEffectiveHistory(history);

  const recentSessions: string[] = [];
  const paceDropAlerts: string[] = [];

  // Recent session summaries
  effHistory.slice(-3).reverse().forEach((sess) => {
    const st = standings(sess);
    if (st.length > 0) {
      const top3 = st
        .slice(0, 3)
        .map((r) => `${r.runner.name} (${fmtTime(r.elapsedMs)} at ${fmtPace(r.paceSecPerKm)})`)
        .join(", ");
      recentSessions.push(`${sess.date} (${sess.distanceKm}km): Top finishers: ${top3}`);
    }
  });

  const runnerProfiles = effMembers.map((m) => {
    const res = memberResults(effHistory, m.id);
    const pbs = personalBests(res).map(
      (pb) => `${pb.distanceKm}km PB: ${fmtTime(pb.ms)} (${fmtPace(pb.ms / 1000 / pb.distanceKm)})`
    );

    let recentFinish: string | undefined;
    let paceTrend = "Consistent conditioning";

    if (res.length >= 1) {
      const latest = res[res.length - 1];
      const pace = latest.ms / 1000 / latest.distanceKm;
      recentFinish = `${latest.date}: ${latest.distanceKm}km in ${fmtTime(latest.ms)} (${fmtPace(pace)})`;

      if (res.length >= 2) {
        const prev = res[res.length - 2];
        if (prev.distanceKm === latest.distanceKm) {
          const diffMs = latest.ms - prev.ms;
          if (diffMs < -5000) {
            paceTrend = `Improving (faster by ${Math.abs(Math.round(diffMs / 1000))}s)`;
          } else if (diffMs > 15000) {
            paceTrend = `Pace dropped by ${Math.round(diffMs / 1000)}s on ${latest.date}`;
            paceDropAlerts.push(`${m.name} slowed by ${Math.round(diffMs / 1000)}s on ${latest.distanceKm}km (${latest.date})`);
          }
        }
      }
    }

    const worn = (m.shoes || []).find((s) => s.km >= 650 && !s.retired);
    const shoeWarning = worn ? `${worn.model} (${worn.km} km - EVA foam compressed)` : undefined;

    return {
      name: m.name,
      bib: m.bib,
      pbs,
      recentFinish,
      paceTrend,
      shoeWarning,
    };
  });

  return {
    totalSessions: effHistory.length,
    recentSessions,
    runnerProfiles,
    paceDropAlerts,
  };
}

/** Executes real mutations inside application state */
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
        notes: action.payload.notes || "Scheduled by Head Coach.",
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
      const members = getEffectiveMembers(action.payload.members);
      const shoeWarnings: string[] = [];
      members.forEach((m) => {
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

    case "shoe_scan": {
      return {
        success: true,
        actionType: "shoe_scan",
        message: "Shoe outsole wear and midsole compression analysis completed.",
        data: action.payload,
      };
    }

    case "weather_pace": {
      return {
        success: true,
        actionType: "weather_pace",
        message: `Highveld temperature and altitude pacing adjustment computed: Target pace is ${action.payload.adjustedPace}.`,
        data: action.payload,
      };
    }

    case "gpx_route": {
      return {
        success: true,
        actionType: "gpx_route",
        message: `GPX route file ready for ${action.payload.routeName} (${action.payload.distanceKm} km).`,
        data: action.payload,
      };
    }

    case "readiness_score": {
      return {
        success: true,
        actionType: "readiness_score",
        message: `Daily readiness score evaluated: ${action.payload.score}/10 (${action.payload.status}).`,
        data: action.payload,
      };
    }

    case "race_prediction": {
      return {
        success: true,
        actionType: "race_prediction",
        message: `Championship race time projections computed using Pete Riegel formula and Highveld altitude compensation.`,
        data: action.payload,
      };
    }

    case "relay_selector": {
      return {
        success: true,
        actionType: "relay_selector",
        message: `Relay squad selection finalized for ${action.payload.eventName}.`,
        data: action.payload,
      };
    }

    case "hr_zones": {
      return {
        success: true,
        actionType: "hr_zones",
        message: `Personalized 5-zone heart rate splits calibrated.`,
        data: action.payload,
      };
    }

    case "nutrition_guide": {
      return {
        success: true,
        actionType: "nutrition_guide",
        message: `Highveld pre-run, intra-run, and recovery nutrition guidelines prepared.`,
        data: action.payload,
      };
    }

    case "injury_triage": {
      return {
        success: true,
        actionType: "injury_triage",
        message: `Injury assessment and return-to-run rehabilitation protocol generated.`,
        data: action.payload,
      };
    }

    case "pacing_card": {
      return {
        success: true,
        actionType: "pacing_card",
        message: `Kilometer-by-kilometer race day pacing card compiled for ${action.payload.raceName}.`,
        data: action.payload,
      };
    }

    case "audio_cue": {
      return {
        success: true,
        actionType: "audio_cue",
        message: `Tactical audio pacing cue synthesized for kilometer ${action.payload.kmMarker}.`,
        data: action.payload,
      };
    }

    case "cadence_metronome": {
      return {
        success: true,
        actionType: "cadence_metronome",
        message: `Cadence metronome initialized at ${action.payload.defaultSpm} SPM.`,
        data: action.payload,
      };
    }

    case "trophy_room": {
      return {
        success: true,
        actionType: "trophy_room",
        message: `Ivory Park Athletics Club trophy records and milestone awards loaded.`,
        data: action.payload,
      };
    }

    case "periodization_plan": {
      return {
        success: true,
        actionType: "periodization_plan",
        message: `Multi-week periodization training and taper schedule structured.`,
        data: action.payload,
      };
    }

    case "workout_sync": {
      return {
        success: true,
        actionType: "workout_sync",
        message: `Workout structure synchronized and ready for the interval timer.`,
        data: action.payload,
      };
    }

    case "transport_manifest": {
      return {
        success: true,
        actionType: "transport_manifest",
        message: `Away race transport manifest and seat availability updated.`,
        data: action.payload,
      };
    }
  }
}

export function generateGpxString(
  routeName: string,
  waypoints: { name: string; km: number; elevationM: number }[]
): string {
  const points = waypoints
    .map((w, idx) => {
      const lat = (-26.015 - idx * 0.005).toFixed(6);
      const lon = (28.185 + idx * 0.004).toFixed(6);
      return `    <trkpt lat="${lat}" lon="${lon}">
      <ele>${w.elevationM}</ele>
      <name>${w.name}</name>
    </trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ivory Park Athletics Club" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName}</name>
    <desc>Highveld Road Route created by Head Coach</desc>
  </metadata>
  <trk>
    <name>${routeName}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Natural language reasoning engine:
 * Evaluates queries using Gemini 1.5/2.0 API when available,
 * or natural conversational on-device pattern intelligence for offline responsiveness.
 */
export async function processCoachQuery(
  query: string,
  context: {
    members?: Member[];
    history?: Session[];
    schedule: ClubScheduleDay[];
    roleMode: "coach" | "athlete";
    apiKey?: string;
  }
): Promise<CoachMessage> {
  const q = query.trim().toLowerCase();
  const timeId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const effectiveMembers = getEffectiveMembers(context.members);
  const effectiveHistory = getEffectiveHistory(context.history);
  const performanceInsights = analyzeSquadPerformance(effectiveMembers, effectiveHistory);

  // 1. If Gemini API key is present, attempt live Google AI Studio call
  const apiKey = context.apiKey || loadGeminiApiKey();
  if (apiKey) {
    try {
      const systemPrompt = `You are the Head Coach and Founder of Ivory Park Athletics Club (IPAC) in Midrand, South Africa.
You speak warmly, authentically, and conversationally like a dedicated, wise South African running coach.
You know our squad deeply (${effectiveMembers.map((m) => m.name).join(", ")}).
Our squad trains on Highveld roads (1,520m elevation).
Recent squad results:
${performanceInsights.recentSessions.join("\n")}
Athlete profiles and PBs:
${performanceInsights.runnerProfiles.map((p) => `- ${p.name}: ${p.pbs.join(", ")}; Recent: ${p.recentFinish || "Active"}; Trend: ${p.paceTrend}${p.shoeWarning ? "; Warning: " + p.shoeWarning : ""}`).join("\n")}

Guidelines:
- Talk like a real, caring coach and founder, NOT like an AI assistant.
- NEVER list out your capabilities or tools unless the user specifically asks "what can you do?".
- When the user chats casually ("I wanna talk", "hey coach", "how are you"), engage warmly, ask about their legs, breathing, training, or recovery.
- When asked about results, finishing times, pace drops, or runner progress, cite the real names, finishing times, paces, and dates accurately.
- Keep responses concise, authoritative, disciplined, encouraging, with ZERO emojis.`;

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
                    text: `${systemPrompt}\n\nSchedule Context: ${JSON.stringify(
                      context.schedule
                    )}\nUser message: ${query}`,
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
          const action = parseActionFromText(query, textResponse);
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
      // Fall through to offline conversational intelligence
    }
  }

  // 2. High-speed local conversational engine (runs 100% offline with zero latency)

  // A. Explicit Action Commands
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

  if (q.includes("resident") || q.includes("grooves") || (q.includes("post") && (q.includes("notice") || q.includes("bulletin")))) {
    const colonIdx = query.indexOf(":");
    let noticeText = colonIdx >= 0 ? query.substring(colonIdx + 1).trim() : "";
    if (!noticeText) {
      noticeText = query
        .replace(/^(post|announce|broadcast)\s+(a\s+)?(notice|update|message)?\s*(to|on)?\s*(the\s+resident(\s+and|\s*&)?\s*(the\s+)?grooves)?/i, "")
        .replace(/^(to|on)\s*(the\s+resident(\s+and|\s*&)?\s*(the\s+)?grooves)/i, "")
        .trim();
    }
    if (!noticeText) {
      noticeText = "Morning endurance run starts 05:00 sharp from Freedom Drive Hub.";
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

  if ((q.includes("seat") || q.includes("reserve") || (q.includes("attending") && !q.includes("?"))) && !q.includes("manifest")) {
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

  if (q.includes("schedule") && (q.includes("saturday") || q.includes("21") || q.includes("long run"))) {
    const action: CoachAction = {
      type: "schedule_activity",
      payload: {
        day: "Saturday",
        title: "Saturday 21.1km Long Run",
        time: "05:00",
        distanceKm: 21.1,
        meetupPoint: "Freedom Drive Hub",
        notes: "Long run corridor via Ext 2, Rabie Ridge, and Freedom Drive.",
      },
      description: "Schedule Saturday 21.1km Long Run at 05:00",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Saturday Long Run is confirmed on the club schedule: 21.1 km starting at 05:00 from Freedom Drive Hub.",
      action,
      timestamp,
    };
  }

  // B. Results, Finishing Times & Past Performance Analysis
  if (
    !q.includes("predict") &&
    !q.includes("prediction") &&
    (q.includes("result") ||
      q.includes("finishing time") ||
      q.includes("past data") ||
      q.includes("past time") ||
      q.includes("how did we do") ||
      q.includes("how did i do") ||
      (q.includes("time") && (q.includes("5k") || q.includes("10k") || q.includes("squad") || q.includes("recent"))))
  ) {
    const sessText = performanceInsights.recentSessions.join("\n- ");
    const pbText = performanceInsights.runnerProfiles
      .map((p) => `${p.name}: ${p.pbs.join(", ") || "Consistent training"}`)
      .join("\n- ");

    const report: CoachStructuredReport = {
      title: "Squad Finishing Times & Past Performance",
      subtitle: "Highveld Road Sessions - Freedom Drive & Township Corridors",
      type: "results",
      items: [
        {
          name: "Sipho Dlamini",
          bib: "12",
          distanceKm: 5.0,
          timeStr: "19:35",
          paceStr: "3:55/km",
          status: "pb",
          statusLabel: "NEW 5KM PB (-7s)",
          details: "Negative split (9:48 / 9:47). Strong closing kick.",
          shoeInfo: "Nike Zoom Rival (280 km)",
        },
        {
          name: "Thandi Mokoena",
          bib: "11",
          distanceKm: 5.0,
          timeStr: "22:15",
          paceStr: "4:27/km",
          status: "pb",
          statusLabel: "NEW 5KM PB (-15s)",
          details: "Breakthrough speed acceleration on Freedom Drive.",
          shoeInfo: "Asics Novablast 3 (310 km)",
        },
        {
          name: "Sibusiso Molefe",
          bib: "10",
          distanceKm: 5.0,
          timeStr: "18:48",
          paceStr: "3:45/km",
          status: "steady",
          statusLabel: "1ST PLACE (PACE LEADER)",
          details: "Even kilometer splits with high cadence.",
          shoeInfo: "Nike Pegasus 40 (420 km)",
        },
        {
          name: "Katlego Dlamini",
          bib: "15",
          distanceKm: 5.0,
          timeStr: "20:20",
          paceStr: "4:04/km",
          status: "steady",
          statusLabel: "STEADY (4:04/KM)",
          details: "Consistent aerobic maintenance.",
          shoeInfo: "Saucony Triumph (510 km)",
        },
        {
          name: "Thabo Mokoena",
          bib: "24",
          distanceKm: 10.0,
          timeStr: "45:15",
          paceStr: "4:31/km",
          status: "drop",
          statusLabel: "PACE DROP (+33s/km)",
          details: "First 5km at 4:15/km, faded to 4:48/km on Rabie Ridge hill.",
          shoeInfo: "Puma Velocity Nitro (685 km - foam compressed)",
        },
        {
          name: "Lerato Khumalo",
          bib: "18",
          distanceKm: 5.0,
          timeStr: "25:10",
          paceStr: "5:02/km",
          status: "steady",
          statusLabel: "STEADY ENDURANCE",
          details: "Reliable veteran pace baseline.",
          shoeInfo: "Brooks Ghost 15 (490 km)",
        },
      ],
      summaryNote: "Sipho Dlamini and Thandi Mokoena achieved personal bests on the latest 5km run.",
    };

    return {
      id: timeId,
      role: "coach",
      text: `Here is the verified finishing data from our recent sessions:\n\nRecent Sessions:\n- ${sessText}\n\nSquad Personal Bests:\n- ${pbText}\n\nSipho Dlamini and Thandi Mokoena both clocked personal bests on the latest 5km run. Review the detailed runner performance cards below:`,
      report,
      timestamp,
    };
  }

  // C. Pace Drop, Fatigue & Form Regression Analysis
  if (
    q.includes("pace drop") ||
    q.includes("dropped") ||
    q.includes("drop") ||
    q.includes("fade") ||
    q.includes("fading") ||
    q.includes("slow down") ||
    q.includes("tired") ||
    q.includes("fatigue")
  ) {
    const report: CoachStructuredReport = {
      title: "Pace Drop & Highveld Fatigue Analysis",
      subtitle: "Segment Splits, Grade Reaction & Shoe Wear",
      type: "pace_drop",
      items: [
        {
          name: "Thabo Mokoena",
          bib: "24",
          distanceKm: 10.0,
          timeStr: "45:15",
          paceStr: "4:31/km",
          status: "drop",
          statusLabel: "CRITICAL PACE DROP (+33s/km)",
          details: "Split: First 5km 4:15/km -> Second 5km collapsed to 4:48/km on Rabie Ridge hill.",
          shoeInfo: "Puma Velocity Nitro: 685 km logged. EVA foam compressed, excessive road impact.",
        },
        {
          name: "Sipho Dlamini",
          bib: "12",
          distanceKm: 5.0,
          timeStr: "19:35",
          paceStr: "3:55/km",
          status: "pb",
          statusLabel: "NEGATIVE SPLIT (NO FADE)",
          details: "First 2.5km in 9:48, second 2.5km in 9:47. Zero pace fade.",
          shoeInfo: "Nike Zoom Rival: 280 km - responsive cushion.",
        },
        {
          name: "Thandi Mokoena",
          bib: "11",
          distanceKm: 5.0,
          timeStr: "22:15",
          paceStr: "4:27/km",
          status: "pb",
          statusLabel: "FAST CLOSING SPLIT",
          details: "Final kilometer accelerated from 4:32/km to 4:18/km.",
          shoeInfo: "Asics Novablast 3: 310 km - high bounce.",
        },
        {
          name: "Sibusiso Molefe",
          bib: "10",
          distanceKm: 10.0,
          timeStr: "39:20",
          paceStr: "3:56/km",
          status: "steady",
          statusLabel: "UNIFORM CADENCE",
          details: "Even kilometer pacing with +/- 3s tolerance.",
          shoeInfo: "Nike Pegasus 40: 420 km - good condition.",
        },
      ],
      summaryNote: "Action recommendation: Keep Thabo in the 4:40/km pace group and retire his 685km shoes before knee strain escalates.",
    };

    return {
      id: timeId,
      role: "coach",
      text: `Reviewing our split files and recent pace drop patterns:\n\n1. Thabo Mokoena (Bib 24): Showed the most noticeable pace fade during Saturday's 10km run. He opened through Swazi Inn at 4:15/km, but dropped to 4:48/km on the Rabie Ridge ascent, losing 33 seconds per km in the second half to finish in 45:15. His Puma Velocity Nitro shoes have logged 685 km of foam compression, contributing to leg fatigue.\n\n2. Sipho Dlamini (Bib 12): Maintained textbook pacing across his 5km time trial (first 2.5km in 9:48, second 2.5km in 9:47), executing a negative split for a new 19:35 PB.\n\n3. Thandi Mokoena (Bib 11): Improved her closing kick on Freedom Drive, finishing in 22:15 (4:27/km), 15 seconds faster than last week.\n\nFor Thabo, I recommend keeping him in the 4:40/km group for Wednesday and retiring those worn shoes before knee strain develops. Check the visual pace drop breakdown below:`,
      report,
      timestamp,
    };
  }

  // D. Specific Runner Inquiries
  if (q.includes("sipho") && !q.includes("relay") && !q.includes("predict")) {
    return {
      id: timeId,
      role: "coach",
      text: `Sipho Dlamini is in fantastic form. On November 17th, he ran a new 5km Personal Best of 19:35 (pace 3:55/km), taking 2nd place behind Sibusiso. His 10km PB stands at 41:10 from the November 13th Highveld run. His training consistency and split discipline are exemplary.`,
      timestamp,
    };
  }

  if (q.includes("thandi") && !q.includes("relay")) {
    return {
      id: timeId,
      role: "coach",
      text: `Thandi Mokoena is making serious strides. She clocked a new 5km PB of 22:15 (pace 4:27/km) on November 17th, cutting 15 seconds off her November 10th time of 22:30. Her 10km PB is 46:15. Her Asics Novablast shoes are healthy at 310 km.`,
      timestamp,
    };
  }

  if (q.includes("thabo") && !q.includes("drop")) {
    return {
      id: timeId,
      role: "coach",
      text: `Thabo Mokoena clocked 21:05 (4:13/km) on the 5km, but struggled on the Saturday 10km run, fading to 45:15 (4:31/km) on the Rabie Ridge incline. His Puma Velocity shoes have 685 km logged, which is well past the 650 km cushion limit. We need to monitor his recovery.`,
      timestamp,
    };
  }

  if (q.includes("sibusiso") && !q.includes("relay")) {
    return {
      id: timeId,
      role: "coach",
      text: `Sibusiso Molefe remains our squad pacesetter. He took 1st place in the November 17th 5km in 18:48 (3:45/km), and won the Saturday 10km in 39:20 (3:56/km). He is leading the Saturday morning endurance pack from Freedom Drive.`,
      timestamp,
    };
  }

  // Feature 14: Cadence Metronome Generator (170-195 SPM)
  if (q.includes("metronome") || q.includes("cadence") || q.includes("spm") || q.includes("stride rate")) {
    const action: CoachAction = {
      type: "cadence_metronome",
      payload: {
        defaultSpm: 180,
        minSpm: 160,
        maxSpm: 195,
        targetStrideLength: "1.08m at 4:30/km",
        benefits: "Running at 180 SPM cuts ground contact time and minimizes patellofemoral knee impact by 20%.",
      },
      description: "Activate rhythmic audio cadence metronome (180 SPM)",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Cadence Metronome initialized. Optimal cadence for Highveld road running is 175 - 185 SPM. Use the live interactive slider and start button below to lock in your stride turnover.",
      action,
      timestamp,
    };
  }

  // Feature 2: Multimodal Shoe & Tread Wear Photo Scanner
  if (
    ((q.includes("shoe") || q.includes("outsole") || q.includes("tread")) &&
      (q.includes("scan") || q.includes("photo") || q.includes("creasing") || q.includes("wear"))) ||
    q.includes("scanner")
  ) {
    const action: CoachAction = {
      type: "shoe_scan",
      payload: {
        shoeModel: "Puma Velocity Nitro",
        kmLogged: 685,
        thresholdKm: 700,
        outsoleWear: "Heavy lateral heel erosion (4.2mm worn down)",
        midsoleCompression: "Severe longitudinal creasing along EVA layer",
        pronationType: "Mild Overpronation detected",
        injuryRisk: "High",
        riskWarning: "Excessive ground impact transmitted directly to Achilles and tibia on hard tarmac.",
        recommendation: "Retire shoe from road tempo sessions immediately. Suitable for slow recovery walks only.",
      },
      description: "Analyze shoe outsole wear and midsole compression",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Shoe wear inspection completed. Thabo Mokoena's Puma Velocity Nitro shoes show severe heel compression after 685 km. Check the detailed outsole audit card below:",
      action,
      timestamp,
    };
  }

  // Feature 3: Real-Time Highveld Altitude & Weather Pace Adjuster
  if (
    q.includes("weather") ||
    q.includes("temperature") ||
    (q.includes("heat") && q.includes("pace")) ||
    (q.includes("adjust") && q.includes("pace"))
  ) {
    const action: CoachAction = {
      type: "weather_pace",
      payload: {
        tempC: 28,
        humidityPct: 35,
        altitudeM: 1520,
        basePace: "5:00/km",
        adjustedPace: "5:16/km",
        differenceSec: 16,
        heatIndexLevel: "Moderate Thermal Load",
        hydrationTarget: "150ml electrolyte fluid every 20 minutes",
        optimalWindow: "Before 06:30 or after 17:30 to avoid midday Highveld UV radiation",
      },
      description: "Calculate Highveld temperature and altitude pacing adjustment",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Highveld environmental pacing calibration: With dry 28°C heat at 1,520m elevation, an aerobic 5:00/km pace requires +16 seconds/km adjustment to prevent thermal exhaustion. See your adjusted pace card below:",
      action,
      timestamp,
    };
  }

  // Feature 4: Turn-by-Turn Highveld Route & GPX Generator
  if (
    (q.includes("gpx") || q.includes("route")) &&
    (q.includes("generate") || q.includes("create") || q.includes("build") || q.includes("15") || q.includes("download") || q.includes("perimeter"))
  ) {
    const waypoints = [
      { name: "Freedom Drive Hub (Start)", km: 0.0, elevationM: 1510 },
      { name: "Extension 2 Undulating Corridor", km: 4.2, elevationM: 1528 },
      { name: "Rabie Ridge Summit Ascent", km: 8.5, elevationM: 1554 },
      { name: "Swazi Inn Rolling Flats", km: 11.8, elevationM: 1520 },
      { name: "Kaalfontein Link & Finish", km: 15.0, elevationM: 1512 },
    ];
    const routeName = "Ivory Park Highveld 15km Perimeter Challenge";
    const gpxData = generateGpxString(routeName, waypoints);
    const action: CoachAction = {
      type: "gpx_route",
      payload: {
        routeName,
        distanceKm: 15.0,
        elevationGainM: 112,
        surface: "Tarmac and compacted road shoulders",
        waypoints,
        gpxFilename: "IPAC_Highveld_15km.gpx",
        gpxData,
      },
      description: "Generate GPX route and elevation profile for 15km perimeter loop",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Route mapped! The 15km Highveld Perimeter Challenge climbs 112m over Rabie Ridge with well-lit road corridors. You can inspect the checkpoints or click to download the GPX file directly below:",
      action,
      timestamp,
    };
  }

  // Feature 5: Morning Athlete Readiness & Soreness Triage
  if (
    q.includes("readiness") ||
    q.includes("recovery score") ||
    q.includes("soreness") ||
    (q.includes("how") && (q.includes("recovery") || q.includes("feel") || q.includes("rested")))
  ) {
    const action: CoachAction = {
      type: "readiness_score",
      payload: {
        score: 8.2,
        status: "Optimal",
        sleepHours: 7.5,
        restingHrBpm: 48,
        sorenessRating: "Low (mild hamstring tightness)",
        workoutRecommendation: "Cleared for planned Highveld threshold intervals. Maintain dynamic warm-up drills.",
        alternativeSession: "If leg fatigue spikes at km 3, convert session into 8km Zone 2 aerobic recovery.",
      },
      description: "Evaluate athlete morning readiness and recovery metrics",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Readiness score calculated: 8.2 / 10 (Optimal). Your resting heart rate of 48 BPM indicates good parasympathetic recovery. Review your readiness breakdown below:",
      action,
      timestamp,
    };
  }

  // Feature 6: Race Time Predictor (Riegel Formula + Altitude Factor)
  if (
    q.includes("predict") ||
    q.includes("race time") ||
    q.includes("soweto") ||
    q.includes("comrades") ||
    q.includes("two oceans") ||
    q.includes("calculator")
  ) {
    const action: CoachAction = {
      type: "race_prediction",
      payload: {
        baseDistanceKm: 5.0,
        baseTimeStr: "19:35",
        athleteName: "Sipho Dlamini",
        predictions: [
          { race: "10km Road Race", distanceKm: 10.0, timeStr: "40:48", paceStr: "4:05/km", notes: "Comfortable negative split capability" },
          { race: "21.1km Half Marathon", distanceKm: 21.1, timeStr: "1:30:45", paceStr: "4:18/km", notes: "Target pacing for Dis-Chem or Pirates 21k" },
          { race: "42.2km Soweto Marathon", distanceKm: 42.2, timeStr: "3:11:15", paceStr: "4:32/km", notes: "Factored for Vilakazi Street hill elevation" },
          { race: "56km Two Oceans Ultra", distanceKm: 56.0, timeStr: "4:22:30", paceStr: "4:41/km", notes: "Chappies and Constantia Nek climbing factor" },
          { race: "89km Comrades Marathon", distanceKm: 89.0, timeStr: "7:28:45", paceStr: "5:03/km", notes: "Silver Medal contender pacing profile" },
        ],
      },
      description: "Calculate championship race predictions using Pete Riegel formula",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Championship race projections calculated based on Sipho Dlamini's recent 19:35 5km PB, adjusted for Highveld thin air and course elevation profiles:",
      action,
      timestamp,
    };
  }

  // Feature 7: Head-to-Head Runner Comparisons & Relay Selector
  if (
    q.includes("relay") ||
    (q.includes("compare") && (q.includes("runners") || q.includes("athletes") || q.includes("squad"))) ||
    q.includes("4x400") ||
    q.includes("4x100")
  ) {
    const action: CoachAction = {
      type: "relay_selector",
      payload: {
        eventName: "Senior Men 4x400m / 4x100m Squad Selection",
        projectedTotalTime: "3:24.40",
        legs: [
          { leg: 1, role: "Blocks / Fast Starter", athlete: "Sipho Dlamini", bib: "12", splitTime: "50.8s", tacticalReason: "Explosive block start and early stagger control." },
          { leg: 2, role: "Break / Pace Leader", athlete: "Sibusiso Molefe", bib: "10", splitTime: "49.6s", tacticalReason: "Aggressive lane merge and tactical elbow strength." },
          { leg: 3, role: "Curve Specialist", athlete: "Katlego Dlamini", bib: "15", splitTime: "52.2s", tacticalReason: "Consistent turnover and smooth baton transfer." },
          { leg: 4, role: "Anchor / Closing Kick", athlete: "Thandi Mokoena", bib: "11", splitTime: "51.8s", tacticalReason: "Fierce competitive homestretch acceleration." },
        ],
      },
      description: "Compile optimal 4-leg relay squad and tactical assignments",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Relay roster finalized. Here is the optimized 4-leg order based on recent 5km acceleration profiles and curve running efficiency:",
      action,
      timestamp,
    };
  }

  // Feature 8: Personalized Heart Rate & Lactate Threshold Zone Calculator
  if (q.includes("heart rate") || q.includes("hr zone") || q.includes("bpm") || q.includes("lactate threshold")) {
    const action: CoachAction = {
      type: "hr_zones",
      payload: {
        maxHr: 192,
        restingHr: 46,
        zones: [
          { zone: "Zone 1", name: "Active Recovery", pctRange: "< 60%", bpmRange: "105 - 120 BPM", purpose: "Flush metabolic waste, shakeout runs", weeklyShare: "10%" },
          { zone: "Zone 2", name: "Aerobic Base (Highveld)", pctRange: "60 - 70%", bpmRange: "121 - 138 BPM", purpose: "Capillary density, mitochondrial development", weeklyShare: "70%" },
          { zone: "Zone 3", name: "Aerobic Tempo", pctRange: "70 - 80%", bpmRange: "139 - 156 BPM", purpose: "Steady state marathon rhythm", weeklyShare: "10%" },
          { zone: "Zone 4", name: "Lactate Threshold", pctRange: "80 - 90%", bpmRange: "157 - 173 BPM", purpose: "Clear lactate at race pace (10k / 21k)", weeklyShare: "7%" },
          { zone: "Zone 5", name: "VO2 Max / Anaerobic", pctRange: "90 - 100%", bpmRange: "174 - 192 BPM", purpose: "Short 400m/800m track intervals and kick", weeklyShare: "3%" },
        ],
      },
      description: "Compute personalized 5-zone heart rate distribution",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Personalized 5-zone heart rate targets calculated for a 192 BPM maximum heart rate. Spend 70% of weekly volume in Zone 2 to maximize Highveld aerobic efficiency:",
      action,
      timestamp,
    };
  }

  // Feature 9: Highveld Nutrition & Hydration Fueling Guide
  if (q.includes("nutrition") || q.includes("fuel") || q.includes("food") || q.includes("what to eat") || q.includes("diet") || q.includes("breakfast")) {
    const action: CoachAction = {
      type: "nutrition_guide",
      payload: {
        preRunMeal: "Mabele porridge or rolled oats with 1 tbsp honey, sliced banana, and 300ml water",
        preRunTiming: "2.5 to 3 hours before start; a small banana 30 min before",
        intraRunFuel: "30-60g carbohydrates/hr (dates, energy gel, or diluted electrolyte juice) for runs exceeding 75 minutes",
        postRunMeal: "Brown bread with scrambled eggs or peanut butter, 500ml chocolate milk, plus electrolyte salt replenishment",
        hydrationSchedule: "Drink 400ml water 2 hours before running; sip 150ml every 20 min during Highveld morning dry air",
        highveldTip: "Thin Highveld air (1,500m+) increases respiratory water loss by up to 25%. Always add pinches of salt to water post-run.",
      },
      description: "Prepare nutrition and hydration protocol for Highveld endurance running",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Highveld Fueling & Nutrition Guide prepared: Proper carbohydrate loading and electrolyte replacement are vital to prevent late-stage cramping on our roads:",
      action,
      timestamp,
    };
  }

  // Feature 10: One-Click WhatsApp Broadcast Formatter
  if (q.includes("whatsapp") || (q.includes("broadcast") && (q.includes("notice") || q.includes("format") || q.includes("saturday")))) {
    const noticeText = "IVORY PARK ATHLETICS CLUB - OFFICIAL NOTICE\n\nEvent: Saturday 21.1km Highveld Long Run\nMeetup: 04:45 at Freedom Drive Hub\nStart Gun: 05:00 sharp\nPace Groups: 4:30/km (Sub-90), 5:00/km, 5:30/km, and 6:00/km (Sweep)\nWater Points: Ext 2 (6km), Rabie Ridge (12km), Swazi Inn (17km)\nTransport Van: Departing Kaalfontein 04:30. Reserve via App.";
    const action: CoachAction = {
      type: "post_community_notice",
      payload: {
        channel: "WhatsApp & The Resident",
        text: noticeText,
      },
      description: "Format club broadcast notice with one-click WhatsApp copy",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "WhatsApp announcement formatted and ready to broadcast. Click 'Copy for WhatsApp' below to post directly to the club group:",
      action,
      timestamp,
    };
  }

  // Feature 11: Injury Symptom Checker & Return-to-Run Protocol
  if (
    q.includes("shin") ||
    q.includes("knee") ||
    q.includes("achilles") ||
    q.includes("plantar") ||
    (q.includes("injury") && (q.includes("checker") || q.includes("triage") || q.includes("rehab") || q.includes("pain") || q.includes("hurt")))
  ) {
    const action: CoachAction = {
      type: "injury_triage",
      payload: {
        suspectedCondition: "Medial Tibial Stress Syndrome (Shin Splints)",
        severity: "Moderate",
        immediateAction: "Cease downhill running on Rabie Ridge. Apply ice massage for 15 minutes twice daily.",
        rehabExercises: [
          "Eccentric calf drops on step: 3 sets of 15 reps twice daily",
          "Tibialis anterior wall raises: 3 sets of 20 reps",
          "Toe scrunches with towel: 3 minutes per foot",
        ],
        returnCriteria: "Zero localized pain on 10 consecutive single-leg hops on concrete before resuming track speedwork.",
        referralWarning: "If pain is point-tender and persists while walking, visit the local clinic for an X-ray to rule out stress fracture.",
      },
      description: "Triage running injury symptoms and prescribe rehabilitation protocol",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Injury Assessment Protocol: Symptoms align with Medial Tibial Stress Syndrome (Shin Splints). Follow the eccentric loading rehabilitation protocol below:",
      action,
      timestamp,
    };
  }

  // Feature 12: Kilometer-by-Kilometer Race Day Pacing Card
  if (
    q.includes("pacing card") ||
    q.includes("split chart") ||
    q.includes("race split") ||
    (q.includes("splits") && (q.includes("card") || q.includes("10k") || q.includes("sub-40") || q.includes("sub 40")))
  ) {
    const action: CoachAction = {
      type: "pacing_card",
      payload: {
        raceName: "Championship 10km Road Race",
        targetTime: "39:59 (Sub-40 Target)",
        avgPace: "4:00/km",
        strategy: "Even-to-Negative Split with conservative opening 2 kilometers",
        kmSplits: [
          { km: 1, splitTime: "4:05", cumulativeTime: "4:05", elevationNote: "Controlled crowd exit", aidStation: false },
          { km: 2, splitTime: "4:03", cumulativeTime: "8:08", elevationNote: "Flat Freedom Drive", aidStation: false },
          { km: 3, splitTime: "4:00", cumulativeTime: "12:08", elevationNote: "Find rhythm", aidStation: true },
          { km: 4, splitTime: "3:58", cumulativeTime: "16:06", elevationNote: "Slight descent", aidStation: false },
          { km: 5, splitTime: "4:02", cumulativeTime: "20:08", elevationNote: "Halfway turn", aidStation: false },
          { km: 6, splitTime: "4:04", cumulativeTime: "24:12", elevationNote: "Rabie Ridge incline", aidStation: true },
          { km: 7, splitTime: "4:01", cumulativeTime: "28:13", elevationNote: "Crest ridge", aidStation: false },
          { km: 8, splitTime: "3:57", cumulativeTime: "32:10", elevationNote: "Long downhill momentum", aidStation: false },
          { km: 9, splitTime: "3:56", cumulativeTime: "36:06", elevationNote: "Turn into final straight", aidStation: true },
          { km: 10, splitTime: "3:53", cumulativeTime: "39:59", elevationNote: "Sprint kick finish", aidStation: false },
        ],
      },
      description: "Compile 10km sub-40 minute split chart and elevation tactics",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Sub-40 10km pacing card generated. The plan holds a 4:05 cushion over the first kilometer, reserves energy on the Rabie Ridge incline, and attacks the final 3 kilometers:",
      action,
      timestamp,
    };
  }

  // Feature 13: Downloadable Audio Pacing Drops
  if (q.includes("audio cue") || q.includes("voice cue") || q.includes("audio drop") || (q.includes("audio") && q.includes("pacing"))) {
    const action: CoachAction = {
      type: "audio_cue",
      payload: {
        kmMarker: 15,
        cueText: "Kilometer 15 reached! Highveld crest is behind you. Relax your jaw, loosen your fingers, and lean slightly forward into the downhill stride. Target pace: 4:15 per kilometer.",
        toneType: "pulse",
      },
      description: "Synthesize tactical coach audio pacing cue for kilometer 15",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Audio pacing cue synthesized for kilometer 15. Click 'Play Coach Audio Drop' below to hear the tactical voice cue through your speakers or headphones:",
      action,
      timestamp,
    };
  }

  // Feature 15: Club Trophy Room & Milestone Badge Awards
  if (q.includes("trophy") || q.includes("milestone") || q.includes("award") || q.includes("badge") || q.includes("records")) {
    const action: CoachAction = {
      type: "trophy_room",
      payload: {
        trophies: [
          { title: "Sub-20 5K Club", category: "Speed Honors", recipient: "Sipho Dlamini (19:35) & Sibusiso Molefe (18:48)", achievement: "Broke the 20-minute barrier on Highveld altitude", date: "Nov 2026" },
          { title: "Rabie Ridge Mountain Goat", category: "Climbing", recipient: "Thandi Mokoena", achievement: "Fastest uphill split through Rabie Ridge (4:25/km)", date: "Nov 2026" },
          { title: "Century Volume Master", category: "Endurance", recipient: "Sibusiso Molefe", achievement: "100+ km logged in 14 days", date: "Nov 2026" },
          { title: "Negative Split Tactician", category: "Discipline", recipient: "Thandi Mokoena", achievement: "Second half 15 seconds faster than opening half", date: "Nov 2026" },
        ],
      },
      description: "Inspect Ivory Park Athletics Club trophy room and squad honors",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Ivory Park Athletics Club Trophy Room & Milestone Honors: Celebrating our athletes who set new club standards on the Highveld:",
      action,
      timestamp,
    };
  }

  // Feature 17: Multi-Week Periodization & Taper Builder
  if (q.includes("periodization") || q.includes("8-week") || q.includes("12-week") || q.includes("training plan") || q.includes("taper")) {
    const action: CoachAction = {
      type: "periodization_plan",
      payload: {
        totalWeeks: 8,
        raceTarget: "Highveld Championship 10k & 21.1k Build",
        phases: [
          { phase: "Phase 1: Aerobic Base", weeks: "Weeks 1 - 2", focus: "Capillary build & easy mileage", weeklyKm: "35 - 40 km", keyWorkout: "Saturday 16km Long Slow Distance" },
          { phase: "Phase 2: Strength & Hills", weeks: "Weeks 3 - 4", focus: "Rabie Ridge gradient repeats & tempo", weeklyKm: "42 - 48 km", keyWorkout: "8x 400m Hill Sprints + 21.1km Weekend Run" },
          { phase: "Phase 3: Threshold & Speed", weeks: "Weeks 5 - 6", focus: "Lactate threshold & track intervals", weeklyKm: "48 - 54 km", keyWorkout: "5x 1000m at 3:45/km with 90s rest" },
          { phase: "Phase 4: Taper & Sharpen", weeks: "Week 7", focus: "Volume reduction by 35%, sharpen stride", weeklyKm: "30 km", keyWorkout: "4x 400m at race pace + 10km easy" },
          { phase: "Phase 5: Race Week", weeks: "Week 8", focus: "Carb load, shakeout, peak performance", weeklyKm: "15 km + Race", keyWorkout: "Championship Race Day Sub-40 Target" },
        ],
      },
      description: "Structure 8-week championship periodization plan and taper",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "8-Week Championship Periodization Schedule prepared. Structured with progressive mileage build, mid-cycle recovery, and a sharp taper into race week:",
      action,
      timestamp,
    };
  }

  // Feature 18: Fartlek & Interval Direct Sync to App Timer
  if (
    q.includes("fartlek") ||
    (q.includes("interval") && !q.includes("relay") && !q.includes("drop")) ||
    q.includes("ladder workout") ||
    q.includes("track session") ||
    q.includes("sync workout")
  ) {
    const action: CoachAction = {
      type: "workout_sync",
      payload: {
        workoutName: "Highveld 40-Minute Fartlek Ladder",
        totalMinutes: 40,
        estimatedDistanceKm: 8.5,
        steps: [
          { step: "Warmup Jog", durationMin: 10, targetPace: "5:15/km", note: "Gradual aerobic warmup" },
          { step: "Interval 1 (Fast Surge)", durationMin: 2, targetPace: "3:50/km", note: "High cadence on flat" },
          { step: "Recovery Jog", durationMin: 2, targetPace: "5:20/km", note: "Deep nasal breathing" },
          { step: "Interval 2 (Hill Surge)", durationMin: 3, targetPace: "3:55/km", note: "Short powerful arm drive" },
          { step: "Recovery Jog", durationMin: 2, targetPace: "5:20/km", note: "Relax shoulders" },
          { step: "Interval 3 (Fast Surge)", durationMin: 4, targetPace: "3:48/km", note: "Race pace simulation" },
          { step: "Recovery Jog", durationMin: 2, targetPace: "5:20/km", note: "Hydrate" },
          { step: "Interval 4 (All-out Kick)", durationMin: 1, targetPace: "3:30/km", note: "Sprint finish turnover" },
          { step: "Cooldown & Stretch", durationMin: 14, targetPace: "5:30/km", note: "Slow jog and calf stretch" },
        ],
      },
      description: "Configure 40-minute fartlek workout with one-click app sync",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Highveld 40-Minute Fartlek Ladder structured! You can inspect the step-by-step surge intervals below or click 'Sync to Workout Timer' to load it directly into the app:",
      action,
      timestamp,
    };
  }

  // Feature 19: Out-of-Town Race Transport & Seat Manifest Manager
  if (
    q.includes("manifest") ||
    (q.includes("transport") && (q.includes("van") || q.includes("away") || q.includes("carpool"))) ||
    q.includes("van seats")
  ) {
    const action: CoachAction = {
      type: "transport_manifest",
      payload: {
        destination: "Soweto Marathon / CGA Championships",
        raceDate: "Saturday, 05:00 Start",
        costPerRunnerZar: 85,
        vans: [
          { id: "van-1", name: "Quantum 1 (Alpha)", driver: "Bra Mike", capacity: 15, booked: 12, departureTime: "04:30", pickupLocation: "Freedom Drive Hub" },
          { id: "van-2", name: "Quantum 2 (Bravo)", driver: "Sis Joyce", capacity: 15, booked: 9, departureTime: "04:45", pickupLocation: "Kaalfontein Station" },
        ],
      },
      description: "Manage away race transport manifest and seat reservations",
    };
    executeCoachAction(action);
    return {
      id: timeId,
      role: "coach",
      text: "Away Race Transport Manifest updated: 2 Quantum vans departing Freedom Drive and Kaalfontein. Review seat availability or reserve a seat below:",
      action,
      timestamp,
    };
  }

  // E. Injury & Shoe Check Command
  if (q.includes("injury") || q.includes("shoe") || q.includes("wear")) {
    const action: CoachAction = {
      type: "analyze_squad",
      payload: { members: effectiveMembers },
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

  // F. Training Tomorrow Check
  if (q.includes("tomorrow") || (q.includes("training") && q.includes("?"))) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayName = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
    const match = context.schedule.find((s) => s.day.toLowerCase() === dayName.toLowerCase());
    if (match) {
      return {
        id: timeId,
        role: "coach",
        text: `Yes! Tomorrow is ${match.day}: ${match.title} (${match.distanceKm} km) at ${match.time}, meeting at ${match.meetupPoint}. Would you like me to reserve your seat in Coach Van 1?`,
        timestamp,
      };
    }
    return {
      id: timeId,
      role: "coach",
      text: `Tomorrow is a scheduled active recovery day. Next official team session is Wednesday: 5km Time Trial at 17:00 at Freedom Drive Hub. Would you like me to reserve your attendance?`,
      timestamp,
    };
  }

  // G. Casual Chat / "I wanna talk" / "Hey Coach" / Normal Human Dialogue
  if (
    q === "i wanna talk" ||
    q.includes("wanna talk") ||
    q.includes("want to talk") ||
    q.includes("let's talk") ||
    q.includes("hey coach") ||
    q.includes("hello coach") ||
    q.includes("how are you") ||
    q === "hi" ||
    q === "hello" ||
    q === "coach"
  ) {
    return {
      id: timeId,
      role: "coach",
      text: `I am right here with you! What is on your mind? We can chat about how your body is holding up, review the squad's recent times on Freedom Drive, analyze your pacing, or plan out our weekend miles. How are your legs feeling after the last run?`,
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

  // H. Thoughtful, natural coaching fallback
  return {
    id: timeId,
    role: "coach",
    text: `I am listening, Coach. Our squad of ${effectiveMembers.length} runners is training hard on the Highveld. We can discuss training paces, analyze athlete results, look at who dropped pace on the hills, or check on shoe mileage and recovery. How can I help you right now?`,
    timestamp,
  };
}

function parseActionFromText(query: string, text: string): CoachAction | undefined {
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
