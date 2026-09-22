#!/usr/bin/env node
/**
 * Executa o script SQL para criar as tabelas no Supabase
 * Uso: node scripts/create-supabase-tables.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUPABASE_URL = process.env.SUPABASE_URL || "https://avfoqkigxuoofsztfdbi.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEwNTQ0MywiZXhwIjoyMTA1NjgxNDQzfQ.qi5FhNAs7uZlnYzYG6lpudrmjaptNiaVaQdRIbns0L8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function executeSqlFile() {
  const sqlPath = path.join(ROOT, "create_tables.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  
  // Dividir o SQL em statements individuais
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Executando ${statements.length} statements SQL...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.error(`Erro no statement ${i + 1}:`, error);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
      } else {
        console.log(`Statement ${i + 1}/${statements.length} executado com sucesso`);
      }
    } catch (err) {
      console.error(`Erro no statement ${i + 1}:`, err.message);
    }
  }

  console.log("\nConcluído!");
}

executeSqlFile().catch(console.error);
