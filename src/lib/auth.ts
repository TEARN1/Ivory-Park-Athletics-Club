import { getSupabaseClient, IPAC_TABLES } from "./supabase";

export interface AthleteProfile {
  id: string;
  name: string;
  bib: string;
  phone?: string;
  pin?: string; // 4-digit mobile PIN for privacy
  role: "athlete" | "coach" | "timekeeper";
  ageGroup: "Junior (under 20)" | "Senior (20-39)" | "Veteran (40-49)" | "Master (50+)";
  gender: "M" | "F" | "X";
  section: string; // Highveld residential section / hub (e.g. "Freedom Drive", "Swazi Inn", "Rabie Ridge", "Kaalfontein", "Ext 2", "Tembisa Border")
  best5k?: string; // e.g. "19:35"
  best10k?: string; // e.g. "41:10"
  targetPace?: string; // e.g. "3:55/km"
  shoeModel?: string; // e.g. "Puma Deviate Nitro 2"
  shoeKm?: number;
  emergencyContact?: { name: string; phone: string };
  createdAt: number;
  updatedAt: number;
}

export const SECTIONS_IVORY_PARK = [
  "Freedom Drive Hub",
  "Swazi Inn Corridors",
  "Rabie Ridge Ascent",
  "Kaalfontein Hub",
  "Extension 2 Park",
  "Tembisa Border",
  "Halfway House Route",
] as const;

export const DEFAULT_CLUB_PROFILES: AthleteProfile[] = [
  {
    id: "profile-sipho-dlamini",
    name: "Sipho Dlamini",
    bib: "12",
    phone: "072-555-1212",
    pin: "1212",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Freedom Drive Hub",
    best5k: "19:35",
    best10k: "41:10",
    targetPace: "3:55/km",
    shoeModel: "Puma Deviate Nitro 2",
    shoeKm: 240,
    emergencyContact: { name: "Bongani Dlamini", phone: "082-555-9901" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
  {
    id: "profile-thandi-mokoena",
    name: "Thandi Mokoena",
    bib: "11",
    phone: "071-555-1111",
    pin: "1111",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "F",
    section: "Swazi Inn Corridors",
    best5k: "22:15",
    best10k: "46:15",
    targetPace: "4:27/km",
    shoeModel: "Asics Novablast 4",
    shoeKm: 310,
    emergencyContact: { name: "Grace Mokoena", phone: "083-555-9902" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
  {
    id: "profile-sibusiso-molefe",
    name: "Sibusiso Molefe",
    bib: "7",
    phone: "073-555-0707",
    pin: "0707",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Rabie Ridge Ascent",
    best5k: "18:48",
    best10k: "39:20",
    targetPace: "3:46/km",
    shoeModel: "Nike Vaporfly 3",
    shoeKm: 180,
    emergencyContact: { name: "Zodwa Molefe", phone: "084-555-9903" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
  {
    id: "profile-thabo-mokoena",
    name: "Thabo Mokoena",
    bib: "24",
    phone: "074-555-2424",
    pin: "2424",
    role: "athlete",
    ageGroup: "Veteran (40-49)",
    gender: "M",
    section: "Kaalfontein Hub",
    best5k: "21:05",
    best10k: "45:15",
    targetPace: "4:32/km",
    shoeModel: "Puma Velocity Nitro 2",
    shoeKm: 685,
    emergencyContact: { name: "Joyce Mokoena", phone: "082-555-9904" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
  {
    id: "profile-lerato-khumalo",
    name: "Lerato Khumalo",
    bib: "18",
    phone: "076-555-1818",
    pin: "1818",
    role: "athlete",
    ageGroup: "Junior (under 20)",
    gender: "F",
    section: "Extension 2 Park",
    best5k: "25:10",
    best10k: "53:00",
    targetPace: "5:02/km",
    shoeModel: "Adidas Boston 12",
    shoeKm: 195,
    emergencyContact: { name: "Themba Khumalo", phone: "083-555-9905" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
  {
    id: "profile-katlego-dlamini",
    name: "Katlego Dlamini",
    bib: "9",
    phone: "079-555-0909",
    pin: "0909",
    role: "athlete",
    ageGroup: "Senior (20-39)",
    gender: "M",
    section: "Tembisa Border",
    best5k: "20:15",
    best10k: "42:50",
    targetPace: "4:03/km",
    shoeModel: "Saucony Endorphin Speed 3",
    shoeKm: 275,
    emergencyContact: { name: "Nandi Dlamini", phone: "082-555-9906" },
    createdAt: 1731900000000,
    updatedAt: 1731900000000,
  },
];

const STORAGE_KEY_CURRENT_ATHLETE = "ipac_current_athlete";
const STORAGE_KEY_ALL_PROFILES = "ipac_athlete_profiles_cache";

/** Load all cached athlete profiles, initialized with defaults */
export function listClubProfiles(): AthleteProfile[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_CLUB_PROFILES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALL_PROFILES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ALL_PROFILES, JSON.stringify(DEFAULT_CLUB_PROFILES));
      return [...DEFAULT_CLUB_PROFILES];
    }
    const parsed: AthleteProfile[] = JSON.parse(raw);
    // Ensure all default profiles exist in cache
    const existingIds = new Set(parsed.map((p) => p.id));
    let updated = false;
    for (const def of DEFAULT_CLUB_PROFILES) {
      if (!existingIds.has(def.id)) {
        parsed.push(def);
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem(STORAGE_KEY_ALL_PROFILES, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return [...DEFAULT_CLUB_PROFILES];
  }
}

/** Save a profile into the local cache */
export function saveProfileToCache(profile: AthleteProfile): void {
  if (typeof localStorage === "undefined") return;
  try {
    const list = listClubProfiles();
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      list[idx] = profile;
    } else {
      list.push(profile);
    }
    localStorage.setItem(STORAGE_KEY_ALL_PROFILES, JSON.stringify(list));
  } catch {}
}

/** Get currently active signed-in athlete */
export function getCurrentAthlete(): AthleteProfile | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_ATHLETE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Set currently active signed-in athlete */
export function setCurrentAthlete(profile: AthleteProfile | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(STORAGE_KEY_CURRENT_ATHLETE, JSON.stringify(profile));
      saveProfileToCache(profile);
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_ATHLETE);
    }
  } catch {}
}

/** Sign out currently active athlete */
export function logoutAthlete(): void {
  setCurrentAthlete(null);
}

/** Register a new athlete and store locally & in Supabase database */
export async function createAthleteProfile(
  input: {
    name: string;
    bib?: string;
    phone?: string;
    pin?: string;
    section?: string;
    ageGroup?: AthleteProfile["ageGroup"];
    gender?: "M" | "F" | "X";
    best5k?: string;
    best10k?: string;
    targetPace?: string;
    shoeModel?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  }
): Promise<AthleteProfile> {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Athlete full name is required");

  // Determine or assign bib
  const existing = listClubProfiles();
  let assignedBib = (input.bib || "").trim();
  if (!assignedBib) {
    const numericBibs = existing.map((p) => parseInt(p.bib, 10)).filter((n) => !isNaN(n));
    const nextBib = numericBibs.length ? Math.max(...numericBibs) + 1 : 100;
    assignedBib = String(nextBib);
  }

  const newProfile: AthleteProfile = {
    id: "profile-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
    name: trimmedName,
    bib: assignedBib,
    phone: (input.phone || "").trim(),
    pin: (input.pin || "").trim() || "1234",
    role: "athlete",
    ageGroup: input.ageGroup || "Senior (20-39)",
    gender: input.gender || "M",
    section: input.section || "Freedom Drive Hub",
    best5k: input.best5k || "",
    best10k: input.best10k || "",
    targetPace: input.targetPace || "",
    shoeModel: input.shoeModel || "Road Trainers",
    shoeKm: 0,
    emergencyContact:
      input.emergencyName || input.emergencyPhone
        ? { name: (input.emergencyName || "").trim(), phone: (input.emergencyPhone || "").trim() }
        : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  setCurrentAthlete(newProfile);

  // Background sync to unified Supabase database
  syncProfileToSupabase(newProfile).catch(() => {});

  return newProfile;
}

/** Quick sign-in by selecting existing athlete from roster */
export function quickSignIn(profileId: string, pin?: string): { ok: boolean; profile?: AthleteProfile; message?: string } {
  const profiles = listClubProfiles();
  const found = profiles.find((p) => p.id === profileId || p.bib === profileId || p.name.toLowerCase() === profileId.toLowerCase());
  if (!found) {
    return { ok: false, message: "Athlete not found in club database" };
  }

  // If PIN check required and provided
  if (found.pin && pin !== undefined && pin.trim()) {
    if (found.pin !== pin.trim()) {
      return { ok: false, message: "Incorrect PIN for " + found.name };
    }
  }

  setCurrentAthlete(found);
  return { ok: true, profile: found };
}

/** Sync profile to Supabase database (The Resident & The Gruvs unified ecosystem) */
export async function syncProfileToSupabase(profile: AthleteProfile): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "Supabase not connected. Saved offline to device." };
  }

  try {
    const payload = {
      id: profile.id.startsWith("profile-") ? undefined : profile.id,
      name: profile.name,
      role: profile.role,
      age_group: profile.ageGroup,
      club_bib: profile.bib,
      contact: profile.phone || "",
      best_5k_sec: profile.best5k ? parseTimeToSeconds(profile.best5k) : null,
      best_10k_sec: profile.best10k ? parseTimeToSeconds(profile.best10k) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from(IPAC_TABLES.PROFILES).upsert(payload, { onConflict: "id" });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "Synced to The Resident & The Gruvs database" };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function parseTimeToSeconds(timeStr: string): number | null {
  const clean = timeStr.trim();
  const parts = clean.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}
