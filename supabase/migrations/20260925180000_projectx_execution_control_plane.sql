-- ProjectX production execution control plane.
-- Adds renewable worker leases, stale-run recovery, execution idempotency,
-- and server-side ownership checks for long-running jobs.

alter table public.job_queue
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

create index if not exists job_queue_running_lease_idx
  on public.job_queue(status, lease_expires_at)
  where status='running';

create unique index if not exists project_execution_transactions_job_action_committed_idx
  on public.project_execution_transactions(job_id, action_id)
  where status='committed' and job_id is not null and action_id is not null;

create or replace function public.claim_project_job(p_worker text, p_limit integer default 1)
returns setof public.job_queue
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.job_queue
  set status='queued', locked_at=null, locked_by=null, lease_token=null,
      lease_expires_at=null, available_at=now(), updated_at=now()
  where status='running'
    and ((lease_expires_at is not null and lease_expires_at < now())
      or (lease_expires_at is null and locked_at is not null
          and locked_at < now() - make_interval(secs => greatest(30, least(timeout_seconds + 60, 960)))))
    and cancel_requested=false;

  update public.job_queue
  set status='cancelled', locked_at=null, locked_by=null, lease_token=null,
      lease_expires_at=null, updated_at=now()
  where status in ('queued','running') and cancel_requested=true;

  return query
  with picked as (
    select id from public.job_queue
    where status='queued' and cancel_requested=false and available_at <= now()
      and attempts < max_attempts
    order by created_at for update skip locked
    limit greatest(1, least(coalesce(p_limit,1),20))
  )
  update public.job_queue j
  set status='running', attempts=j.attempts+1, locked_at=now(),
      locked_by=left(coalesce(p_worker,'worker'),120), lease_token=gen_random_uuid(),
      lease_expires_at=now()+make_interval(secs => greatest(30, least(coalesce(j.timeout_seconds,120),900))),
      updated_at=now()
  from picked where j.id=picked.id returning j.*;
end;
$$;

create or replace function public.renew_project_job_lease(
  p_id uuid, p_lease_token uuid, p_extension_seconds integer default 120
)
returns public.job_queue
language plpgsql security definer set search_path=public
as $$
declare j public.job_queue;
begin
  select * into j from public.job_queue where id=p_id for update;
  if not found then raise exception 'Job not found'; end if;
  if j.status <> 'running' or j.lease_token is null or p_lease_token is null
     or j.lease_token <> p_lease_token
  then raise exception 'Execution lease is no longer owned by this worker'; end if;
  update public.job_queue
  set lease_expires_at=now()+make_interval(secs => greatest(30, least(coalesce(p_extension_seconds,120),900))),
      updated_at=now()
  where id=p_id returning * into j;
  return j;
end;
$$;

create or replace function public.assert_project_job_lease(p_id uuid,p_lease_token uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
declare ok boolean;
begin
  select (status='running' and lease_token is not null and p_lease_token is not null
    and lease_token=p_lease_token and lease_expires_at > now()) into ok
  from public.job_queue where id=p_id;
  return coalesce(ok,false);
end;
$$;

create or replace function public.finish_project_job(
  p_id uuid, p_status text, p_result jsonb default '{}'::jsonb,
  p_error text default null, p_retry_seconds integer default 60,
  p_lease_token uuid default null
)
returns public.job_queue
language plpgsql security definer set search_path=public
as $$
declare j public.job_queue;
begin
  select * into j from public.job_queue where id=p_id for update;
  if not found then raise exception 'Job not found'; end if;
  if p_lease_token is not null and (
    j.status <> 'running' or j.lease_token is null or j.lease_token <> p_lease_token
    or j.lease_expires_at is null or j.lease_expires_at <= now()
  ) then raise exception 'Execution lease expired or owned by another worker'; end if;

  if p_status='succeeded' then
    update public.job_queue set status='succeeded',result=coalesce(p_result,'{}'::jsonb),error=null,
      locked_at=null,locked_by=null,lease_token=null,lease_expires_at=null,updated_at=now()
      where id=p_id returning * into j;
  elsif p_status='failed' and j.attempts < j.max_attempts then
    update public.job_queue set status='queued',error=left(coalesce(p_error,'Job failed'),2000),
      available_at=now()+make_interval(secs=>greatest(1,least(coalesce(p_retry_seconds,60),86400))),
      locked_at=null,locked_by=null,lease_token=null,lease_expires_at=null,updated_at=now()
      where id=p_id returning * into j;
  else
    update public.job_queue set status=case when p_status='cancelled' then 'cancelled' else 'failed' end,
      error=left(coalesce(p_error,'Job failed'),2000),result=coalesce(p_result,'{}'::jsonb),
      locked_at=null,locked_by=null,lease_token=null,lease_expires_at=null,updated_at=now()
      where id=p_id returning * into j;
  end if;
  return j;
end;
$$;

create or replace function public.cancel_project_job(p_id uuid,p_user_id uuid)
returns public.job_queue language plpgsql security definer set search_path=public
as $$
declare j public.job_queue;
begin
  select * into j from public.job_queue where id=p_id for update;
  if not found then raise exception 'Job not found'; end if;
  if j.user_id <> p_user_id then raise exception 'Not authorized'; end if;
  if j.status in ('succeeded','failed','cancelled') then return j; end if;
  update public.job_queue set cancel_requested=true,
    status=case when status='queued' then 'cancelled' else status end,
    lease_expires_at=case when status='queued' then null else lease_expires_at end,
    updated_at=now() where id=p_id returning * into j;
  return j;
end;
$$;

revoke all on function public.claim_project_job(text,integer) from public,anon,authenticated;
revoke all on function public.renew_project_job_lease(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.assert_project_job_lease(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_project_job(uuid,text,jsonb,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.cancel_project_job(uuid,uuid) from public,anon,authenticated;

grant execute on function public.claim_project_job(text,integer) to service_role;
grant execute on function public.renew_project_job_lease(uuid,uuid,integer) to service_role;
grant execute on function public.assert_project_job_lease(uuid,uuid) to service_role;
grant execute on function public.finish_project_job(uuid,text,jsonb,text,integer,uuid) to service_role;
grant execute on function public.cancel_project_job(uuid,uuid) to service_role;
