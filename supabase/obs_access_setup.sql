-- Kode akses bersama untuk mode "OBS tanpa login" (/obs) — jalankan sekali di SQL Editor.
-- Ini BUKAN password pribadi — dibagikan ke semua OBS lewat WhatsApp grup dsb.
-- Karena ini satu-satunya penghalang sebelum orang bisa mengisi nilai siswa,
-- pilih FRASA yang cukup panjang (bukan PIN 4 digit), misalnya "apiis-obs-2026".

-- Aman dijalankan berkali-kali: insert kalau belum ada, update kalau sudah ada
-- (mengganti kode kapan pun cukup jalankan ulang file ini dengan frasa baru).
do $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = 'obs_access_code';
  if existing_id is null then
    perform vault.create_secret('GANTI-DENGAN-FRASA-RAHASIA-KAMU', 'obs_access_code', 'Kode akses bersama mode OBS tanpa login');
  else
    perform vault.update_secret(existing_id, 'GANTI-DENGAN-FRASA-RAHASIA-KAMU', 'obs_access_code', 'Kode akses bersama mode OBS tanpa login');
  end if;
end $$;

-- Verifikasi (hanya melihat nama, bukan isi kodenya):
--   select name from vault.decrypted_secrets where name = 'obs_access_code';
