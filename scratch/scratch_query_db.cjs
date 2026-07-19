const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDb() {
  console.log("=== Lendo pastas no Supabase ===");
  const { data: folders, error: fErr } = await supabase.from('folders').select('id, name, parent_id');
  if (fErr) console.error("Erro ao ler pastas:", fErr);
  else console.log("Pastas encontradas:", folders);

  console.log("\n=== Lendo arquivos (assets) no Supabase ===");
  const { data: assets, error: aErr } = await supabase.from('assets').select('id, name, folder_id, drive_id');
  if (aErr) console.error("Erro ao ler arquivos:", aErr);
  else console.log("Arquivos encontrados:", assets);
}

checkDb();
