-- OBS 免登录模式:共享访问码 + 自选身份,任何 OBS 可为「任意」小组录入本周评估
-- (不受 assignments 限制)。背景:OBS 之间常临时互相代班,逐人登录太麻烦。
-- 共享码不是真正的身份验证,只是把"完全公开"和"逐人登录"之间的门槛调到中间——
-- 每次进入/保存都会记录操作人(自报)、设备、IP、时间,供管理员事后追溯。

-- 1) 访问日志表
create table if not exists public.obs_access_log (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid references public.profiles (id) on delete set null,
  full_name    text,                -- 冗余存一份,即使该志愿者后来被删也能看出是谁
  action       text not null check (action in ('enter', 'save_attendance')),
  group_id     uuid references public.groups (id) on delete set null,
  group_name   text,
  class_name   text,
  session_date date,
  device_info  text,
  ip_address   text,
  created_at   timestamptz not null default now()
);
create index if not exists obs_access_log_created_idx on public.obs_access_log (created_at desc);

alter table public.obs_access_log enable row level security;
drop policy if exists "obs_access_log_admin_select" on public.obs_access_log;
create policy "obs_access_log_admin_select" on public.obs_access_log
  for select to authenticated using (public.is_admin());
grant select on public.obs_access_log to authenticated;

-- 2) 共享访问码校验(码存 Vault,见 obs_access_setup.sql)。不对外单独开放,
--    只在下面各 obs_* 函数内部调用——避免把校验逻辑暴露成一个可反复试错的入口。
create or replace function public.obs_check_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare stored text;
begin
  select decrypted_secret into stored from vault.decrypted_secrets where name = 'obs_access_code';
  return stored is not null and p_code is not null and p_code = stored;
end;
$$;
revoke execute on function public.obs_check_code(text) from public, anon, authenticated;

-- 供前端探测 IP:PostgREST 会把请求头放进 request.headers 这个 GUC
create or replace function public.obs_client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
    current_setting('request.headers', true)::json ->> 'x-real-ip'
  );
$$;

-- 3) 验证访问码 + 选定身份,记一条"进入"日志
create or replace function public.obs_verify(p_code text, p_volunteer_id uuid, p_device_info text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare vname text;
begin
  if not public.obs_check_code(p_code) then
    return false;
  end if;
  select full_name into vname from public.profiles where id = p_volunteer_id and role = 'volunteer';
  if vname is null then
    return false;
  end if;
  insert into public.obs_access_log (volunteer_id, full_name, action, device_info, ip_address)
  values (p_volunteer_id, vname, 'enter', p_device_info, public.obs_client_ip());
  return true;
end;
$$;
grant execute on function public.obs_verify(text, uuid, text) to anon, authenticated;

-- 4) 志愿者名单(仅 id + 姓名,供"我是谁"下拉选择)
create or replace function public.obs_list_volunteers(p_code text)
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'volunteer' and public.obs_check_code(p_code)
  order by p.full_name;
$$;
grant execute on function public.obs_list_volunteers(text) to anon, authenticated;

-- 5) 班级 + 小组列表(不受 assignments 限制,任何组都能选——这是本功能的核心目的)
create or replace function public.obs_list_groups(p_code text)
returns table (cohort_id uuid, cohort_name text, group_id uuid, group_name text)
language sql
security definer
stable
set search_path = ''
as $$
  select c.id, c.name, g.id, g.name
  from public.groups g
  join public.cohorts c on c.id = g.cohort_id
  where public.obs_check_code(p_code)
  order by c.name, g.name;
$$;
grant execute on function public.obs_list_groups(text) to anon, authenticated;

-- 6) 某组学员名单(仅 id + 姓名,不含 email——与 get_group_students 对志愿者的限制一致)
create or replace function public.obs_group_students(p_code text, p_group_id uuid)
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = ''
as $$
  select s.id, s.full_name
  from public.students s
  where s.group_id = p_group_id and public.obs_check_code(p_code)
  order by s.full_name;
$$;
grant execute on function public.obs_group_students(text, uuid) to anon, authenticated;

-- 7) 读取某组某次课已存在的评估
create or replace function public.obs_get_attendance(p_code text, p_group_id uuid, p_session_date date)
returns setof public.attendance_records
language sql
security definer
stable
set search_path = ''
as $$
  select *
  from public.attendance_records
  where group_id = p_group_id and session_date = p_session_date and public.obs_check_code(p_code);
$$;
grant execute on function public.obs_get_attendance(text, uuid, date) to anon, authenticated;

-- 8) 保存评估(批量 upsert)+ 记一条"保存"日志(含班级/小组/日期,便于管理员追溯)
create or replace function public.obs_save_attendance(
  p_code         text,
  p_volunteer_id uuid,
  p_device_info  text,
  p_group_id     uuid,
  p_session_date date,
  p_rows         jsonb   -- [{student_id, contribution, notes}, ...]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vname    text;
  grp_name text;
  cls_name text;
begin
  if not public.obs_check_code(p_code) then
    raise exception 'Kode akses salah';
  end if;
  select full_name into vname from public.profiles where id = p_volunteer_id and role = 'volunteer';
  if vname is null then
    raise exception 'OBS tidak dikenali';
  end if;

  insert into public.attendance_records (group_id, student_id, volunteer_id, session_date, contribution, notes)
  select p_group_id, (r ->> 'student_id')::uuid, p_volunteer_id, p_session_date,
         nullif(r ->> 'contribution', '')::smallint, coalesce(r ->> 'notes', '')
  from jsonb_array_elements(p_rows) r
  on conflict (student_id, session_date) do update
    set contribution = excluded.contribution,
        notes        = excluded.notes,
        volunteer_id = excluded.volunteer_id;

  select g.name, c.name into grp_name, cls_name
  from public.groups g join public.cohorts c on c.id = g.cohort_id
  where g.id = p_group_id;

  insert into public.obs_access_log
    (volunteer_id, full_name, action, group_id, group_name, class_name, session_date, device_info, ip_address)
  values
    (p_volunteer_id, vname, 'save_attendance', p_group_id, grp_name, cls_name, p_session_date, p_device_info, public.obs_client_ip());
end;
$$;
grant execute on function public.obs_save_attendance(text, uuid, text, uuid, date, jsonb) to anon, authenticated;
