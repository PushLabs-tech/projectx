create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null default 'free',
  status text not null default 'active',
  monthly_credits integer not null default 20,
  credits_used integer not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz,
  provider text,
  provider_subscription_id text,
  updated_at timestamptz not null default now()
);
alter table public.billing_entitlements enable row level security;
drop policy if exists "billing entitlement own read" on public.billing_entitlements;
create policy "billing entitlement own read" on public.billing_entitlements for select to authenticated using(user_id=(select auth.uid()));
revoke insert,update,delete on public.billing_entitlements from anon,authenticated;
