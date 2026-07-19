const FOLDERS_KEY = "prov_dash_folders_v1";
const ASSETS_KEY = "prov_dash_assets_v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

function readEnvelope<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.data || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
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
    // quota — ignore
  }
}

export type CachedFolder = {
  id: string;
  name: string;
  date: string;
  parentId?: string | null;
  clientEmail?: string | null;
  trashed?: boolean;
  [key: string]: unknown;
};

export type CachedAsset = {
  id: string;
  name: string;
  type: string;
  captureDate: string;
  uploadDate: string;
  folderId: string;
  driveId?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  trashed?: boolean;
  parentId?: string | null;
  clientEmail?: string | null;
  [key: string]: unknown;
};

export function readDashboardFoldersCache(): CachedFolder[] | null {
  const data = readEnvelope<CachedFolder[]>(FOLDERS_KEY);
  return data?.length ? data : null;
}

export function writeDashboardFoldersCache(folders: CachedFolder[]) {
  if (!folders.length) return;
  writeEnvelope(FOLDERS_KEY, folders);
}

export function readDashboardAssetsCache(): CachedAsset[] | null {
  const data = readEnvelope<CachedAsset[]>(ASSETS_KEY);
  return data?.length ? data : null;
}

export function writeDashboardAssetsCache(assets: CachedAsset[]) {
  if (!assets.length) return;
  const slim = assets.map(({ versions, ...rest }) => rest as CachedAsset);
  writeEnvelope(ASSETS_KEY, slim);
}

export function folderFromCache(row: CachedFolder) {
  return {
    ...row,
    date: new Date(row.date),
  };
}

export function assetFromCache(row: CachedAsset) {
  return {
    ...row,
    captureDate: new Date(row.captureDate),
    uploadDate: new Date(row.uploadDate),
    versions: [],
  };
}

export function folderToCache(folder: { id: string; name: string; date: Date; [key: string]: unknown }): CachedFolder {
  return {
    ...folder,
    date: folder.date.toISOString(),
  };
}

export function assetToCache(asset: {
  id: string;
  name: string;
  type: string;
  captureDate: Date;
  uploadDate: Date;
  folderId: string;
  [key: string]: unknown;
}): CachedAsset {
  const { versions, ...rest } = asset;
  return {
    ...rest,
    captureDate: asset.captureDate.toISOString(),
    uploadDate: asset.uploadDate.toISOString(),
  };
}
