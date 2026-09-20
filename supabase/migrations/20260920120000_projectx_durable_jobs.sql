-- Durable ProjectX job queue.
create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 80),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_queue_ready_idx
on public.job_queue(status, available_at, created_at);

create index if not exists job_queue_project_idx
on public.job_queue(project_id, created_at desc);

alter table public.job_queue enable row level security;

drop policy if exists "job queue members read" on public.job_queue;
create policy "job queue members read" on public.job_queue
for select to authenticated
using (
  user_id = (select auth.uid())
  or (project_id is not null and (select private.is_project_member(project_id)))
);

drop policy if exists "job queue editors insert" on public.job_queue;
create policy "job queue editors insert" on public.job_queue
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (project_id is null or (select private.is_project_editor(project_id)))
);

revoke update, delete on public.job_queue from anon, authenticated;

create or replace function public.claim_project_job(p_worker text, p_limit integer default 1)
returns setof public.job_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select id
    from public.job_queue
    where status = 'queued'
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
      updated_at=now()
  from picked
  where j.id=picked.id
  returning j.*;
end;
$$;

create or replace function public.finish_project_job(
  p_id uuid,
  p_status text,
  p_result jsonb default '{}'::jsonb,
  p_error text default null,
  p_retry_seconds integer default 60
)
returns public.job_queue
language plpgsql
security definer
set search_path = public
as $$
declare j public.job_queue;
begin
  select * into j from public.job_queue where id=p_id for update;
  if not found then raise exception 'Job not found'; end if;
  if p_status='succeeded' then
    update public.job_queue set status='succeeded',result=coalesce(p_result,'{}'::jsonb),error=null,locked_at=null,locked_by=null,updated_at=now() where id=p_id returning * into j;
  elsif p_status='failed' and j.attempts < j.max_attempts then
    update public.job_queue set status='queued',error=left(coalesce(p_error,'Job failed'),2000),available_at=now()+make_interval(secs=>greatest(1,least(coalesce(p_retry_seconds,60),86400))),locked_at=null,locked_by=null,updated_at=now() where id=p_id returning * into j;
  else
    update public.job_queue set status=case when p_status='cancelled' then 'cancelled' else 'failed' end,error=left(coalesce(p_error,'Job failed'),2000),result=coalesce(p_result,'{}'::jsonb),locked_at=null,locked_by=null,updated_at=now() where id=p_id returning * into j;
  end if;
  return j;
end;
$$;

revoke all on function public.claim_project_job(text,integer) from public, anon, authenticated;
revoke all on function public.finish_project_job(uuid,text,jsonb,text,integer) from public, anon, authenticated;
