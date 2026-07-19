import { Readable } from "stream";
import { staticPhotosForSlug } from "./galleryStaticPhotos.js";

const SITE_FOLDER_SETTINGS_KEY = "site_drive_folder_id";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export function slugifyName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isDriveFolder(file) {
  return file?.mimeType === FOLDER_MIME;
}

export function isDriveImage(file) {
  if (!file) return false;
  if (file.mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name || "");
}

export function driveMediaUrl(fileId) {
  return `/api/drive/media?id=${encodeURIComponent(fileId)}`;
}

export function driveThumbUrl(fileId) {
  return `/api/drive/thumbnail?id=${encodeURIComponent(fileId)}`;
}

export async function listAllDriveFiles(drive, queryStr, orderByStr = "folder,name,createdTime") {
  const allFiles = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: queryStr,
      orderBy: orderByStr,
      fields:
        "nextPageToken, files(id, name, mimeType, webViewLink, size, thumbnailLink, createdTime, shortcutDetails, starred, trashed)",
      pageSize: 1000,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    if (response.data.files?.length) {
      allFiles.push(...response.data.files);
    }
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles.filter((f) => !f.trashed);
}

export async function listFolderChildren(drive, folderId) {
  const parent = folderId && folderId !== "root" ? folderId : "root";
  const queryStr =
    parent === "root"
      ? "('root' in parents or sharedWithMe = true) and trashed = false"
      : `'${parent}' in parents and trashed = false`;
  return listAllDriveFiles(drive, queryStr);
}

export async function findFolderByName(drive, parentId, folderName) {
  const children = await listFolderChildren(drive, parentId);
  const target = folderName.toLowerCase();
  return children.find((f) => isDriveFolder(f) && f.name?.toLowerCase() === target) || null;
}

export async function findOrCreateFolder(drive, parentId, folderName) {
  const existing = await findFolderByName(drive, parentId, folderName);
  if (existing) return existing;

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: FOLDER_MIME,
      parents: parentId && parentId !== "root" ? [parentId] : undefined,
    },
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });

  return response.data;
}

async function readCachedSiteFolderId(supabase) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SITE_FOLDER_SETTINGS_KEY)
      .single();
    if (!error && data?.value?.folderId) return data.value.folderId;
  } catch (_) {}
  return null;
}

async function cacheSiteFolderId(supabase, folderId) {
  if (!supabase || !folderId) return;
  try {
    await supabase.from("settings").upsert({
      key: SITE_FOLDER_SETTINGS_KEY,
      value: { folderId, updatedAt: new Date().toISOString() },
    });
  } catch (_) {}
}

/** Resolve a pasta de conteúdo do site (My Drive > Site, primeiro nível). */
export async function getSiteContentFolderId(drive, supabase, { refresh = false } = {}) {
  if (!refresh) {
    const cached = await readCachedSiteFolderId(supabase);
    if (cached) return cached;
  }

  const rootChildren = await listFolderChildren(drive, "root");
  let siteFolder = rootChildren.find(
    (f) => isDriveFolder(f) && f.name?.toLowerCase() === "site",
  );

  if (!siteFolder) {
    siteFolder = await findOrCreateFolder(drive, "root", "site");
  }

  await cacheSiteFolderId(supabase, siteFolder.id);
  return siteFolder.id;
}

export async function moveDriveItem(drive, fileId, newParentId, oldParentId) {
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: oldParentId,
    supportsAllDrives: true,
    fields: "id, parents",
  });
}

/** Move recursivamente o conteúdo de uma subpasta para o destino (mescla pastas homónimas). */
export async function mergeFolderContents(drive, sourceFolderId, destFolderId) {
  const children = await listFolderChildren(drive, sourceFolderId);
  for (const child of children) {
    if (isDriveFolder(child)) {
      const destSub = await findOrCreateFolder(drive, destFolderId, child.name);
      await mergeFolderContents(drive, child.id, destSub.id);
      try {
        await drive.files.update({
          fileId: child.id,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
      } catch (_) {}
    } else {
      await moveDriveItem(drive, child.id, destFolderId, sourceFolderId);
    }
  }
}

export async function resolveSiteSubfolderId(drive, supabase, subpath = "") {
  const siteId = await getSiteContentFolderId(drive, supabase);
  if (!subpath) return siteId;

  const parts = subpath.split("/").filter(Boolean);
  let currentId = siteId;
  for (const part of parts) {
    const folder = await findOrCreateFolder(drive, currentId, part);
    currentId = folder.id;
  }
  return currentId;
}

export function mapDrivePhoto(file) {
  return {
    id: file.id,
    name: file.name,
    url: driveMediaUrl(file.id),
    thumbnailUrl: driveThumbUrl(file.id),
    mimeType: file.mimeType,
  };
}

export async function listSiteLibraryPhotos(drive, supabase) {
  const siteId = await getSiteContentFolderId(drive, supabase);
  const files = await listFolderChildren(drive, siteId);
  return files.filter(isDriveImage).map(mapDrivePhoto);
}

export async function listSiteGalleryAlbums(drive, supabase) {
  const siteId = await getSiteContentFolderId(drive, supabase);
  const galeriaFolder = await findFolderByName(drive, siteId, "galeria");

  if (!galeriaFolder) {
    const library = await listSiteLibraryPhotos(drive, supabase);
    if (library.length) {
      return {
        siteFolderId: siteId,
        albums: [
          {
            slug: "biblioteca",
            name: "Biblioteca",
            folderId: siteId,
            coverUrl: library[0].thumbnailUrl,
            coverDriveId: library[0].id,
            photoCount: library.length,
          },
        ],
      };
    }
    const fromMeta = await albumsFromStoredMeta(supabase, siteId);
    if (fromMeta) return fromMeta;
    return { siteFolderId: siteId, albums: [] };
  }

  const albumFolders = (await listFolderChildren(drive, galeriaFolder.id)).filter(isDriveFolder);
  if (!albumFolders.length) {
    const fromMeta = await albumsFromStoredMeta(supabase, siteId);
    if (fromMeta) return { ...fromMeta, galeriaFolderId: galeriaFolder.id };
  }

  const albums = await Promise.all(
    albumFolders.map(async (folder) => {
      const photos = (await listFolderChildren(drive, folder.id)).filter(isDriveImage);
      const coverPhoto =
        photos.find((p) => /^cover\./i.test(p.name || "")) ||
        photos.find((p) => /cover/i.test(p.name || "")) ||
        photos[0];
      return {
        slug: slugifyName(folder.name),
        name: folder.name,
        folderId: folder.id,
        coverUrl: coverPhoto ? driveThumbUrl(coverPhoto.id) : null,
        coverDriveId: coverPhoto?.id || null,
        photoCount: photos.length,
      };
    }),
  );

  return { siteFolderId: siteId, galeriaFolderId: galeriaFolder.id, albums };
}

/** Lista rápida para admin: pastas + meta Supabase, sem varrer fotos de cada álbum. */
export async function listSiteGalleryAlbumsSummary(drive, supabase) {
  const siteId = await getSiteContentFolderId(drive, supabase);
  const galeriaFolder = await findFolderByName(drive, siteId, "galeria");

  if (!galeriaFolder) {
    const library = await listSiteLibraryPhotos(drive, supabase);
    if (library.length) {
      return {
        siteFolderId: siteId,
        albums: [
          {
            slug: "biblioteca",
            name: "Biblioteca",
            folderId: siteId,
            coverUrl: library[0].thumbnailUrl,
            coverDriveId: library[0].id,
            photoCount: library.length,
          },
        ],
      };
    }
    const fromMeta = await albumsFromStoredMeta(supabase, siteId);
    if (fromMeta) return fromMeta;
    return { siteFolderId: siteId, albums: [] };
  }

  const albumFolders = (await listFolderChildren(drive, galeriaFolder.id)).filter(isDriveFolder);
  if (!albumFolders.length) {
    const fromMeta = await albumsFromStoredMeta(supabase, siteId);
    if (fromMeta) return { ...fromMeta, galeriaFolderId: galeriaFolder.id };
  }

  const meta = await ensureGalleryAlbumsMetaSeeded(supabase, albumFolders.map((folder) => ({
    slug: slugifyName(folder.name),
    name: folder.name,
  })));

  const albums = albumFolders.map((folder) => {
    const slug = slugifyName(folder.name);
    const merged = mergeAlbumWithMeta(
      {
        slug,
        name: folder.name,
        folderId: folder.id,
        coverUrl: null,
        coverDriveId: null,
        photoCount: 0,
      },
      meta,
    );
    const metaEntry = meta.find((entry) => entry.slug === slug);
    return resolveAlbumCoverUrls({
      slug,
      title: merged.title || merged.name,
      subtitle: merged.subtitle,
      folderId: folder.id,
      coverDriveId: metaEntry?.coverDriveId || merged.coverDriveId || null,
      coverImageUrl: metaEntry?.coverImageUrl,
      coverUrl: merged.coverUrl,
      photoCount: metaEntry?.photoCount ?? merged.photoCount ?? 0,
    });
  });

  return { siteFolderId: siteId, galeriaFolderId: galeriaFolder.id, albums };
}

function guessMimeType(filename) {
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Carrega ficheiro para uma subpasta do site (ex: home, galeria/mmec, servicos/branding-design). */
export async function uploadFileToSiteFolder(
  drive,
  supabase,
  subpath,
  filename,
  buffer,
  mimeType,
  { skipIfExists = true } = {},
) {
  const folderId = await resolveSiteSubfolderId(drive, supabase, subpath);
  const children = await listFolderChildren(drive, folderId);
  const existing = children.find((f) => f.name === filename);

  if (existing && skipIfExists) {
    return { id: existing.id, url: driveMediaUrl(existing.id), skipped: true };
  }

  const bufferStream = new Readable();
  bufferStream.push(buffer);
  bufferStream.push(null);

  const response = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: mimeType || guessMimeType(filename), body: bufferStream },
    supportsAllDrives: true,
    fields: "id, name, mimeType",
  });

  return {
    id: response.data.id,
    url: driveMediaUrl(response.data.id),
    skipped: false,
  };
}

export async function listSiteServiceImages(drive, supabase) {
  const siteId = await getSiteContentFolderId(drive, supabase);
  const servicosFolder = await findFolderByName(drive, siteId, "servicos");
  if (!servicosFolder) return {};

  const map = {};
  const children = await listFolderChildren(drive, servicosFolder.id);

  for (const child of children) {
    if (isDriveImage(child)) {
      const slug = slugifyName(child.name.replace(/\.[^.]+$/, ""));
      map[slug] = driveMediaUrl(child.id);
      continue;
    }
    if (!isDriveFolder(child)) continue;

    const slug = slugifyName(child.name);
    const photos = (await listFolderChildren(drive, child.id)).filter(isDriveImage);
    const cover =
      photos.find((p) => /^cover\./i.test(p.name || "")) ||
      photos.find((p) => /cover/i.test(p.name || "")) ||
      photos[0];
    if (cover) map[slug] = driveMediaUrl(cover.id);
  }

  return map;
}

/** Indexa todas as imagens em site/ (recursivo) por nome de ficheiro. */
let siteImageIndexCache = { map: null, expires: 0, loading: null };
const SITE_INDEX_TTL_MS = 10 * 60 * 1000;

export async function buildSiteImageIndex(drive, supabase) {
  if (siteImageIndexCache.map && Date.now() < siteImageIndexCache.expires) {
    return siteImageIndexCache.map;
  }
  if (siteImageIndexCache.loading) return siteImageIndexCache.loading;

  siteImageIndexCache.loading = (async () => {
    const siteId = await getSiteContentFolderId(drive, supabase);
    const index = new Map();

    async function scanFolder(folderId) {
      const children = await listFolderChildren(drive, folderId);
      for (const child of children) {
        if (isDriveImage(child)) {
          const key = (child.name || "").toLowerCase();
          const fileId = driveImageFileId(child);
          if (fileId && !index.has(key)) index.set(key, driveMediaUrl(fileId));
        } else if (isDriveFolder(child)) {
          await scanFolder(child.id);
        }
      }
    }

    await scanFolder(siteId);
    siteImageIndexCache.map = index;
    siteImageIndexCache.expires = Date.now() + SITE_INDEX_TTL_MS;
    siteImageIndexCache.loading = null;
    return index;
  })().catch((err) => {
    siteImageIndexCache.loading = null;
    throw err;
  });

  return siteImageIndexCache.loading;
}

export function resolveSiteImageUrl(url, index) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("/api/drive/") || /^https?:\/\//i.test(url)) return url;
  const basename = decodeURIComponent(url.split("/").pop() || "").toLowerCase();
  return index.get(basename) || null;
}

/** Imagens da home servidas de /INICIO/ (proxy Drive devolve 404 para muitos IDs da pasta site/). */
const HOME_STATIC_FALLBACKS = {
  "coberturas.jpg": "/INICIO/Coberturas.jpg",
  "mmec40-scaled.jpg": "/INICIO/MMEC40-scaled.jpg",
  "paineis5-scaled.jpg": "/INICIO/PAINEIS5-scaled.jpg",
  "comunidade.jpg": "/INICIO/COmunidade.jpg",
  "sobre.webp": "/INICIO/sobre.webp",
  "producao-grafica.webp": "/INICIO/producao-grafica.webp",
  "fotografo.png": "/INICIO/Fotografo.png",
  "captura de ecrã 2026-05-23, às 14.09.11.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.09.11.png",
  "captura de ecrã 2026-05-23, às 14.10.07.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.10.07.png",
  "captura de ecrã 2026-05-23, às 14.10.43.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.10.43.png",
  "captura de ecrã 2026-05-23, às 14.16.15.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.16.15.png",
  "artboard-1.svg": "/INICIO/clientes/Artboard-1.svg",
  "artboard-2.svg": "/INICIO/clientes/Artboard-2.svg",
  "artboard-3.svg": "/INICIO/clientes/Artboard-3.svg",
  "artboard-4.svg": "/INICIO/clientes/Artboard-4.svg",
  "artboard-5.svg": "/INICIO/clientes/Artboard-5.svg",
  "artboard-6.svg": "/INICIO/clientes/Artboard-6.svg",
  "artboard-7.svg": "/INICIO/clientes/Artboard-7.svg",
  "artboard-8.svg": "/INICIO/clientes/Artboard-8.svg",
  "artboard-9.svg": "/INICIO/clientes/Artboard-9.svg",
  "artboard-10.svg": "/INICIO/clientes/Artboard-10.svg",
  "at.png": "/INICIO/clientes/AT.png",
  "up.png": "/INICIO/clientes/Up.png",
};

const HOME_DEFAULT_FILES = {
  heroBackground: "coberturas.jpg",
  aboutImage: "sobre.webp",
  processBackground: "producao-grafica.webp",
  teamBanner: "coberturas.jpg",
  contactPhoto: "Fotografo.png",
  slides: ["mmec40-scaled.jpg", "paineis5-scaled.jpg", "coberturas.jpg", "comunidade.jpg"],
  team: [
    "captura de ecrã 2026-05-23, às 14.09.11.png",
    "captura de ecrã 2026-05-23, às 14.10.07.png",
    "captura de ecrã 2026-05-23, às 14.10.43.png",
    "captura de ecrã 2026-05-23, às 14.16.15.png",
  ],
  eventTypes: ["mmec40-scaled.jpg", "paineis5-scaled.jpg", "coberturas.jpg", "comunidade.jpg"],
  clientLogos: [
    "Artboard-1.svg",
    "Artboard-2.svg",
    "Artboard-3.svg",
    "Artboard-4.svg",
    "Artboard-5.svg",
    "Artboard-6.svg",
    "Artboard-7.svg",
    "Artboard-8.svg",
    "Artboard-9.svg",
    "Artboard-10.svg",
    "AT.png",
    "Up.png",
  ],
  news: ["a70a8812-300x200.jpg", "a70a8732-1-300x200.jpg", "first-panel-3-300x190.jpg"],
};

function extractDriveFileIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function driveImageFileId(file) {
  if (
    file?.mimeType === "application/vnd.google-apps.shortcut" &&
    file.shortcutDetails?.targetId
  ) {
    return file.shortcutDetails.targetId;
  }
  return file?.id;
}

/** Resolve imagem: prioriza ficheiros estáticos /INICIO/; Drive só para nomes sem fallback. */
function pickImage(url, fallbackFile, index) {
  const fallbackKey = (fallbackFile || "").toLowerCase();
  const staticUrl = fallbackKey ? HOME_STATIC_FALLBACKS[fallbackKey] : null;
  if (staticUrl) return staticUrl;

  const fallbackUrl = fallbackKey ? index.get(fallbackKey) : null;

  if (url && url.startsWith("/api/drive/")) {
    const storedId = extractDriveFileIdFromUrl(url);
    if (storedId) {
      for (const driveUrl of index.values()) {
        if (driveUrl.includes(storedId)) return driveUrl;
      }
    }
    if (fallbackUrl) return fallbackUrl;
    return url;
  }

  const fromPath = resolveSiteImageUrl(url, index);
  if (fromPath) return fromPath;
  return fallbackUrl || url || null;
}

/** True quando ainda existem caminhos /INICIO/ ou URLs por resolver. */
export function homeContentNeedsDriveResolve(content) {
  if (!content || typeof content !== "object") return true;

  const urls = [
    content.hero?.backgroundImage,
    content.aboutImage,
    content.processBackground,
    content.teamBanner,
    content.contact?.photo,
    ...(content.slides || []).map((slide) => slide?.image),
    ...(content.teamMembers || []).map((member) => member?.image),
    ...(content.eventTypes || []).map((item) => item?.image),
    ...(content.clientLogos || []).map((item) => item?.image),
    ...(content.newsItems || []).map((item) => item?.image),
  ];

  return urls.some((url) => {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("/api/drive/") || /^https?:\/\//i.test(url)) return false;
    return true;
  });
}

/** Grava conteúdo com URLs já resolvidas no Supabase para evitar scans repetidos. */
export async function persistResolvedHomeContentIfNeeded(supabase, key, before, after) {
  if (!supabase || !after || typeof after !== "object") return;
  try {
    if (JSON.stringify(before ?? null) === JSON.stringify(after)) return;
    await supabase.from("settings").upsert({ key, value: after });
  } catch (err) {
    console.warn("Home content persist skipped:", err?.message || err);
  }
}

/** Resolve imagens da home (estáticas /INICIO/ primeiro; índice Drive opcional). */
export function resolveHomeContentWithIndex(content, index = new Map()) {
  const base = content && typeof content === "object" ? content : {};

  const hero = { ...(base.hero || {}) };
  hero.backgroundImage = pickImage(
    hero.backgroundImage,
    HOME_DEFAULT_FILES.heroBackground,
    index,
  );

  const slides = (base.slides?.length ? base.slides : HOME_DEFAULT_FILES.slides.map(() => ({}))).map(
    (slide, i) => ({
      ...slide,
      image: pickImage(slide.image, HOME_DEFAULT_FILES.slides[i] || "", index),
    }),
  );

  const teamMembers = (
    base.teamMembers?.length ? base.teamMembers : HOME_DEFAULT_FILES.team.map(() => ({}))
  ).map((member, i) => ({
    ...member,
    image: pickImage(member.image, HOME_DEFAULT_FILES.team[i] || "", index),
  }));

  const eventTypes = (
    base.eventTypes?.length ? base.eventTypes : HOME_DEFAULT_FILES.eventTypes.map(() => ({}))
  ).map((item, i) => ({
    ...item,
    image: pickImage(item.image, HOME_DEFAULT_FILES.eventTypes[i] || "", index),
  }));

  const clientLogos = (
    base.clientLogos?.length ? base.clientLogos : HOME_DEFAULT_FILES.clientLogos.map(() => ({}))
  )
    .map((item, i) => ({
      ...item,
      image:
        pickImage(item.image, HOME_DEFAULT_FILES.clientLogos[i] || "", index) || item.image,
    }))
    .filter((item) => {
      const baseName = decodeURIComponent((item.image || "").split("/").pop() || "").toLowerCase();
      return !["artboard-11.svg", "artboard-15.svg", "artboard-41.svg", "artboard-44.svg", "artboard-10-copy.svg"].includes(
        baseName,
      );
    });

  const newsItems = (base.newsItems?.length ? base.newsItems : HOME_DEFAULT_FILES.news.map(() => ({}))).map(
    (item, i) => ({
      ...item,
      image: pickImage(item.image, HOME_DEFAULT_FILES.news[i] || "", index),
    }),
  );

  return {
    ...base,
    hero,
    slides,
    aboutImage: pickImage(base.aboutImage, HOME_DEFAULT_FILES.aboutImage, index),
    processBackground: pickImage(
      base.processBackground,
      HOME_DEFAULT_FILES.processBackground,
      index,
    ),
    teamBanner: pickImage(base.teamBanner, HOME_DEFAULT_FILES.teamBanner, index),
    teamMembers,
    eventTypes: eventTypes.length ? eventTypes : base.eventTypes,
    clientLogos: clientLogos.length ? clientLogos : base.clientLogos,
    newsItems: newsItems.length ? newsItems : base.newsItems,
    contact: {
      ...(base.contact || {}),
      photo: pickImage(base.contact?.photo, HOME_DEFAULT_FILES.contactPhoto, index),
    },
  };
}

export async function resolveHomeContentImages(drive, supabase, content) {
  let index = new Map();
  try {
    index = await buildSiteImageIndex(drive, supabase);
  } catch (err) {
    console.warn("Site image index skipped, static fallbacks only:", err?.message || err);
  }
  return resolveHomeContentWithIndex(content, index);
}

/** @deprecated alias */
export const resolveHomeContentStaticOnly = resolveHomeContentWithIndex;

export const GALLERY_PHOTOS_CACHE_KEY = "site_gallery_photos_cache";
/** Profundidade máxima de subpastas ao indexar fotos de um álbum (ex.: 12º nível). */
export const MAX_GALLERY_FOLDER_DEPTH = 12;

export async function getGalleryPhotosCache(supabase) {
  const raw = await readSettingsValue(supabase, GALLERY_PHOTOS_CACHE_KEY);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export async function saveGalleryPhotosCacheEntry(supabase, slug, entry) {
  const cache = await getGalleryPhotosCache(supabase);
  cache[slug] = {
    folderId: entry.folderId || null,
    photos: entry.photos || [],
    syncedAt: new Date().toISOString(),
  };
  await writeSettingsValue(supabase, GALLERY_PHOTOS_CACHE_KEY, cache);
}

export async function removeGalleryPhotosCacheEntry(supabase, slug) {
  const cache = await getGalleryPhotosCache(supabase);
  if (!cache[slug]) return;
  delete cache[slug];
  await writeSettingsValue(supabase, GALLERY_PHOTOS_CACHE_KEY, cache);
}

async function findFolderBySlugRecursive(drive, parentId, slug, depth = 0, maxDepth = MAX_GALLERY_FOLDER_DEPTH) {
  if (depth > maxDepth) return null;

  const children = (await listFolderChildren(drive, parentId)).filter(isDriveFolder);
  const target = slug.toLowerCase();

  for (const child of children) {
    const childSlug = slugifyName(child.name || "");
    if (childSlug === slug || String(child.name || "").toLowerCase() === target) {
      return child;
    }
  }

  for (const child of children) {
    const found = await findFolderBySlugRecursive(drive, child.id, slug, depth + 1, maxDepth);
    if (found) return found;
  }

  return null;
}

/** Localiza pasta do álbum em galeria/ ou em qualquer subnível até MAX_GALLERY_FOLDER_DEPTH. */
export async function findAlbumFolderDeep(drive, supabase, slug) {
  const direct = await findGalleryAlbumFolder(drive, supabase, slug);
  if (direct) return direct;

  const siteId = await getSiteContentFolderId(drive, supabase);
  return findFolderBySlugRecursive(drive, siteId, slug);
}

/** Recolhe imagens na pasta e subpastas (até 12 níveis). */
export async function listImagesInFolderDeep(
  drive,
  folderId,
  depth = 0,
  maxDepth = MAX_GALLERY_FOLDER_DEPTH,
  pathPrefix = "",
) {
  const photos = [];
  const children = await listFolderChildren(drive, folderId);

  for (const child of children) {
    if (isDriveImage(child)) {
      const mapped = mapDrivePhoto(child);
      if (pathPrefix) mapped.name = `${pathPrefix}${child.name}`;
      photos.push(mapped);
    } else if (isDriveFolder(child) && depth < maxDepth) {
      const subPrefix = `${pathPrefix}${child.name}/`;
      photos.push(
        ...(await listImagesInFolderDeep(drive, child.id, depth + 1, maxDepth, subPrefix)),
      );
    }
  }

  return photos;
}

export async function getGalleryAlbumPhotos(supabase, slug) {
  const cache = await getGalleryPhotosCache(supabase);
  const entry = cache[slug];
  if (!entry?.photos?.length) return null;
  return {
    slug,
    folderId: entry.folderId || null,
    photos: entry.photos,
    fromCache: true,
    syncedAt: entry.syncedAt || null,
  };
}

/** Sincroniza fotos do Drive → Supabase (uma vez; leituras seguintes usam cache). */
export async function syncGalleryAlbumPhotosFromDrive(drive, supabase, slug) {
  if (slug === "biblioteca") {
    const siteId = await getSiteContentFolderId(drive, supabase);
    const photos = await listImagesInFolderDeep(drive, siteId);
    await saveGalleryPhotosCacheEntry(supabase, slug, { folderId: siteId, photos });
    const cover = photos.find((p) => /^cover\./i.test(p.name || "")) || photos[0];
    if (cover) {
      await upsertGalleryAlbumMetaEntry(supabase, {
        slug,
        folderId: siteId,
        photoCount: photos.length,
        coverDriveId: cover.id,
      });
    }
    return { slug, folderId: siteId, photos, synced: true, fromCache: false };
  }

  const meta = await getGalleryAlbumsMeta(supabase);
  const metaEntry = meta.find((m) => m.slug === slug);

  let albumFolder = null;
  if (metaEntry?.folderId) {
    try {
      const probe = await listFolderChildren(drive, metaEntry.folderId);
      if (probe) albumFolder = { id: metaEntry.folderId, name: metaEntry.title || slug };
    } catch (_) {}
  }
  if (!albumFolder) {
    albumFolder = await findAlbumFolderDeep(drive, supabase, slug);
  }

  let photos = [];
  let folderId = albumFolder?.id || null;

  if (albumFolder) {
    photos = await listImagesInFolderDeep(drive, albumFolder.id);
  } else if (metaEntry?.coverDriveId) {
    try {
      const coverFile = await drive.files.get({
        fileId: metaEntry.coverDriveId,
        fields: "id, parents, name",
        supportsAllDrives: true,
      });
      folderId = coverFile.data.parents?.[0] || null;
      if (folderId) {
        photos = await listImagesInFolderDeep(drive, folderId);
        albumFolder = { id: folderId, name: metaEntry.title || slug };
      }
    } catch (err) {
      console.warn(`Capa Drive (${slug}) inacessível:`, err?.message || err);
    }
  }

  if (!photos.length) {
    const staticPhotos = staticPhotosForSlug(slug);
    if (staticPhotos.length) {
      await saveGalleryPhotosCacheEntry(supabase, slug, { folderId: null, photos: staticPhotos });
      await upsertGalleryAlbumMetaEntry(supabase, {
        slug,
        photoCount: staticPhotos.length,
      });
      return {
        slug,
        folderId: null,
        photos: staticPhotos,
        synced: true,
        fromCache: false,
        source: "static",
      };
    }
    return { slug, folderId: null, photos: [], synced: false, fromCache: false };
  }
  await saveGalleryPhotosCacheEntry(supabase, slug, {
    folderId,
    photos,
  });

  const coverPhoto =
    photos.find((p) => /^cover\./i.test(p.name || "")) ||
    photos.find((p) => p.id === metaEntry?.coverDriveId) ||
    photos[0];

  const coverImageUrl =
    coverPhoto?.url?.startsWith("/INICIO/") || coverPhoto?.thumbnailUrl?.startsWith("/INICIO/")
      ? coverPhoto.url || coverPhoto.thumbnailUrl
      : STATIC_GALLERY_IMAGES[slug] || null;

  await upsertGalleryAlbumMetaEntry(supabase, {
    slug,
    folderId,
    photoCount: photos.length,
    coverDriveId: coverPhoto?.id?.startsWith("static-") ? null : coverPhoto?.id || null,
    coverImageUrl,
  });

  return {
    slug,
    folderId,
    photos,
    synced: true,
    fromCache: false,
  };
}

export async function syncAllGalleryPhotosCache(drive, supabase) {
  const meta = await getGalleryAlbumsMeta(supabase);
  const slugs = meta.length
    ? meta.map((m) => m.slug).filter(Boolean)
    : DEFAULT_GALLERY_ALBUMS_META.map((m) => m.slug);

  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug));
    } catch (err) {
      results.push({ slug, photos: [], synced: false, error: err?.message || String(err) });
    }
  }
  return results;
}

/** Lê fotos: cache Supabase primeiro; Drive só se refresh ou cache vazio. */
export async function listSiteGalleryAlbumPhotos(drive, supabase, slug, { refresh = false } = {}) {
  if (!refresh) {
    const cached = await getGalleryAlbumPhotos(supabase, slug);
    if (cached) return cached;
  }

  if (!drive) {
    const cached = await getGalleryAlbumPhotos(supabase, slug);
    return cached || { slug, folderId: null, photos: [], fromCache: !!cached };
  }

  try {
    return await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug);
  } catch (err) {
    const cached = await getGalleryAlbumPhotos(supabase, slug);
    if (cached) return { ...cached, driveError: err?.message || String(err) };
    throw err;
  }
}

export const GALLERY_ALBUMS_META_KEY = "site_gallery_albums_meta";
export const SITE_VIDEOS_KEY = "site_videos";

export const DEFAULT_SITE_VIDEOS = [
  {
    slug: "institucional-provisual",
    title: "ProVisual Corporate — Institucional",
    youtubeId: "WumPsSTFzaA",
    image: "https://img.youtube.com/vi/WumPsSTFzaA/hqdefault.jpg",
  },
  {
    slug: "provisual-youtube",
    title: "ProVisual Corporate",
    youtubeId: "DVgtNr_bq1g",
    image: "https://img.youtube.com/vi/DVgtNr_bq1g/hqdefault.jpg",
  },
];

export async function readSettingsValue(supabase, key) {
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function writeSettingsValue(supabase, key, value) {
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) throw error;
}

export async function getGalleryAlbumsMeta(supabase) {
  const raw = await readSettingsValue(supabase, GALLERY_ALBUMS_META_KEY);
  return Array.isArray(raw) ? raw : [];
}

export async function saveGalleryAlbumsMeta(supabase, meta) {
  await writeSettingsValue(supabase, GALLERY_ALBUMS_META_KEY, meta);
}

export function mergeAlbumWithMeta(album, metaList) {
  const m = metaList.find((x) => x.slug === album.slug);
  return {
    ...album,
    title: m?.title || album.name,
    subtitle: m?.subtitle || `${m?.photoCount ?? album.photoCount ?? 0} fotos`,
    coverDriveId: m?.coverDriveId || album.coverDriveId || null,
    photoCount: m?.photoCount ?? album.photoCount ?? 0,
  };
}

const STATIC_GALLERY_IMAGES = {
  "autoridade-tributaria": "/INICIO/galeria/autoridade-tributaria.jpg",
  "construcao-obras": "/INICIO/galeria/construcao-quitunda.jpg",
  mmec: "/INICIO/galeria/mmec.jpg",
  gmt: "/INICIO/galeria/gmt.jpg",
  agricultura: "/INICIO/galeria/agricultura-machambas.jpg",
};

export const DEFAULT_GALLERY_ALBUMS_META = [
  {
    slug: "autoridade-tributaria",
    title: "Autoridade Tributária de Moçambique",
    subtitle: "Tomada de Posse",
  },
  {
    slug: "construcao-obras",
    title: "Contrução/ Obras",
    subtitle: "Contrução da estrada de Quitunda",
  },
  {
    slug: "mmec",
    title: "MMEC",
    subtitle: "Mozambique Mining and Energy Conference",
  },
  {
    slug: "gmt",
    title: "GMT",
    subtitle: "GMT Mulheres em Energia Limpa e Rede de Ação Climática para promover a inclusão",
  },
  {
    slug: "agricultura",
    title: "Agricultura",
    subtitle: "Machambas",
  },
];

export async function ensureGalleryAlbumsMetaSeeded(supabase, driveAlbums = []) {
  const meta = await getGalleryAlbumsMeta(supabase);
  let changed = false;

  for (const album of driveAlbums) {
    if (!album?.slug) continue;
    const idx = meta.findIndex((entry) => entry.slug === album.slug);
    const patch = {
      slug: album.slug,
      coverDriveId: album.coverDriveId || null,
      photoCount: typeof album.photoCount === "number" ? album.photoCount : 0,
    };

    if (idx === -1) {
      meta.push({
        ...patch,
        title: album.name || album.slug,
        subtitle: album.subtitle || `${patch.photoCount} fotos`,
      });
      changed = true;
      continue;
    }

    const current = meta[idx];
    const next = { ...current };
    let entryChanged = false;
    if (album.coverDriveId && current.coverDriveId !== album.coverDriveId) {
      next.coverDriveId = album.coverDriveId;
      entryChanged = true;
    }
    if (typeof album.photoCount === "number" && current.photoCount !== album.photoCount) {
      next.photoCount = album.photoCount;
      entryChanged = true;
    }
    if (entryChanged) {
      meta[idx] = next;
      changed = true;
    }
  }

  for (const defaults of DEFAULT_GALLERY_ALBUMS_META) {
    const inDrive = driveAlbums.some((album) => album.slug === defaults.slug);
    if (!inDrive) continue;

    const idx = meta.findIndex((entry) => entry.slug === defaults.slug);
    if (idx === -1) {
      meta.push({ ...defaults });
      changed = true;
      continue;
    }

    const current = meta[idx];
    if (!current.title || current.title === current.slug) {
      meta[idx] = { ...current, title: defaults.title };
      changed = true;
    }
    if (!current.subtitle) {
      meta[idx] = { ...meta[idx], subtitle: defaults.subtitle };
      changed = true;
    }
  }

  if (changed) {
    await saveGalleryAlbumsMeta(supabase, meta);
  }

  return meta;
}

export function albumCoverImageUrl(album) {
  if (album.coverDriveId) {
    return driveThumbUrl(album.coverDriveId) + "&sz=800";
  }
  if (album.coverUrl?.includes("/api/drive/")) {
    return album.coverUrl.includes("sz=") ? album.coverUrl : `${album.coverUrl}&sz=800`;
  }
  return "";
}

/** Converte entradas de meta (Supabase) em álbuns para admin/site. */
export function resolveAlbumCoverUrls(entry) {
  const staticImage =
    entry.coverImageUrl ||
    STATIC_GALLERY_IMAGES[entry.slug] ||
    (entry.coverUrl?.startsWith("/INICIO/") ? entry.coverUrl : "") ||
    "";
  const merged = {
    slug: entry.slug,
    name: entry.title || entry.slug,
    title: entry.title || entry.slug,
    subtitle: entry.subtitle || `${entry.photoCount ?? 0} fotos`,
    folderId: entry.folderId || null,
    coverUrl: staticImage || entry.coverUrl || null,
    coverDriveId: entry.coverDriveId || null,
    photoCount: entry.photoCount ?? 0,
  };
  const driveImage = merged.coverDriveId ? albumCoverImageUrl(merged) : "";
  const image = staticImage || driveImage;
  return { ...merged, image };
}

export function buildAlbumsFromMetaList(metaList) {
  return metaList.map((entry) => resolveAlbumCoverUrls(entry));
}

/** Álbuns a partir de meta Supabase / defaults — quando Drive falha ou galeria vazia. */
export async function listGalleryAlbumsOffline(supabase) {
  let meta = await getGalleryAlbumsMeta(supabase);
  if (!meta.length) meta = DEFAULT_GALLERY_ALBUMS_META;
  return { siteFolderId: null, albums: buildAlbumsFromMetaList(meta) };
}

async function albumsFromStoredMeta(supabase, siteFolderId = null) {
  const meta = await getGalleryAlbumsMeta(supabase);
  if (!meta.length) return null;
  const photoCache = await getGalleryPhotosCache(supabase);
  const albums = meta.map((entry) => {
    const first = photoCache[entry.slug]?.photos?.[0];
    const fromCache =
      first?.thumbnailUrl?.startsWith("/INICIO/") || first?.url?.startsWith("/INICIO/")
        ? first.thumbnailUrl || first.url
        : null;
    return resolveAlbumCoverUrls({
      ...entry,
      coverImageUrl: entry.coverImageUrl || fromCache,
    });
  });
  return { siteFolderId, albums };
}

export async function listSiteGalleryAlbumsWithMeta(drive, supabase) {
  const data = await listSiteGalleryAlbums(drive, supabase);
  const meta = await ensureGalleryAlbumsMetaSeeded(supabase, data.albums);
  let albums = data.albums.map((album) => {
    const merged = mergeAlbumWithMeta(album, meta);
    return {
      ...merged,
      image: albumCoverImageUrl(merged),
    };
  });

  if (!albums.length && meta.length) {
    albums = buildAlbumsFromMetaList(meta);
  }

  return {
    ...data,
    meta,
    albums,
  };
}

export async function findGalleryAlbumFolder(drive, supabase, slug) {
  const siteId = await getSiteContentFolderId(drive, supabase);
  const galeriaFolder = await findFolderByName(drive, siteId, "galeria");
  if (!galeriaFolder) return null;
  const albumFolders = (await listFolderChildren(drive, galeriaFolder.id)).filter(isDriveFolder);
  return (
    albumFolders.find((f) => slugifyName(f.name) === slug) ||
    albumFolders.find((f) => f.name?.toLowerCase() === slug.toLowerCase()) ||
    null
  );
}

export async function upsertGalleryAlbumMetaEntry(supabase, entry) {
  const meta = await getGalleryAlbumsMeta(supabase);
  const idx = meta.findIndex((m) => m.slug === entry.slug);
  if (idx >= 0) meta[idx] = { ...meta[idx], ...entry };
  else meta.push(entry);
  await saveGalleryAlbumsMeta(supabase, meta);
}

export async function removeGalleryAlbumMetaEntry(supabase, slug) {
  const meta = await getGalleryAlbumsMeta(supabase);
  await saveGalleryAlbumsMeta(
    supabase,
    meta.filter((m) => m.slug !== slug),
  );
}

function coverExtension(filename) {
  const match = String(filename || "").match(/\.(\w+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

async function replaceAlbumCover(drive, supabase, subpath, coverFile) {
  const folderId = await resolveSiteSubfolderId(drive, supabase, subpath);
  const children = await listFolderChildren(drive, folderId);
  for (const child of children) {
    if (isDriveImage(child) && /^cover\./i.test(child.name || "")) {
      await drive.files.update({
        fileId: child.id,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
    }
  }
  const ext = coverExtension(coverFile.originalname || coverFile.filename);
  await uploadFileToSiteFolder(
    drive,
    supabase,
    subpath,
    `cover.${ext}`,
    coverFile.buffer,
    coverFile.mimetype,
    { skipIfExists: false },
  );
}

export async function createSiteGalleryAlbum(drive, supabase, { title, subtitle, cover, photos = [] }) {
  const trimmedTitle = String(title || "").trim();
  if (!trimmedTitle) throw new Error("Título é obrigatório.");
  if (!cover?.buffer) throw new Error("Foto de capa é obrigatória.");

  const slug = slugifyName(trimmedTitle);
  if (!slug) throw new Error("Título inválido.");

  const existing = await findGalleryAlbumFolder(drive, supabase, slug);
  if (existing) throw new Error("Já existe um álbum com este título.");

  const subpath = `galeria/${trimmedTitle}`;
  await resolveSiteSubfolderId(drive, supabase, subpath);
  await replaceAlbumCover(drive, supabase, subpath, cover);

  for (const photo of photos) {
    if (!photo?.buffer) continue;
    await uploadFileToSiteFolder(
      drive,
      supabase,
      subpath,
      photo.originalname || photo.filename || `foto-${Date.now()}.jpg`,
      photo.buffer,
      photo.mimetype,
      { skipIfExists: false },
    );
  }

  await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug);

  const data = await listSiteGalleryAlbumsWithMeta(drive, supabase);
  return data.albums.find((a) => a.slug === slug) || null;
}

export async function updateSiteGalleryAlbum(
  drive,
  supabase,
  slug,
  { title, subtitle, cover, photos = [], deletedPhotoIds = [] },
) {
  const folder = await findAlbumFolderDeep(drive, supabase, slug);
  if (!folder) throw new Error("Álbum não encontrado.");

  const trimmedTitle = String(title || "").trim();
  const trimmedSubtitle = String(subtitle || "").trim();
  const subpath = `galeria/${folder.name}`;

  if (cover?.buffer) {
    await replaceAlbumCover(drive, supabase, subpath, cover);
  }

  for (const photoId of deletedPhotoIds) {
    if (!photoId) continue;
    try {
      await deleteSiteGalleryPhoto(drive, supabase, slug, photoId);
    } catch (_) {}
  }

  for (const photo of photos) {
    if (!photo?.buffer) continue;
    await uploadFileToSiteFolder(
      drive,
      supabase,
      subpath,
      photo.originalname || photo.filename || `foto-${Date.now()}.jpg`,
      photo.buffer,
      photo.mimetype,
      { skipIfExists: false },
    );
  }

  await upsertGalleryAlbumMetaEntry(supabase, {
    slug,
    title: trimmedTitle || folder.name,
    subtitle: trimmedSubtitle,
  });
  await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug);

  const data = await listSiteGalleryAlbumsWithMeta(drive, supabase);
  return data.albums.find((a) => a.slug === slug) || null;
}

export async function deleteSiteGalleryAlbum(drive, supabase, slug) {
  const folder = await findAlbumFolderDeep(drive, supabase, slug);
  if (folder) {
    await drive.files.update({
      fileId: folder.id,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
  }
  await removeGalleryAlbumMetaEntry(supabase, slug);
  await removeGalleryPhotosCacheEntry(supabase, slug);
}

export async function deleteSiteGalleryPhoto(drive, supabase, slug, photoId) {
  const folder = await findAlbumFolderDeep(drive, supabase, slug);
  if (!folder) throw new Error("Álbum não encontrado.");

  let found = false;
  async function trashIfPresent(folderId, depth = 0) {
    if (depth > MAX_GALLERY_FOLDER_DEPTH) return;
    const children = await listFolderChildren(drive, folderId);
    for (const file of children) {
      if (file.id === photoId) {
        await drive.files.update({
          fileId: photoId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
        });
        found = true;
        return;
      }
      if (isDriveFolder(file) && depth < MAX_GALLERY_FOLDER_DEPTH) {
        await trashIfPresent(file.id, depth + 1);
        if (found) return;
      }
    }
  }

  await trashIfPresent(folder.id);
  if (!found) throw new Error("Foto não encontrada.");

  await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug);
}

export async function updateSiteVideoItem(supabase, slug, { title, url }) {
  const targetSlug = decodeURIComponent(String(slug || "").trim());
  if (!targetSlug) throw new Error("Vídeo inválido.");

  const videos = await getSiteVideos(supabase);
  const idx = videos.findIndex((video) => video.slug === targetSlug);
  if (idx === -1) throw new Error("Vídeo não encontrado.");

  const current = videos[idx];
  const nextTitle = String(title ?? current.title).trim() || current.title;
  const urlInput = url ?? `https://www.youtube.com/watch?v=${current.youtubeId}`;
  const item = buildVideoItemFromUrl(nextTitle, urlInput);
  const next = [...videos];
  next[idx] = {
    ...current,
    slug: current.slug,
    title: nextTitle,
    youtubeId: item.youtubeId,
    image: `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`,
  };
  await saveSiteVideos(supabase, next);
  return next;
}

export function parseYoutubeVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id && id.length === 11 ? id : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && v.length === 11) return v;
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch (_) {}
  return null;
}

export function buildVideoItemFromUrl(title, url) {
  const youtubeId = parseYoutubeVideoId(url);
  if (!youtubeId) throw new Error("Link do YouTube inválido.");
  const trimmedTitle = String(title || "").trim() || "Vídeo ProVisual";
  const slug = slugifyName(trimmedTitle) || `video-${youtubeId}`;
  return {
    slug,
    title: trimmedTitle,
    youtubeId,
    image: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

export async function getSiteVideos(supabase) {
  const raw = await readSettingsValue(supabase, SITE_VIDEOS_KEY);
  let videos = raw;
  if (typeof videos === "string") {
    try {
      videos = JSON.parse(videos);
    } catch (_) {
      videos = null;
    }
  }
  if (Array.isArray(videos)) return videos.length ? videos : DEFAULT_SITE_VIDEOS;
  return DEFAULT_SITE_VIDEOS;
}

export async function saveSiteVideos(supabase, videos) {
  if (!Array.isArray(videos)) throw new Error("Lista de vídeos inválida.");
  await writeSettingsValue(supabase, SITE_VIDEOS_KEY, videos);
}
