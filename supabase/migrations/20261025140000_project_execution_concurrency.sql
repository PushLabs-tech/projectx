-- Serialize execution-job enqueue per project and prevent overlapping queued/running execution jobs.
-- The advisory lock makes the active-job check and insert atomic under concurrent requests.
create or replace function public.enqueue_project_execution_job(
  p_project_id uuid,
  p_user_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_max_attempts integer default 3,
  p_timeout_seconds integer default 120
) returns public.job_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_queue%rowtype;
  v_project_owner uuid;
  v_workspace_id uuid;
  v_role text;
begin
  if p_project_id is null or p_user_id is null then
    raise exception 'Project and user are required';
  end if;

  select owner_id, workspace_id
    into v_project_owner, v_workspace_id
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project_owner is distinct from p_user_id then
    select role into v_role
    from public.workspace_members
    where workspace_id = v_workspace_id and user_id = p_user_id
    limit 1;
    if v_role is null or v_role not in ('owner', 'admin', 'editor') then
      raise exception 'Not authorized';
    end if;
  end if;

  -- Hash collisions only serialize unrelated projects; they cannot weaken the gate.
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));

  if exists (
    select 1 from public.job_queue
    where project_id = p_project_id
      and kind = 'execution'
      and status in ('queued', 'running')
  ) then
    raise exception 'An execution job is already active for this project';
  end if;

  insert into public.job_queue(
    project_id, user_id, kind, payload, max_attempts, timeout_seconds
  ) values (
    p_project_id, p_user_id, 'execution', coalesce(p_payload, '{}'::jsonb),
    greatest(1, least(coalesce(p_max_attempts, 3), 10)),
    greatest(10, least(coalesce(p_timeout_seconds, 120), 300))
  )
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.enqueue_project_execution_job(uuid, uuid, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_project_execution_job(uuid, uuid, jsonb, integer, integer)
  to service_role;
