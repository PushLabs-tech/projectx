alter table public.projects add column if not exists project_spec jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists understanding jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists workspace_config jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists spec_version integer not null default 1;
alter table public.projects add column if not exists selected_section text not null default 'chat';

create index if not exists projects_owner_updated_idx on public.projects(owner_id, updated_at desc);
create index if not exists project_versions_project_version_idx on public.project_versions(project_id, version_number desc);
