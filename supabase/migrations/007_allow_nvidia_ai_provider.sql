alter table public.ai_provider_credentials drop constraint if exists ai_provider_credentials_provider_check;

alter table public.ai_provider_credentials
  add constraint ai_provider_credentials_provider_check
  check (provider = any (array['bytez'::text,'openrouter'::text,'openai'::text,'google'::text,'anthropic'::text,'nvidia'::text,'generic'::text]));
