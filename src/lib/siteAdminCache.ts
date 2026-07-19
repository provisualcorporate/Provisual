const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

function readEnvelope<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.data || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEnvelope<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEnvelope<T> = { savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota
  }
}

export const ADMIN_CACHE_KEYS = {
  albums: "prov_admin_albums_v2",
  videos: "prov_admin_videos_v2",
  gallery: "prov_site_gallery_v2",
  accounts: "prov_admin_accounts_v2",
  photos: (slug: string) => `prov_admin_photos_v2:${slug}`,
};

export function readAdminCache<T>(key: string, ttlMs?: number): T | null {
  return readEnvelope<T>(key, ttlMs);
}

export function writeAdminCache<T>(key: string, data: T) {
  writeEnvelope(key, data);
}

export function clearAdminCache(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearAdminPhotoCaches() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("prov_admin_photos_v2:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Pasta Drive já sincronizada recentemente — evita novo pedido à API. */
const FOLDER_SYNC_PREFIX = "prov_folder_sync_v1:";

export function shouldSkipFolderSync(folderId: string, maxAgeMs = 30 * 60 * 1000): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(FOLDER_SYNC_PREFIX + folderId);
    if (!raw) return false;
    return Date.now() - Number(raw) < maxAgeMs;
  } catch {
    return false;
  }
}

export function markFolderSynced(folderId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FOLDER_SYNC_PREFIX + folderId, String(Date.now()));
  } catch {
    // ignore
  }
}
