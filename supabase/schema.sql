-- Exclusivamente para un NUEVO proyecto Supabase de BellaShop Beneficios.
-- NO ejecutar en RutaYa ni en BellaShop Inventario.
create extension if not exists pgcrypto;
create table public.teachers (
 id uuid primary key default gen_random_uuid(),
 display_name text not null check (length(trim(display_name)) between 3 and 120),
 slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.students (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (length(trim(full_name)) between 4 and 120),
 phone text not null unique check (phone ~ '^3[0-9]{9}$'),
 teacher_id uuid not null references public.teachers(id),
 status text not null default 'active' check (status in ('active','suspended')),
 consented_at timestamptz not null,
 policy_version text not null,
 created_at timestamptz not null default now()
);
create index students_teacher_idx on public.students(teacher_id);
create index students_created_idx on public.students(created_at desc);
create table public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.benefits (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.teachers(id),
 title text not null check (length(trim(title)) between 3 and 120),
 percent_off numeric(5,2) not null check (percent_off>0 and percent_off<=100),
 product_codes text[] not null check (cardinality(product_codes)>0),
 terms text not null default '' check (length(terms)<=500),
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index benefits_teacher_idx on public.benefits(teacher_id);
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.admins enable row level security;
alter table public.benefits enable row level security;
revoke all on public.teachers,public.students,public.admins,public.benefits from anon,authenticated;
grant select on public.teachers to anon;
grant select,insert,update,delete on public.teachers to authenticated;
grant select on public.students to authenticated;
grant update(status) on public.students to authenticated;
grant select on public.admins to authenticated;
grant select,insert,update,delete on public.benefits to authenticated;
create policy "lectura_publica_profesoras_activas" on public.teachers
 for select to anon using(active=true);
create policy "admin_puede_ver_su_permiso" on public.admins
 for select to authenticated using(user_id=(select auth.uid()) and enabled);
create policy "admin_gestiona_profesoras" on public.teachers
 for all to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled))
 with check(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy "admin_consulta_estudiantes" on public.students
 for select to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy "admin_cambia_estado_estudiantes" on public.students
 for update to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled))
 with check(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy "admin_gestiona_beneficios" on public.benefits
 for all to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled))
 with check(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
insert into public.teachers(display_name,slug) values ('Master Viviana','viviana');
-- Luego de crear usuario en Auth > Users:
-- insert into public.admins(user_id) values ('UID_DEL_USUARIO_AUTH');

-- Funcionalidades adicionales de temporada instaladas en Master Viviana:
-- registro directo, herramientas CRUD del administrador y apertura/cierre de inscripciones.
grant insert, delete on public.students to authenticated;
grant update(full_name, phone, teacher_id, status) on public.students to authenticated;
create policy "admin_agrega_estudiantes" on public.students
 for insert to authenticated
 with check(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy "admin_elimina_estudiantes" on public.students
 for delete to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));

create table public.campaign_settings(
 id smallint primary key default 1 check(id=1),
 registration_open boolean not null default true,
 ends_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.campaign_settings enable row level security;
revoke all on public.campaign_settings from public,anon,authenticated;
grant select on public.campaign_settings to anon;
grant select,update on public.campaign_settings to authenticated;
create policy "public_consulta_estado_campana" on public.campaign_settings
 for select to anon using(true);
create policy "admin_consulta_campana" on public.campaign_settings
 for select to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
create policy "admin_edita_campana" on public.campaign_settings
 for update to authenticated
 using(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled))
 with check(exists(select 1 from public.admins a where a.user_id=(select auth.uid()) and a.enabled));
insert into public.campaign_settings(id,registration_open) values(1,true);

create table public.bella_registration_limits(
 bucket text primary key,
 attempts integer not null default 0,
 expires_at timestamptz not null
);
alter table public.bella_registration_limits enable row level security;
revoke all on public.bella_registration_limits from public,anon,authenticated;
grant select,insert,update,delete on public.bella_registration_limits to service_role;
create function public.bella_check_registration_limit(
 p_bucket text,p_max integer,p_window_seconds integer
) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare hits integer;
begin
 if length(p_bucket)>180 or length(p_bucket)<3 or p_max not between 1 and 1000
  or p_window_seconds not between 60 and 86400 then return false; end if;
 insert into public.bella_registration_limits(bucket,attempts,expires_at)
 values(p_bucket,1,now()+make_interval(secs=>p_window_seconds))
 on conflict(bucket) do update
 set attempts=case when public.bella_registration_limits.expires_at<=now() then 1 else public.bella_registration_limits.attempts+1 end,
     expires_at=case when public.bella_registration_limits.expires_at<=now() then now()+make_interval(secs=>p_window_seconds)
     else public.bella_registration_limits.expires_at end
 returning attempts into hits;
 return hits<=p_max;
end $$;
revoke all on function public.bella_check_registration_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.bella_check_registration_limit(text,integer,integer) to service_role;
