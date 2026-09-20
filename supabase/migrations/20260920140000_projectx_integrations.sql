-- ProjectX integrations: collaboration, GitHub, deployment targets, and resources.
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null, role text not null default 'editor' check(role in ('admin','editor','viewer')),
  token_hash text not null unique, invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null, accepted_at timestamptz, accepted_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id,created_at desc);

create table if not exists public.workspace_presence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  cursor jsonb not null default '{}'::jsonb, status text not null default 'online' check(status in ('online','away','offline')),
  last_seen_at timestamptz not null default now(), primary key(workspace_id,user_id)
);

create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade, github_user_id text not null, github_login text not null,
  access_token_ciphertext text not null, scope text, expires_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,workspace_id)
);

create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.github_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, owner_login text not null, repo_name text not null,
  full_name text not null, default_branch text not null default 'main', private boolean not null default false,
  html_url text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(connection_id,full_name)
);

create table if not exists public.deployment_targets (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check(provider in ('vercel','netlify','cloudflare')), label text not null,
  credential_ciphertext text not null, metadata jsonb not null default '{}'::jsonb, enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,provider,label)
);

create table if not exists public.project_resources (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, storage_bucket text, storage_path text,
  original_name text not null, mime_type text, size_bytes bigint not null default 0, sha256 text,
  extraction_status text not null default 'queued' check(extraction_status in ('queued','processing','ready','failed')),
  extracted_text text, metadata jsonb not null default '{}'::jsonb, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists project_resources_project_idx on public.project_resources(project_id,created_at desc);

create table if not exists public.github_oauth_states (
  state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade, expires_at timestamptz not null, created_at timestamptz not null default now()
);

alter table public.workspace_invitations enable row level security;
alter table public.workspace_presence enable row level security;
alter table public.github_connections enable row level security;
alter table public.github_repositories enable row level security;
alter table public.deployment_targets enable row level security;
alter table public.project_resources enable row level security;
alter table public.github_oauth_states enable row level security;

drop policy if exists "workspace invite read" on public.workspace_invitations;
create policy "workspace invite read" on public.workspace_invitations for select to authenticated using (private.is_workspace_member(workspace_id,(select auth.uid())));
drop policy if exists "workspace invite write" on public.workspace_invitations;
create policy "workspace invite write" on public.workspace_invitations for all to authenticated using (private.workspace_role(workspace_id,(select auth.uid())) in ('owner','admin')) with check (private.workspace_role(workspace_id,(select auth.uid())) in ('owner','admin'));

drop policy if exists "presence read" on public.workspace_presence;
create policy "presence read" on public.workspace_presence for select to authenticated using (private.is_workspace_member(workspace_id,(select auth.uid())));
drop policy if exists "presence own write" on public.workspace_presence;
create policy "presence own write" on public.workspace_presence for all to authenticated using (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id,(select auth.uid()))) with check (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "github repos member read" on public.github_repositories;
create policy "github repos member read" on public.github_repositories for select to authenticated using (private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "deployment targets member read" on public.deployment_targets;
create policy "deployment targets member read" on public.deployment_targets for select to authenticated using (private.is_workspace_member(workspace_id,(select auth.uid())));

drop policy if exists "resources member read" on public.project_resources;
create policy "resources member read" on public.project_resources for select to authenticated using (private.is_project_member(project_id,(select auth.uid())));
drop policy if exists "resources editor write" on public.project_resources;
create policy "resources editor write" on public.project_resources for all to authenticated using (private.is_project_editor(project_id,(select auth.uid()))) with check (private.is_project_editor(project_id,(select auth.uid())));

revoke all on public.github_connections from anon,authenticated;
revoke all on public.deployment_targets from anon,authenticated;
revoke all on public.github_repositories from anon,authenticated;
revoke all on public.github_oauth_states from anon,authenticated;