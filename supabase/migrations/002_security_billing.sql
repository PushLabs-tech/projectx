-- Security, audit, billing and tenant-hardening migration.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id,created_at desc);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('razorpay')),
  provider_subscription_id text not null unique,
  status text not null,
  plan_key text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- The current app does not use these token columns. Remove plaintext credential storage.
alter table if exists public.connected_accounts drop column if exists access_token;
alter table if exists public.connected_accounts drop column if exists refresh_token;

alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "audit own read" on public.audit_logs;
create policy "audit own read" on public.audit_logs for select using(user_id=auth.uid());
drop policy if exists "security own read" on public.security_events;
create policy "security own read" on public.security_events for select using(user_id=auth.uid());
drop policy if exists "billing own read" on public.billing_subscriptions;
create policy "billing own read" on public.billing_subscriptions for select using(user_id=auth.uid());
-- payment_events are backend-only.

revoke all on public.ai_provider_credentials from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.security_events from anon, authenticated;
revoke insert, update, delete on public.billing_subscriptions from anon, authenticated;

-- Keep client-side grants intentionally narrow for private application data.
revoke all on public.connected_accounts from anon, authenticated;

comment on table public.ai_provider_credentials is 'Backend-only encrypted AI credentials. Never expose through the Data API.';
comment on table public.payment_events is 'Backend-only idempotency and webhook audit store.';
