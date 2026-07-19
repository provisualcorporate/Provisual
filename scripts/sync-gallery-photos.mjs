#!/usr/bin/env node
/**
 * Sincroniza fotos de todos os álbuns: Drive → Supabase (cache).
 * Uso: node scripts/sync-gallery-photos.mjs [slug-opcional]
 */
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  syncAllGalleryPhotosCache,
  syncGalleryAlbumPhotosFromDrive,
} from "../lib/siteDriveHelpers.js";
import { resolveGoogleCredentials } from "../lib/googleCredentials.js";
import { buildOAuthClient, mergeOAuthTokens } from "../lib/googleOAuthRedirect.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUPABASE_URL = process.env.SUPABASE_URL || "https://gwankhxcbkrtgxopbxwd.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const slugArg = process.argv[2];

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
  throw new Error("Sem credenciais Google. Execute push-google-credentials.mjs primeiro.");
}

const drive = await createDrive();

if (slugArg) {
  const result = await syncGalleryAlbumPhotosFromDrive(drive, supabase, slugArg);
  console.log(`${slugArg}: ${result.photos.length} fotos (synced=${result.synced})`);
} else {
  const results = await syncAllGalleryPhotosCache(drive, supabase);
  for (const r of results) {
    console.log(`${r.slug}: ${r.photos?.length ?? 0} fotos (synced=${r.synced})${r.error ? ` — ${r.error}` : ""}`);
  }
}

console.log("\nCache gravado em Supabase (settings.site_gallery_photos_cache).");
