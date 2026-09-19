-- ProjectX Phase 2/4: atomic Brain/state version commits and durable verification.
create table if not exists public.verification_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  brain_version integer not null,
  artifact_version text,
  subject_type text not null,
  subject_id text,
  check_type text not null,
  status text not null check (status in ('pass','fail','warning','blocked','skipped','human_review')),
  severity text,
  evidence jsonb not null default '{}'::jsonb,
  requirement_refs jsonb not null default '[]'::jsonb,
  verifier text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists verification_results_project_created_idx
  on public.verification_results(project_id, created_at desc);
create index if not exists verification_results_project_brain_idx
  on public.verification_results(project_id, brain_version desc);

alter table public.verification_results enable row level security;
drop policy if exists "verification read" on public.verification_results;
create policy "verification read" on public.verification_results
  for select using (public.is_project_member(project_id));
revoke insert, update, delete on public.verification_results from anon, authenticated;

create or replace function public.commit_project_brain_mutation(
  p_project_id uuid,
  p_base_version integer,
  p_mutation_id text,
  p_client_request_id text,
  p_actor jsonb,
  p_snapshot jsonb,
  p_operations jsonb,
  p_change_summary text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  current_project public.projects%rowtype;
  actor_user_id uuid;
  existing_mutation public.project_brain_mutations%rowtype;
  current_version integer;
  new_version integer;
  workspace_role text;
begin
  actor_user_id := nullif(trim(coalesce(p_actor->>'user_id','')), '')::uuid;
  if actor_user_id is null then
    raise exception 'Missing actor user id';
  end if;

  select * into current_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if current_project.owner_id <> actor_user_id then
    select role into workspace_role
    from public.workspace_members
    where workspace_id = current_project.workspace_id
      and user_id = actor_user_id
    limit 1;

    if workspace_role is null or workspace_role not in ('owner','admin','editor') then
      raise exception 'Not authorized';
    end if;
  end if;

  -- Idempotency: return an existing mutation result without applying it twice.
  select * into existing_mutation
  from public.project_brain_mutations
  where project_id = p_project_id
    and (
      mutation_id = p_mutation_id
      or (
        p_client_request_id is not null
        and p_client_request_id <> ''
        and client_request_id = p_client_request_id
      )
    )
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'status', existing_mutation.status,
      'mutationId', existing_mutation.mutation_id,
      'currentVersion', coalesce(current_project.spec_version,1),
      'resultingVersion', existing_mutation.resulting_version,
      'rejectionReason', existing_mutation.rejection_reason
    );
  end if;

  current_version := greatest(coalesce(current_project.spec_version,1),1);

  if current_version <> p_base_version then
    insert into public.project_brain_mutations(
      project_id, mutation_id, client_request_id, base_version, actor,
      operations, status, rejection_reason, resulting_version, change_summary
    ) values (
      p_project_id, p_mutation_id, nullif(p_client_request_id,''),
      p_base_version, coalesce(p_actor,'{}'::jsonb),
      coalesce(p_operations,'[]'::jsonb), 'stale',
      format('Server is at version %s; mutation targeted version %s.', current_version, p_base_version),
      current_version, coalesce(p_change_summary,'')
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'stale',
      'mutationId', p_mutation_id,
      'currentVersion', current_version,
      'requestedBaseVersion', p_base_version
    );
  end if;

  new_version := current_version + 1;

  update public.projects
  set
    title = left(coalesce(p_snapshot->>'title', current_project.title), 200),
    intention = left(coalesce(p_snapshot->>'intention', p_snapshot->>'intent', current_project.intention), 10000),
    project_type = left(coalesce(p_snapshot->>'type', p_snapshot->>'project_type', current_project.project_type), 100),
    classification = coalesce(p_snapshot->'understanding', p_snapshot->'classification', current_project.classification, '{}'::jsonb),
    plan = coalesce(p_snapshot->'plan', current_project.plan, '[]'::jsonb),
    project_spec = coalesce(p_snapshot->'spec', current_project.project_spec, '{}'::jsonb),
    understanding = coalesce(p_snapshot->'understanding', current_project.understanding, '{}'::jsonb),
    workspace_config = coalesce(p_snapshot->'workspace', current_project.workspace_config, '{}'::jsonb),
    selected_section = left(coalesce(p_snapshot->>'selectedSection', current_project.selected_section, 'chat'), 100),
    settings = coalesce(p_snapshot->'settings', current_project.settings, '{}'::jsonb),
    status = left(coalesce(p_snapshot->>'status', current_project.status, 'planning'), 60),
    spec_version = new_version,
    updated_at = now()
  where id = p_project_id;

  insert into public.project_versions(
    project_id, version_number, label, snapshot, created_by,
    parent_version, mutation_id, actor, change_summary
  ) values (
    p_project_id, new_version, left(coalesce(p_change_summary, 'Brain mutation'), 160),
    coalesce(p_snapshot,'{}'::jsonb), actor_user_id,
    current_version, p_mutation_id, coalesce(p_actor,'{}'::jsonb),
    left(coalesce(p_change_summary,''), 500)
  );

  insert into public.project_brain_mutations(
    project_id, mutation_id, client_request_id, base_version, actor,
    operations, status, resulting_version, change_summary
  ) values (
    p_project_id, p_mutation_id, nullif(p_client_request_id,''),
    p_base_version, coalesce(p_actor,'{}'::jsonb),
    coalesce(p_operations,'[]'::jsonb), 'accepted', new_version,
    left(coalesce(p_change_summary,''), 500)
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'mutationId', p_mutation_id,
    'baseVersion', current_version,
    'newVersion', new_version
  );
end;
$$;

revoke all on function public.commit_project_brain_mutation(uuid, integer, text, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.commit_project_brain_mutation(uuid, integer, text, text, jsonb, jsonb, jsonb, text) to service_role;
