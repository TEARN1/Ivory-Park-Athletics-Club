export interface ClubScheduleDay {
  day: "Monday" | "Wednesday" | "Saturday" | "Sunday";
  title: string;
  time: string; // "17:00"
  season: "summer" | "winter";
  distanceKm: number;
  meetupPoint: string;
  notes: string;
}

export interface MileageTarget {
  weeklyKm: number;
  monthlyKm: number;
  raceGoal: string;
}

export const DEFAULT_CLUB_SCHEDULE: ClubScheduleDay[] = [
  {
    day: "Monday",
    title: "Monday Course Run",
    time: "17:00",
    season: "summer",
    distanceKm: 8.0,
    meetupPoint: "Freedom Drive Hub / Ext 2 Hall",
    notes: "Summer 17:00 start (Winter 17:30). Aerobic base building across township corridors.",
  },
  {
    day: "Wednesday",
    title: "Wednesday 5km Time Trial",
    time: "17:00",
    season: "summer",
    distanceKm: 5.0,
    meetupPoint: "Freedom Drive 5km Circuit",
    notes: "Official weekly 5km speed check and personal best tracking.",
  },
  {
    day: "Saturday",
    title: "Saturday Long Run & League Race",
    time: "04:30",
    season: "summer",
    distanceKm: 21.1,
    meetupPoint: "Freedom Drive Hub",
    notes: "Wake-up 04:30, transport departs 05:00. Highveld endurance pack.",
  },
  {
    day: "Sunday",
    title: "Sunday Races & Recovery Run",
    time: "05:00",
    season: "summer",
    distanceKm: 15.0,
    meetupPoint: "Freedom Drive Hub / Event Venue",
    notes: "Official CGA/ASA road races or easy Sunday distance recovery.",
  },
];

export const DEFAULT_MILEAGE_TARGET: MileageTarget = {
  weeklyKm: 40,
  monthlyKm: 160,
  raceGoal: "10K & Half Marathon Build",
};

const SCHEDULE_KEY = "ipac_club_schedule";
const TARGET_KEY = "ipac_mileage_target";

export function loadClubSchedule(): ClubScheduleDay[] {
  if (typeof localStorage === "undefined") return DEFAULT_CLUB_SCHEDULE;
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return DEFAULT_CLUB_SCHEDULE;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CLUB_SCHEDULE;
  } catch {
    return DEFAULT_CLUB_SCHEDULE;
  }
}

export function saveClubSchedule(schedule: ClubScheduleDay[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

export function loadMileageTarget(): MileageTarget {
  if (typeof localStorage === "undefined") return DEFAULT_MILEAGE_TARGET;
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    if (!raw) return DEFAULT_MILEAGE_TARGET;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_MILEAGE_TARGET, ...parsed };
  } catch {
    return DEFAULT_MILEAGE_TARGET;
  }
}

export function saveMileageTarget(target: MileageTarget): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TARGET_KEY, JSON.stringify(target));
}
