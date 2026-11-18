import type { CoachMessage } from "./geminiCoach";
import type { AthleteProfile } from "./auth";
import { getSupabaseClient, IPAC_TABLES } from "./supabase";

const STORAGE_PREFIX = "ipac_athlete_chats_";

export function getAthleteChatStorageKey(athleteId: string | null): string {
  return athleteId ? `${STORAGE_PREFIX}${athleteId}` : `${STORAGE_PREFIX}guest`;
}

export function createWelcomeMessage(athlete?: AthleteProfile | null): CoachMessage {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (athlete) {
    const sectionStr = athlete.section ? ` from ${athlete.section}` : "";
    const pbStr = athlete.best5k ? ` (5km PB: ${athlete.best5k})` : "";
    return {
      id: "intro-" + athlete.id,
      role: "coach",
      text: `Sanibonani ${athlete.name}! Welcome to your private coaching space${sectionStr}${pbStr}. Your chats here are private to you and synced with our club database. What are we focusing on today?`,
      timestamp,
    };
  }

  return {
    id: "intro-guest",
    role: "coach",
    text: `Sanibonani! Head Coach and Founder here. Whether you want to talk about how your training is feeling, analyze our past finishing times and pace trends, set morning alarms, or schedule our next Highveld session, I am right here with you. What is on your mind?`,
    timestamp,
  };
}

/** Load private chat history for a specific athlete (or guest) */
export function loadAthleteChatHistory(athlete: AthleteProfile | null): CoachMessage[] {
  const storageKey = getAthleteChatStorageKey(athlete?.id || null);
  if (typeof localStorage === "undefined") {
    return [createWelcomeMessage(athlete)];
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      const welcome = [createWelcomeMessage(athlete)];
      localStorage.setItem(storageKey, JSON.stringify(welcome));
      return welcome;
    }
    const parsed: CoachMessage[] = JSON.parse(raw);
    if (!parsed || !parsed.length) {
      const welcome = [createWelcomeMessage(athlete)];
      localStorage.setItem(storageKey, JSON.stringify(welcome));
      return welcome;
    }
    return parsed;
  } catch {
    return [createWelcomeMessage(athlete)];
  }
}

/** Save private chat history for a specific athlete (or guest) */
export function saveAthleteChatHistory(athlete: AthleteProfile | null, messages: CoachMessage[]): void {
  const storageKey = getAthleteChatStorageKey(athlete?.id || null);
  if (typeof localStorage === "undefined") return;

  try {
    // Keep last 150 messages to maintain high performance
    const trimmed = messages.slice(-150);
    localStorage.setItem(storageKey, JSON.stringify(trimmed));
  } catch {}

  // If athlete is signed in and Supabase is configured, sync in background
  if (athlete && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    syncChatMessageToSupabase(athlete.id, lastMsg).catch(() => {});
  }
}

/** Clear private chat history for an athlete */
export function clearAthleteChatHistory(athlete: AthleteProfile | null): CoachMessage[] {
  const storageKey = getAthleteChatStorageKey(athlete?.id || null);
  const fresh = [createWelcomeMessage(athlete)];
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey, JSON.stringify(fresh));
    } catch {}
  }
  return fresh;
}

/** Sync a chat message to the shared Supabase database (The Resident & The Gruvs) */
export async function syncChatMessageToSupabase(
  athleteId: string,
  message: CoachMessage
): Promise<{ ok: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "Offline mode: Supabase not connected." };
  }

  try {
    const payload = {
      id: message.id.startsWith("intro") ? undefined : message.id,
      user_id: athleteId,
      role: message.role,
      text: message.text,
      action: message.action || null,
      report: message.report || null,
      timestamp: message.timestamp,
      created_at: new Date().toISOString(),
    };

    const { error } = await client.from(IPAC_TABLES.COACH_CHATS).insert(payload);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
