-- Inserir usuários existentes no Supabase
-- Executar este SQL no SQL Editor do Supabase

INSERT INTO user_profiles (id, email, password, role, display_name, admin_token, created_at) VALUES
  ('user_edwina_001', 'edwinaxavier98@gmail.com', 'rdjL9$O4pC', 'cliente', 'Edwina - Autoidade tributaria', NULL, NOW()),
  ('user_edy_001', 'edy@provisualcorporate.co.mz', 'EdyPro#2026', 'cliente', 'Edy - Provisual Corporate', NULL, NOW()),
  ('user_joana_001', 'joana@provisualcorporate.co.mz', 'JoanaPro#2026', 'admin', 'Joana - ProVisual Corporate', 'Silva_Chamo_Master_Admin_2026', NOW()),
  ('user_provisual_001', 'provisualcorp@gmail.com', 'VisualCorp#2020', 'cliente', 'Provisual - ProvisualCorporate', NULL, NOW()),
  ('admin_master_silva', 'silva.chamo@gmail.com', 'Administrador#01?*', 'admin', 'Silva Chamo (Admin Master)', 'Silva_Chamo_Master_Admin_2026', NOW())
ON CONFLICT (email) DO NOTHING;
