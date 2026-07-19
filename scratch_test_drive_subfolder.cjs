const { google } = require("googleapis");
const fs = require("fs");

async function run() {
  const oauthKeys = JSON.parse(fs.readFileSync("./google-oauth.json", "utf-8"));
  const tokens = JSON.parse(fs.readFileSync("./google-tokens.json", "utf-8"));
  
  const oauth2Client = new google.auth.OAuth2(
    oauthKeys.client_id,
    oauthKeys.client_secret,
    "http://localhost:3333/api/drive/auth/callback"
  );
  oauth2Client.setCredentials(tokens);
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  // Folder: "SELECAO PARTE 2" (1-Bwu285cyHzl41PyHcuGX40HhIkr9QKf)
  const folderId = "1-Bwu285cyHzl41PyHcuGX40HhIkr9QKf";
  console.log(`Listing files under folder ID: ${folderId}`);
  
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    console.log(`Total files found: ${res.data.files.length}`);
    res.data.files.slice(0, 15).forEach(f => {
      console.log(`- File: ${f.name} | Type: ${f.mimeType} | Size: ${f.size}`);
    });
  } catch (error) {
    console.error("Error fetching files:", error);
  }
}

run();
