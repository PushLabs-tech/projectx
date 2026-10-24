-- Atomic fixed-window API rate limiting for user-triggered expensive/resource-consuming actions.
-- The counter increments before work starts, so concurrent requests cannot all pass a count-then-call race.
create table if not exists public.projectx_api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, window_start)
);

create index if not exists projectx_api_rate_limits_window_idx
  on public.projectx_api_rate_limits(window_start);

alter table public.projectx_api_rate_limits enable row level security;
revoke all on public.projectx_api_rate_limits from public, anon, authenticated;
grant all on public.projectx_api_rate_limits to service_role;

create schema if not exists private;

create or replace function private.consume_projectx_api_rate_limit(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_request_count integer;
begin
  if p_user_id is null then
    raise exception 'Rate limit user is required';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit parameters';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.projectx_api_rate_limits(user_id, window_start, request_count)
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_start) do update
    set request_count = public.projectx_api_rate_limits.request_count + 1
  returning request_count into v_request_count;

  -- Retain only a small rolling history of fixed windows; this is not a billing ledger.
  delete from public.projectx_api_rate_limits
  where window_start < v_window_start - make_interval(secs => p_window_seconds * 10);

  return v_request_count <= p_limit;
end;
$$;

revoke all on function private.consume_projectx_api_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function private.consume_projectx_api_rate_limit(uuid, integer, integer)
  to service_role;

create or replace function public.projectx_consume_rate_limit(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.consume_projectx_api_rate_limit(p_user_id, p_limit, p_window_seconds);
$$;

revoke all on function public.projectx_consume_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.projectx_consume_rate_limit(uuid, integer, integer)
  to service_role;
