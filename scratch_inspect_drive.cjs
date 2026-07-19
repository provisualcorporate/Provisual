const { google } = require("googleapis");
const keys = require("./provisual-corporate-a16cee3d2250.json");

async function inspect() {
  try {
    const auth = google.auth.fromJSON(keys);
    auth.scopes = ['https://www.googleapis.com/auth/drive.readonly'];
    const drive = google.drive({ version: 'v3', auth });

    console.log("--- PASTAS NA RAIZ DO GOOGLE DRIVE ---");
    const res = await drive.files.list({
      q: "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)'
    });
    
    console.log(JSON.stringify(res.data.files, null, 2));

    for (const folder of res.data.files) {
      if (folder.name.toLowerCase().includes("arquivo") || folder.name.toLowerCase().includes("client")) {
        console.log(`\n--- CONTEÚDO DA PASTA: ${folder.name} (${folder.id}) ---`);
        const subRes = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)'
        });
        console.log(JSON.stringify(subRes.data.files, null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

inspect();
