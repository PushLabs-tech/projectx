alter table public.deployments
  add column if not exists source_spec_version integer,
  add column if not exists source_hash text,
  add column if not exists health_status text,
  add column if not exists health_checked_at timestamptz,
  add column if not exists health_evidence jsonb not null default '{}'::jsonb,
  add column if not exists previous_deployment_id uuid references public.deployments(id) on delete set null,
  add column if not exists external_status text;

create index if not exists deployments_project_created_idx
  on public.deployments(project_id, created_at desc);
create index if not exists deployments_project_health_idx
  on public.deployments(project_id, health_status, created_at desc);