import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log("=== Colunas da tabela folders ===");
  const { data: cols, error: err } = await supabase.rpc('execute_sql_query', {
    sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'folders'"
  });
  if (err) {
    // Se rpc não existir, fazemos uma query normal ou usamos sql local
    console.warn("RPC falhou:", err);
    
    // Tenta ler colunas gerando um erro de propósito ou listando um registro
    const { data: row, error: rErr } = await supabase.from('folders').select('*').limit(1);
    if (rErr) console.error(rErr);
    else console.log("Campos em folders:", Object.keys(row[0] || {}));
  } else {
    console.log(cols);
  }

  console.log("\n=== Colunas da tabela user_profiles ===");
  const { data: uRow, error: uErr } = await supabase.from('user_profiles').select('*').limit(1);
  if (uErr) console.error(uErr);
  else console.log("Campos em user_profiles:", Object.keys(uRow[0] || {}));
}

checkSchema();
