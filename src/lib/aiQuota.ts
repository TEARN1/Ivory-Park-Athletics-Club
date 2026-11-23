import { type AthleteProfile, listClubProfiles } from "./auth";
import { getSupabaseClient } from "./supabase";

export interface ProfileAiShare {
  profileId: string;
  name: string;
  bib: string;
  usedToday: number;
  dailyLimit: number;
  remaining: number;
  unlimited: boolean;
  lastUsedAt?: number;
}

export interface ClubAiConfig {
  apiKey: string;
  apiUrl?: string;
  defaultDailyLimit: number;
  updatedAt: number;
  updatedBy?: string;
}

const STORAGE_KEY_CLUB_AI_CONFIG = "ipac_club_ai_config";
const STORAGE_KEY_PROFILE_QUOTAS = "ipac_profile_ai_quotas_";
export const DEFAULT_DAILY_SHARE_LIMIT = 20;

/** Get today's date key string (YYYY-MM-DD) */
export function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Check if an athlete profile has club admin privileges (Coach or IT Lead) */
export function isProfileAdmin(profile: AthleteProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === "coach") return true;
  const note = (profile.titleNote || "").toLowerCase();
  const name = profile.name.toLowerCase();
  if (note.includes("it") || name.includes("asemahle") || name.includes("siyavuya") || profile.bib === "1" || profile.bib === "4") {
    return true;
  }
  return false;
}

/** Load global club AI configuration */
export function loadClubAiConfig(): ClubAiConfig {
  const fallbackKey = typeof localStorage !== "undefined" ? localStorage.getItem("ipac_gemini_api_key") || "" : "";
  const fallbackUrl = typeof localStorage !== "undefined" ? localStorage.getItem("ipac_gemini_api_url") || "" : "";

  if (typeof localStorage === "undefined") {
    return { apiKey: fallbackKey, apiUrl: fallbackUrl, defaultDailyLimit: DEFAULT_DAILY_SHARE_LIMIT, updatedAt: 0 };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLUB_AI_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || fallbackKey,
        apiUrl: parsed.apiUrl || fallbackUrl,
        defaultDailyLimit: typeof parsed.defaultDailyLimit === "number" ? parsed.defaultDailyLimit : DEFAULT_DAILY_SHARE_LIMIT,
        updatedAt: parsed.updatedAt || 0,
        updatedBy: parsed.updatedBy,
      };
    }
  } catch {}

  return { apiKey: fallbackKey, apiUrl: fallbackUrl, defaultDailyLimit: DEFAULT_DAILY_SHARE_LIMIT, updatedAt: 0 };
}

/** Save global club AI configuration (caters for everyone in the club) */
export function saveClubAiConfig(config: Partial<ClubAiConfig>, adminProfile?: AthleteProfile | null): ClubAiConfig {
  const current = loadClubAiConfig();
  const updated: ClubAiConfig = {
    apiKey: config.apiKey !== undefined ? config.apiKey.trim().replace(/^["']|["']$/g, "") : current.apiKey,
    apiUrl: config.apiUrl !== undefined ? config.apiUrl.trim() : current.apiUrl,
    defaultDailyLimit: typeof config.defaultDailyLimit === "number" ? config.defaultDailyLimit : current.defaultDailyLimit,
    updatedAt: Date.now(),
    updatedBy: adminProfile ? `${adminProfile.name} (Bib ${adminProfile.bib})` : current.updatedBy || "Club Admin",
  };

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_CLUB_AI_CONFIG, JSON.stringify(updated));
      localStorage.setItem("ipac_gemini_api_key", updated.apiKey);
      if (updated.apiUrl) {
        localStorage.setItem("ipac_gemini_api_url", updated.apiUrl);
      } else {
        localStorage.removeItem("ipac_gemini_api_url");
      }
    } catch {}
  }

  // Sync to Supabase in background so all other athletes get it automatically
  syncClubAiConfigToCloud(updated).catch(() => {});

  return updated;
}

/** Sync Club AI config to Supabase so it caters for all squad members */
export async function syncClubAiConfigToCloud(config: ClubAiConfig): Promise<{ ok: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "Offline: Supabase not connected." };
  }

  try {
    const { error } = await client.from("ipac_club_settings").upsert({
      key: "club_ai_config",
      value: JSON.stringify(config),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Sync failed" };
  }
}

/** Pull Club AI config from Supabase to cater for this device */
export async function fetchClubAiConfigFromCloud(): Promise<ClubAiConfig | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("ipac_club_settings")
      .select("value")
      .eq("key", "club_ai_config")
      .maybeSingle();

    if (error || !data?.value) return null;
    const parsed = JSON.parse(data.value);
    if (parsed && (parsed.apiKey || parsed.apiUrl)) {
      saveClubAiConfig(parsed);
      return parsed;
    }
  } catch {}
  return null;
}

/** Get current athlete's share status for today */
export function getProfileAiShare(athlete: AthleteProfile | null): ProfileAiShare {
  const cfg = loadClubAiConfig();
  const isAdmin = isProfileAdmin(athlete);
  const profileId = athlete?.id || "guest";
  const name = athlete?.name || "Guest Runner";
  const bib = athlete?.bib || "-";
  const dailyLimit = isAdmin ? 999999 : cfg.defaultDailyLimit;
  const unlimited = isAdmin || dailyLimit >= 99999;

  const todayKey = getTodayDateKey();
  const storageKey = `${STORAGE_KEY_PROFILE_QUOTAS}${profileId}_${todayKey}`;

  let usedToday = 0;
  let lastUsedAt: number | undefined;

  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        usedToday = typeof parsed.count === "number" ? parsed.count : 0;
        lastUsedAt = parsed.lastUsedAt;
      }
    } catch {}
  }

  const remaining = unlimited ? 999999 : Math.max(0, dailyLimit - usedToday);

  return {
    profileId,
    name,
    bib,
    usedToday,
    dailyLimit,
    remaining,
    unlimited,
    lastUsedAt,
  };
}

/** Consume 1 inquiry from this profile's daily share. Returns whether allowed. */
export function consumeProfileAiShare(athlete: AthleteProfile | null): {
  allowed: boolean;
  share: ProfileAiShare;
  reason?: string;
} {
  const share = getProfileAiShare(athlete);
  if (!share.unlimited && share.remaining <= 0) {
    return {
      allowed: false,
      share,
      reason: `Daily cloud AI share of ${share.dailyLimit} inquiries reached for today.`,
    };
  }

  const newCount = share.usedToday + 1;
  const todayKey = getTodayDateKey();
  const storageKey = `${STORAGE_KEY_PROFILE_QUOTAS}${share.profileId}_${todayKey}`;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ count: newCount, lastUsedAt: Date.now() })
      );
    } catch {}
  }

  const updatedShare: ProfileAiShare = {
    ...share,
    usedToday: newCount,
    remaining: share.unlimited ? 999999 : Math.max(0, share.dailyLimit - newCount),
    lastUsedAt: Date.now(),
  };

  return {
    allowed: true,
    share: updatedShare,
  };
}

/** Get a roster of all squad athlete profiles and their current AI share usage today */
export function getSquadAiShareRoster(athletes?: AthleteProfile[]): ProfileAiShare[] {
  const list = athletes && athletes.length > 0 ? athletes : listClubProfiles();
  return list.map((a) => getProfileAiShare(a));
}

/** Reset all athlete shares for today (Admin action) */
export function resetSquadAiShares(athletes?: AthleteProfile[]): void {
  const list = athletes && athletes.length > 0 ? athletes : listClubProfiles();
  const todayKey = getTodayDateKey();
  if (typeof localStorage === "undefined") return;

  const ids = [...list.map((a) => a.id), "guest"];
  for (const id of ids) {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PROFILE_QUOTAS}${id}_${todayKey}`);
    } catch {}
  }
}

/** Reset a single athlete's share for today */
export function resetSingleAthleteShare(athleteId: string): void {
  const todayKey = getTodayDateKey();
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PROFILE_QUOTAS}${athleteId}_${todayKey}`);
  } catch {}
}
