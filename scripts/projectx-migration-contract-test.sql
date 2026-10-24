\set ON_ERROR_STOP on
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_workspace uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_other_project uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_allowed boolean;
  v_credits integer;
  v_job public.job_queue%rowtype;
  v_count integer;
BEGIN
  -- Atomic user/action counters: limits are isolated by action and by user.
  IF public.projectx_consume_rate_limit(v_user_a, 'generate', 2, 60) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'rate-limit first request should pass';
  END IF;
  IF public.projectx_consume_rate_limit(v_user_a, 'generate', 2, 60) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'rate-limit second request should pass';
  END IF;
  IF public.projectx_consume_rate_limit(v_user_a, 'generate', 2, 60) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'rate-limit third request should be rejected';
  END IF;
  IF public.projectx_consume_rate_limit(v_user_a, 'saveCredential', 2, 60) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'different action must not share the generate counter';
  END IF;
  IF public.projectx_consume_rate_limit(v_user_b, 'generate', 2, 60) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'different user must have a separate counter';
  END IF;

  -- Initial webhook effects, then update the same entitlement without resetting credits_used.
  IF public.projectx_process_payment_webhook(
    'evt-created', 'subscription.activated', '{}'::jsonb, true, v_user_a,
    'sub-projectx-1', 'active', 'pro', 150, now(),
    'payment.subscription.activated',
    '{"plan":"pro","amountPaise":"499","externalId":"sub-projectx-1"}'::jsonb
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'first payment webhook should be processed';
  END IF;
  UPDATE public.billing_entitlements SET credits_used = 17 WHERE user_id = v_user_a;
  IF public.projectx_process_payment_webhook(
    'evt-updated', 'subscription.updated', '{}'::jsonb, true, v_user_a,
    'sub-projectx-1', 'active', 'pro', 180, now(),
    'payment.subscription.updated',
    '{"plan":"pro","amountPaise":"499","externalId":"sub-projectx-1"}'::jsonb
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'new update event should be processed';
  END IF;
  SELECT credits_used INTO v_credits
    FROM public.billing_entitlements WHERE user_id = v_user_a;
  IF v_credits IS DISTINCT FROM 17 THEN
    RAISE EXCEPTION 'webhook update reset credits_used (actual=%)', v_credits;
  END IF;

  -- Duplicate provider delivery must be a no-op.
  IF public.projectx_process_payment_webhook(
    'evt-updated', 'subscription.updated', '{"duplicate":true}'::jsonb, true, v_user_a,
    'sub-projectx-1', 'active', 'pro', 180, now(),
    'payment.subscription.updated',
    '{"plan":"pro","amountPaise":"499","externalId":"sub-projectx-1"}'::jsonb
  ) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'duplicate webhook event should return false';
  END IF;
  SELECT count(*) INTO v_count FROM public.payment_events WHERE event_id = 'evt-updated';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate webhook event was inserted more than once'; END IF;

  -- Owner mismatch must raise, and the event claim must roll back with the transaction.
  BEGIN
    PERFORM public.projectx_process_payment_webhook(
      'evt-owner-mismatch', 'subscription.updated', '{}'::jsonb, true, v_user_b,
      'sub-projectx-1', 'active', 'pro', 180, now(),
      'payment.subscription.updated',
      '{"plan":"pro","amountPaise":"499","externalId":"sub-projectx-1"}'::jsonb
    );
    RAISE EXCEPTION 'TEST_EXPECTED_PAYMENT_OWNER_MISMATCH';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_EXPECTED_PAYMENT_OWNER_MISMATCH' THEN RAISE; END IF;
    IF SQLERRM <> 'Payment subscription owner mismatch' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE event_id = 'evt-owner-mismatch') THEN
    RAISE EXCEPTION 'owner-mismatch event claim did not roll back';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_subscriptions WHERE provider_subscription_id = 'sub-projectx-1' AND user_id = v_user_b) THEN
    RAISE EXCEPTION 'webhook reassigned a subscription to another user';
  END IF;

  -- Free beta records a signed event but must not grant an entitlement when billing is off.
  IF public.projectx_process_payment_webhook(
    'evt-free-beta', 'subscription.activated', '{}'::jsonb, false, v_user_b,
    'sub-free-beta', 'active', 'pro', 150, now(),
    'payment.subscription.activated',
    '{"plan":"pro","amountPaise":"499","externalId":"sub-free-beta"}'::jsonb
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'billing-disabled webhook event should be acknowledged';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_subscriptions WHERE provider_subscription_id = 'sub-free-beta') THEN
    RAISE EXCEPTION 'billing-disabled webhook created a paid subscription';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_entitlements WHERE user_id = v_user_b) THEN
    RAISE EXCEPTION 'billing-disabled webhook created a paid entitlement';
  END IF;

  -- Project enqueue gate: one queued/running execution per project, plus owner/workspace authorization.
  INSERT INTO public.projects (id, owner_id, workspace_id)
  VALUES (v_project, v_user_a, v_workspace), (v_other_project, v_user_a, 'cccccccc-cccc-cccc-cccc-cccccccccccd');
  v_job := public.enqueue_project_execution_job(v_project, v_user_a, '{}'::jsonb, 3, 120);
  IF v_job.status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'new execution job should be queued';
  END IF;
  BEGIN
    PERFORM public.enqueue_project_execution_job(v_project, v_user_a, '{}'::jsonb, 3, 120);
    RAISE EXCEPTION 'TEST_EXPECTED_ACTIVE_JOB_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_EXPECTED_ACTIVE_JOB_REJECTION' THEN RAISE; END IF;
    IF position('already active' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  SELECT count(*) INTO v_count FROM public.job_queue
    WHERE project_id = v_project AND kind = 'execution' AND status IN ('queued', 'running');
  IF v_count <> 1 THEN RAISE EXCEPTION 'expected exactly one active execution job'; END IF;

  BEGIN
    PERFORM public.enqueue_project_execution_job(v_other_project, v_user_b, '{}'::jsonb, 3, 120);
    RAISE EXCEPTION 'TEST_EXPECTED_NOT_AUTHORIZED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_EXPECTED_NOT_AUTHORIZED' THEN RAISE; END IF;
    IF SQLERRM <> 'Not authorized' THEN RAISE; END IF;
  END;

  IF has_table_privilege('authenticated', 'public.job_queue', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role retained direct job_queue INSERT';
  END IF;
  IF has_function_privilege('anon', 'public.projectx_consume_rate_limit(uuid,text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon role can execute rate-limit RPC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.projectx_consume_rate_limit(uuid,text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service role cannot execute rate-limit RPC';
  END IF;
  IF has_function_privilege('anon', 'public.projectx_process_payment_webhook(text,text,jsonb,boolean,uuid,text,text,text,integer,timestamptz,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon role can execute payment webhook RPC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.projectx_process_payment_webhook(text,text,jsonb,boolean,uuid,text,text,text,integer,timestamptz,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service role cannot execute payment webhook RPC';
  END IF;
  IF has_function_privilege('authenticated', 'public.enqueue_project_execution_job(uuid,uuid,jsonb,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute project enqueue RPC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.enqueue_project_execution_job(uuid,uuid,jsonb,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service role cannot execute project enqueue RPC';
  END IF;

  RAISE NOTICE 'PASS: per-action/user rate limits, webhook duplicate/rollback/credit preservation, beta billing guard, enqueue authorization/concurrency and RPC grants';
END $$;
