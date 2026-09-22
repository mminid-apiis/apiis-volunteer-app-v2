-- Kode akses bersama untuk mode "OBS tanpa login" (/obs) — jalankan sekali di SQL Editor.
-- Ini BUKAN password pribadi — dibagikan ke semua OBS lewat WhatsApp grup dsb.
-- Karena ini satu-satunya penghalang sebelum orang bisa mengisi nilai siswa,
-- pilih FRASA yang cukup panjang (bukan PIN 4 digit), misalnya "apiis-obs-2026".

select vault.create_secret('GANTI-DENGAN-FRASA-RAHASIA-KAMU', 'obs_access_code', 'Kode akses bersama mode OBS tanpa login');

-- Mengganti kode nanti (cari id dulu):
--   select id, name from vault.secrets where name = 'obs_access_code';
--   select vault.update_secret('<secret-id>', 'kode-baru', 'obs_access_code', 'Kode akses bersama mode OBS tanpa login');

-- Verifikasi (hanya melihat nama, bukan isi kodenya):
--   select name from vault.decrypted_secrets where name = 'obs_access_code';
