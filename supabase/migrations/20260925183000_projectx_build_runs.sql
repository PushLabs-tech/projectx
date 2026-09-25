-- ProjectX durable isolated build-run records.
create table if not exists public.projectx_build_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  repository_full_name text not null,
  branch text not null default 'main',
  commit_sha text not null,
  workflow_path text not null default '.github/workflows/projectx-build.yml',
  workflow_run_id bigint,
  status text not null default 'queued'
    check (status in ('queued','in_progress','completed','success','failure','cancelled','timed_out','skipped','unknown')),
  conclusion text,
  html_url text,
  run_attempt integer,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  artifact_summary jsonb not null default '[]'::jsonb,
  client_request_id text,
  error text,
  constraint projectx_build_runs_client_request_key unique (project_id, client_request_id)
);

create index if not exists projectx_build_runs_project_idx
  on public.projectx_build_runs(project_id, requested_at desc);
create index if not exists projectx_build_runs_workflow_idx
  on public.projectx_build_runs(repository_full_name, workflow_run_id);

alter table public.projectx_build_runs enable row level security;
drop policy if exists "projectx build runs read" on public.projectx_build_runs;
create policy "projectx build runs read"
on public.projectx_build_runs
for select to authenticated
using (
  user_id = (select auth.uid())
  or (project_id is not null and (select private.is_project_member(project_id)))
);

revoke insert, update, delete on public.projectx_build_runs from anon, authenticated;
