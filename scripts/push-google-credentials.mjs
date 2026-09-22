#!/usr/bin/env node
/**
 * Publica credenciais Google (OAuth + conta de serviço) no Supabase.
 * Execute uma vez no Mac local — em produção (Vercel) o backend lê-as de settings.
 *
 * Uso: node scripts/push-google-credentials.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUPABASE_URL = process.env.SUPABASE_URL || "https://avfoqkigxuoofsztfdbi.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU0NDMsImV4cCI6MjEwNTY4MTQ0M30.UZg69ECsFZbjfd7iPGSM7OjYCGbTum-bGaPr5rjERAU";

function readJson(name) {
  const filePath = path.join(ROOT, name);
  if (!fs.existsSync(filePath)) {
    console.error(`Ficheiro em falta: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Buscar arquivo de conta de serviço (qualquer arquivo JSON que não seja metadata, package, tsconfig ou vercel)
const serviceFiles = fs.readdirSync(ROOT).filter(f => 
  f.endsWith('.json') && 
  !f.includes('metadata') && 
  !f.includes('package') && 
  !f.includes('tsconfig') && 
  !f.includes('vercel') &&
  !f.includes('oauth')
);
if (serviceFiles.length === 0) {
  console.error("Nenhum arquivo JSON de conta de serviço encontrado na raiz do projeto.");
  process.exit(1);
}
const serviceFile = serviceFiles[0];
console.log(`Usando arquivo de conta de serviço: ${serviceFile}`);

const oauth = fs.existsSync(path.join(ROOT, "google-oauth.json")) 
  ? readJson("google-oauth.json") 
  : null;
const service = readJson(serviceFile);

if (oauth && (!oauth.client_id || !oauth.client_secret)) {
  console.error("google-oauth.json inválido (client_id / client_secret).");
  process.exit(1);
}
if (!service.client_email || !service.private_key) {
  console.error("Conta de serviço inválida (client_email / private_key).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rows = [];
if (oauth) {
  rows.push({
    key: "google_oauth_config",
    value: { client_id: oauth.client_id, client_secret: oauth.client_secret },
  });
}
rows.push({ key: "google_service_account", value: service });

for (const row of rows) {
  const { error } = await supabase.from("settings").upsert(row);
  if (error) {
    console.error(`Erro ao gravar ${row.key}:`, error.message);
    process.exit(1);
  }
  console.log(`✓ ${row.key} gravado no Supabase`);
}

console.log("\nConcluído. Faça deploy (ou aguarde) e teste /api/drive/auth/status em produção.");
console.log("Opcional: no painel, Google Drive → Conectar Google Drive (conta pessoal OAuth).");
