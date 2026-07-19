/**
 * Achata My Drive/Site/Site → My Drive/Site e consolida slides em site/hero/.
 * Uso: node scripts/flatten-site-drive.mjs
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import {
  findFolderByName,
  findOrCreateFolder,
  getSiteContentFolderId,
  listFolderChildren,
  mergeFolderContents,
  moveDriveItem,
  isDriveFolder,
  isDriveImage,
} from "../lib/siteDriveHelpers.js";

const ROOT = process.cwd();
const SUPABASE_URL = "https://gwankhxcbkrtgxopbxwd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY";

async function getGoogleAuth() {
  const oauthKeys = JSON.parse(fs.readFileSync(path.join(ROOT, "google-oauth.json"), "utf-8"));
  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "google-tokens.json"), "utf-8"));
  const oauth2Client = new google.auth.OAuth2(
    oauthKeys.client_id,
    oauthKeys.client_secret,
    "http://localhost:3333/api/drive/auth/callback",
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function moveImagesToHero(drive, siteId) {
  const heroFolder = await findOrCreateFolder(drive, siteId, "hero");
  const slidesFolder = await findFolderByName(drive, siteId, "home");
  if (slidesFolder) {
    const slidesSub = await findFolderByName(drive, slidesFolder.id, "slides");
    if (slidesSub) {
      const slideFiles = (await listFolderChildren(drive, slidesSub.id)).filter(isDriveImage);
      for (const file of slideFiles) {
        await moveDriveItem(drive, file.id, heroFolder.id, slidesSub.id);
        console.log(`  hero ← home/slides/${file.name}`);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
}

async function main() {
  console.log("A reorganizar Google Drive: Site (1º nível) + hero único...\n");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const siteId = await getSiteContentFolderId(drive, supabase, { refresh: true });
  const siteChildren = await listFolderChildren(drive, siteId);
  const nestedSite = siteChildren.find(
    (f) => isDriveFolder(f) && f.name?.toLowerCase() === "site",
  );

  if (nestedSite) {
    console.log("— A mover conteúdo de Site/Site → Site —");
    await mergeFolderContents(drive, nestedSite.id, siteId);
    try {
      await drive.files.update({
        fileId: nestedSite.id,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
      console.log("  pasta Site/Site removida (vazia)");
    } catch (err) {
      console.warn("  aviso: não foi possível remover Site/Site:", err.message);
    }
  } else {
    console.log("— Sem pasta Site/Site aninhada —");
  }

  console.log("\n— A consolidar slides em site/hero/ —");
  await moveImagesToHero(drive, siteId);

  await getSiteContentFolderId(drive, supabase, { refresh: true });
  console.log("\n✓ Estrutura actualizada: My Drive > Site > (galeria, hero, home, servicos...)");
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
