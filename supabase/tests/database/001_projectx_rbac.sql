-- ProjectX RBAC regression tests.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  exists(select 1 from pg_namespace where nspname='private'),
  'private schema exists for RLS helpers'
);

select ok(
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='is_project_editor'
      and p.prosecdef
  ),
  'project editor helper is security definer in private schema'
);

select ok(
  not exists(
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='projects'
      and cmd='ALL'
  ),
  'projects has no broad member ALL policy'
);

select ok(
  not exists(
    select 1
    from pg_policies p
    join pg_class c on c.relname=p.tablename
    join pg_namespace n on n.oid=c.relnamespace and n.nspname=p.schemaname
    where p.schemaname='public'
      and p.cmd='ALL'
      and exists(
        select 1 from pg_attribute a
        where a.attrelid=c.oid
          and a.attname='project_id'
          and a.attnum>0
          and not a.attisdropped
      )
  ),
  'project-scoped tables have no broad ALL policy'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='projects'
      and policyname='project editors update'
      and cmd='UPDATE'
      and 'authenticated'=any(roles)
  ),
  'project update policy is authenticated-only'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='project_files'
      and policyname='project_files_editors_update'
      and cmd='UPDATE'
      and 'authenticated'=any(roles)
  ),
  'project file writes require authenticated editor policy'
);

select ok(
  not exists(
    select 1
    from information_schema.role_table_grants
    where grantee='anon'
      and table_schema='public'
      and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
  ),
  'anon has no direct table privileges in public schema'
);

select * from finish();
rollback;
