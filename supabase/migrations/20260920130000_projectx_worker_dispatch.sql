-- ProjectX durable worker execution and secure scheduling.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'projectx_worker_token'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'projectx_worker_token',
      'ProjectX internal worker authentication token'
    );
  end if;
end $$;

create or replace function private.projectx_worker_token_valid(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'projectx_worker_token'
      and decrypted_secret = coalesce(p_token, '')
      and char_length(decrypted_secret) >= 32
  );
$$;

revoke all on function private.projectx_worker_token_valid(text) from public, anon, authenticated;
grant execute on function private.projectx_worker_token_valid(text) to service_role;

create or replace function private.projectx_worker_token_get()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'projectx_worker_token'
  limit 1;
$$;

revoke all on function private.projectx_worker_token_get() from public, anon, authenticated;
grant execute on function private.projectx_worker_token_get() to service_role;

-- The worker endpoint is invoked by pg_cron/pg_net. The token is read from Vault
-- at execution time, so no credential is stored in the cron definition.
select cron.schedule(
  'projectx-worker-dispatch',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://homgaryumqbrnjcfkezi.supabase.co/functions/v1/projectx-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-ProjectX-Worker-Token',
          (select decrypted_secret from vault.decrypted_secrets where name = 'projectx_worker_token')
      ),
      body := '{"limit":10}'::jsonb,
      timeout_milliseconds := 5000
    ) as request_id;
  $cron$
);
