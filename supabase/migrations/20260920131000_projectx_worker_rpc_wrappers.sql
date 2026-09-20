create or replace function public.projectx_worker_token_valid(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.projectx_worker_token_valid(p_token);
$$;

create or replace function public.projectx_worker_token_get()
returns text
language sql
security definer
set search_path = ''
as $$
  select private.projectx_worker_token_get();
$$;

revoke all on function public.projectx_worker_token_valid(text) from public, anon, authenticated;
revoke all on function public.projectx_worker_token_get() from public, anon, authenticated;
grant execute on function public.projectx_worker_token_valid(text) to service_role;
grant execute on function public.projectx_worker_token_get() to service_role;