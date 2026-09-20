create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;


-- V7 analytics and payment readiness
create table if not exists public.payment_analytics (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  provider text not null default 'razorpay',
  plan_key text,
  amount_paise bigint,
  currency text not null default 'INR',
  external_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_analytics_event_created_idx on public.payment_analytics(event_name,created_at desc);
create index if not exists payment_analytics_user_created_idx on public.payment_analytics(user_id,created_at desc);

-- Existing Builder tables. This migration is additive and preserves the original project model.
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, avatar_url text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.workspaces (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, name text not null default 'My Workspace', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.workspace_members (workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'member' check (role in ('owner','admin','editor','viewer')), created_at timestamptz default now(), primary key(workspace_id,user_id));
create table if not exists public.projects (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete cascade, title text not null, intention text not null, project_type text not null default 'custom', classification jsonb not null default '{}'::jsonb, plan jsonb not null default '[]'::jsonb, status text not null default 'planning', readiness int not null default 0 check(readiness between 0 and 100), progress int not null default 0 check(progress between 0 and 100), settings jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.project_files (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, path text not null, content text not null default '', mime_type text not null default 'text/plain', size_bytes int not null default 0, checksum text, created_at timestamptz default now(), updated_at timestamptz default now(), unique(project_id,path));
create table if not exists public.project_messages (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, user_id uuid references auth.users(id) on delete set null, role text not null check(role in ('user','assistant','system','tool')), mode text not null default 'build', content jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.project_versions (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, version_number int not null, label text not null, snapshot jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null, created_at timestamptz default now(), unique(project_id,version_number));
create table if not exists public.attachments (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, bucket text not null, path text not null, original_name text not null, mime_type text, size_bytes bigint, metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.research_findings (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, query text not null, finding text not null, source_title text, source_url text, source_date date, confidence numeric(4,3), provider text, raw jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.project_memory (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, content text not null, embedding vector(768), metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.workflows (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, name text not null, definition jsonb not null default '{}'::jsonb, enabled boolean not null default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.workflow_runs (id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.workflows(id) on delete cascade, status text not null default 'queued', input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb, error text, started_at timestamptz, finished_at timestamptz, created_at timestamptz default now());
create table if not exists public.agents (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, name text not null, instructions text not null default '', tools jsonb not null default '[]'::jsonb, permissions jsonb not null default '{}'::jsonb, memory jsonb not null default '{}'::jsonb, enabled boolean not null default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.test_cases (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, name text not null, definition jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.test_runs (id uuid primary key default gen_random_uuid(), test_case_id uuid not null references public.test_cases(id) on delete cascade, status text not null default 'queued', result jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.security_scans (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, status text not null default 'queued', findings jsonb not null default '[]'::jsonb, created_at timestamptz default now());
create table if not exists public.analytics_events (id bigint generated always as identity primary key, project_id uuid references public.projects(id) on delete cascade, user_id uuid references auth.users(id) on delete set null, event_name text not null, properties jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.ai_usage (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade, action text not null, provider text not null, model text, units numeric not null default 1, created_at timestamptz default now());
create table if not exists public.credit_transactions (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, kind text not null check(kind in('build','integration')), amount int not null, reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table if not exists public.connected_accounts (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, provider text not null, account_label text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique(workspace_id,provider));
create table if not exists public.deployments (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, provider text not null, status text not null default 'queued', url text, provider_project text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());

-- New encrypted credential vault. Never expose this table directly to the browser.
create table if not exists public.ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('bytez','openrouter','openai','google','anthropic','generic')),
  label text not null default 'Personal key',
  api_key_ciphertext text not null,
  provider_key_ciphertext text,
  base_url text,
  key_hint text not null default '••••',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create or replace function public.is_workspace_member(wid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.workspace_members where workspace_id=wid and user_id=uid); $$;
create or replace function public.is_project_member(pid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.projects p join public.workspace_members m on m.workspace_id=p.workspace_id where p.id=pid and m.user_id=uid); $$;

alter table public.profiles enable row level security; alter table public.workspaces enable row level security; alter table public.workspace_members enable row level security; alter table public.projects enable row level security; alter table public.project_files enable row level security; alter table public.project_messages enable row level security; alter table public.project_versions enable row level security; alter table public.attachments enable row level security; alter table public.research_findings enable row level security; alter table public.project_memory enable row level security; alter table public.workflows enable row level security; alter table public.workflow_runs enable row level security; alter table public.agents enable row level security; alter table public.test_cases enable row level security; alter table public.test_runs enable row level security; alter table public.security_scans enable row level security; alter table public.analytics_events enable row level security; alter table public.ai_usage enable row level security; alter table public.credit_transactions enable row level security; alter table public.connected_accounts enable row level security; alter table public.deployments enable row level security; alter table public.ai_provider_credentials enable row level security; alter table public.payment_analytics enable row level security;

drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "workspace read" on public.workspaces;
create policy "workspace read" on public.workspaces for select using(public.is_workspace_member(id));
drop policy if exists "workspace owner" on public.workspaces;
create policy "workspace owner" on public.workspaces for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "member read" on public.workspace_members;
create policy "member read" on public.workspace_members for select using(user_id=auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists "owner manages members" on public.workspace_members;
create policy "owner manages members" on public.workspace_members for all using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())) with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
drop policy if exists "project members" on public.projects;
create policy "project members" on public.projects for all using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));
drop policy if exists "files" on public.project_files;
create policy "files" on public.project_files for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "messages" on public.project_messages;
create policy "messages" on public.project_messages for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "versions" on public.project_versions;
create policy "versions" on public.project_versions for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "attachments" on public.attachments;
create policy "attachments" on public.attachments for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "research" on public.research_findings;
create policy "research" on public.research_findings for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "memory" on public.project_memory;
create policy "memory" on public.project_memory for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "workflows" on public.workflows;
create policy "workflows" on public.workflows for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "workflow runs" on public.workflow_runs;
create policy "workflow runs" on public.workflow_runs for all using(exists(select 1 from public.workflows w where w.id=workflow_id and public.is_project_member(w.project_id))) with check(exists(select 1 from public.workflows w where w.id=workflow_id and public.is_project_member(w.project_id)));
drop policy if exists "agents" on public.agents;
create policy "agents" on public.agents for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "tests" on public.test_cases;
create policy "tests" on public.test_cases for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "test runs" on public.test_runs;
create policy "test runs" on public.test_runs for all using(exists(select 1 from public.test_cases tc where tc.id=test_case_id and public.is_project_member(tc.project_id))) with check(exists(select 1 from public.test_cases tc where tc.id=test_case_id and public.is_project_member(tc.project_id)));
drop policy if exists "security" on public.security_scans;
create policy "security" on public.security_scans for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));
drop policy if exists "analytics" on public.analytics_events;
create policy "analytics" on public.analytics_events for all using(project_id is null or public.is_project_member(project_id)) with check(project_id is null or public.is_project_member(project_id));
drop policy if exists "usage read" on public.ai_usage;
create policy "usage read" on public.ai_usage for select using(user_id=auth.uid());
drop policy if exists "credits read" on public.credit_transactions;
create policy "credits read" on public.credit_transactions for select using(user_id=auth.uid());
drop policy if exists "connected read" on public.connected_accounts;
create policy "connected read" on public.connected_accounts for select using(public.is_workspace_member(workspace_id));
drop policy if exists "deployment" on public.deployments;
create policy "deployment" on public.deployments for all using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));

-- Intentionally no client policy on ai_provider_credentials. Only the Edge Function service role can read/write encrypted secrets.

insert into storage.buckets(id,name,public) values('builder-attachments','builder-attachments',false) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('builder-assets','builder-assets',false) on conflict(id) do nothing;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',new.email)) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();


-- Payment analytics are backend-written; users may read only their own events.
drop policy if exists "payment analytics own read" on public.payment_analytics;
create policy "payment analytics own read" on public.payment_analytics for select using(user_id=auth.uid());
revoke insert, update, delete on public.payment_analytics from anon, authenticated;


-- Final RBAC hardening (kept in bootstrap schema as well as the migration).
-- The canonical migration is supabase/migrations/20260920110000_projectx_rbac_hardening.sql.
create schema if not exists private;
create or replace function private.is_workspace_member(wid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.workspace_members wm where wm.workspace_id=wid and wm.user_id=uid); $$;
create or replace function private.workspace_role(wid uuid, uid uuid default auth.uid()) returns text language sql stable security definer set search_path=''
as $$ select wm.role from public.workspace_members wm where wm.workspace_id=wid and wm.user_id=uid limit 1; $$;
create or replace function private.is_project_member(pid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.projects p join public.workspace_members wm on wm.workspace_id=p.workspace_id where p.id=pid and wm.user_id=uid); $$;
create or replace function private.is_project_editor(pid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.projects p join public.workspace_members wm on wm.workspace_id=p.workspace_id where p.id=pid and wm.user_id=uid and wm.role in ('owner','admin','editor')); $$;
create or replace function private.protect_project_tenant_fields() returns trigger language plpgsql set search_path=''
as $$ begin if tg_op='UPDATE' and (new.owner_id is distinct from old.owner_id or new.workspace_id is distinct from old.workspace_id) then raise exception 'Project ownership and workspace cannot be changed directly'; end if; return new; end; $$;
drop trigger if exists projects_protect_tenant_fields on public.projects;
create trigger projects_protect_tenant_fields before update on public.projects for each row execute function private.protect_project_tenant_fields();
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_workspace_member(uuid,uuid),private.workspace_role(uuid,uuid),private.is_project_member(uuid,uuid),private.is_project_editor(uuid,uuid) from public,anon;
grant execute on function private.is_workspace_member(uuid,uuid),private.workspace_role(uuid,uuid),private.is_project_member(uuid,uuid),private.is_project_editor(uuid,uuid) to authenticated;
revoke all on function public.is_workspace_member(uuid,uuid),public.is_project_member(uuid,uuid) from public,anon,authenticated;
do $$ declare r record; begin for r in select distinct p.schemaname,p.tablename,p.policyname from pg_policies p join pg_class c on c.relname=p.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname=p.schemaname where p.schemaname='public' and p.cmd='ALL' and p.tablename not in ('projects','engine_run_events','test_runs','workflow_runs','project_brain_mutations') and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='project_id' and a.attnum>0 and not a.attisdropped) loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop; end $$;
drop policy if exists "project members" on public.projects;
drop policy if exists "project members read" on public.projects;
drop policy if exists "project editors insert" on public.projects;
drop policy if exists "project editors update" on public.projects;
drop policy if exists "project editors delete" on public.projects;
create policy "project members read" on public.projects for select to authenticated using((select private.is_workspace_member(workspace_id)));
create policy "project editors insert" on public.projects for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_workspace_member(workspace_id,auth.uid())));
create policy "project editors update" on public.projects for update to authenticated using((select private.is_project_editor(id))) with check((select private.is_project_editor(id)));
create policy "project editors delete" on public.projects for delete to authenticated using((select private.is_project_editor(id)));
do $$ declare t text; begin foreach t in array ARRAY['agents','attachments','browser_test_runs','compile_attempts','deploy_attempts','deployments','engine_runs','project_capabilities','project_decisions','project_files','project_memory','project_messages','project_observability','project_requirements','project_resources','project_snapshots','project_versions','research_findings','security_scans','self_heal_runs','synthetic_user_runs','test_cases','transform_runs','workflows'] loop execute format('create policy %I on public.%I for select to authenticated using ((select private.is_project_member(project_id)))',t||'_members_read',t); execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_project_editor(project_id)))',t||'_editors_insert',t); execute format('create policy %I on public.%I for update to authenticated using ((select private.is_project_editor(project_id))) with check ((select private.is_project_editor(project_id)))',t||'_editors_update',t); execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_project_editor(project_id)))',t||'_editors_delete',t); end loop; end $$;
drop policy if exists "engine events project members" on public.engine_run_events;
drop policy if exists "engine events members read" on public.engine_run_events;
create policy "engine events members read" on public.engine_run_events for select to authenticated using(exists(select 1 from public.engine_runs r where r.id=engine_run_events.run_id and (select private.is_project_member(r.project_id))));
create policy "engine events editors insert" on public.engine_run_events for insert to authenticated with check(exists(select 1 from public.engine_runs r where r.id=engine_run_events.run_id and (select private.is_project_editor(r.project_id))));
create policy "engine events editors update" on public.engine_run_events for update to authenticated using(exists(select 1 from public.engine_runs r where r.id=engine_run_events.run_id and (select private.is_project_editor(r.project_id)))) with check(exists(select 1 from public.engine_runs r where r.id=engine_run_events.run_id and (select private.is_project_editor(r.project_id))));
create policy "engine events editors delete" on public.engine_run_events for delete to authenticated using(exists(select 1 from public.engine_runs r where r.id=engine_run_events.run_id and (select private.is_project_editor(r.project_id))));
drop policy if exists "test runs" on public.test_runs;
drop policy if exists "test runs members read" on public.test_runs;
create policy "test runs members read" on public.test_runs for select to authenticated using(exists(select 1 from public.test_cases tc where tc.id=test_runs.test_case_id and (select private.is_project_member(tc.project_id))));
create policy "test runs editors insert" on public.test_runs for insert to authenticated with check(exists(select 1 from public.test_cases tc where tc.id=test_runs.test_case_id and (select private.is_project_editor(tc.project_id))));
create policy "test runs editors update" on public.test_runs for update to authenticated using(exists(select 1 from public.test_cases tc where tc.id=test_runs.test_case_id and (select private.is_project_editor(tc.project_id)))) with check(exists(select 1 from public.test_cases tc where tc.id=test_runs.test_case_id and (select private.is_project_editor(tc.project_id))));
create policy "test runs editors delete" on public.test_runs for delete to authenticated using(exists(select 1 from public.test_cases tc where tc.id=test_runs.test_case_id and (select private.is_project_editor(tc.project_id))));
drop policy if exists "workflow runs" on public.workflow_runs;
drop policy if exists "workflow runs members read" on public.workflow_runs;
create policy "workflow runs members read" on public.workflow_runs for select to authenticated using(exists(select 1 from public.workflows w where w.id=workflow_runs.workflow_id and (select private.is_project_member(w.project_id))));
create policy "workflow runs editors insert" on public.workflow_runs for insert to authenticated with check(exists(select 1 from public.workflows w where w.id=workflow_runs.workflow_id and (select private.is_project_editor(w.project_id))));
create policy "workflow runs editors update" on public.workflow_runs for update to authenticated using(exists(select 1 from public.workflows w where w.id=workflow_runs.workflow_id and (select private.is_project_editor(w.project_id)))) with check(exists(select 1 from public.workflows w where w.id=workflow_runs.workflow_id and (select private.is_project_editor(w.project_id))));
create policy "workflow runs editors delete" on public.workflow_runs for delete to authenticated using(exists(select 1 from public.workflows w where w.id=workflow_runs.workflow_id and (select private.is_project_editor(w.project_id))));
drop policy if exists "brain mutations" on public.project_brain_mutations;
drop policy if exists "brain mutations members read" on public.project_brain_mutations;
create policy "brain mutations members read" on public.project_brain_mutations for select to authenticated using((select private.is_project_member(project_id)));
drop policy if exists "verification read" on public.verification_results;
drop policy if exists "verification members read" on public.verification_results;
create policy "verification members read" on public.verification_results for select to authenticated using((select private.is_project_member(project_id)));
revoke all on public.ai_provider_credentials from anon,authenticated;
revoke all on public.payment_events from anon,authenticated;
revoke all on all tables in schema public from anon;

-- Additional RBAC coverage for resource chunks, profiles and analytics.
drop policy if exists "resource chunks project members" on public.resource_chunks;
drop policy if exists "resource chunks members read" on public.resource_chunks;
create policy "resource chunks members read" on public.resource_chunks for select to authenticated using(exists(select 1 from public.project_resources r where r.id=resource_chunks.resource_id and (select private.is_project_member(r.project_id))));
create policy "resource chunks editors insert" on public.resource_chunks for insert to authenticated with check(exists(select 1 from public.project_resources r where r.id=resource_chunks.resource_id and (select private.is_project_editor(r.project_id))));
create policy "resource chunks editors update" on public.resource_chunks for update to authenticated using(exists(select 1 from public.project_resources r where r.id=resource_chunks.resource_id and (select private.is_project_editor(r.project_id)))) with check(exists(select 1 from public.project_resources r where r.id=resource_chunks.resource_id and (select private.is_project_editor(r.project_id))));
create policy "resource chunks editors delete" on public.resource_chunks for delete to authenticated using(exists(select 1 from public.project_resources r where r.id=resource_chunks.resource_id and (select private.is_project_editor(r.project_id))));
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
drop policy if exists "analytics" on public.analytics_events;
drop policy if exists "analytics own read" on public.analytics_events;
create policy "analytics own read" on public.analytics_events for select to authenticated using(user_id is null or (select auth.uid())=user_id);
revoke insert, update, delete on public.analytics_events from anon, authenticated;

-- Backend-only tables use authenticated deny policies for defense in depth.
drop policy if exists "ai credentials no direct client access" on public.ai_provider_credentials;
create policy "ai credentials no direct client access" on public.ai_provider_credentials
for all to authenticated using (false) with check (false);
drop policy if exists "payment events no direct client access" on public.payment_events;
create policy "payment events no direct client access" on public.payment_events
for all to authenticated using (false) with check (false);
