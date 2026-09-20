-- ProjectX integrations: collaboration, GitHub, deployment targets, resource ingestion.
create table if not exists public.github_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.github_oauth_states enable row level security;
revoke all on public.github_oauth_states from anon, authenticated;

-- RLS policies for integration metadata.
alter table public.workspace_invitations enable row level security;
alter table public.workspace_presence enable row level security;
alter table public.github_connections enable row level security;
alter table public.github_repositories enable row level security;
alter table public.deployment_targets enable row level security;
alter table public.project_resources enable row level security;

drop policy if exists "workspace invite read" on public.workspace_invitations;
create policy "workspace invite read" on public.workspace_invitations for select to authenticated
using (private.is_workspace_member(workspace_id,(select auth.uid())));
drop policy if exists "workspace invite write" on public.workspace_invitations;
create policy "workspace invite write" on public.workspace_invitations for all to authenticated
using (private.workspace_role(workspace_id,(select auth.uid())) in ('owner','admin'))
with check (private.workspace_role(workspace_id,(select auth.uid())) in ('owner','admin'));

drop policy if exists "presence read" on public.workspace_presence;
create policy "presence read" on public.workspace_presence for select to authenticated
using (private.is_workspace_member(workspace_id,(select auth.uid())));
drop policy if exists "presence own write" on public.workspace_presence;
create policy "presence own write" on public.workspace_presence for all to authenticated
using (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id,(select auth.uid())))
with check (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "github repos member read" on public.github_repositories;
create policy "github repos member read" on public.github_repositories for select to authenticated
using (private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "deployment targets member read" on public.deployment_targets;
create policy "deployment targets member read" on public.deployment_targets for select to authenticated
using (private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "resources member read" on public.project_resources;
create policy "resources member read" on public.project_resources for select to authenticated
using (private.is_project_member(project_id,(select auth.uid())));
drop policy if exists "resources editor write" on public.project_resources;
create policy "resources editor write" on public.project_resources for all to authenticated
using (private.is_project_editor(project_id,(select auth.uid())))
with check (private.is_project_editor(project_id,(select auth.uid())));

revoke all on public.github_connections from anon,authenticated;
revoke all on public.deployment_targets from anon,authenticated;
revoke all on public.github_repositories from anon,authenticated;
revoke all on public.github_oauth_states from anon,authenticated;