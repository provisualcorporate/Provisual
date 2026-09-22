import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://avfoqkigxuoofsztfdbi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU0NDMsImV4cCI6MjEwNTY4MTQ0M30.UZg69ECsFZbjfd7iPGSM7OjYCGbTum-bGaPr5rjERAU';

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
