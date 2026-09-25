-- Performance hardening for foreign keys surfaced by Supabase advisors.
-- These indexes are additive and preserve existing RLS/policy behavior.
create index if not exists deployments_previous_deployment_id_idx
  on public.deployments(previous_deployment_id);

create index if not exists github_connections_workspace_id_idx
  on public.github_connections(workspace_id);

create index if not exists github_oauth_states_user_id_idx
  on public.github_oauth_states(user_id);

create index if not exists github_oauth_states_workspace_id_idx
  on public.github_oauth_states(workspace_id);

create index if not exists github_repositories_workspace_id_idx
  on public.github_repositories(workspace_id);

create index if not exists job_queue_user_id_idx
  on public.job_queue(user_id);

create index if not exists project_execution_events_user_id_idx
  on public.project_execution_events(user_id);

create index if not exists project_execution_transactions_user_id_idx
  on public.project_execution_transactions(user_id);

create index if not exists projectx_build_runs_user_id_idx
  on public.projectx_build_runs(user_id);

create index if not exists workspace_invitations_accepted_by_idx
  on public.workspace_invitations(accepted_by);

create index if not exists workspace_invitations_invited_by_idx
  on public.workspace_invitations(invited_by);

create index if not exists workspace_presence_project_id_idx
  on public.workspace_presence(project_id);

create index if not exists workspace_presence_user_id_idx
  on public.workspace_presence(user_id);
