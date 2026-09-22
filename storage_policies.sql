-- Políticas para Supabase Storage (bucket gallery-albums já existe)
-- Executar este SQL separadamente após criar as tabelas

-- Política para leitura pública
DROP POLICY IF EXISTS "Public read access for gallery-albums" ON storage.objects;
CREATE POLICY "Public read access for gallery-albums" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'gallery-albums');

-- Política para upload (autenticado)
DROP POLICY IF EXISTS "Authenticated upload for gallery-albums" ON storage.objects;
CREATE POLICY "Authenticated upload for gallery-albums" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'gallery-albums' AND auth.role() = 'authenticated');

-- Política para delete (autenticado)
DROP POLICY IF EXISTS "Authenticated delete for gallery-albums" ON storage.objects;
CREATE POLICY "Authenticated delete for gallery-albums" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'gallery-albums' AND auth.role() = 'authenticated');
