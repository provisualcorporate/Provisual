-- Criar tabelas necessárias para o projeto Provisual Corporate

-- Tabela user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'cliente',
  display_name TEXT,
  admin_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela folders
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  display_name TEXT,
  client_email TEXT,
  owner_id TEXT,
  versions TEXT,
  trashed BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela assets (com unique constraint em drive_id)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  drive_id TEXT UNIQUE,
  folder_id TEXT,
  owner_id TEXT,
  parent_id TEXT,
  capture_date TIMESTAMPTZ,
  upload_date TIMESTAMPTZ,
  thumbnail_url TEXT,
  display_name TEXT,
  client_id TEXT,
  client_email TEXT,
  versions TEXT,
  trashed BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela gallery_albums (para álbuns de fotos no Supabase Storage)
CREATE TABLE IF NOT EXISTS gallery_albums (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela gallery_photos (para fotos dentro dos álbuns)
CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  album_id TEXT NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (ajustar conforme necessário)
DROP POLICY IF EXISTS "Public read access for user_profiles" ON user_profiles;
CREATE POLICY "Public read access for user_profiles" ON user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for folders" ON folders;
CREATE POLICY "Public read access for folders" ON folders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for assets" ON assets;
CREATE POLICY "Public read access for assets" ON assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for settings" ON settings;
CREATE POLICY "Public read access for settings" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for gallery_albums" ON gallery_albums;
CREATE POLICY "Public read access for gallery_albums" ON gallery_albums FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for gallery_photos" ON gallery_photos;
CREATE POLICY "Public read access for gallery_photos" ON gallery_photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert for user_profiles" ON user_profiles;
CREATE POLICY "Insert for user_profiles" ON user_profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for user_profiles" ON user_profiles;
CREATE POLICY "Update for user_profiles" ON user_profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for user_profiles" ON user_profiles;
CREATE POLICY "Delete for user_profiles" ON user_profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Insert for folders" ON folders;
CREATE POLICY "Insert for folders" ON folders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for folders" ON folders;
CREATE POLICY "Update for folders" ON folders FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for folders" ON folders;
CREATE POLICY "Delete for folders" ON folders FOR DELETE USING (true);

DROP POLICY IF EXISTS "Insert for assets" ON assets;
CREATE POLICY "Insert for assets" ON assets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for assets" ON assets;
CREATE POLICY "Update for assets" ON assets FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for assets" ON assets;
CREATE POLICY "Delete for assets" ON assets FOR DELETE USING (true);

DROP POLICY IF EXISTS "Insert for settings" ON settings;
CREATE POLICY "Insert for settings" ON settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for settings" ON settings;
CREATE POLICY "Update for settings" ON settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for settings" ON settings;
CREATE POLICY "Delete for settings" ON settings FOR DELETE USING (true);

DROP POLICY IF EXISTS "Insert for gallery_albums" ON gallery_albums;
CREATE POLICY "Insert for gallery_albums" ON gallery_albums FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for gallery_albums" ON gallery_albums;
CREATE POLICY "Update for gallery_albums" ON gallery_albums FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for gallery_albums" ON gallery_albums;
CREATE POLICY "Delete for gallery_albums" ON gallery_albums FOR DELETE USING (true);

DROP POLICY IF EXISTS "Insert for gallery_photos" ON gallery_photos;
CREATE POLICY "Insert for gallery_photos" ON gallery_photos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update for gallery_photos" ON gallery_photos;
CREATE POLICY "Update for gallery_photos" ON gallery_photos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete for gallery_photos" ON gallery_photos;
CREATE POLICY "Delete for gallery_photos" ON gallery_photos FOR DELETE USING (true);
