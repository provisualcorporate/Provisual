import fs from "fs";
import path from "path";

const OAUTH_FILE_NAMES = ["google-oauth.json"];
const SERVICE_FILE_NAMES = ["provisual-corporate-a16cee3d2250.json"];

function readJsonIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (_) {}
  return null;
}

function findJsonInCandidates(fileNames) {
  const roots = [process.cwd(), path.join(process.cwd(), "..")];
  for (const root of roots) {
    for (const name of fileNames) {
      const data = readJsonIfExists(path.join(root, name));
      if (data) return data;
    }
  }
  return null;
}

export function loadOAuthKeysSync() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  return findJsonInCandidates(OAUTH_FILE_NAMES);
}

export function loadServiceKeysSync() {
  if (process.env.GOOGLE_KEYS) {
    try {
      return JSON.parse(process.env.GOOGLE_KEYS);
    } catch (_) {}
  }
  return findJsonInCandidates(SERVICE_FILE_NAMES);
}

export function isOAuthKeysConfigured(oauthKeys) {
  return !!(
    oauthKeys?.client_id &&
    oauthKeys?.client_secret &&
    !String(oauthKeys.client_id).includes("COLE_AQUI") &&
    !String(oauthKeys.client_secret).includes("COLE_AQUI")
  );
}

export function isServiceKeysConfigured(serviceKeys) {
  return !!(serviceKeys?.client_email && serviceKeys?.private_key);
}

/** Credenciais em Supabase — sobrevivem ao deploy na Vercel sem variáveis de ambiente. */
export async function loadCredentialsFromSupabase(supabase) {
  const result = { oauth: null, service: null };
  if (!supabase) return result;

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["google_oauth_config", "google_service_account"]);

    if (error || !data) return result;

    for (const row of data) {
      if (row.key === "google_oauth_config" && row.value) result.oauth = row.value;
      if (row.key === "google_service_account" && row.value) result.service = row.value;
    }
  } catch (_) {}

  return result;
}

/** Ficheiros/env têm prioridade; Supabase é fallback para produção (Vercel). */
export async function resolveGoogleCredentials(supabase) {
  const oauth = loadOAuthKeysSync();
  const service = loadServiceKeysSync();

  if (isOAuthKeysConfigured(oauth) && isServiceKeysConfigured(service)) {
    return { oauth, service };
  }

  const fromDb = await loadCredentialsFromSupabase(supabase);
  return {
    oauth: isOAuthKeysConfigured(oauth) ? oauth : fromDb.oauth,
    service: isServiceKeysConfigured(service) ? service : fromDb.service,
  };
}
