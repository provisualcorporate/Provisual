/**
 * Sincroniza INICIO/Equipa/ → Google Drive (site/home/equipa) e actualiza equipa no Supabase.
 * Uso: npm run sync:equipa
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { uploadFileToSiteFolder } from "../lib/siteDriveHelpers.js";

const ROOT = process.cwd();
const SUPABASE_URL = "https://gwankhxcbkrtgxopbxwd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY";
const HOME_CONTENT_KEY = "home_page_content";
const EQUIPA_DIR = path.join(ROOT, "INICIO", "Equipa");

const TEAM_FILES = [
  "Captura de ecrã 2026-05-23, às 14.09.11.png",
  "Captura de ecrã 2026-05-23, às 14.10.07.png",
  "Captura de ecrã 2026-05-23, às 14.10.43.png",
  "Captura de ecrã 2026-05-23, às 14.16.15.png",
];

const DEFAULT_TEAM = [
  {
    name: "Carlos Nhaca",
    role: "Director de Produção",
    social: {
      facebook: "https://www.facebook.com/profile.php?id=61577619669570",
      linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
      instagram: "https://www.instagram.com/",
    },
  },
  {
    name: "Miguel Tembe",
    role: "Especialista Audiovisual",
    social: {
      facebook: "https://www.facebook.com/profile.php?id=61577619669570",
      linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
      instagram: "https://www.instagram.com/",
    },
  },
  {
    name: "João Machava",
    role: "Gestor de Projectos",
    social: {
      facebook: "https://www.facebook.com/profile.php?id=61577619669570",
      linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
      instagram: "https://www.instagram.com/",
    },
  },
  {
    name: "Ana Mabunda",
    role: "Directora Criativa",
    social: {
      facebook: "https://www.facebook.com/profile.php?id=61577619669570",
      linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
      instagram: "https://www.instagram.com/",
    },
  },
];

function guessMime(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

function resolveLocalFile(name) {
  const direct = path.join(EQUIPA_DIR, name);
  if (fs.existsSync(direct)) return direct;
  const match = fs
    .readdirSync(EQUIPA_DIR)
    .find((file) => file.normalize("NFC") === name.normalize("NFC"));
  return match ? path.join(EQUIPA_DIR, match) : null;
}

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

async function uploadTeamPhoto(drive, supabase, filename) {
  const localPath = resolveLocalFile(filename);
  if (!localPath) {
    console.warn(`  missing: INICIO/Equipa/${filename}`);
    return null;
  }

  const buffer = fs.readFileSync(localPath);
  const remoteName = path.basename(localPath);

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const result = await uploadFileToSiteFolder(
        drive,
        supabase,
        "home/equipa",
        remoteName,
        buffer,
        guessMime(remoteName),
      );
      console.log(`  ${result.skipped ? "exists" : "uploaded"}: site/home/equipa/${remoteName}`);
      await new Promise((r) => setTimeout(r, 300));
      return result.url;
    } catch (err) {
      if (attempt === 4) throw err;
      console.warn(`  retry ${attempt}/4: ${remoteName}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function main() {
  if (!fs.existsSync(EQUIPA_DIR)) {
    console.error("Pasta INICIO/Equipa/ não encontrada.");
    process.exit(1);
  }

  console.log("A sincronizar INICIO/Equipa/ → Google Drive + Supabase...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const teamUrls = [];
  for (const file of TEAM_FILES) {
    const url = await uploadTeamPhoto(drive, supabase, file);
    teamUrls.push(url);
  }

  const { data: existing } = await supabase
    .from("settings")
    .select("value")
    .eq("key", HOME_CONTENT_KEY)
    .single();

  const base = existing?.value && typeof existing.value === "object" ? existing.value : {};
  const teamMembers = DEFAULT_TEAM.map((member, index) => ({
    ...member,
    image: teamUrls[index] || base.teamMembers?.[index]?.image || "",
  }));

  const homeContent = {
    ...base,
    teamMembers,
  };

  await supabase.from("settings").upsert({ key: HOME_CONTENT_KEY, value: homeContent });
  console.log("\n✓ Equipa actualizada no Supabase com URLs do Drive.");
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
