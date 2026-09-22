-- Adicionar colunas necessárias para login na tabela user_profiles
-- Executar este SQL primeiro no SQL Editor do Supabase

-- Adicionar colunas se não existirem
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cliente',
ADD COLUMN IF NOT EXISTS admin_token TEXT;

-- Remover a restrição UNIQUE antiga se existir (para evitar conflitos)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_client_email_key'
    ) THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_client_email_key;
    END IF;
END $$;
