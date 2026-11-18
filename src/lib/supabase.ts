import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client integration for Ivory Park Athletics Club.
 * Shares the unified database ecosystem with The Resident and The Grooves,
 * while strictly segregating all data into dedicated 'ipac_*' tables.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
}

export const IPAC_TABLES = {
  ATHLETES: "ipac_athletes",
  SESSIONS: "ipac_sessions",
  ATTENDANCE: "ipac_attendance",
  ROUTES: "ipac_routes",
  ALARMS: "ipac_alarms",
  NOTICES: "ipac_notices",
  PROFILES: "ipac_profiles",
  COACH_CHATS: "ipac_coach_chats",
} as const;

const STORAGE_KEY = "ipac_supabase_config";

export function loadSupabaseConfig(): SupabaseConfig {
  const envUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";
  const envKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

  if (typeof localStorage === "undefined") {
    return { url: envUrl, anonKey: envKey, connected: !!(envUrl && envKey) };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        connected: !!((parsed.url || envUrl) && (parsed.anonKey || envKey)),
      };
    }
  } catch {}

  return { url: envUrl, anonKey: envKey, connected: !!(envUrl && envKey) };
}

export function saveSupabaseConfig(cfg: { url: string; anonKey: string }) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

let cachedClient: SupabaseClient | null = null;
let lastKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = loadSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;

  const keyCombo = `${cfg.url}:${cfg.anonKey}`;
  if (cachedClient && lastKey === keyCombo) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastKey = keyCombo;
    return cachedClient;
  } catch {
    return null;
  }
}

/** Test connectivity to the shared Supabase project */
export async function testSupabaseConnection(url?: string, anonKey?: string): Promise<{ ok: boolean; message: string }> {
  const testUrl = url || loadSupabaseConfig().url;
  const testKey = anonKey || loadSupabaseConfig().anonKey;

  if (!testUrl || !testKey) {
    return {
      ok: false,
      message: "Supabase project URL and anon key are required.",
    };
  }

  try {
    const client = createClient(testUrl, testKey);
    // Ping health or check table availability
    const { error } = await client.from(IPAC_TABLES.NOTICES).select("id").limit(1);
    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      // 42P01 = table does not exist yet (schema script needs to run in Supabase SQL editor)
      if (error.code === "42P01") {
        return {
          ok: true,
          message: "Connected to Supabase project. Dedicated ipac_* schema ready to initialize.",
        };
      }
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: "Connected to shared Supabase database. IPAC namespace active.",
    };
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message || "Cannot connect to Supabase.",
    };
  }
}
