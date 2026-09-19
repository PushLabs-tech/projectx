-- Phase 2/3/4 additive server-authoritative brain mutation storage.
alter table public.project_versions
  add column if not exists parent_version int,
  add column if not exists mutation_id text,
  add column if not exists actor jsonb not null default '{}'::jsonb,
  add column if not exists change_summary text not null default '';

create table if not exists public.project_brain_mutations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mutation_id text not null,
  client_request_id text,
  base_version int not null,
  actor jsonb not null default '{}'::jsonb,
  operations jsonb not null default '[]'::jsonb,
  status text not null check (status in ('accepted','rejected','stale')),
  rejection_reason text,
  resulting_version int,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, mutation_id)
);

create unique index if not exists project_brain_mutations_request_idx
  on public.project_brain_mutations(project_id, client_request_id)
  where client_request_id is not null and client_request_id <> '';

create index if not exists project_brain_mutations_project_created_idx
  on public.project_brain_mutations(project_id, created_at desc);

alter table public.project_brain_mutations enable row level security;
drop policy if exists "brain mutations" on public.project_brain_mutations;
create policy "brain mutations" on public.project_brain_mutations
  for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
