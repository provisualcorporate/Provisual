const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  console.log("=== COLECÇÃO DE FOLDERS ===");
  const foldersSnap = await getDocs(collection(db, "folders"));
  console.log(`Total folders: ${foldersSnap.size}`);
  foldersSnap.forEach(doc => {
    console.log(`- Folder: ${doc.id} | Name: ${doc.data().name} | ParentId: ${doc.data().parentId}`);
  });

  console.log("\n=== COLECÇÃO DE ASSETS ===");
  const assetsSnap = await getDocs(collection(db, "assets"));
  console.log(`Total assets: ${assetsSnap.size}`);
  assetsSnap.forEach(doc => {
    console.log(`- Asset: ${doc.id} | Name: ${doc.data().name} | FolderId: ${doc.data().folderId}`);
  });
}

main().catch(console.error);
