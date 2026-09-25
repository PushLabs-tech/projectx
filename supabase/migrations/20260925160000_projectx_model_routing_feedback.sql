-- Durable per-user model routing feedback.
create table if not exists public.ai_model_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 240),
  task text not null check (char_length(task) between 1 and 40),
  attempts integer not null default 0 check (attempts >= 0),
  successes integer not null default 0 check (successes >= 0),
  failures integer not null default 0 check (failures >= 0),
  verification_passes integer not null default 0 check (verification_passes >= 0),
  verification_failures integer not null default 0 check (verification_failures >= 0),
  total_latency_ms bigint not null default 0 check (total_latency_ms >= 0),
  last_latency_ms integer not null default 0 check (last_latency_ms >= 0),
  last_outcome text,
  last_error text,
  last_evidence jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, model, task)
);

create index if not exists ai_model_feedback_user_task_idx
  on public.ai_model_feedback(user_id, task, updated_at desc);

alter table public.ai_model_feedback enable row level security;

drop policy if exists "model feedback read own" on public.ai_model_feedback;
create policy "model feedback read own"
on public.ai_model_feedback
for select to authenticated
using (user_id = (select auth.uid()));

revoke insert, update, delete on public.ai_model_feedback from anon, authenticated;

create or replace function public.record_ai_model_feedback(
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_task text,
  p_outcome text,
  p_latency_ms integer default 0,
  p_error text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns public.ai_model_feedback
language plpgsql
security definer
set search_path=public
as $$
declare row_data public.ai_model_feedback;
begin
  if p_user_id is null or char_length(coalesce(p_provider,'')) = 0 or char_length(coalesce(p_model,'')) = 0 or char_length(coalesce(p_task,'')) = 0 then
    raise exception 'Missing model feedback identity';
  end if;

  insert into public.ai_model_feedback(
    user_id,provider,model,task,attempts,successes,failures,
    verification_passes,verification_failures,total_latency_ms,last_latency_ms,
    last_outcome,last_error,last_evidence,last_used_at,updated_at
  ) values (
    p_user_id,left(p_provider,40),left(p_model,240),left(p_task,40),
    1,
    case when p_outcome in ('success','verification_pass') then 1 else 0 end,
    case when p_outcome in ('failure','verification_fail') then 1 else 0 end,
    case when p_outcome='verification_pass' then 1 else 0 end,
    case when p_outcome='verification_fail' then 1 else 0 end,
    greatest(coalesce(p_latency_ms,0),0),
    greatest(coalesce(p_latency_ms,0),0),
    left(coalesce(p_outcome,'unknown'),40),
    left(coalesce(p_error,''),1000),
    coalesce(p_evidence,'{}'::jsonb),
    now(), now()
  )
  on conflict(user_id,provider,model,task) do update set
    attempts=public.ai_model_feedback.attempts+1,
    successes=public.ai_model_feedback.successes + case when excluded.last_outcome in ('success','verification_pass') then 1 else 0 end,
    failures=public.ai_model_feedback.failures + case when excluded.last_outcome in ('failure','verification_fail') then 1 else 0 end,
    verification_passes=public.ai_model_feedback.verification_passes + case when excluded.last_outcome='verification_pass' then 1 else 0 end,
    verification_failures=public.ai_model_feedback.verification_failures + case when excluded.last_outcome='verification_fail' then 1 else 0 end,
    total_latency_ms=public.ai_model_feedback.total_latency_ms + excluded.last_latency_ms,
    last_latency_ms=excluded.last_latency_ms,
    last_outcome=excluded.last_outcome,
    last_error=excluded.last_error,
    last_evidence=excluded.last_evidence,
    last_used_at=now(),
    updated_at=now()
  returning * into row_data;

  return row_data;
end;
$$;

revoke all on function public.record_ai_model_feedback(uuid,text,text,text,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_ai_model_feedback(uuid,text,text,text,text,integer,text,jsonb) to service_role;
