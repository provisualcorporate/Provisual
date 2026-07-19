const AUTH_TTL_MS = 50 * 60 * 1000;
const THUMB_META_TTL_MS = 60 * 60 * 1000;

let authCache = { value: null, expires: 0, loading: null };
const thumbMetaCache = new Map();

export const IMAGE_CACHE_CONTROL =
  "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";

export const HOME_API_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

/** Reutiliza cliente Google Auth entre pedidos na mesma instância serverless. */
export async function getCachedGoogleAuth(getGoogleAuth) {
  if (authCache.value && Date.now() < authCache.expires) {
    return authCache.value;
  }
  if (authCache.loading) return authCache.loading;

  authCache.loading = getGoogleAuth()
    .then((result) => {
      authCache.value = result;
      authCache.expires = Date.now() + AUTH_TTL_MS;
      authCache.loading = null;
      return result;
    })
    .catch((err) => {
      authCache.loading = null;
      throw err;
    });

  return authCache.loading;
}

export function clearGoogleAuthCache() {
  authCache = { value: null, expires: 0, loading: null };
}

/** Evita chamar drive.files.get em cada pedido de thumbnail. */
export async function getCachedThumbnailMeta(drive, fileId) {
  const cached = thumbMetaCache.get(fileId);
  if (cached && Date.now() < cached.expires) {
    return cached;
  }

  const fileResponse = await drive.files.get({
    fileId,
    fields: "thumbnailLink, mimeType",
    supportsAllDrives: true,
  });

  const meta = {
    thumbnailLink: fileResponse.data.thumbnailLink,
    mimeType: fileResponse.data.mimeType,
    expires: Date.now() + THUMB_META_TTL_MS,
  };
  thumbMetaCache.set(fileId, meta);
  return meta;
}
