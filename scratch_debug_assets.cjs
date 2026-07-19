const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

async function debug() {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

    // Fetch folders
    const foldersSnap = await getDocs(collection(db, "folders"));
    const folders = foldersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch assets
    const assetsSnap = await getDocs(collection(db, "assets"));
    const assets = assetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Loaded ${folders.length} folders and ${assets.length} assets.`);

    // 1. Resolve arquivoFolder
    let found = folders.find(f => 
      f && f.name && typeof f.name === 'string' && 
      f.name.trim().toLowerCase() === 'arquivo' && 
      (!f.parentId || f.parentId === 'root' || f.parentId === '') && 
      !f.trashed
    );
    if (!found) {
      found = folders.find(f => 
        f && f.name && typeof f.name === 'string' && 
        f.name.toLowerCase().includes('arquivo') && 
        (!f.parentId || f.parentId === 'root' || f.parentId === '') && 
        !f.trashed
      );
    }
    if (!found) {
      found = folders.find(f => 
        f && f.name && typeof f.name === 'string' && 
        f.name.trim().toLowerCase() === 'arquivo' && 
        !f.trashed
      );
    }

    console.log("Resolved arquivoFolder:", found ? `${found.name} (id: ${found.id}, parentId: ${found.parentId})` : "NONE");
    const arquivoFolderId = found ? found.id : null;

    // Let's check how many folders have parentId === arquivoFolderId
    const subfolders = folders.filter(f => f.parentId === arquivoFolderId);
    console.log(`Number of folders directly under Arquivo (${arquivoFolderId}): ${subfolders.length}`);
    subfolders.forEach(sf => console.log(`- Folder: ${sf.name} (${sf.id})`));

    // Let's check how many assets have folderId === arquivoFolderId
    const directAssets = assets.filter(a => a.folderId === arquivoFolderId);
    console.log(`Number of assets directly under Arquivo (${arquivoFolderId}): ${directAssets.length}`);
    directAssets.slice(0, 10).forEach(a => console.log(`- Asset: ${a.name} (${a.id})`));

    // Let's check assets with folderId in one of the subfolders
    const subfolderIds = subfolders.map(sf => sf.id);
    const subfolderAssets = assets.filter(a => subfolderIds.includes(a.folderId));
    console.log(`Number of assets inside subfolders of Arquivo: ${subfolderAssets.length}`);

    // Check if there are assets in Google Drive with folderId that are NOT in the folders list
    const unknownFolderAssets = assets.filter(a => a.ownerId === 'google-drive' && a.folderId && !folders.find(f => f.id === a.folderId) && a.folderId !== 'root' && a.folderId !== 'trash');
    console.log(`Number of assets with unknown folderId: ${unknownFolderAssets.length}`);
    unknownFolderAssets.slice(0, 10).forEach(a => console.log(`- Asset: ${a.name} (unknown folderId: ${a.folderId})`));

  } catch (err) {
    console.error("Error:", err);
  }
}

debug();
