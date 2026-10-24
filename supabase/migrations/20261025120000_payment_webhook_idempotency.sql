-- Process a Razorpay webhook and all related database effects atomically.
-- The event claim and side effects commit together: duplicate deliveries are no-ops,
-- while a failed transaction leaves the event unclaimed so the provider can retry.
create or replace function public.projectx_process_payment_webhook(
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_user_id uuid,
  p_subscription_id text,
  p_status text,
  p_plan_key text,
  p_monthly_credits integer,
  p_period_end timestamptz,
  p_event_name text,
  p_metadata jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_id bigint;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'Payment webhook event id is required';
  end if;

  insert into public.payment_events(event_id, event_type, payload, received_at)
  values (p_event_id, coalesce(p_event_type, 'unknown'), coalesce(p_payload, '{}'::jsonb), now())
  on conflict (event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return false;
  end if;

  if p_user_id is not null and p_subscription_id is not null then
    insert into public.billing_subscriptions(
      user_id, provider, provider_subscription_id, status, plan_key, current_period_end, updated_at
    ) values (
      p_user_id, 'razorpay', p_subscription_id, coalesce(p_status, 'unknown'),
      p_plan_key, p_period_end, now()
    )
    on conflict (provider_subscription_id) do update set
      user_id = excluded.user_id,
      status = excluded.status,
      plan_key = excluded.plan_key,
      current_period_end = excluded.current_period_end,
      updated_at = now();

    insert into public.billing_entitlements(
      user_id, plan_key, status, monthly_credits, provider, provider_subscription_id, period_end, updated_at
    ) values (
      p_user_id, coalesce(p_plan_key, 'free'), coalesce(p_status, 'unknown'),
      greatest(coalesce(p_monthly_credits, 20), 0), 'razorpay', p_subscription_id, p_period_end, now()
    )
    on conflict (user_id) do update set
      plan_key = excluded.plan_key,
      status = excluded.status,
      monthly_credits = excluded.monthly_credits,
      provider = excluded.provider,
      provider_subscription_id = excluded.provider_subscription_id,
      period_end = excluded.period_end,
      updated_at = now();
    -- Intentionally do not overwrite credits_used on conflict.

    insert into public.payment_analytics(
      user_id, event_name, provider, plan_key, amount_paise, currency, external_id, properties
    ) values (
      p_user_id, coalesce(p_event_name, 'payment.webhook.unknown'), 'razorpay',
      p_metadata->>'plan', nullif(p_metadata->>'amountPaise', '')::bigint,
      'INR', p_metadata->>'externalId', coalesce(p_metadata, '{}'::jsonb)
    );

    insert into public.analytics_events(user_id, event_name, properties)
    values (p_user_id, coalesce(p_event_name, 'payment.webhook.unknown'), coalesce(p_metadata, '{}'::jsonb));

    insert into public.audit_logs(user_id, action, metadata)
    values (p_user_id, 'payment.webhook', jsonb_build_object(
      'event', coalesce(p_event_type, 'unknown'),
      'subscription_id', p_subscription_id
    ));
  end if;

  return true;
end;
$$;

revoke all on function public.projectx_process_payment_webhook(
  text, text, jsonb, uuid, text, text, text, integer, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.projectx_process_payment_webhook(
  text, text, jsonb, uuid, text, text, text, integer, timestamptz, text, jsonb
) to service_role;
