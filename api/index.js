import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import { Readable } from "stream";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import {
  getSiteContentFolderId,
  listSiteGalleryAlbums,
  listSiteGalleryAlbumsSummary,
  listSiteGalleryAlbumPhotos,
  listSiteGalleryAlbumsWithMeta,
  createSiteGalleryAlbum,
  updateSiteGalleryAlbum,
  deleteSiteGalleryAlbum,
  deleteSiteGalleryPhoto,
  getSiteVideos,
  saveSiteVideos,
  buildVideoItemFromUrl,
  updateSiteVideoItem,
  ensureGalleryAlbumsMetaSeeded,
  listSiteLibraryPhotos,
  listSiteServiceImages,
  resolveSiteSubfolderId,
  driveMediaUrl,
  resolveHomeContentImages,
  resolveHomeContentWithIndex,
  persistResolvedHomeContentIfNeeded,
  listGalleryAlbumsOffline,
  getGalleryAlbumPhotos,
  syncAllGalleryPhotosCache,
  syncGalleryAlbumPhotosFromDrive,
} from "../lib/siteDriveHelpers.js";
import {
  getCachedGoogleAuth,
  getCachedThumbnailMeta,
  clearGoogleAuthCache,
  IMAGE_CACHE_CONTROL,
  HOME_API_CACHE_CONTROL,
} from "../lib/driveServerCache.js";
import {
  listAllFilesInFolder,
  streamDriveFileDownload,
} from "../lib/driveDownloadHelpers.js";
import {
  getGoogleOAuthRedirectUri,
  isInvalidGrantError,
  mergeOAuthTokens,
  buildOAuthClient,
  clearStoredOAuthTokens,
} from "../lib/googleOAuthRedirect.js";
import {
  resolveGoogleCredentials,
  isOAuthKeysConfigured,
  isServiceKeysConfigured,
} from "../lib/googleCredentials.js";
import {
  getGalleryCacheStatus,
  scheduleGalleryAutoSync,
  runGalleryAutoSync,
  isAuthorizedCronRequest,
} from "../lib/galleryAutoSync.js";

const app = express();
app.use(express.json());

// Inicializar Supabase para sincronização resiliente de tokens do Google Drive (Vercel Resiliência)
const SUPABASE_URL = "https://gwankhxcbkrtgxopbxwd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase inicializado no backend (Vercel API)!");

// Google Drive Integration
const upload = multer({ storage: multer.memoryStorage() });

// Utilitário para inicializar o cliente Google Auth (Híbrido)
async function createGoogleAuth() {
  const { oauth: oauthKeys, service: serviceKeys } = await resolveGoogleCredentials(supabase);
  const localTokensPath = path.join(process.cwd(), "google-tokens.json");

  // Se tivermos as credenciais OAuth do Silva
  if (isOAuthKeysConfigured(oauthKeys)) {
    try {
      let tokens = null;
      
      // Se existir localmente no disco (cache temporário da Vercel)
      if (fs.existsSync(localTokensPath)) {
        try {
          tokens = JSON.parse(fs.readFileSync(localTokensPath, "utf-8"));
        } catch (e) {}
      }
      
      // Se não estiver no disco local, recuperamos do Supabase (resiliência no Vercel)
      if (!tokens) {
        try {
          const { data, error } = await supabase.from('settings').select('value').eq('key', 'google_drive_tokens').single();
          if (!error && data && data.value) {
            tokens = data.value;
            // Salva localmente em cache temporário de arquivo na Vercel se possível
            try {
              fs.writeFileSync(localTokensPath, JSON.stringify(tokens, null, 2));
            } catch (e) {}
            console.log("Tokens do Google Drive recuperados com sucesso do Supabase (Vercel).");
          }
        } catch (dbErr) {
          console.warn("Erro ao buscar tokens do Supabase no Vercel:", dbErr);
        }
      }

      if (tokens) {
        try {
          const redirectUri = getGoogleOAuthRedirectUri();
          const oauth2Client = await buildOAuthClient(
            oauthKeys,
            tokens,
            redirectUri,
            async (mergedTokens) => {
              try {
                fs.writeFileSync(localTokensPath, JSON.stringify(mergedTokens, null, 2));
              } catch (_) {}
              try {
                await supabase.from("settings").upsert({
                  key: "google_drive_tokens",
                  value: mergedTokens,
                });
              } catch (dbErr) {
                console.error("Erro ao atualizar tokens no Supabase:", dbErr);
              }
            },
          );

          return { auth: oauth2Client, type: "oauth2" };
        } catch (err) {
          if (isInvalidGrantError(err)) {
            console.warn("Tokens OAuth inválidos — a usar conta de serviço:", err.message);
            await clearStoredOAuthTokens(supabase, localTokensPath, fs);
            clearGoogleAuthCache();
          } else {
            console.warn("Erro OAuth2, fallback para conta de serviço:", err.message);
          }
        }
      }
    } catch (err) {
      console.warn("Erro ao configurar cliente OAuth2 pessoal no Vercel, fazendo fallback para Conta de Serviço:", err);
    }
  }

  // 2. Fallback: Conta de Serviço (ficheiro local, env GOOGLE_KEYS ou Supabase)
  if (isServiceKeysConfigured(serviceKeys)) {
    const auth = new google.auth.JWT({
      email: serviceKeys.client_email,
      key: serviceKeys.private_key,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    return { auth, type: "service_account" };
  }

  throw new Error("Credenciais do Google Drive não configuradas. Por favor conecte o Drive na interface do console.");
}

async function getGoogleAuth() {
  return getCachedGoogleAuth(createGoogleAuth);
}

async function createDriveClient() {
  const { auth } = await getGoogleAuth();
  return google.drive({ version: "v3", auth });
}

async function sendGalleryJson(res, data, summary) {
  const cacheStatus = await getGalleryCacheStatus(supabase);
  if (cacheStatus.stale) {
    scheduleGalleryAutoSync(supabase, () => createDriveClient());
  }
  res.set("Cache-Control", summary ? "private, max-age=15" : HOME_API_CACHE_CONTROL);
  res.json({ ...data, cacheStatus });
}

function respondDriveAuthError(res, error) {
  if (isInvalidGrantError(error)) {
    clearGoogleAuthCache();
    return res.status(401).json({
      error: "invalid_grant",
      message:
        "Ligação pessoal ao Drive expirou. O painel continua com a conta de serviço; reconecte em Google Drive → Conectar quando puder.",
      fallback: "service_account",
    });
  }
  return res.status(500).json({ error: error.message || "Erro no Google Drive." });
}

// ----------------- ROTAS DA API -----------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel-serverless", timestamp: new Date().toISOString() });
});

const HOME_CONTENT_KEY = "home_page_content";

app.get("/api/site/home", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", HOME_CONTENT_KEY)
      .single();
    if (error && error.code !== "PGRST116") throw error;

    let content = data?.value ?? null;
    const rawContent = content;
    try {
      const { auth } = await getGoogleAuth();
      const drive = google.drive({ version: "v3", auth });
      content = await resolveHomeContentImages(drive, supabase, content);
      await persistResolvedHomeContentIfNeeded(
        supabase,
        HOME_CONTENT_KEY,
        rawContent,
        content,
      );
    } catch (driveErr) {
      console.warn("Home Drive image resolve skipped:", driveErr);
      content = resolveHomeContentWithIndex(content);
    }

    res.setHeader("Cache-Control", HOME_API_CACHE_CONTROL);
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro ao carregar conteúdo da home." });
  }
});

app.put("/api/site/home", async (req, res) => {
  try {
    const content = req.body?.content;
    if (!content || typeof content !== "object") {
      return res.status(400).json({ error: "Conteúdo inválido." });
    }
    const { error } = await supabase
      .from("settings")
      .upsert({ key: HOME_CONTENT_KEY, value: content });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro ao guardar conteúdo da home." });
  }
});

app.get("/api/site/gallery", async (req, res) => {
  const summary = req.query.summary === "1" || req.query.summary === "true";

  const loadGallery = async () => {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    return summary
      ? await listSiteGalleryAlbumsSummary(drive, supabase)
      : await listSiteGalleryAlbumsWithMeta(drive, supabase);
  };

  try {
    let data = await loadGallery();
    if (!data.albums?.length) {
      const offline = await listGalleryAlbumsOffline(supabase);
      if (offline.albums.length) data = offline;
    }
    return sendGalleryJson(res, data, summary);
  } catch (err) {
    if (isInvalidGrantError(err)) {
      clearGoogleAuthCache();
      try {
        let data = await loadGallery();
        if (!data.albums?.length) {
          const offline = await listGalleryAlbumsOffline(supabase);
          if (offline.albums.length) data = offline;
        }
        return sendGalleryJson(res, data, summary);
      } catch (retryErr) {
        console.error("Site gallery list retry error:", retryErr);
        try {
          const offline = await listGalleryAlbumsOffline(supabase);
          if (offline.albums.length) return sendGalleryJson(res, offline, summary);
        } catch (_) {}
        return respondDriveAuthError(res, retryErr);
      }
    }
    console.error("Site gallery list error:", err);
    try {
      const offline = await listGalleryAlbumsOffline(supabase);
      if (offline.albums.length) return sendGalleryJson(res, offline, summary);
    } catch (_) {}
    res.status(500).json({ error: err.message || "Erro ao listar galeria do site." });
  }
});

app.get("/api/cron/gallery-sync", async (req, res) => {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  try {
    const result = await runGalleryAutoSync(supabase, () => createDriveClient(), { force: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Cron gallery sync error:", err);
    res.status(500).json({ error: err.message || "Erro na sincronização automática." });
  }
});

const albumUpload = upload.fields([
  { name: "cover", maxCount: 1 },
  { name: "photos", maxCount: 100 },
]);

app.post("/api/site/gallery/albums", albumUpload, async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const cover = req.files?.cover?.[0];
    const photos = req.files?.photos || [];
    const album = await createSiteGalleryAlbum(drive, supabase, {
      title: req.body?.title,
      subtitle: req.body?.subtitle,
      cover,
      photos,
    });
    res.json({ album });
  } catch (err) {
    console.error("Site gallery create album error:", err);
    res.status(500).json({ error: err.message || "Erro ao criar álbum." });
  }
});

app.put("/api/site/gallery/albums/:slug", albumUpload, async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const cover = req.files?.cover?.[0];
    const photos = req.files?.photos || [];
    let deletedPhotoIds = [];
    if (typeof req.body?.deletedPhotoIds === "string") {
      try {
        deletedPhotoIds = JSON.parse(req.body.deletedPhotoIds);
      } catch (_) {
        deletedPhotoIds = req.body.deletedPhotoIds.split(",").filter(Boolean);
      }
    }
    const album = await updateSiteGalleryAlbum(drive, supabase, req.params.slug, {
      title: req.body?.title,
      subtitle: req.body?.subtitle,
      cover,
      photos,
      deletedPhotoIds,
    });
    res.json({ album });
  } catch (err) {
    console.error("Site gallery update album error:", err);
    res.status(500).json({ error: err.message || "Erro ao atualizar álbum." });
  }
});

app.delete("/api/site/gallery/albums/:slug/photos/:photoId", async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    await deleteSiteGalleryPhoto(drive, supabase, req.params.slug, req.params.photoId);
    res.json({ success: true });
  } catch (err) {
    console.error("Site gallery delete photo error:", err);
    res.status(500).json({ error: err.message || "Erro ao eliminar foto." });
  }
});

app.delete("/api/site/gallery/albums/:slug", async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    await deleteSiteGalleryAlbum(drive, supabase, req.params.slug);
    res.json({ success: true });
  } catch (err) {
    console.error("Site gallery delete album error:", err);
    res.status(500).json({ error: err.message || "Erro ao eliminar álbum." });
  }
});

app.get("/api/site/gallery/:slug/photos", async (req, res) => {
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  const slug = req.params.slug;

  try {
    let drive = null;
    if (refresh || !(await getGalleryAlbumPhotos(supabase, slug))) {
      try {
        const { auth } = await getGoogleAuth();
        drive = google.drive({ version: "v3", auth });
      } catch (driveErr) {
        if (refresh || !(await getGalleryAlbumPhotos(supabase, slug))) throw driveErr;
      }
    }

    const data = await listSiteGalleryAlbumPhotos(drive, supabase, slug, { refresh });
    res.set("Cache-Control", data.fromCache ? "private, max-age=300" : "private, max-age=60");
    res.json(data);
  } catch (err) {
    const cached = await getGalleryAlbumPhotos(supabase, slug);
    if (cached) return res.json(cached);
    console.error("Site gallery photos error:", err);
    res.status(500).json({ error: err.message || "Erro ao listar fotos do álbum." });
  }
});

app.post("/api/site/gallery/sync-photos", async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const slug = req.body?.slug ? String(req.body.slug) : null;

    if (slug) {
      const result = await syncGalleryAlbumPhotosFromDrive(drive, supabase, slug);
      return res.json({ success: true, results: [result] });
    }

    const results = await syncAllGalleryPhotosCache(drive, supabase);
    res.json({
      success: true,
      synced: results.filter((r) => r.synced).length,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error("Site gallery sync photos error:", err);
    res.status(500).json({ error: err.message || "Erro ao sincronizar fotos da galeria." });
  }
});

app.get("/api/site/library", async (_req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const siteFolderId = await getSiteContentFolderId(drive, supabase);
    const photos = await listSiteLibraryPhotos(drive, supabase);
    res.json({ siteFolderId, photos });
  } catch (err) {
    console.error("Site library error:", err);
    res.status(500).json({ error: err.message || "Erro ao listar biblioteca do site." });
  }
});

app.post("/api/site/gallery/sync-meta", async (_req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    await getSiteContentFolderId(drive, supabase, { refresh: true });
    const driveData = await listSiteGalleryAlbums(drive, supabase);
    const meta = await ensureGalleryAlbumsMetaSeeded(supabase, driveData.albums);
    const data = await listSiteGalleryAlbumsWithMeta(drive, supabase);
    const photoSync = await syncAllGalleryPhotosCache(drive, supabase);
    res.json({
      success: true,
      meta,
      albums: data.albums,
      photoSync: {
        synced: photoSync.filter((r) => r.synced).length,
        total: photoSync.length,
      },
    });
  } catch (err) {
    console.error("Site gallery sync meta error:", err);
    res.status(500).json({ error: err.message || "Erro ao sincronizar metadados da galeria." });
  }
});

async function listAdminAccounts() {
  const { data, error } = await supabase.from("user_profiles").select("*").order("email");
  if (error) throw error;
  return data || [];
}

app.get("/api/admin/accounts", async (_req, res) => {
  try {
    res.json({ accounts: await listAdminAccounts() });
  } catch (err) {
    console.error("Admin accounts list error:", err);
    res.status(500).json({ error: err.message || "Erro ao listar contas." });
  }
});

app.post("/api/admin/accounts", async (req, res) => {
  try {
    const { email, displayName, password, role, clientId } = req.body || {};
    if (!email || !displayName || !password) {
      return res.status(400).json({ error: "Email, nome e senha são obrigatórios." });
    }
    const id = clientId || `client_${Math.random().toString(36).substring(2, 11)}`;
    const { error } = await supabase.from("user_profiles").upsert({
      id,
      email: String(email).trim().toLowerCase(),
      display_name: String(displayName),
      password: String(password),
      role: role || "cliente",
      client_id: id,
    });
    if (error) throw error;
    res.json({ success: true, accounts: await listAdminAccounts() });
  } catch (err) {
    console.error("Admin accounts create error:", err);
    res.status(500).json({ error: err.message || "Erro ao criar conta." });
  }
});

app.put("/api/admin/accounts/:id", async (req, res) => {
  try {
    const { email, displayName, password, role } = req.body || {};
    if (!email || !displayName || !password) {
      return res.status(400).json({ error: "Email, nome e senha são obrigatórios." });
    }
    const { error } = await supabase
      .from("user_profiles")
      .update({
        email: String(email).trim().toLowerCase(),
        display_name: String(displayName),
        password: String(password),
        role: role || "cliente",
      })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, accounts: await listAdminAccounts() });
  } catch (err) {
    console.error("Admin accounts update error:", err);
    res.status(500).json({ error: err.message || "Erro ao atualizar conta." });
  }
});

app.delete("/api/admin/accounts/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("user_profiles").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, accounts: await listAdminAccounts() });
  } catch (err) {
    console.error("Admin accounts delete error:", err);
    res.status(500).json({ error: err.message || "Erro ao eliminar conta." });
  }
});

app.get("/api/site/videos", async (_req, res) => {
  try {
    const videos = await getSiteVideos(supabase);
    res.json({ videos });
  } catch (err) {
    console.error("Site videos list error:", err);
    res.status(500).json({ error: err.message || "Erro ao listar vídeos do site." });
  }
});

app.put("/api/site/videos/:slug", async (req, res) => {
  try {
    const { title, url } = req.body || {};
    const videos = await updateSiteVideoItem(supabase, req.params.slug, { title, url });
    res.json({ success: true, videos });
  } catch (err) {
    console.error("Site videos update error:", err);
    res.status(500).json({ error: err.message || "Erro ao atualizar vídeo." });
  }
});

app.put("/api/site/videos", async (req, res) => {
  try {
    const { slug, title, url, videos } = req.body || {};

    if (slug) {
      const updated = await updateSiteVideoItem(supabase, slug, { title, url });
      return res.json({ success: true, videos: updated });
    }

    if (!Array.isArray(videos)) {
      return res.status(400).json({ error: "Lista de vídeos inválida." });
    }
    await saveSiteVideos(supabase, videos);
    res.json({ success: true, videos });
  } catch (err) {
    console.error("Site videos save error:", err);
    res.status(500).json({ error: err.message || "Erro ao guardar vídeos." });
  }
});

app.post("/api/site/videos", async (req, res) => {
  try {
    const { title, url } = req.body || {};
    const item = buildVideoItemFromUrl(title, url);
    const videos = await getSiteVideos(supabase);
    if (videos.some((v) => v.youtubeId === item.youtubeId)) {
      return res.status(400).json({ error: "Este vídeo já está na lista." });
    }
    let slug = item.slug;
    let counter = 1;
    while (videos.some((v) => v.slug === slug)) {
      slug = `${item.slug}-${counter++}`;
    }
    const next = [...videos, { ...item, slug }];
    await saveSiteVideos(supabase, next);
    res.json({ video: { ...item, slug }, videos: next });
  } catch (err) {
    console.error("Site videos add error:", err);
    res.status(500).json({ error: err.message || "Erro ao adicionar vídeo." });
  }
});

app.delete("/api/site/videos/:slug", async (req, res) => {
  try {
    const videos = await getSiteVideos(supabase);
    const next = videos.filter((v) => v.slug !== req.params.slug);
    await saveSiteVideos(supabase, next);
    res.json({ success: true, videos: next });
  } catch (err) {
    console.error("Site videos delete error:", err);
    res.status(500).json({ error: err.message || "Erro ao eliminar vídeo." });
  }
});

app.post("/api/site/media/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const subpath = typeof req.body?.subpath === "string" ? req.body.subpath : "";

  if (!file) return res.status(400).json({ error: "Ficheiro é obrigatório." });

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const folderId = await resolveSiteSubfolderId(drive, supabase, subpath);

    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const response = await drive.files.create({
      requestBody: { name: file.originalname, parents: [folderId] },
      media: { mimeType: file.mimetype, body: bufferStream },
      supportsAllDrives: true,
      fields: "id, name, mimeType, webViewLink, thumbnailLink, createdTime",
    });

    res.json({
      ...response.data,
      folderId,
      subpath,
      url: driveMediaUrl(response.data.id),
      thumbnailUrl: `/api/drive/thumbnail?id=${response.data.id}`,
    });
  } catch (err) {
    console.error("Site media upload error:", err);
    res.status(500).json({ error: err.message || "Erro ao carregar imagem para o site." });
  }
});

app.get("/api/site/services", async (_req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const images = await listSiteServiceImages(drive, supabase);
    res.json({ images });
  } catch (err) {
    console.error("Site services images error:", err);
    res.status(500).json({ error: err.message || "Erro ao listar imagens de serviços." });
  }
});

app.post("/api/drive/list", async (req, res) => {
  const { folderId, filterType } = req.body;

  try {
    const { auth, type } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    let queryStr = (!folderId || folderId === 'root')
      ? `('root' in parents or sharedWithMe = true) and trashed = false`
      : `'${folderId}' in parents and trashed = false`;
    let orderByStr = 'folder,name,createdTime';

    if (filterType === 'sharedWithMe') {
      queryStr = `sharedWithMe = true and trashed = false`;
    } else if (filterType === 'starred') {
      queryStr = `starred = true and trashed = false`;
    } else if (filterType === 'recent') {
      queryStr = `trashed = false`;
      orderByStr = 'modifiedTime desc';
    } else if (filterType === 'trashed') {
      queryStr = `trashed = true`;
    }

    const allFiles = [];
    let pageToken;

    do {
      const response = await drive.files.list({
        q: queryStr,
        orderBy: orderByStr,
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink, size, thumbnailLink, createdTime, shortcutDetails, starred, trashed, permissions)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      if (response.data.files?.length) {
        allFiles.push(...response.data.files);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    const normalizedFiles = allFiles.map((file) => ({
      ...file,
      name: typeof file.name === "string"
        ? file.name.normalize("NFC").replace(/\uFFFD/g, "").trim() || "Sem nome"
        : "Sem nome",
    }));

    res.json(normalizedFiles);
  } catch (error) {
    console.error("List Error:", error);
    if (isInvalidGrantError(error)) {
      return respondDriveAuthError(res, error);
    }
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/drive/storage", async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.about.get({
      fields: 'storageQuota'
    });
    res.json(response.data.storageQuota);
  } catch (error) {
    console.error("Storage Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
  const { folderId } = req.body;
  const file = req.file;

  if (!file || !folderId) return res.status(400).json({ error: "File and Folder ID are required" });

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    let response;
    try {
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      response = await drive.files.create({
        requestBody: { 
          name: file.originalname, 
          parents: [folderId] 
        },
        media: { 
          mimeType: file.mimetype, 
          body: bufferStream 
        },
        supportsAllDrives: true,
        fields: 'id, name, webViewLink, size, mimeType, createdTime',
      });
    } catch (uploadError) {
      console.warn("Upload to specific folder failed on Vercel, falling back to root:", uploadError.message);
      const fallbackStream = new Readable();
      fallbackStream.push(file.buffer);
      fallbackStream.push(null);

      response = await drive.files.create({
        requestBody: { 
          name: file.originalname, 
          parents: ['root'] 
        },
        media: { 
          mimeType: file.mimetype, 
          body: fallbackStream 
        },
        supportsAllDrives: true,
        fields: 'id, name, webViewLink, size, mimeType, createdTime',
      });
    }
    res.json(response.data);
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/drive/create-folder", async (req, res) => {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ error: "Nome da pasta é obrigatório" });

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Normalizar nome para NFC
    const normalizedName = name.normalize("NFC");

    const fileMetadata = {
      name: normalizedName,
      mimeType: "application/vnd.google-apps.folder",
      parents: (parentId && parentId !== "root") ? [parentId] : []
    };

    console.log("Vercel: Criando pasta com metadados:", fileMetadata);

    let file;
    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: "id, name",
        supportsAllDrives: true
      });
      file = response.data;
    } catch (createError) {
      console.warn("Vercel: Falha ao criar pasta com parentId, tentando sem parents:", createError.message);
      
      const fallbackMetadata = {
        name: normalizedName,
        mimeType: "application/vnd.google-apps.folder"
      };

      const response = await drive.files.create({
        requestBody: fallbackMetadata,
        fields: "id, name",
        supportsAllDrives: true
      });
      file = response.data;
    }

    res.json(file);
  } catch (error) {
    console.error("Vercel Create Folder Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/drive/delete", async (req, res) => {
  const { fileId, permanent = false } = req.body;
  if (!fileId) return res.status(400).json({ error: "ID do arquivo é obrigatório" });

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    if (permanent) {
      await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true
      });
      res.json({ success: true, message: "Item eliminado permanentemente do Google Drive." });
    } else {
      await drive.files.update({
        fileId: fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true
      });
      res.json({ success: true, message: "Item movido para a lixeira com sucesso." });
    }
  } catch (error) {
    console.error("Vercel Delete Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/drive/empty-trash", async (req, res) => {
  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const trashedFiles = [];
    let pageToken;
    do {
      const response = await drive.files.list({
        q: 'trashed = true',
        fields: 'nextPageToken, files(id, name)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      if (response.data.files?.length) {
        trashedFiles.push(...response.data.files);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    let deleted = 0;
    let failed = 0;
    const DELETE_BATCH = 10;
    for (let i = 0; i < trashedFiles.length; i += DELETE_BATCH) {
      const batch = trashedFiles.slice(i, i + DELETE_BATCH);
      await Promise.all(
        batch.map(async (file) => {
          if (!file.id) return;
          try {
            await drive.files.delete({ fileId: file.id, supportsAllDrives: true });
            deleted++;
          } catch (err) {
            failed++;
            console.warn(`Falha ao eliminar ${file.id}:`, err.message);
          }
        })
      );
    }

    res.json({ success: true, deleted, failed, total: trashedFiles.length });
  } catch (error) {
    console.error("Empty Trash Error:", error);
    if (isInvalidGrantError(error)) {
      return respondDriveAuthError(res, error);
    }
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/drive/thumbnail", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send("ID do arquivo é obrigatório");

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    const { thumbnailLink, mimeType } = await getCachedThumbnailMeta(drive, String(id));
    if (!thumbnailLink) return res.status(404).send("Thumbnail não disponível");

    const requestedSize = Math.min(Math.max(parseInt(String(req.query.sz || "800"), 10) || 800, 200), 1600);
    const crop = req.query.crop === "1" || req.query.crop === "true";
    const sizeToken = crop ? `s${requestedSize}-c` : `s${requestedSize}`;
    const sizeLink = thumbnailLink.replace(/=s\d+(-c)?/, `=${sizeToken}`);
    const tokenResponse = await auth.getAccessToken();
    const imageResponse = await fetch(sizeLink, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` },
    });

    if (!imageResponse.ok) {
      throw new Error(`Erro ao baixar thumbnail: ${imageResponse.statusText}`);
    }

    res.setHeader("Content-Type", imageResponse.headers.get("content-type") || mimeType || "image/jpeg");
    res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);

    if (imageResponse.body) {
      Readable.fromWeb(imageResponse.body).pipe(res);
      return;
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error("Erro ao obter thumbnail do Drive:", error);
    res.status(500).send(error.message);
  }
});

app.get("/api/drive/media", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send("ID do arquivo é obrigatório");

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    const fileResponse = await drive.files.get({
      fileId: id,
      fields: "mimeType, name",
      supportsAllDrives: true,
    });

    const mediaResponse = await drive.files.get(
      { fileId: id, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );

    res.setHeader("Content-Type", fileResponse.data.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);
    mediaResponse.data
      .on("error", (streamErr) => {
        console.error("Stream media error:", streamErr);
        if (!res.headersSent) res.status(500).end(streamErr.message);
      })
      .pipe(res);
  } catch (error) {
    console.error("Erro ao obter media do Drive:", error);
    res.status(500).send(error.message);
  }
});

app.get("/api/drive/download", async (req, res) => {
  const { id, name } = req.query;
  if (!id) return res.status(400).send("ID do arquivo é obrigatório");

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    await streamDriveFileDownload(drive, String(id), name ? String(name) : undefined, res);
  } catch (error) {
    console.error("Erro ao transferir ficheiro do Drive:", error);
    const status = error.statusCode || 500;
    if (!res.headersSent) {
      res.status(status).send(error.message || "Erro ao transferir ficheiro.");
    }
  }
});

app.post("/api/drive/folder-files", async (req, res) => {
  const { folderId } = req.body || {};
  if (!folderId) return res.status(400).json({ error: "ID da pasta é obrigatório." });

  try {
    const { auth } = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const files = await listAllFilesInFolder(drive, String(folderId));
    res.json({ files, count: files.length });
  } catch (error) {
    console.error("Erro ao listar ficheiros da pasta:", error);
    res.status(500).json({ error: error.message || "Erro ao listar ficheiros da pasta." });
  }
});

// ----------------- ROTAS DE AUTENTICAÇÃO OAUTH 2.0 -----------------

app.get("/api/drive/auth/status", async (_req, res) => {
  const { oauth: oauthKeys, service: serviceKeys } = await resolveGoogleCredentials(supabase);
  const oauthConfigured = isOAuthKeysConfigured(oauthKeys);
  const localTokensPath = path.join(process.cwd(), "google-tokens.json");
  let hasOAuthTokens = fs.existsSync(localTokensPath);

  if (!hasOAuthTokens) {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "google_drive_tokens")
        .single();
      if (!error && data?.value) hasOAuthTokens = true;
    } catch (_) {}
  }

  const serviceKeysConfigured = isServiceKeysConfigured(serviceKeys);

  let statusType = "disconnected";
  let email = "Desconectado";

  if (oauthConfigured && hasOAuthTokens) {
    statusType = "oauth2";
    email = "provisualcorporate@gmail.com (Cota Pessoal)";
  } else if (serviceKeysConfigured) {
    statusType = "service_account";
    email = "Conta de Serviço Google Drive";
  }

  res.json({
    connected: statusType !== "disconnected",
    type: statusType,
    email,
    configNeeded: !oauthConfigured && !serviceKeysConfigured,
  });
});

app.get("/api/drive/auth/url", async (req, res) => {
  try {
    const { oauth: oauthKeys } = await resolveGoogleCredentials(supabase);
    if (!isOAuthKeysConfigured(oauthKeys)) {
      return res.status(400).json({
        error:
          "Credenciais OAuth não configuradas. Execute node scripts/push-google-credentials.mjs no Mac ou defina GOOGLE_CLIENT_ID/SECRET na Vercel.",
      });
    }

    const redirectUri = getGoogleOAuthRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(
      oauthKeys.client_id,
      oauthKeys.client_secret,
      redirectUri
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive"]
    });

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/drive/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Código de autorização não fornecido pelo Google.");

  const localTokensPath = path.join(process.cwd(), "google-tokens.json");

  try {
    const { oauth: oauthKeys } = await resolveGoogleCredentials(supabase);
    if (!isOAuthKeysConfigured(oauthKeys)) {
      return res.status(400).send("Credenciais OAuth não configuradas no servidor.");
    }

    const redirectUri = getGoogleOAuthRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(
      oauthKeys.client_id,
      oauthKeys.client_secret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    const existing = fs.existsSync(localTokensPath)
      ? JSON.parse(fs.readFileSync(localTokensPath, "utf-8"))
      : {};
    const mergedTokens = mergeOAuthTokens(existing, tokens);
    
    try {
      fs.writeFileSync(localTokensPath, JSON.stringify(mergedTokens, null, 2));
    } catch (e) {}

    // Persistir também no Supabase para resiliência na Vercel
    try {
      await supabase.from('settings').upsert({ key: 'google_drive_tokens', value: mergedTokens });
      console.log("Tokens de acesso persistidos com sucesso no Supabase.");
    } catch (dbErr) {
      console.error("Erro ao salvar tokens no Supabase:", dbErr);
    }

    clearGoogleAuthCache();

    res.send(`
      <html>
        <head>
          <title>Conectado com Sucesso</title>
          <style>
            body { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #333; text-align: center; padding-top: 100px; }
            .card { background: white; border: 1px solid #eaeaea; border-radius: 12px; max-width: 500px; margin: 0 auto; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1 { color: #a21b7e; margin-bottom: 20px; font-size: 24px; }
            p { color: #666; font-size: 15px; line-height: 1.6; }
            .badge { background: #faf0f8; color: #a21b7e; padding: 6px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin-top: 15px; font-size: 13px; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✨ Google Drive Conectado!</h1>
            <p>O painel <strong>ProVisual Corporate</strong> se conectou com absoluto sucesso à sua conta corporativa.</p>
            <div class="badge">uploads e cota pessoal habilitados!</div>
            <p style="margin-top: 30px; font-size: 13px; color: #999;">Esta janela fechará automaticamente...</p>
          </div>
          <script>
            setTimeout(() => { window.close(); }, 3500);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Auth Callback Error:", error);
    res.status(500).send(`Erro ao obter tokens do Google Drive: ${error.message}`);
  }
});

app.post("/api/drive/auth/disconnect", async (req, res) => {
  const localTokensPath = path.join(process.cwd(), "google-tokens.json");
  try {
    if (fs.existsSync(localTokensPath)) {
      fs.unlinkSync(localTokensPath);
    }

    // Remover também do Supabase para manter sincronização
    try {
      await supabase.from('settings').delete().eq('key', 'google_drive_tokens');
      console.log("Tokens removidos com sucesso do Supabase.");
    } catch (dbErr) {
      console.error("Erro ao deletar tokens do Supabase:", dbErr);
    }
    clearGoogleAuthCache();
    res.json({ success: true, message: "Google Drive desconectado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
