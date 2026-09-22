import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://avfoqkigxuoofsztfdbi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU0NDMsImV4cCI6MjEwNTY4MTQ0M30.UZg69ECsFZbjfd7iPGSM7OjYCGbTum-bGaPr5rjERAU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Fetching columns and schema information for user_profiles...");
  
  // Try to insert a dummy row or fetch a row to see the response fields
  const { data: rows, error: selectError } = await supabase.from('user_profiles').select('*').limit(1);
  if (selectError) {
    console.error("Error fetching user_profiles:", selectError);
  } else {
    console.log("Found row structure:", rows);
    if (rows && rows.length > 0) {
      console.log("Existing columns in user_profiles table:", Object.keys(rows[0]));
    }
  }
  
  // Try a dry-run insert to see if 'created_at' or 'createdAt' is supported
  const dummyUser = {
    id: 'test_inspect_id_999',
    email: 'test_inspect@provisual.com',
    display_name: 'Inspect Test Account',
    password: 'password123',
    role: 'cliente',
    client_id: 'test_inspect_id_999'
  };
  
  console.log("Trying insertion of dummy user *WITHOUT* created_at/createdAt...");
  const { data: insertData, error: insertError } = await supabase.from('user_profiles').insert(dummyUser);
  if (insertError) {
    console.error("Insertion error without created_at:", insertError);
  } else {
    console.log("Insertion SUCCESS without created_at!");
    // Clean up
    await supabase.from('user_profiles').delete().eq('id', 'test_inspect_id_999');
  }
}

inspect();
