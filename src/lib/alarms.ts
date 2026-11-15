export type AlarmTone = "fanfare" | "siren" | "pulse" | "chime";
export type TargetSquad = "all" | "seniors" | "juniors" | "minibus_a" | "minibus_b";

export interface CoachAlarm {
  id: string;
  time: string; // "04:30"
  enabled: boolean;
  programTitle: string;
  programCode?: string;
  distanceKm?: number;
  meetupPoint: string;
  departureTime?: string;
  instructions: string;
  targetSquad: TargetSquad;
  soundTone: AlarmTone;
  repeatDaily: boolean;
  lastFiredDate?: string;
}

export interface AthleteAlarmCheckIn {
  athleteId: string;
  athleteName: string;
  bib: string;
  checkInAt: string;
  status: "awake" | "needs_pickup" | "snoozed" | "en_route";
  note?: string;
}

export const STORAGE_KEY_ALARM = "ipac_offline_coach_alarm";
export const STORAGE_KEY_CHECKINS = "ipac_alarm_checkins";

export function defaultCoachAlarm(): CoachAlarm {
  return {
    id: "alarm-ivory-park-default",
    time: "04:30",
    enabled: true,
    programTitle: "Saturday 5km Time Trial & League Race",
    programCode: "SAT-5K",
    distanceKm: 5.0,
    meetupPoint: "Freedom Drive Hub",
    departureTime: "05:15",
    instructions: "Bring ASA license and race bib. Team transport departs promptly at 05:15.",
    targetSquad: "all",
    soundTone: "fanfare",
    repeatDaily: true,
  };
}

export function loadCoachAlarm(): CoachAlarm {
  try {
    if (typeof localStorage === "undefined") return defaultCoachAlarm();
    const raw = localStorage.getItem(STORAGE_KEY_ALARM);
    if (!raw) return defaultCoachAlarm();
    const parsed = JSON.parse(raw);
    return { ...defaultCoachAlarm(), ...parsed };
  } catch {
    return defaultCoachAlarm();
  }
}

export function saveCoachAlarm(alarm: CoachAlarm): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_ALARM, JSON.stringify(alarm));
  } catch {
    /* storage quota or privacy mode */
  }
}

export function clearCoachAlarm(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY_ALARM);
  } catch {
    /* noop */
  }
}

export function formatLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatLocalTimeStr(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Returns true if the alarm is enabled and due right now on this local minute */
export function checkAlarmDue(alarm: CoachAlarm, now: Date = new Date()): boolean {
  if (!alarm.enabled) return false;
  const nowTime = formatLocalTimeStr(now);
  const nowDate = formatLocalDateStr(now);

  if (nowTime !== alarm.time) return false;
  if (alarm.lastFiredDate === nowDate) return false;
  return true;
}

/** Parses alarm parameters from deep links or QR code scans */
export function parseAlarmFromUrl(search: string): Partial<CoachAlarm> | null {
  try {
    const sp = new URLSearchParams(search);
    if (!sp.has("alarm_time") && !sp.has("set_alarm") && !sp.has("time")) return null;
    const time = sp.get("alarm_time") || sp.get("time");
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;

    return {
      time,
      enabled: true,
      programTitle: sp.get("title") || undefined,
      instructions: sp.get("instructions") || undefined,
      meetupPoint: sp.get("meetup") || undefined,
      departureTime: sp.get("departure") || undefined,
      targetSquad: (sp.get("squad") as TargetSquad) || "all",
      soundTone: (sp.get("tone") as AlarmTone) || "fanfare",
      repeatDaily: sp.get("repeat") === "1" || sp.get("repeat") === "true",
    };
  } catch {
    return null;
  }
}

/** Encodes alarm configuration into a shareable query string */
export function createAlarmShareParams(alarm: CoachAlarm): string {
  const sp = new URLSearchParams();
  sp.set("set_alarm", "1");
  sp.set("alarm_time", alarm.time);
  if (alarm.programTitle) sp.set("title", alarm.programTitle);
  if (alarm.instructions) sp.set("instructions", alarm.instructions);
  if (alarm.meetupPoint) sp.set("meetup", alarm.meetupPoint);
  if (alarm.departureTime) sp.set("departure", alarm.departureTime);
  sp.set("squad", alarm.targetSquad);
  sp.set("tone", alarm.soundTone);
  sp.set("repeat", alarm.repeatDaily ? "1" : "0");
  return sp.toString();
}

/** Formats a clean, high-priority WhatsApp broadcast message with no emojis */
export function formatAlarmWhatsApp(alarm: CoachAlarm, appUrl: string): string {
  const lines: string[] = [
    "*IVORY PARK ATHLETICS CLUB - SQUAD WAKE-UP ALARM*",
    `Scheduled Wake-Up: ${alarm.time}`,
    `Program: ${alarm.programTitle}`,
  ];

  if (alarm.meetupPoint) {
    lines.push(`Meetup Point: ${alarm.meetupPoint}`);
  }
  if (alarm.departureTime) {
    lines.push(`Transport Departure: ${alarm.departureTime}`);
  }
  if (alarm.instructions) {
    lines.push(`Instructions: ${alarm.instructions}`);
  }

  const shareParams = createAlarmShareParams(alarm);
  const fullLink = `${appUrl.replace(/\/$/, "")}/today?${shareParams}`;

  lines.push("");
  lines.push("Tap this link to sync this offline alarm directly into your app:");
  lines.push(fullLink);
  lines.push("");
  lines.push("[Active Offline: Alarm will ring on your phone even if mobile data is turned off]");

  return lines.join("\n");
}

export function loadAthleteCheckIns(): Record<string, AthleteAlarmCheckIn> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY_CHECKINS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAthleteCheckIn(checkIn: AthleteAlarmCheckIn): Record<string, AthleteAlarmCheckIn> {
  try {
    const cur = loadAthleteCheckIns();
    const updated = { ...cur, [checkIn.athleteId]: checkIn };
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return {};
  }
}
