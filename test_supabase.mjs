import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Fetching from user_profiles...");
  const { data, error } = await supabase.from('user_profiles').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data length:", data.length);
    console.log("Data:", JSON.stringify(data, null, 2));
  }
}

test();
