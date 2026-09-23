import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://avfoqkigxuoofsztfdbi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEwNTQ0MywiZXhwIjoyMTA1NjgxNDQzfQ.qi5FhNAs7uZlnYzYG6lpudrmjaptNiaVaQdRIbns0L8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sql = `
-- gallery_albums
DROP POLICY IF EXISTS "Insert for gallery_albums" ON gallery_albums;
CREATE POLICY "Insert for gallery_albums" ON gallery_albums FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for gallery_albums" ON gallery_albums;
CREATE POLICY "Update for gallery_albums" ON gallery_albums FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for gallery_albums" ON gallery_albums;
CREATE POLICY "Delete for gallery_albums" ON gallery_albums FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read access for gallery_albums" ON gallery_albums;
CREATE POLICY "Public read access for gallery_albums" ON gallery_albums FOR SELECT USING (true);

-- gallery_photos
DROP POLICY IF EXISTS "Insert for gallery_photos" ON gallery_photos;
CREATE POLICY "Insert for gallery_photos" ON gallery_photos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for gallery_photos" ON gallery_photos;
CREATE POLICY "Update for gallery_photos" ON gallery_photos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for gallery_photos" ON gallery_photos;
CREATE POLICY "Delete for gallery_photos" ON gallery_photos FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read access for gallery_photos" ON gallery_photos;
CREATE POLICY "Public read access for gallery_photos" ON gallery_photos FOR SELECT USING (true);
`;

const { error } = await supabase.rpc('query', { sql }).catch(() => ({ error: null }));

// Tentar via REST direto
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql }),
});

if (!res.ok) {
  // Tentar via pg endpoint
  const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const pgBody = await pgRes.text();
  console.log('PG response:', pgRes.status, pgBody);
} else {
  const body = await res.text();
  console.log('✅ RLS policies aplicadas!', body);
}
