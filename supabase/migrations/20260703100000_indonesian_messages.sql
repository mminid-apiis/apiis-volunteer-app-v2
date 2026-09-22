-- 把后端(SQL)生成的通知标题/正文、邮件主题/HTML、以及会经 toast 显示给用户的
-- RPC 错误信息全部改成印尼语。纯文案替换,逻辑/签名/权限一律不变
-- (内部专用的中文提示,如「只有管理员可手动运行」，维持原样，不在此次范围内)。

-- ============================== run_weekly_availability_check ==============================
create or replace function public.run_weekly_availability_check(
  p_send_email boolean default false,
  p_curriculum text default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  wk          date := public.next_week_monday();
  s           public.app_settings;
  n           integer := 0;
  app_url     text;
  email_batch jsonb;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception '只有管理员可手动运行';
  end if;
  select * into s from public.app_settings where id;
  if s.reminders_enabled is distinct from true then return 0; end if;
  if not exists (
    select 1 from public.class_sessions
    where session_date = wk and (p_curriculum is null or curriculum = p_curriculum)
  ) then
    return 0;
  end if;

  insert into public.availability (volunteer_id, group_id, week_start_date, is_available)
  select distinct a.volunteer_id, a.group_id, wk, null::boolean
  from public.assignments a
  join public.groups g on g.id = a.group_id
  join public.cohorts c on c.id = g.cohort_id
  join public.profiles p on p.id = a.volunteer_id
  where p.role = 'volunteer' and a.coverage_week is null
    and (p_curriculum is null or c.name like p_curriculum || '%')
  on conflict (volunteer_id, group_id, week_start_date) do nothing;

  insert into public.notifications (recipient_id, type, title, body)
  select p.id, 'weekly_check', 'Kamu bisa hadir minggu depan?',
         'Mohon konfirmasi, untuk tiap grup yang kamu tangani, apakah kamu bisa mengawasi selama minggu dari '
         || to_char(wk, 'YYYY-MM-DD') || '.'
  from public.profiles p
  where p.role = 'volunteer'
    and (p_curriculum is null or exists (
      select 1 from public.assignments a
      join public.groups g on g.id = a.group_id
      join public.cohorts c on c.id = g.cohort_id
      where a.volunteer_id = p.id and c.name like p_curriculum || '%'
    ));
  get diagnostics n = row_count;

  if p_send_email then
    select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
    select coalesce(jsonb_agg(jsonb_build_object(
             'to', u.email,
             'subject', 'APIIS — Kamu bisa hadir minggu depan?',
             'html', '<p>Hai ' || coalesce(p.full_name, '') || ',</p>'
                     || '<p>Mohon konfirmasi apakah kamu bisa mengawasi kelas berikut minggu depan (minggu dari <b>'
                     || to_char(wk, 'YYYY-MM-DD') || '</b>):</p>'
                     || '<ul>' || coalesce((
                          select string_agg('<li>' || c2.name || ' — ' || g2.name || '</li>', '' order by c2.name, g2.name)
                          from public.assignments a2
                          join public.groups g2 on g2.id = a2.group_id
                          join public.cohorts c2 on c2.id = g2.cohort_id
                          where a2.volunteer_id = p.id and a2.coverage_week is null
                            and (p_curriculum is null or c2.name like p_curriculum || '%')
                        ), '<li>grup yang kamu tangani</li>') || '</ul>'
                     || '<p>Buka aplikasi untuk menjawab Ya/Tidak untuk tiap grup:</p>'
                     || case when app_url is not null then '<p><a href="' || app_url || '">Buka APIIS Volunteer APP</a></p>' else '' end
           )), '[]'::jsonb)
      into email_batch
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'volunteer' and u.email is not null
      and (p_curriculum is null or exists (
        select 1 from public.assignments a
        join public.groups g on g.id = a.group_id
        join public.cohorts c on c.id = g.cohort_id
        where a.volunteer_id = p.id and c.name like p_curriculum || '%'
      ));
    perform public.app_send_email_batch(email_batch);
  end if;

  return n;
end;
$$;

-- ============================== run_summarize_coverage ==============================
create or replace function public.run_summarize_coverage(
  p_send_email boolean default false,
  p_curriculum text default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  wk          date := public.next_week_monday();
  n           integer := 0;
  app_url     text;
  email_batch jsonb;
  has_open    boolean;
  open_html   text;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception '只有管理员可手动运行';
  end if;
  if not exists (select 1 from public.class_sessions where session_date = wk) then
    return 0;
  end if;

  -- 缺口:某组的原负责人本周标了不可用 → 建补位(仅那周有课的组)
  insert into public.coverage_requests (group_id, week_start_date, reason, status)
  select distinct av.group_id, wk, 'OBS yang ditugaskan tidak bisa hadir', 'open'
  from public.availability av
  join public.groups g on g.id = av.group_id
  join public.cohorts c on c.id = g.cohort_id
  where av.week_start_date = wk and av.is_available = false
    and exists (select 1 from public.class_sessions cs where cs.session_date = wk and cs.curriculum = left(c.name, 6))
  on conflict (group_id, week_start_date) do nothing;

  select exists (select 1 from public.coverage_requests where week_start_date = wk and status = 'open') into has_open;

  if has_open then
    -- 收件人:本周至少有一个组标了 available 的志愿者(+ 可选课程过滤)
    insert into public.notifications (recipient_id, type, title, body)
    select p.id, 'coverage_request', 'Butuh pengganti',
           'Beberapa grup butuh pengganti untuk minggu dari ' || to_char(wk, 'YYYY-MM-DD') || '. Bisakah kamu bantu?'
    from public.profiles p
    where p.role = 'volunteer'
      and exists (
        select 1 from public.availability av
        where av.volunteer_id = p.id and av.week_start_date = wk and av.is_available = true
      )
      and (p_curriculum is null or exists (
        select 1 from public.assignments a
        join public.groups g on g.id = a.group_id
        join public.cohorts c on c.id = g.cohort_id
        where a.volunteer_id = p.id and c.name like p_curriculum || '%'
      ));

    if p_send_email then
      select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';

      select coalesce(string_agg('<li>' || c.name || ' — ' || g.name || '</li>', '' order by c.name, g.name), '')
        into open_html
      from public.coverage_requests cr
      join public.groups g on g.id = cr.group_id
      join public.cohorts c on c.id = g.cohort_id
      where cr.week_start_date = wk and cr.status = 'open';

      select coalesce(jsonb_agg(jsonb_build_object(
               'to', u.email,
               'subject', 'APIIS — Butuh pengganti',
               'html', '<p>Hai ' || coalesce(p.full_name, '') || ',</p>'
                       || '<p>Grup-grup ini butuh pengganti untuk minggu dari <b>' || to_char(wk, 'YYYY-MM-DD') || '</b>. Bisakah kamu bantu?</p>'
                       || '<ul>' || open_html || '</ul>'
                       || case when app_url is not null then '<p><a href="' || app_url || '">Buka APIIS Volunteer APP untuk klaim</a></p>' else '' end
             )), '[]'::jsonb)
        into email_batch
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.role = 'volunteer' and u.email is not null
        and exists (
          select 1 from public.availability av
          where av.volunteer_id = p.id and av.week_start_date = wk and av.is_available = true
        )
        and (p_curriculum is null or exists (
          select 1 from public.assignments a
          join public.groups g on g.id = a.group_id
          join public.cohorts c on c.id = g.cohort_id
          where a.volunteer_id = p.id and c.name like p_curriculum || '%'
        ));
      perform public.app_send_email_batch(email_batch);
    end if;
  end if;

  select count(*) into n from public.coverage_requests where week_start_date = wk and status = 'open';
  return n;
end;
$$;

-- ============================== claim_coverage ==============================
create or replace function public.claim_coverage(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  req public.coverage_requests;
begin
  if uid is null then
    raise exception 'Belum masuk (belum login)';
  end if;

  select * into req from public.coverage_requests where id = p_request_id for update;
  if not found then
    raise exception 'Permintaan pengganti tidak ditemukan';
  end if;
  if req.status <> 'open' then
    raise exception 'Permintaan ini sudah ada yang menggantikan';
  end if;

  -- 每人每周最多认领一个补位组
  if exists (
    select 1 from public.assignments a
    where a.volunteer_id = uid and a.coverage_week = req.week_start_date
  ) then
    raise exception 'Kamu hanya bisa menggantikan satu grup per minggu';
  end if;

  update public.coverage_requests
    set status = 'covered', covered_by = uid
    where id = p_request_id;

  insert into public.assignments (group_id, volunteer_id, coverage_week)
    values (req.group_id, uid, req.week_start_date)
    on conflict (group_id, volunteer_id) do nothing;
end;
$$;

-- ============================== admin_reopen_coverage ==============================
create or replace function public.admin_reopen_coverage(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req       public.coverage_requests;
  grp_name  text;
  cls_name  text;
  sess_date date;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  select * into req from public.coverage_requests where id = p_request_id for update;
  if not found then
    raise exception 'Permintaan pengganti tidak ditemukan';
  end if;

  -- 释放原认领人的临时补位分配
  if req.covered_by is not null then
    delete from public.assignments
    where group_id = req.group_id
      and volunteer_id = req.covered_by
      and coverage_week = req.week_start_date;
  end if;

  -- 请求改回 open
  update public.coverage_requests
    set status = 'open', covered_by = null
    where id = p_request_id;

  -- 组名 / 班名 / 实际上课日(周二班 = 周一 +1)
  select g.name, c.name into grp_name, cls_name
  from public.groups g
  join public.cohorts c on c.id = g.cohort_id
  where g.id = req.group_id;
  sess_date := req.week_start_date + case when cls_name ilike '%tuesday%' then 1 else 0 end;

  -- 主动站内通知本周 available 的志愿者(不发邮件)
  insert into public.notifications (recipient_id, type, title, body)
  select p.id, 'general', 'Butuh pengganti lagi',
         coalesce(grp_name, 'Sebuah grup') || ' · ' || coalesce(cls_name, '')
         || ' butuh pengganti pada ' || to_char(sess_date, 'YYYY-MM-DD')
         || '. Buka APIIS Volunteer untuk klaim.'
  from public.profiles p
  where p.role = 'volunteer'
    and exists (
      select 1 from public.availability av
      where av.volunteer_id = p.id
        and av.week_start_date = req.week_start_date
        and av.is_available = true
    );
end;
$$;

-- ============================== admin_import_volunteer ==============================
create or replace function public.admin_import_volunteer(
  p_email     text,
  p_full_name text,
  p_phone     text,
  p_password  text,
  p_group_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya super admin';
  end if;
  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email wajib diisi';
  end if;

  select id into uid from auth.users where lower(email) = lower(btrim(p_email));

  if uid is null then
    if p_password is null or p_password = '' then
      raise exception 'Password wajib diisi untuk OBS baru';
    end if;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(btrim(p_email)), crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', coalesce(p_full_name, ''), 'role', 'volunteer', 'phone', p_phone),
      false, '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', lower(btrim(p_email))), 'email', now(), now(), now());
  end if;

  -- 角色：新账号 = volunteer(下面 values);已存在用户不动其 role(保住 admin / super_admin)
  insert into public.profiles (id, full_name, role, phone)
  values (uid, coalesce(p_full_name, ''), 'volunteer', p_phone)
  on conflict (id) do update
    set full_name = excluded.full_name, phone = excluded.phone;

  if p_group_id is not null then
    insert into public.assignments (group_id, volunteer_id)
    values (p_group_id, uid)
    on conflict (group_id, volunteer_id) do nothing;
  end if;

  return uid;
end;
$$;

-- ============================== admin_delete_volunteer ==============================
create or replace function public.admin_delete_volunteer(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya super admin';
  end if;
  if p_id = (select auth.uid()) then
    raise exception 'Kamu tidak bisa menghapus akunmu sendiri';
  end if;
  select role into target_role from public.profiles where id = p_id;
  if target_role is null then
    raise exception 'Pengguna tidak ditemukan';
  end if;
  if target_role = 'super_admin' then
    raise exception 'Super admin tidak bisa dihapus di sini';
  end if;
  delete from auth.users where id = p_id;
end;
$$;

-- ============================== admin_clear_assignments ==============================
create or replace function public.admin_clear_assignments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya super admin';
  end if;
  -- 用 TRUNCATE 清空:启用了 safeupdate 的库会拒绝不带 WHERE 的 DELETE;TRUNCATE 不受其约束
  select count(*) into n from public.assignments;
  truncate table public.assignments;
  return n;
end;
$$;

-- ============================== admin_assign_volunteer ==============================
create or replace function public.admin_assign_volunteer(p_group_id uuid, p_volunteer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  -- 1) 建立永久分配(与界面手动指派一致,标记 manual → 组上显示深蓝)
  insert into public.assignments (group_id, volunteer_id, source)
  values (p_group_id, p_volunteer_id, 'manual')
  on conflict (group_id, volunteer_id) do nothing;

  -- 2) 同步:该组所有未认领的补位请求 → 已覆盖,覆盖人 = 被指派者
  update public.coverage_requests
    set status = 'covered', covered_by = p_volunteer_id
    where group_id = p_group_id and status = 'open';
end;
$$;
