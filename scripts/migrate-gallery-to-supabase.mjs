#!/usr/bin/env node
/**
 * Migra álbuns de fotos do Google Drive para Supabase Storage
 * Uso: node scripts/migrate-gallery-to-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveGoogleCredentials } from "../lib/googleCredentials.js";
import { buildOAuthClient, mergeOAuthTokens } from "../lib/googleOAuthRedirect.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUPABASE_URL = process.env.SUPABASE_URL || "https://avfoqkigxuoofsztfdbi.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEwNTQ0MywiZXhwIjoyMTA1NjgxNDQzfQ.qi5FhNAs7uZlnYzYG6lpudrmjaptNiaVaQdRIbns0L8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET_NAME = "gallery-albums";

async function createDrive() {
  const { oauth, service } = await resolveGoogleCredentials(supabase);
  if (oauth?.client_id && oauth?.client_secret) {
    const { data } = await supabase.from("settings").select("value").eq("key", "google_drive_tokens").single();
    if (data?.value) {
      const oauth2 = await buildOAuthClient(
        oauth,
        data.value,
        "http://localhost:3333/api/drive/auth/callback",
        async (merged) => {
          await supabase.from("settings").upsert({ key: "google_drive_tokens", value: mergeOAuthTokens(data.value, merged) });
        },
      );
      return google.drive({ version: "v3", auth: oauth2 });
    }
  }
  if (service?.client_email && service?.private_key) {
    const auth = new google.auth.JWT({
      email: service.client_email,
      key: service.private_key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
  }
  throw new Error("No valid Google credentials found");
}

function titleToSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function downloadFile(drive, fileId) {
  try {
    const { data } = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(data);
  } catch (error) {
    console.error(`Error downloading file ${fileId}:`, error.message);
    return null;
  }
}

async function uploadToSupabase(buffer, albumId, fileName) {
  const fileExt = fileName.split('.').pop();
  const storagePath = `${albumId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: `image/${fileExt}`,
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl };
}

async function migrateGallery() {
  try {
    console.log("Conectando ao Google Drive...");
    const drive = await createDrive();

    // Buscar pastas no Drive (sem filtro para ver tudo)
    const { data: folders } = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder'",
      fields: "files(id, name)",
    });

    if (!folders?.files?.length) {
      console.log("Nenhuma pasta encontrada no Drive.");
      return;
    }

    console.log(`Encontradas ${folders.files.length} pastas no Drive:`);
    folders.files.forEach(f => console.log(`  - ${f.name} (${f.id})`));

    // Filtrar pastas que parecem ser galerias
    const galleryFolders = folders.files.filter(f => 
      f.name.toLowerCase().includes('galeria') || 
      f.name.toLowerCase().includes('gallery') ||
      f.name.toLowerCase().includes('foto') ||
      f.name.toLowerCase().includes('photo')
    );

    if (galleryFolders.length === 0) {
      console.log("Nenhuma pasta de galeria encontrada (com nome contendo 'galeria', 'gallery', 'foto' ou 'photo').");
      console.log("Usando todas as pastas encontradas.");
      var foldersToProcess = folders.files;
    } else {
      console.log(`\nPastas de galeria encontradas: ${galleryFolders.length}`);
      var foldersToProcess = galleryFolders;
    }

    for (const folder of foldersToProcess) {
      console.log(`\nProcessando pasta: ${folder.name} (${folder.id})`);

      // Buscar arquivos na pasta
      const { data: files } = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType contains 'image/'`,
        fields: "files(id, name)",
      });

      if (!files?.files?.length) {
        console.log(`Nenhuma imagem encontrada em ${folder.name}.`);
        continue;
      }

      console.log(`Encontradas ${files.files.length} imagens.`);

      // Criar álbum no Supabase
      const slug = titleToSlug(folder.name);
      const { data: album, error: albumError } = await supabase
        .from("gallery_albums")
        .insert({
          slug,
          title: folder.name,
          description: `Migrado do Google Drive`,
        })
        .select()
        .single();

      if (albumError) {
        console.error(`Erro ao criar álbum ${folder.name}:`, albumError.message);
        continue;
      }

      console.log(`Álbum criado: ${album.id}`);

      // Upload das fotos
      let photoCount = 0;
      for (const file of files.files) {
        console.log(`  Baixando ${file.name}...`);
        const buffer = await downloadFile(drive, file.id);
        
        if (!buffer) {
          console.log(`  Falha ao baixar ${file.name}`);
          continue;
        }

        console.log(`  Uploading ${file.name}...`);
        const { storagePath, publicUrl } = await uploadToSupabase(buffer, album.id, file.name);

        // Criar registro da foto
        const { error: photoError } = await supabase
          .from("gallery_photos")
          .insert({
            album_id: album.id,
            storage_path: storagePath,
            public_url: publicUrl,
            order_index: photoCount,
          });

        if (photoError) {
          console.error(`  Erro ao criar registro da foto:`, photoError.message);
        } else {
          photoCount++;
          console.log(`  Foto ${file.name} migrada com sucesso.`);
        }
      }

      // Atualizar capa do álbum com a primeira foto
      if (photoCount > 0) {
        const { data: photos } = await supabase
          .from("gallery_photos")
          .select("public_url")
          .eq("album_id", album.id)
          .order("order_index", { ascending: true })
          .limit(1);

        if (photos?.[0]) {
          await supabase
            .from("gallery_albums")
            .update({ cover_image_url: photos[0].public_url })
            .eq("id", album.id);
        }
      }

      console.log(`Concluído: ${photoCount} fotos migradas para ${folder.name}.`);
    }

    console.log("\n=== Migração concluída ===");

  } catch (error) {
    console.error("Erro durante migração:", error);
    process.exit(1);
  }
}

migrateGallery();
