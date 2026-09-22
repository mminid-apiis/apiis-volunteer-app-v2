-- Izinkan OBS mode tanpa login (/obs) mengirim "Tanggapan" juga.
-- Tabel public.feedback punya RLS "insert to authenticated with check (user_id = auth.uid())",
-- yang tidak bisa dipenuhi sesi anon /obs (tidak ada auth.uid()). Fungsi ini memverifikasi kode
-- akses + identitas OBS yang dipilih sendiri (pola sama seperti obs_verify/obs_save_attendance),
-- lalu insert lewat SECURITY DEFINER supaya tetap melewati RLS dengan aman.
create or replace function public.obs_submit_feedback(p_code text, p_volunteer_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare vname text;
begin
  if not public.obs_check_code(p_code) then
    raise exception 'Kode akses salah';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'Tanggapan tidak boleh kosong';
  end if;
  select full_name into vname from public.profiles where id = p_volunteer_id and role = 'volunteer';
  if vname is null then
    raise exception 'OBS tidak dikenali';
  end if;

  insert into public.feedback (user_id, full_name, message)
  values (p_volunteer_id, vname, trim(p_message));
end;
$$;
grant execute on function public.obs_submit_feedback(text, uuid, text) to anon, authenticated;
