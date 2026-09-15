-- ProjectX backend hardening migration.
-- Idempotent: safe to apply after the existing 001-003 migrations.

-- Backend-only credential/event stores must remain inaccessible through the Data API.
alter table if exists public.ai_provider_credentials enable row level security;
alter table if exists public.payment_events enable row level security;
drop policy if exists "ai credentials no direct client access" on public.ai_provider_credentials;
drop policy if exists "payment events no direct client access" on public.payment_events;
create policy "ai credentials no direct client access" on public.ai_provider_credentials for all to anon, authenticated using (false) with check (false);
create policy "payment events no direct client access" on public.payment_events for all to anon, authenticated using (false) with check (false);
revoke all on public.ai_provider_credentials from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

-- SECURITY DEFINER helpers are internal primitives; clients must not call them through RPC.
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.is_project_member(uuid, uuid) from anon, authenticated;
revoke all on function public.is_workspace_member(uuid, uuid) from anon, authenticated;
revoke all on function public.rls_auto_enable() from anon, authenticated;

-- Pin function search paths to prevent search_path hijacking.
alter function public.handle_new_user() set search_path = public;
alter function public.is_project_member(uuid, uuid) set search_path = public;
alter function public.is_workspace_member(uuid, uuid) set search_path = public;
alter function public.rls_auto_enable() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.match_project_resources(uuid, vector, integer) set search_path = public;

-- Avoid duplicate permissive SELECT policies while preserving the same authorization model.
drop policy if exists "workspace owner" on public.workspaces;
drop policy if exists "workspace read" on public.workspaces;
create policy "workspace owner writes" on public.workspaces for insert to public with check (owner_id = (select auth.uid()));
create policy "workspace owner updates" on public.workspaces for update to public using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "workspace owner deletes" on public.workspaces for delete to public using (owner_id = (select auth.uid()));
create policy "workspace read" on public.workspaces for select to public using (owner_id = (select auth.uid()) or public.is_workspace_member(id));

drop policy if exists "member read" on public.workspace_members;
drop policy if exists "owner manages members" on public.workspace_members;
create policy "member read" on public.workspace_members for select to public using (user_id = (select auth.uid()) or public.is_workspace_member(workspace_id));
create policy "owner manages members insert" on public.workspace_members for insert to public with check (exists (select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = (select auth.uid())));
create policy "owner manages members updates" on public.workspace_members for update to public using (exists (select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = (select auth.uid()))) with check (exists (select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = (select auth.uid())));
create policy "owner manages members deletes" on public.workspace_members for delete to public using (exists (select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = (select auth.uid())));

-- Pin auth.uid() evaluation once per statement in simple ownership policies.
drop policy if exists "audit own read" on public.audit_logs;
create policy "audit own read" on public.audit_logs for select to public using (user_id = (select auth.uid()));
drop policy if exists "security own read" on public.security_events;
create policy "security own read" on public.security_events for select to public using (user_id = (select auth.uid()));
drop policy if exists "billing own read" on public.billing_subscriptions;
create policy "billing own read" on public.billing_subscriptions for select to public using (user_id = (select auth.uid()));
drop policy if exists "usage read" on public.ai_usage;
create policy "usage read" on public.ai_usage for select to public using (user_id = (select auth.uid()));
drop policy if exists "credits read" on public.credit_transactions;
create policy "credits read" on public.credit_transactions for select to public using (user_id = (select auth.uid()));
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to public using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Cover every foreign key with a matching index. IF NOT EXISTS keeps this safe when
-- a prior migration already created an equivalent index.
create index if not exists agents_project_id_fk_idx on public.agents(project_id);
create index if not exists ai_provider_credentials_user_id_fk_idx on public.ai_provider_credentials(user_id);
create index if not exists ai_usage_project_id_fk_idx on public.ai_usage(project_id);
create index if not exists ai_usage_user_id_fk_idx on public.ai_usage(user_id);
create index if not exists analytics_events_project_id_fk_idx on public.analytics_events(project_id);
create index if not exists analytics_events_user_id_fk_idx on public.analytics_events(user_id);
create index if not exists attachments_project_id_fk_idx on public.attachments(project_id);
create index if not exists attachments_user_id_fk_idx on public.attachments(user_id);
create index if not exists audit_logs_user_id_fk_idx on public.audit_logs(user_id);
create index if not exists billing_subscriptions_user_id_fk_idx on public.billing_subscriptions(user_id);
create index if not exists browser_test_runs_project_id_fk_idx on public.browser_test_runs(project_id);
create index if not exists compile_attempts_project_id_fk_idx on public.compile_attempts(project_id);
create index if not exists connected_accounts_workspace_id_fk_idx on public.connected_accounts(workspace_id);
create index if not exists credit_transactions_user_id_fk_idx on public.credit_transactions(user_id);
create index if not exists deploy_attempts_deployment_id_fk_idx on public.deploy_attempts(deployment_id);
create index if not exists deploy_attempts_project_id_fk_idx on public.deploy_attempts(project_id);
create index if not exists deployments_project_id_fk_idx on public.deployments(project_id);
create index if not exists engine_run_events_run_id_fk_idx on public.engine_run_events(run_id);
create index if not exists engine_runs_project_id_fk_idx on public.engine_runs(project_id);
create index if not exists engine_runs_user_id_fk_idx on public.engine_runs(user_id);
create index if not exists payment_analytics_user_id_fk_idx on public.payment_analytics(user_id);
create index if not exists profiles_id_fk_idx on public.profiles(id);
create index if not exists project_capabilities_project_id_fk_idx on public.project_capabilities(project_id);
create index if not exists project_decisions_project_id_fk_idx on public.project_decisions(project_id);
create index if not exists project_files_project_id_fk_idx on public.project_files(project_id);
create index if not exists project_memory_project_id_fk_idx on public.project_memory(project_id);
create index if not exists project_messages_project_id_fk_idx on public.project_messages(project_id);
create index if not exists project_messages_user_id_fk_idx on public.project_messages(user_id);
create index if not exists project_observability_project_id_fk_idx on public.project_observability(project_id);
create index if not exists project_requirements_project_id_fk_idx on public.project_requirements(project_id);
create index if not exists project_resources_created_by_fk_idx on public.project_resources(created_by);
create index if not exists project_resources_project_id_fk_idx on public.project_resources(project_id);
create index if not exists project_snapshots_created_by_fk_idx on public.project_snapshots(created_by);
create index if not exists project_snapshots_project_id_fk_idx on public.project_snapshots(project_id);
create index if not exists project_versions_created_by_fk_idx on public.project_versions(created_by);
create index if not exists project_versions_project_id_fk_idx on public.project_versions(project_id);
create index if not exists projects_owner_id_fk_idx on public.projects(owner_id);
create index if not exists projects_workspace_id_fk_idx on public.projects(workspace_id);
create index if not exists research_findings_project_id_fk_idx on public.research_findings(project_id);
create index if not exists resource_chunks_resource_id_fk_idx on public.resource_chunks(resource_id);
create index if not exists security_events_user_id_fk_idx on public.security_events(user_id);
create index if not exists security_scans_project_id_fk_idx on public.security_scans(project_id);
create index if not exists self_heal_runs_project_id_fk_idx on public.self_heal_runs(project_id);
create index if not exists self_heal_runs_source_run_id_fk_idx on public.self_heal_runs(source_run_id);
create index if not exists synthetic_user_runs_project_id_fk_idx on public.synthetic_user_runs(project_id);
create index if not exists test_cases_project_id_fk_idx on public.test_cases(project_id);
create index if not exists test_runs_test_case_id_fk_idx on public.test_runs(test_case_id);
create index if not exists transform_runs_project_id_fk_idx on public.transform_runs(project_id);
create index if not exists workflow_runs_workflow_id_fk_idx on public.workflow_runs(workflow_id);
create index if not exists workflows_project_id_fk_idx on public.workflows(project_id);
create index if not exists workspace_members_user_id_fk_idx on public.workspace_members(user_id);
create index if not exists workspace_members_workspace_id_fk_idx on public.workspace_members(workspace_id);
create index if not exists workspaces_owner_id_fk_idx on public.workspaces(owner_id);
