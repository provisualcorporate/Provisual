const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listUsers() {
  try {
    console.log("Conectando ao Firestore...");
    const querySnapshot = await getDocs(collection(db, "users"));
    console.log(`Encontrados ${querySnapshot.size} usuários no Firestore:`);
    querySnapshot.forEach((doc) => {
      console.log(`ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log("-----------------------------------------");
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
  }
}

listUsers();
