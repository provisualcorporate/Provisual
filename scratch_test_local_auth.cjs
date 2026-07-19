const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function testAuth() {
  console.log("--- TESTANDO CONFIGURAÇÃO DE AUTH LOCAL ---");
  
  // 1. Tentar ler as credenciais OAuth 2.0 pessoais do Silva
  let oauthKeys;
  try {
    if (fs.existsSync("./google-oauth.json")) {
      oauthKeys = JSON.parse(fs.readFileSync("./google-oauth.json", "utf-8"));
      console.log("google-oauth.json carregado com sucesso. Client ID:", oauthKeys.client_id);
    } else {
      console.log("google-oauth.json NÃO encontrado!");
    }
  } catch (err) {
    console.error("Erro ao ler google-oauth.json:", err.message);
  }

  // Se tivermos as credenciais OAuth do Silva e o token salvo
  if (oauthKeys && oauthKeys.client_id && oauthKeys.client_secret && fs.existsSync("./google-tokens.json")) {
    try {
      const tokens = JSON.parse(fs.readFileSync("./google-tokens.json", "utf-8"));
      console.log("google-tokens.json carregado com sucesso. Expira em:", new Date(tokens.expiry_date).toLocaleString());
      
      const oauth2Client = new google.auth.OAuth2(
        oauthKeys.client_id,
        oauthKeys.client_secret,
        "http://localhost:3333/api/drive/auth/callback"
      );
      oauth2Client.setCredentials(tokens);
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      console.log("Testando chamada sobre a cota de armazenamento pessoal...");
      const storageRes = await drive.about.get({ fields: 'storageQuota' });
      console.log("Sucesso! Cota OAuth pessoal:");
      console.log(JSON.stringify(storageRes.data.storageQuota, null, 2));
      
      console.log("\nTestando listagem de pastas na raiz do seu Drive pessoal...");
      const listRes = await drive.files.list({
        q: "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name)'
      });
      console.log("Pastas encontradas:");
      console.log(JSON.stringify(listRes.data.files, null, 2));
      return;
    } catch (err) {
      console.error("ERRO na autenticação pessoal OAuth:", err);
    }
  } else {
    console.log("Não foram encontradas credenciais pessoais OAuth completas ou tokens. Tentando fallback para Conta de Serviço...");
  }

  // Fallback: Conta de Serviço
  try {
    let serviceKeys = JSON.parse(fs.readFileSync("./provisual-corporate-a16cee3d2250.json", "utf-8"));
    console.log("provisual-corporate-a16cee3d2250.json carregado. Conta de serviço:", serviceKeys.client_email);
    
    const auth = new google.auth.JWT({
      email: serviceKeys.client_email,
      key: serviceKeys.private_key,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });
    console.log("Testando chamada de cota para Conta de Serviço...");
    const storageRes = await drive.about.get({ fields: 'storageQuota' });
    console.log("Sucesso! Cota da Conta de Serviço:");
    console.log(JSON.stringify(storageRes.data.storageQuota, null, 2));
  } catch (err) {
    console.error("ERRO na Conta de Serviço:", err);
  }
}

testAuth();
