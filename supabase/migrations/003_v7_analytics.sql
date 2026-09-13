-- Builder V7 analytics and payment readiness
create table if not exists public.payment_analytics (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  provider text not null default 'razorpay',
  plan_key text,
  amount_paise bigint,
  currency text not null default 'INR',
  external_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_analytics_event_created_idx on public.payment_analytics(event_name,created_at desc);
create index if not exists payment_analytics_user_created_idx on public.payment_analytics(user_id,created_at desc);
alter table public.payment_analytics enable row level security;
drop policy if exists "payment analytics own read" on public.payment_analytics;
create policy "payment analytics own read" on public.payment_analytics for select using(user_id=auth.uid());
revoke insert, update, delete on public.payment_analytics from anon, authenticated;
