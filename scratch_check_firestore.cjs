const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

async function check() {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

    console.log("Fetching folders...");
    const foldersSnap = await getDocs(collection(db, "folders"));
    console.log(`Total folders in Firestore: ${foldersSnap.size}`);
    foldersSnap.forEach(doc => {
      console.log(`Folder: ID=${doc.id}, Name="${doc.data().name}", ParentID="${doc.data().parentId}", OwnerID="${doc.data().ownerId}"`);
    });

    console.log("\nFetching assets...");
    const assetsSnap = await getDocs(collection(db, "assets"));
    console.log(`Total assets in Firestore: ${assetsSnap.size}`);
    assetsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`Asset: ID=${doc.id}, Name="${data.name}", FolderID="${data.folderId}", Owner="${data.ownerId}", driveId="${data.driveId}"`);
    });

  } catch (err) {
    console.error("Error:", err);
  }
}

check();
