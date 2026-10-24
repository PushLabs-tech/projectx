import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ai = read('supabase/functions/ai/index.ts');
const cors = read('supabase/functions/_shared/cors.ts');
const payments = read('supabase/functions/payments/index.ts');
const deploy = read('supabase/functions/deploy/index.ts');
const schema = read('supabase/schema.sql');
const paymentWebhookMigration = read('supabase/migrations/20261025120000_payment_webhook_idempotency.sql');

assert.match(ai, /corsHeaders/);
assert.match(cors, /Access-Control-Allow-Origin/);
assert.match(cors, /https:\/\/pushlabs-tech\.github\.io/);
assert.doesNotMatch(cors, /https:\/\/pushlabs-tech\.github\.io\/projectx/);
assert.match(ai, /Authorization/);
assert.match(ai, /persistProject/);
assert.match(ai, /429/);
assert.match(ai, /providerListModels/);
assert.match(ai, /project_id/);
assert.match(ai, /research/);
assert.match(ai, /research_findings/);
assert.match(ai, /usage/);
assert.match(ai, /securityEvents/);
assert.match(ai, /assertSafeBaseUrl/);

assert.match(payments, /projectx_process_payment_webhook/);
assert.match(payments, /razorpay/i);
assert.match(payments, /webhook/i);
assert.match(payments, /signature/i);
assert.match(payments, /sha256:/);
assert.doesNotMatch(payments, /from\('payment_events'\)\.upsert/);

// Webhook deduplication and side effects must share one database transaction.
assert.ok(paymentWebhookMigration.toLowerCase().includes('on conflict (event_id) do nothing'));
assert.ok(paymentWebhookMigration.includes('if v_inserted_id is null then'));
assert.ok(paymentWebhookMigration.includes('insert into public.billing_entitlements'));
assert.doesNotMatch(paymentWebhookMigration, /credits_used\s*=\s*excluded\.credits_used/i);
assert.ok(paymentWebhookMigration.includes('grant execute on function public.projectx_process_payment_webhook'));

// Beta safety: payment collection must remain disabled unless explicitly enabled.
assert.match(payments, /PROJECTX_BILLING_ENABLED.*===\s*["']true["']/);
const createSubscriptionStart = payments.indexOf("if(action==='createSubscription')");
const createSubscriptionProviderCall = payments.indexOf("https://api.razorpay.com/v1/subscriptions", createSubscriptionStart);
const createSubscriptionGuard = payments.indexOf("if(!BILLING_ENABLED)", createSubscriptionStart);
assert.ok(createSubscriptionStart >= 0 && createSubscriptionGuard > createSubscriptionStart && createSubscriptionGuard < createSubscriptionProviderCall,
  'createSubscription must be guarded before the Razorpay API call');

// Cancellation: ownership must be checked before calling the external provider.
const cancelSubscriptionStart = payments.indexOf("if(action==='cancelSubscription')");
const cancelOwnershipCheck = payments.indexOf("ownedSubscription", cancelSubscriptionStart);
const cancelProviderCall = payments.indexOf("/cancel", cancelSubscriptionStart);
assert.ok(cancelSubscriptionStart >= 0 && cancelOwnershipCheck > cancelSubscriptionStart && cancelOwnershipCheck < cancelProviderCall,
  'cancelSubscription must verify the authenticated user owns the subscription before the provider call');
assert.match(payments, /eq\('provider_subscription_id',sid\)\.eq\('user_id',u\.id\)/);

assert.match(schema, /create table/i);
assert.match(schema, /projects/i);

assert.match(deploy, /deploymentUrlHealthCheck/);
assert.match(deploy, /api[.]vercel[.]com[/]v13[/]deployments/);
assert.match(deploy, /api[.]netlify[.]com[/]api[/]v1[/]deploys/);
assert.match(deploy, /health_status/);
assert.match(deploy, /previous_deployment_id/);
assert.match(deploy, /rollbackDeployment/);
assert.match(deploy, /WORKSPACE_REQUIRED|FORBIDDEN/);

console.log('PASS AI edge-function contract');
console.log('PASS CORS contract');
console.log('PASS beta billing guard');
console.log('PASS subscription cancellation ownership contract');
console.log('PASS payment webhook contract');
console.log('PASS database schema contract');
console.log('BACKEND CONTRACT CHECKS PASSED');
