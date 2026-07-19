import { parseAccountDisplay } from "./accountDisplay";
import { supabase } from "./supabase";

const CACHE_KEY = "prov_login_profiles_v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type LoginProfileRow = {
  id: string;
  email: string;
  password: string;
  role: string;
  display_name: string;
};

interface CacheEnvelope {
  savedAt: number;
  profiles: LoginProfileRow[];
}

const LOGIN_FIELDS = "id,email,password,role,display_name";

function slimDisplayName(displayName: string): string {
  const { responsible, companyName } = parseAccountDisplay(displayName);
  return `${responsible}|${companyName}|`;
}

export function slimLoginProfile(row: Record<string, unknown>): LoginProfileRow {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? "").toLowerCase(),
    password: String(row.password ?? ""),
    role: String(row.role ?? "cliente"),
    display_name: slimDisplayName(String(row.display_name || row.displayName || "")),
  };
}

export function readLoginProfilesCache(): LoginProfileRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.profiles?.length || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.profiles;
  } catch {
    return null;
  }
}

export function writeLoginProfilesCache(profiles: LoginProfileRow[]) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEnvelope = { savedAt: Date.now(), profiles };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota
  }
}

export function upsertLoginProfileCache(row: Record<string, unknown>) {
  const slim = slimLoginProfile(row);
  const existing = readLoginProfilesCache() || [];
  const next = existing.filter((p) => p.id !== slim.id && p.email !== slim.email);
  next.push(slim);
  writeLoginProfilesCache(next);
}

export async function fetchLoginProfiles(): Promise<LoginProfileRow[]> {
  const { data, error } = await supabase.from("user_profiles").select(LOGIN_FIELDS);
  if (error) throw error;
  const profiles = (data || []).map((row) => slimLoginProfile(row as Record<string, unknown>));
  writeLoginProfilesCache(profiles);
  return profiles;
}

/** Pré-carrega perfis em background na página de login. */
export function prefetchLoginProfiles() {
  const cached = readLoginProfilesCache();
  if (cached?.length) {
    fetchLoginProfiles().catch(() => {});
    return;
  }
  fetchLoginProfiles().catch(() => {});
}
