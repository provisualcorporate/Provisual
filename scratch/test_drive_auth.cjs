const fs = require('fs');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testOAuth2() {
  console.log("=== Testando Autenticação OAuth2 (Cota Pessoal) ===");
  try {
    if (!fs.existsSync('./google-oauth.json')) {
      console.log("google-oauth.json não existe. Pulando.");
      return false;
    }
    const oauthKeys = JSON.parse(fs.readFileSync('./google-oauth.json', 'utf-8'));
    
    let tokens = null;
    if (fs.existsSync('./google-tokens.json')) {
      tokens = JSON.parse(fs.readFileSync('./google-tokens.json', 'utf-8'));
      console.log("Tokens carregados do disco local.");
    } else {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'google_drive_tokens').single();
      if (!error && data && data.value) {
        tokens = data.value;
        console.log("Tokens carregados do Supabase.");
      }
    }

    if (!tokens) {
      console.log("Nenhum token encontrado. Pulando.");
      return false;
    }

    const oauth2Client = new google.auth.OAuth2(
      oauthKeys.client_id,
      oauthKeys.client_secret,
      "http://localhost:3333/api/drive/auth/callback"
    );
    oauth2Client.setCredentials(tokens);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log("Testando requisição à API do Drive...");
    const res = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name)'
    });
    console.log("Sucesso! Arquivos encontrados no OAuth2:", res.data.files);
    return true;
  } catch (err) {
    console.error("ERRO no OAuth2:", err.message);
    if (err.response && err.response.data) {
      console.error("Detalhes do erro do Google:", err.response.data);
    }
    return false;
  }
}

async function testServiceAccount() {
  console.log("\n=== Testando Autenticação por Conta de Serviço ===");
  try {
    let serviceKeys = null;
    if (fs.existsSync('./provisual-corporate-a16cee3d2250.json')) {
      serviceKeys = JSON.parse(fs.readFileSync('./provisual-corporate-a16cee3d2250.json', 'utf-8'));
      console.log("Chaves da Conta de Serviço carregadas do disco.");
    }

    if (!serviceKeys) {
      console.log("Nenhuma chave de conta de serviço encontrada.");
      return false;
    }

    const auth = new google.auth.JWT({
      email: serviceKeys.client_email,
      key: serviceKeys.private_key,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });
    console.log("Testando requisição à API do Drive...");
    const res = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name)'
    });
    console.log("Sucesso! Arquivos encontrados na Conta de Serviço:", res.data.files);
    return true;
  } catch (err) {
    console.error("ERRO na Conta de Serviço:", err.message);
    return false;
  }
}

async function run() {
  const oauthOk = await testOAuth2();
  const serviceOk = await testServiceAccount();
  console.log("\n=== RESUMO ===");
  console.log("OAuth2:", oauthOk ? "FUNCIONANDO" : "FALHOU");
  console.log("Conta de Serviço:", serviceOk ? "FUNCIONANDO" : "FALHOU");
}

run();
