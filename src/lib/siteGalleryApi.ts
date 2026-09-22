import { GALLERY_ALBUMS, VIDEO_ITEMS, type GalleryAlbum, type VideoItem } from "./sitePages";
import { getGalleryPhotos } from "./galleryPhotos";
import { mergeHomeContent, type HomeContent } from "./homeContent";
import {
  ADMIN_CACHE_KEYS,
  clearAdminCache,
  clearAdminPhotoCaches,
  readAdminCache,
  writeAdminCache,
} from "./siteAdminCache";
import {
  createAlbum,
  updateAlbum,
  deleteAlbum,
  uploadPhotoToAlbum,
  addPhotoToAlbum,
  deletePhotoFromAlbum,
  listAlbums,
  listAlbumPhotos,
  getAlbumBySlug,
  type GalleryAlbum as SupabaseAlbum,
  type GalleryPhoto as SupabasePhoto,
} from "./supabaseStorage";

export interface SiteDrivePhoto {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  mimeType?: string;
}

export interface SiteDriveAlbum {
  slug: string;
  name: string;
  title?: string;
  subtitle?: string;
  image?: string;
  folderId: string | null;
  coverUrl: string | null;
  coverDriveId: string | null;
  photoCount: number;
}

// Helper function to convert title to slug
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper function to convert Supabase album to SiteDriveAlbum
function supabaseAlbumToSiteAlbum(album: SupabaseAlbum & { cover_image_url?: string }): SiteDriveAlbum {
  return {
    slug: album.slug,
    name: album.title,
    title: album.title,
    subtitle: album.description || '',
    image: album.cover_image_url || '',
    folderId: null,
    coverUrl: album.cover_image_url || null,
    coverDriveId: null,
    photoCount: 0, // Will be updated when photos are loaded
  };
}

// Helper function to convert Supabase photo to SiteDrivePhoto
function supabasePhotoToSitePhoto(photo: SupabasePhoto): SiteDrivePhoto {
  return {
    id: photo.id,
    name: photo.storage_path.split('/').pop() || 'photo.jpg',
    url: photo.public_url,
    thumbnailUrl: photo.public_url,
  };
}

const HOME_CACHE_KEY = "provisual_home_content_v6";
const HOME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface HomeCacheEntry {
  content: HomeContent;
  savedAt: number;
}

function readHomeCache(): HomeContent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCacheEntry;
    if (!parsed?.content || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > HOME_CACHE_TTL_MS) {
      localStorage.removeItem(HOME_CACHE_KEY);
      return null;
    }
    return parsed.content;
  } catch {
    return null;
  }
}

function writeHomeCache(content: HomeContent) {
  if (typeof window === "undefined") return;
  try {
    const entry: HomeCacheEntry = { content, savedAt: Date.now() };
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota or private mode — ignore
  }
}

async function fetchHomeFromApi(): Promise<HomeContent> {
  const res = await fetch("/api/site/home");
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  const merged = mergeHomeContent(data.content);
  writeHomeCache(merged);
  return merged;
}

function mergeAlbumMetadata(driveAlbum: SiteDriveAlbum): GalleryAlbum {
  const meta = GALLERY_ALBUMS.find((a) => a.slug === driveAlbum.slug);
  
  const staticCandidate = [driveAlbum.coverUrl, driveAlbum.image].find((u) => u?.startsWith("/INICIO/"));
  let coverFromDrive = staticCandidate || "";
  
  if (!coverFromDrive) {
    if (driveAlbum.coverDriveId && !String(driveAlbum.coverDriveId).startsWith("static-")) {
      coverFromDrive = `/api/drive/thumbnail?id=${encodeURIComponent(driveAlbum.coverDriveId)}&sz=800`;
    } else if (driveAlbum.image?.includes("/api/drive/")) {
      coverFromDrive = driveAlbum.image;
    } else {
      coverFromDrive = driveAlbum.image || driveAlbum.coverUrl || "";
    }
  }

  return {
    slug: driveAlbum.slug,
    title: driveAlbum.title || meta?.title || driveAlbum.name,
    subtitle: driveAlbum.subtitle || meta?.subtitle || `${driveAlbum.photoCount} fotos`,
    image: coverFromDrive,
  };
}

export async function fetchSiteHomeContent(): Promise<HomeContent> {
  const cached = readHomeCache();
  if (cached) {
    fetchHomeFromApi()
      .then((fresh) => {
        writeHomeCache(fresh);
      })
      .catch(() => {});
    return mergeHomeContent(cached);
  }

  try {
    return await fetchHomeFromApi();
  } catch (e) {
    console.warn("Home Drive indisponível, usando dados locais:", e);
    return mergeHomeContent(null);
  }
}

async function fetchSiteGalleryAlbumsFromApi(): Promise<GalleryAlbum[]> {
  try {
    const albums = await listAlbums();
    const galleryAlbums: GalleryAlbum[] = albums.map(album => ({
      slug: album.slug,
      title: album.title,
      subtitle: album.description || '',
      image: album.cover_image_url || '',
    }));
    
    writeAdminCache(ADMIN_CACHE_KEYS.gallery, galleryAlbums);
    return galleryAlbums;
  } catch (e) {
    throw new Error("empty");
  }
}

export async function fetchSiteGalleryAlbums(options?: { resync?: boolean }): Promise<GalleryAlbum[]> {
  if (!options?.resync) {
    const cached = readAdminCache<GalleryAlbum[]>(ADMIN_CACHE_KEYS.gallery);
    if (cached?.length) {
      fetchSiteGalleryAlbumsFromApi().catch(() => {});
      return cached;
    }
  }

  try {
    return await fetchSiteGalleryAlbumsFromApi();
  } catch {
    try {
      await syncSiteGalleryMeta();
      return await fetchSiteGalleryAlbumsFromApi();
    } catch (e) {
      console.warn("Galeria Drive indisponível, usando dados locais:", e);
    }
  }

  const cached = readAdminCache<GalleryAlbum[]>(ADMIN_CACHE_KEYS.gallery);
  if (cached?.length) return cached;

  if (import.meta.env.DEV) return GALLERY_ALBUMS;

  return GALLERY_ALBUMS.map((album) => ({
    ...album,
    image: album.image?.includes("/api/drive/") ? album.image : "",
  }));
}

export async function syncSiteGalleryMeta(): Promise<GalleryAlbum[]> {
  // A galeria agora está no Supabase Storage, não precisa de sincronização com Drive
  return await fetchSiteGalleryAlbumsFromApi();
}

/** Sincronização não necessária - galeria está no Supabase Storage */
export async function syncGalleryPhotosCache(slug?: string): Promise<void> {
  // No-op: galeria está no Supabase Storage
}

function localGalleryPhotos(slug: string, fallbackCover: string): SiteDrivePhoto[] {
  return getGalleryPhotos(slug, fallbackCover).map((url, index) => ({
    id: `local-${slug}-${index}`,
    name: url.split("/").pop() || `foto-${index + 1}.jpg`,
    url,
    thumbnailUrl: url,
  }));
}

export async function fetchSiteGalleryPhotos(slug: string, fallbackCover: string): Promise<SiteDrivePhoto[]> {
  try {
    const album = await getAlbumBySlug(slug);
    if (!album) {
      console.warn(`Álbum ${slug} não encontrado no Supabase`);
      return [];
    }
    
    const photos = await listAlbumPhotos(album.id);
    return photos.map(supabasePhotoToSitePhoto);
  } catch (e) {
    console.warn(`Fotos Supabase (${slug}) indisponíveis, usando dados locais:`, e);
  }

  if (import.meta.env.DEV) {
    return localGalleryPhotos(slug, fallbackCover);
  }

  return [];
}

export async function uploadSiteMedia(file: File, subpath = ""): Promise<SiteDrivePhoto & { folderId: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("subpath", subpath);

  const res = await fetch("/api/site/media/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao carregar imagem.");
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    url: data.url,
    thumbnailUrl: data.thumbnailUrl,
    mimeType: data.mimeType,
    folderId: data.folderId,
  };
}

export async function fetchSiteLibrary(): Promise<SiteDrivePhoto[]> {
  const res = await fetch("/api/site/library");
  if (!res.ok) throw new Error("Erro ao carregar biblioteca.");
  const data = await res.json();
  return data.photos || [];
}

export async function fetchSiteServiceImages(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/api/site/services");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.images || {};
  } catch (e) {
    console.warn("Imagens de serviços Drive indisponíveis:", e);
    return {};
  }
}

export function applyDriveServiceImages<T extends { slug: string; image: string }>(
  items: T[],
  images: Record<string, string>,
): T[] {
  return items.map((item) => ({
    ...item,
    image: images[item.slug] || item.image,
  }));
}

function staticAlbumsForAdmin(): SiteDriveAlbum[] {
  return GALLERY_ALBUMS.map((album) => ({
    slug: album.slug,
    name: album.title,
    title: album.title,
    subtitle: album.subtitle,
    image: album.image,
    folderId: null,
    coverUrl: album.image,
    coverDriveId: null,
    photoCount: 0,
  }));
}

function albumsFromApiPayload(data: Record<string, unknown>): SiteDriveAlbum[] | null {
  const albums = data.albums;
  if (Array.isArray(albums) && albums.length > 0) {
    return albums as SiteDriveAlbum[];
  }

  const meta = data.meta;
  if (!Array.isArray(meta) || meta.length === 0) return null;

  return meta.map((entry: Record<string, unknown>) => {
    const slug = String(entry.slug || "");
    const staticAlbum = GALLERY_ALBUMS.find((a) => a.slug === slug);
    const coverDriveId = entry.coverDriveId ? String(entry.coverDriveId) : null;
    const coverImageUrl = entry.coverImageUrl
      ? String(entry.coverImageUrl)
      : staticAlbum?.image || null;
    return {
      slug,
      name: String(entry.title || slug),
      title: String(entry.title || slug),
      subtitle: String(entry.subtitle || `${entry.photoCount ?? 0} fotos`),
      folderId: entry.folderId ? String(entry.folderId) : null,
      coverDriveId,
      coverUrl: coverImageUrl,
      photoCount: typeof entry.photoCount === "number" ? entry.photoCount : 0,
      image: coverImageUrl || "",
    };
  });
}

async function fetchAdminGalleryAlbumsFromApi(): Promise<SiteDriveAlbum[]> {
  try {
    const albums = await listAlbums();
    const siteAlbums = albums.map(supabaseAlbumToSiteAlbum);
    
    // Atualizar photoCount para cada álbum
    for (const album of siteAlbums) {
      const supabaseAlbum = await getAlbumBySlug(album.slug);
      if (supabaseAlbum) {
        const photos = await listAlbumPhotos(supabaseAlbum.id);
        album.photoCount = photos.length;
      }
    }
    
    writeAdminCache(ADMIN_CACHE_KEYS.albums, siteAlbums);
    return siteAlbums;
  } catch (e) {
    const fallback = staticAlbumsForAdmin();
    writeAdminCache(ADMIN_CACHE_KEYS.albums, fallback);
    return fallback;
  }
}

export async function fetchAdminGalleryAlbums(): Promise<SiteDriveAlbum[]> {
  const cached = readAdminCache<SiteDriveAlbum[]>(ADMIN_CACHE_KEYS.albums);
  if (cached?.length) {
    fetchAdminGalleryAlbumsFromApi().catch(() => {});
    return cached;
  }
  return fetchAdminGalleryAlbumsFromApi();
}

export async function createGalleryAlbum(payload: {
  title: string;
  subtitle: string;
  cover: File;
  photos: File[];
}): Promise<SiteDriveAlbum> {
  // Gerar slug a partir do título
  const slug = titleToSlug(payload.title);
  
  // Criar álbum no Supabase
  const album = await createAlbum(slug, payload.title, payload.subtitle);
  
  // Upload da capa
  const { storagePath: coverPath, publicUrl: coverUrl } = await uploadPhotoToAlbum(payload.cover, album.id);
  
  // Atualizar álbum com a capa
  await updateAlbum(album.id, { cover_image_url: coverUrl });
  
  // Upload das fotos
  for (let i = 0; i < payload.photos.length; i++) {
    const photo = payload.photos[i];
    const { storagePath, publicUrl } = await uploadPhotoToAlbum(photo, album.id);
    await addPhotoToAlbum(album.id, storagePath, publicUrl, undefined, i);
  }
  
  clearAdminCache(ADMIN_CACHE_KEYS.albums);
  clearAdminCache(ADMIN_CACHE_KEYS.gallery);
  clearAdminPhotoCaches();
  
  return supabaseAlbumToSiteAlbum({ ...album, cover_image_url: coverUrl });
}

async function fetchAdminGalleryPhotosFromApi(
  slug: string,
  options?: { refresh?: boolean },
): Promise<SiteDrivePhoto[]> {
  const cacheKey = ADMIN_CACHE_KEYS.photos(slug);
  
  try {
    const album = await getAlbumBySlug(slug);
    if (!album) {
      const cached = readAdminCache<SiteDrivePhoto[]>(cacheKey);
      if (cached?.length) return cached;
      throw new Error("Álbum não encontrado.");
    }
    
    const photos = await listAlbumPhotos(album.id);
    const sitePhotos = photos.map(supabasePhotoToSitePhoto);
    
    if (sitePhotos.length) writeAdminCache(cacheKey, sitePhotos);
    return sitePhotos;
  } catch (e) {
    const cached = readAdminCache<SiteDrivePhoto[]>(cacheKey);
    if (cached?.length) return cached;
    throw new Error("Erro ao carregar fotos do álbum.");
  }
}

export async function fetchAdminGalleryPhotos(
  slug: string,
  options?: { refresh?: boolean },
): Promise<SiteDrivePhoto[]> {
  const cacheKey = ADMIN_CACHE_KEYS.photos(slug);
  if (!options?.refresh) {
    const cached = readAdminCache<SiteDrivePhoto[]>(cacheKey);
    if (cached?.length) {
      fetchAdminGalleryPhotosFromApi(slug).catch(() => {});
      return cached;
    }
  }
  return fetchAdminGalleryPhotosFromApi(slug, options);
}

export async function updateGalleryAlbum(
  slug: string,
  payload: {
    title: string;
    subtitle: string;
    cover?: File | null;
    photos: File[];
    deletedPhotoIds?: string[];
  },
): Promise<SiteDriveAlbum> {
  const album = await getAlbumBySlug(slug);
  if (!album) throw new Error("Álbum não encontrado.");
  
  // Atualizar metadados
  await updateAlbum(album.id, {
    title: payload.title,
    description: payload.subtitle,
  });
  
  // Upload nova capa se fornecida
  if (payload.cover) {
    const { storagePath, publicUrl } = await uploadPhotoToAlbum(payload.cover, album.id);
    await updateAlbum(album.id, { cover_image_url: publicUrl });
  }
  
  // Deletar fotos marcadas
  if (payload.deletedPhotoIds?.length) {
    for (const photoId of payload.deletedPhotoIds) {
      await deletePhotoFromAlbum(photoId);
    }
  }
  
  // Upload novas fotos
  const existingPhotos = await listAlbumPhotos(album.id);
  for (let i = 0; i < payload.photos.length; i++) {
    const photo = payload.photos[i];
    const { storagePath, publicUrl } = await uploadPhotoToAlbum(photo, album.id);
    await addPhotoToAlbum(album.id, storagePath, publicUrl, undefined, existingPhotos.length + i);
  }
  
  clearAdminCache(ADMIN_CACHE_KEYS.albums);
  clearAdminCache(ADMIN_CACHE_KEYS.gallery);
  clearAdminCache(ADMIN_CACHE_KEYS.photos(slug));
  
  const updatedAlbum = await getAlbumBySlug(slug);
  return supabaseAlbumToSiteAlbum(updatedAlbum!);
}

export async function deleteGalleryAlbum(slug: string): Promise<void> {
  const album = await getAlbumBySlug(slug);
  if (!album) throw new Error("Álbum não encontrado.");
  
  await deleteAlbum(album.id);
  
  clearAdminCache(ADMIN_CACHE_KEYS.albums);
  clearAdminCache(ADMIN_CACHE_KEYS.gallery);
  clearAdminCache(ADMIN_CACHE_KEYS.photos(slug));
}

export async function fetchSiteVideos(): Promise<VideoItem[]> {
  try {
    const res = await fetch("/api/site/videos", { cache: "no-store" });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (Array.isArray(data.videos)) return data.videos;
  } catch (e) {
    console.warn("Vídeos do site indisponíveis, usando dados locais:", e);
  }
  return VIDEO_ITEMS;
}

async function fetchAdminSiteVideosFromApi(): Promise<VideoItem[]> {
  const res = await fetch("/api/site/videos", { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao carregar vídeos.");
  const data = await res.json();
  const videos = data.videos || [];
  writeAdminCache(ADMIN_CACHE_KEYS.videos, videos);
  return videos;
}

export async function fetchAdminSiteVideos(): Promise<VideoItem[]> {
  const cached = readAdminCache<VideoItem[]>(ADMIN_CACHE_KEYS.videos);
  if (cached?.length) {
    fetchAdminSiteVideosFromApi().catch(() => {});
    return cached;
  }
  return fetchAdminSiteVideosFromApi();
}

export async function addSiteVideo(title: string, url: string): Promise<VideoItem[]> {
  const res = await fetch("/api/site/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao adicionar vídeo.");
  }
  const data = await res.json();
  clearAdminCache(ADMIN_CACHE_KEYS.videos);
  return data.videos || [];
}

export async function deleteSiteVideo(slug: string): Promise<VideoItem[]> {
  const res = await fetch(`/api/site/videos/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao eliminar vídeo.");
  }
  const data = await res.json();
  clearAdminCache(ADMIN_CACHE_KEYS.videos);
  return data.videos || [];
}

export async function updateSiteVideo(slug: string, title: string, url: string): Promise<VideoItem[]> {
  const res = await fetch("/api/site/videos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ slug, title, url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao atualizar vídeo.");
  }
  const data = await res.json();
  clearAdminCache(ADMIN_CACHE_KEYS.videos);
  return data.videos || [];
}

async function fetchAdminAccountsFromApi(): Promise<any[]> {
  const res = await fetch("/api/admin/accounts", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao carregar contas.");
  }
  const data = await res.json();
  const accounts = (data.accounts || []).map(mapAccountRow);
  writeAdminCache(ADMIN_CACHE_KEYS.accounts, accounts);
  return accounts;
}

export async function fetchAdminAccounts(options?: { force?: boolean }): Promise<any[]> {
  if (!options?.force) {
    const cached = readAdminCache<any[]>(ADMIN_CACHE_KEYS.accounts);
    if (cached?.length) {
      fetchAdminAccountsFromApi().catch(() => {});
      return cached;
    }
  }
  return fetchAdminAccountsFromApi();
}

export async function createAdminAccount(payload: {
  email: string;
  displayName: string;
  password: string;
  role: string;
  clientId: string;
}): Promise<any[]> {
  const res = await fetch("/api/admin/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao criar conta.");
  }
  const data = await res.json();
  const accounts = (data.accounts || []).map(mapAccountRow);
  writeAdminCache(ADMIN_CACHE_KEYS.accounts, accounts);
  return accounts;
}

export async function updateAdminAccount(
  id: string,
  payload: {
    email: string;
    displayName: string;
    password: string;
    role: string;
  },
): Promise<any[]> {
  const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao atualizar conta.");
  }
  const data = await res.json();
  const accounts = (data.accounts || []).map(mapAccountRow);
  writeAdminCache(ADMIN_CACHE_KEYS.accounts, accounts);
  return accounts;
}

export async function deleteAdminAccount(id: string): Promise<any[]> {
  const res = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao eliminar conta.");
  }
  const data = await res.json();
  const accounts = (data.accounts || []).map(mapAccountRow);
  writeAdminCache(ADMIN_CACHE_KEYS.accounts, accounts);
  return accounts;
}

export function prefetchAdminPanelData() {
  fetchAdminGalleryAlbums()
    .then((albums) => {
      albums.forEach((album) => {
        fetchAdminGalleryPhotos(album.slug).catch(() => {});
      });
    })
    .catch(() => {});
  fetchAdminSiteVideos().catch(() => {});
  fetchAdminAccounts().catch(() => {});
}

function mapAccountRow(row: any) {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    role: row.role || "cliente",
    displayName: row.display_name || row.displayName || "",
    clientId: row.client_id || row.clientId || row.id,
  };
}
