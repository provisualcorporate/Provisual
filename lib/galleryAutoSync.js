import {
  getGalleryPhotosCache,
  getSiteContentFolderId,
  syncAllGalleryPhotosCache,
  listSiteGalleryAlbums,
  ensureGalleryAlbumsMetaSeeded,
  listSiteGalleryAlbumsWithMeta,
  readSettingsValue,
  writeSettingsValue,
  DEFAULT_GALLERY_ALBUMS_META,
  getGalleryAlbumsMeta,
} from "./siteDriveHelpers.js";

export const GALLERY_AUTO_SYNC_KEY = "gallery_auto_sync_state";

/** Intervalo mínimo entre syncs automáticas (evita spam em cada visita). */
const MIN_AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000;

export function getGalleryCacheMaxAgeMs() {
  const hours = Number(process.env.GALLERY_CACHE_MAX_AGE_HOURS || 6);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function isCacheSyncedAtStale(syncedAt, maxAgeMs = getGalleryCacheMaxAgeMs()) {
  if (!syncedAt) return true;
  const ts = new Date(syncedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > maxAgeMs;
}

/** Estado do cache de fotos (para decidir sync automática). */
export async function getGalleryCacheStatus(supabase) {
  const cache = await getGalleryPhotosCache(supabase);
  const maxAgeMs = getGalleryCacheMaxAgeMs();
  const meta = await getGalleryAlbumsMeta(supabase);
  const expectedSlugs = meta.length
    ? meta.map((m) => m.slug).filter(Boolean)
    : DEFAULT_GALLERY_ALBUMS_META.map((m) => m.slug);

  let lastSyncedAt = null;
  let lastSyncedTs = 0;
  const missingSlugs = [];

  for (const slug of expectedSlugs) {
    const entry = cache[slug];
    if (!entry?.photos?.length) {
      missingSlugs.push(slug);
      continue;
    }
    const ts = entry.syncedAt ? new Date(entry.syncedAt).getTime() : 0;
    if (ts > lastSyncedTs) {
      lastSyncedTs = ts;
      lastSyncedAt = entry.syncedAt;
    }
    if (isCacheSyncedAtStale(entry.syncedAt, maxAgeMs)) {
      // pelo menos um álbum expirou
    }
  }

  const stale =
    missingSlugs.length > 0 ||
    !lastSyncedAt ||
    isCacheSyncedAtStale(lastSyncedAt, maxAgeMs);

  return {
    stale,
    lastSyncedAt,
    missingSlugs,
    maxAgeHours: maxAgeMs / (60 * 60 * 1000),
    albumCount: expectedSlugs.length,
    cachedAlbumCount: expectedSlugs.length - missingSlugs.length,
  };
}

let inFlightSync = null;

/**
 * Sincroniza álbuns + fotos Drive → Supabase.
 * Respeita rate-limit (1x/hora) salvo force=true (cron).
 */
export async function runGalleryAutoSync(supabase, createDrive, { force = false } = {}) {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    try {
      if (!force) {
        const state = await readSettingsValue(supabase, GALLERY_AUTO_SYNC_KEY);
        const lastRun = state?.lastRun ? new Date(state.lastRun).getTime() : 0;
        if (lastRun && Date.now() - lastRun < MIN_AUTO_SYNC_INTERVAL_MS) {
          return { skipped: true, reason: "rate_limited", lastRun: state.lastRun };
        }
      }

      const drive = await createDrive();
      await getSiteContentFolderId(drive, supabase, { refresh: true });
      const driveData = await listSiteGalleryAlbums(drive, supabase);
      await ensureGalleryAlbumsMetaSeeded(supabase, driveData.albums);
      await listSiteGalleryAlbumsWithMeta(drive, supabase);
      const photoResults = await syncAllGalleryPhotosCache(drive, supabase);

      const synced = photoResults.filter((r) => r.synced).length;
      const payload = {
        lastRun: new Date().toISOString(),
        synced,
        total: photoResults.length,
        forced: force,
      };
      await writeSettingsValue(supabase, GALLERY_AUTO_SYNC_KEY, payload);

      return { skipped: false, ...payload, results: photoResults };
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

/** Dispara sync em background se cache expirou (não bloqueia resposta HTTP). */
export function scheduleGalleryAutoSync(supabase, createDrive, { force = false } = {}) {
  void runGalleryAutoSync(supabase, createDrive, { force }).catch((err) => {
    console.warn("Gallery auto-sync (background):", err?.message || err);
  });
}

export function isAuthorizedCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
  }
  const auth = String(req.headers?.authorization || "");
  return auth === `Bearer ${secret}`;
}
