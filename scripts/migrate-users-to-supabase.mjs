#!/usr/bin/env node
/**
 * Migra usuários do Firestore para Supabase
 * Uso: node scripts/migrate-users-to-supabase.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUPABASE_URL = process.env.SUPABASE_URL || "https://avfoqkigxuoofsztfdbi.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEwNTQ0MywiZXhwIjoyMTA1NjgxNDQzfQ.qi5FhNAs7uZlnYzYG6lpudrmjaptNiaVaQdRIbns0L8";

// Ler configuração do Firebase
const firebaseConfigPath = path.join(ROOT, "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  console.error("Arquivo firebase-applet-config.json não encontrado.");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateUsers() {
  try {
    console.log("Conectando ao Firestore...");
    const querySnapshot = await getDocs(collection(firestore, "users"));
    console.log(`Encontrados ${querySnapshot.size} usuários no Firestore.`);

    let migrated = 0;
    let failed = 0;

    for (const doc of querySnapshot.docs) {
      const userData = doc.data();
      console.log(`\nMigrando usuário: ${doc.id}`);
      console.log(`Email: ${userData.email}`);
      console.log(`Role: ${userData.role}`);

      try {
        // Verificar se usuário já existe no Supabase
        const { data: existing } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", userData.email)
          .maybeSingle();

        if (existing) {
          console.log(`Usuário com email ${userData.email} já existe no Supabase. Pulando.`);
          continue;
        }

        // Inserir usuário no Supabase
        const { error } = await supabase
          .from("user_profiles")
          .insert({
            id: doc.id,
            email: userData.email,
            password: userData.password,
            role: userData.role || "cliente",
            display_name: userData.displayName,
            admin_token: userData.adminToken,
            created_at: userData.createdAt ? new Date(userData.createdAt).toISOString() : new Date().toISOString(),
          });

        if (error) {
          console.error(`Erro ao migrar usuário ${doc.id}:`, error.message);
          failed++;
        } else {
          console.log(`Usuário ${doc.id} migrado com sucesso.`);
          migrated++;
        }
      } catch (err) {
        console.error(`Erro ao migrar usuário ${doc.id}:`, err.message);
        failed++;
      }
    }

    console.log(`\n=== Resumo ===`);
    console.log(`Migrados com sucesso: ${migrated}`);
    console.log(`Falhas: ${failed}`);
    console.log(`Total processado: ${querySnapshot.size}`);

  } catch (error) {
    console.error("Erro ao migrar usuários:", error);
    process.exit(1);
  }
}

migrateUsers();
