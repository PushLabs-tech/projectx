-- ProjectX remote execution worker: atomic file execution, cancellation, and durable execution events.

alter table public.job_queue
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists timeout_seconds integer not null default 120 check (timeout_seconds between 10 and 900);

create table if not exists public.project_execution_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.job_queue(id) on delete set null,
  action_id text,
  event text not null,
  status text,
  executor text,
  tool text,
  message text,
  evidence jsonb not null default '[]'::jsonb,
  project_version integer not null,
  created_at timestamptz not null default now()
);

create index if not exists project_execution_events_project_idx
  on public.project_execution_events(project_id, created_at desc);
create index if not exists project_execution_events_job_idx
  on public.project_execution_events(job_id, created_at desc);

alter table public.project_execution_events enable row level security;

drop policy if exists "execution events read" on public.project_execution_events;
create policy "execution events read" on public.project_execution_events
for select to authenticated
using (
  user_id = (select auth.uid())
  or (project_id is not null and (select private.is_project_member(project_id)))
);

revoke insert, update, delete on public.project_execution_events from anon, authenticated;

-- Claiming requeues abandoned leases before picking fresh jobs. A worker still owns a
-- claimed job until it finishes/cancels it; abandoned jobs become eligible again.
create or replace function public.claim_project_job(p_worker text, p_limit integer default 1)
returns setof public.job_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_queue
  set status='queued',
      locked_at=null,
      locked_by=null,
      updated_at=now()
  where status='running'
    and locked_at is not null
    and locked_at < now() - make_interval(secs => greatest(30, least(timeout_seconds + 60, 960)));

  return query
  with picked as (
    select id
    from public.job_queue
    where status='queued'
      and cancel_requested=false
      and available_at <= now()
      and attempts < max_attempts
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,1),20))
  )
  update public.job_queue j
  set status='running',
      attempts=j.attempts+1,
      locked_at=now(),
      locked_by=left(coalesce(p_worker,'worker'),120),
      timeout_seconds=greatest(10, least(coalesce(j.timeout_seconds,120),900)),
      updated_at=now()
  from picked
  where j.id=picked.id
  returning j.*;
end;
$$;

create or replace function public.cancel_project_job(p_id uuid, p_user_id uuid)
returns public.job_queue
language plpgsql
security definer
set search_path = public
as $$
declare j public.job_queue;
begin
  select * into j from public.job_queue where id=p_id for update;
  if not found then raise exception 'Job not found'; end if;
  if j.user_id <> p_user_id then raise exception 'Not authorized'; end if;
  if j.status in ('succeeded','failed','cancelled') then return j; end if;

  update public.job_queue
  set cancel_requested=true,
      status=case when status='queued' then 'cancelled' else status end,
      updated_at=now()
  where id=p_id
  returning * into j;
  return j;
end;
$$;

create or replace function public.commit_project_execution(
  p_project_id uuid,
  p_user_id uuid,
  p_base_version integer,
  p_job_id uuid,
  p_action_id text,
  p_executor text,
  p_status text,
  p_settings jsonb,
  p_file_operations jsonb default '[]'::jsonb,
  p_event text default 'action_finished',
  p_tool text default null,
  p_message text default '',
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  current_project public.projects%rowtype;
  workspace_role text;
  op jsonb;
  path text;
  content text;
  current_settings jsonb;
begin
  select * into current_project
  from public.projects
  where id=p_project_id
  for update;

  if not found then raise exception 'Project not found'; end if;

  if current_project.owner_id <> p_user_id then
    select role into workspace_role
    from public.workspace_members
    where workspace_id=current_project.workspace_id and user_id=p_user_id
    limit 1;
    if workspace_role is null or workspace_role not in ('owner','admin','editor') then
      raise exception 'Not authorized';
    end if;
  end if;

  if greatest(coalesce(current_project.spec_version,1),1) <> greatest(coalesce(p_base_version,1),1) then
    return jsonb_build_object(
      'ok',true,'status','stale',
      'currentVersion',greatest(coalesce(current_project.spec_version,1),1),
      'requestedVersion',greatest(coalesce(p_base_version,1),1)
    );
  end if;

  current_settings := coalesce(current_project.settings,'{}'::jsonb);

  for op in select value from jsonb_array_elements(coalesce(p_file_operations,'[]'::jsonb))
  loop
    path := replace(coalesce(op->>'path',''),'\\','/');
    if path='' or length(path)>180 or path like '%..%' or path like '/%' or path ~ '^[a-zA-Z][a-zA-Z0-9+.-]*://'
      then raise exception 'Unsafe execution file path'; end if;

    if op->>'op' = 'delete' then
      delete from public.project_files where project_id=p_project_id and path=path;
    elsif op->>'op' = 'write' then
      content := coalesce(op->>'content','');
      if length(content)>600000 then raise exception 'Execution file exceeds 600KB'; end if;
      insert into public.project_files(project_id,path,content,size_bytes,mime_type,updated_at)
      values (
        p_project_id,
        path,
        content,
        length(content),
        case
          when path ~* '\\.(html?)$' then 'text/html'
          when path ~* '\\.(css)$' then 'text/css'
          when path ~* '\\.(js|mjs|ts)$' then 'text/javascript'
          when path ~* '\\.(json)$' then 'application/json'
          when path ~* '\\.(md|txt)$' then 'text/plain'
          else 'text/plain'
        end,
        now()
      )
      on conflict(project_id,path) do update
      set content=excluded.content,size_bytes=excluded.size_bytes,mime_type=excluded.mime_type,updated_at=now();
    else
      raise exception 'Unsupported execution file operation';
    end if;
  end loop;

  update public.projects
  set settings=coalesce(p_settings,current_settings),
      updated_at=now()
  where id=p_project_id;

  insert into public.project_execution_events(
    project_id,user_id,job_id,action_id,event,status,executor,tool,message,evidence,project_version
  ) values (
    p_project_id,p_user_id,p_job_id,p_action_id,left(coalesce(p_event,'action_finished'),80),
    left(coalesce(p_status,''),40),left(coalesce(p_executor,''),100),left(coalesce(p_tool,''),100),
    left(coalesce(p_message,''),1000),coalesce(p_evidence,'[]'::jsonb),
    greatest(coalesce(current_project.spec_version,1),1)
  );

  return jsonb_build_object(
    'ok',true,
    'status','accepted',
    'projectVersion',greatest(coalesce(current_project.spec_version,1),1),
    'filesChanged',jsonb_array_length(coalesce(p_file_operations,'[]'::jsonb))
  );
end;
$$;

revoke all on function public.cancel_project_job(uuid,uuid) from public, anon, authenticated;
revoke all on function public.commit_project_execution(uuid,uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.cancel_project_job(uuid,uuid) to service_role;
grant execute on function public.commit_project_execution(uuid,uuid,integer,uuid,text,text,text,jsonb,jsonb,text,text,text,jsonb) to service_role;
