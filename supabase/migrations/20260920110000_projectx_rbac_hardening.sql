-- ProjectX RBAC and Data API hardening.
-- Members may read project data. Only owners/admins/editors may mutate it.
-- Security-definer membership helpers live in the non-exposed private schema to avoid RLS recursion.

create schema if not exists private;

create or replace function private.is_workspace_member(wid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = wid and wm.user_id = uid
  );
$$;

create or replace function private.workspace_role(wid uuid, uid uuid default auth.uid())
returns text
language sql stable security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = wid and wm.user_id = uid
  limit 1;
$$;

create or replace function private.is_project_member(pid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = pid and wm.user_id = uid
  );
$$;

create or replace function private.is_project_editor(pid uuid, uid uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = pid
      and wm.user_id = uid
      and wm.role in ('owner','admin','editor')
  );
$$;

create or replace function private.protect_project_tenant_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.owner_id is distinct from old.owner_id
          or new.workspace_id is distinct from old.workspace_id) then
    raise exception 'Project ownership and workspace cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_protect_tenant_fields on public.projects;
create trigger projects_protect_tenant_fields
before update on public.projects
for each row execute function private.protect_project_tenant_fields();

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_workspace_member(uuid,uuid),
                     private.workspace_role(uuid,uuid),
                     private.is_project_member(uuid,uuid),
                     private.is_project_editor(uuid,uuid)
from public, anon;
grant execute on function private.is_workspace_member(uuid,uuid),
                          private.workspace_role(uuid,uuid),
                          private.is_project_member(uuid,uuid),
                          private.is_project_editor(uuid,uuid)
to authenticated;

revoke all on function public.is_workspace_member(uuid,uuid),
                      public.is_project_member(uuid,uuid)
from public, anon, authenticated;

do $$
declare r record;
begin
  for r in
    select distinct p.schemaname, p.tablename, p.policyname
    from pg_policies p
    join pg_class c on c.relname = p.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
    where p.schemaname = 'public'
      and p.cmd = 'ALL'
      and p.tablename not in ('projects','engine_run_events','test_runs','workflow_runs','project_brain_mutations')
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'project_id'
          and a.attnum > 0 and not a.attisdropped
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop policy if exists "project members" on public.projects;
drop policy if exists "project members read" on public.projects;
drop policy if exists "project editors insert" on public.projects;
drop policy if exists "project editors update" on public.projects;
drop policy if exists "project editors delete" on public.projects;

create policy "project members read" on public.projects
for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy "project editors insert" on public.projects
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id, auth.uid()))
);

create policy "project editors update" on public.projects
for update to authenticated
using ((select private.is_project_editor(id)))
with check ((select private.is_project_editor(id)));

create policy "project editors delete" on public.projects
for delete to authenticated
using ((select private.is_project_editor(id)));

do $$
declare t text;
begin
  foreach t in array ARRAY[
    'agents','attachments','browser_test_runs','compile_attempts','deploy_attempts','deployments',
    'engine_runs','project_capabilities','project_decisions','project_files','project_memory',
    'project_messages','project_observability','project_requirements','project_resources',
    'project_snapshots','project_versions','research_findings','security_scans','self_heal_runs',
    'synthetic_user_runs','test_cases','transform_runs','workflows'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_project_member(project_id)))', t||'_members_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_project_editor(project_id)))', t||'_editors_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_project_editor(project_id))) with check ((select private.is_project_editor(project_id)))', t||'_editors_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_project_editor(project_id)))', t||'_editors_delete', t);
  end loop;
end $$;

drop policy if exists "engine events project members" on public.engine_run_events;
drop policy if exists "engine events members read" on public.engine_run_events;
create policy "engine events members read" on public.engine_run_events
for select to authenticated
using (exists (
  select 1 from public.engine_runs r
  where r.id = engine_run_events.run_id
    and (select private.is_project_member(r.project_id))
));
create policy "engine events editors insert" on public.engine_run_events
for insert to authenticated
with check (exists (
  select 1 from public.engine_runs r
  where r.id = engine_run_events.run_id
    and (select private.is_project_editor(r.project_id))
));
create policy "engine events editors update" on public.engine_run_events
for update to authenticated
using (exists (
  select 1 from public.engine_runs r
  where r.id = engine_run_events.run_id
    and (select private.is_project_editor(r.project_id))
))
with check (exists (
  select 1 from public.engine_runs r
  where r.id = engine_run_events.run_id
    and (select private.is_project_editor(r.project_id))
));
create policy "engine events editors delete" on public.engine_run_events
for delete to authenticated
using (exists (
  select 1 from public.engine_runs r
  where r.id = engine_run_events.run_id
    and (select private.is_project_editor(r.project_id))
));

drop policy if exists "test runs" on public.test_runs;
drop policy if exists "test runs members read" on public.test_runs;
create policy "test runs members read" on public.test_runs
for select to authenticated
using (exists (
  select 1 from public.test_cases tc
  where tc.id = test_runs.test_case_id
    and (select private.is_project_member(tc.project_id))
));
create policy "test runs editors insert" on public.test_runs
for insert to authenticated
with check (exists (
  select 1 from public.test_cases tc
  where tc.id = test_runs.test_case_id
    and (select private.is_project_editor(tc.project_id))
));
create policy "test runs editors update" on public.test_runs
for update to authenticated
using (exists (
  select 1 from public.test_cases tc
  where tc.id = test_runs.test_case_id
    and (select private.is_project_editor(tc.project_id))
))
with check (exists (
  select 1 from public.test_cases tc
  where tc.id = test_runs.test_case_id
    and (select private.is_project_editor(tc.project_id))
));
create policy "test runs editors delete" on public.test_runs
for delete to authenticated
using (exists (
  select 1 from public.test_cases tc
  where tc.id = test_runs.test_case_id
    and (select private.is_project_editor(tc.project_id))
));

drop policy if exists "workflow runs" on public.workflow_runs;
drop policy if exists "workflow runs members read" on public.workflow_runs;
create policy "workflow runs members read" on public.workflow_runs
for select to authenticated
using (exists (
  select 1 from public.workflows w
  where w.id = workflow_runs.workflow_id
    and (select private.is_project_member(w.project_id))
));
create policy "workflow runs editors insert" on public.workflow_runs
for insert to authenticated
with check (exists (
  select 1 from public.workflows w
  where w.id = workflow_runs.workflow_id
    and (select private.is_project_editor(w.project_id))
));
create policy "workflow runs editors update" on public.workflow_runs
for update to authenticated
using (exists (
  select 1 from public.workflows w
  where w.id = workflow_runs.workflow_id
    and (select private.is_project_editor(w.project_id))
))
with check (exists (
  select 1 from public.workflows w
  where w.id = workflow_runs.workflow_id
    and (select private.is_project_editor(w.project_id))
));
create policy "workflow runs editors delete" on public.workflow_runs
for delete to authenticated
using (exists (
  select 1 from public.workflows w
  where w.id = workflow_runs.workflow_id
    and (select private.is_project_editor(w.project_id))
));

drop policy if exists "brain mutations" on public.project_brain_mutations;
drop policy if exists "brain mutations members read" on public.project_brain_mutations;
create policy "brain mutations members read" on public.project_brain_mutations
for select to authenticated
using ((select private.is_project_member(project_id)));

drop policy if exists "verification read" on public.verification_results;
drop policy if exists "verification members read" on public.verification_results;
create policy "verification members read" on public.verification_results
for select to authenticated
using ((select private.is_project_member(project_id)));

revoke all on public.ai_provider_credentials from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Secondary project-scoped table: chunks inherit authorization from their resource.
drop policy if exists "resource chunks project members" on public.resource_chunks;
drop policy if exists "resource chunks members read" on public.resource_chunks;
create policy "resource chunks members read" on public.resource_chunks
for select to authenticated
using (exists (
  select 1 from public.project_resources r
  where r.id=resource_chunks.resource_id
    and (select private.is_project_member(r.project_id))
));
create policy "resource chunks editors insert" on public.resource_chunks
for insert to authenticated
with check (exists (
  select 1 from public.project_resources r
  where r.id=resource_chunks.resource_id
    and (select private.is_project_editor(r.project_id))
));
create policy "resource chunks editors update" on public.resource_chunks
for update to authenticated
using (exists (
  select 1 from public.project_resources r
  where r.id=resource_chunks.resource_id
    and (select private.is_project_editor(r.project_id))
))
with check (exists (
  select 1 from public.project_resources r
  where r.id=resource_chunks.resource_id
    and (select private.is_project_editor(r.project_id))
));
create policy "resource chunks editors delete" on public.resource_chunks
for delete to authenticated
using (exists (
  select 1 from public.project_resources r
  where r.id=resource_chunks.resource_id
    and (select private.is_project_editor(r.project_id))
));

-- Keep profile access explicitly authenticated-only.
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles
for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Analytics are server-written; signed-in users can read only their own events.
drop policy if exists "analytics" on public.analytics_events;
drop policy if exists "analytics own read" on public.analytics_events;
create policy "analytics own read" on public.analytics_events
for select to authenticated
using (user_id is null or (select auth.uid()) = user_id);
revoke insert, update, delete on public.analytics_events from anon, authenticated;

-- Backend-only tables use authenticated deny policies for defense in depth.
drop policy if exists "ai credentials no direct client access" on public.ai_provider_credentials;
create policy "ai credentials no direct client access" on public.ai_provider_credentials
for all to authenticated using (false) with check (false);
drop policy if exists "payment events no direct client access" on public.payment_events;
create policy "payment events no direct client access" on public.payment_events
for all to authenticated using (false) with check (false);
