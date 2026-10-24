import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ai = read('supabase/functions/ai/index.ts');
const cors = read('supabase/functions/_shared/cors.ts');
const payments = read('supabase/functions/payments/index.ts');
const deploy = read('supabase/functions/deploy/index.ts');
const schema = read('supabase/schema.sql');
const paymentWebhookMigration = read('supabase/migrations/20261025120000_payment_webhook_idempotency.sql');
const atomicRateLimitMigration = read('supabase/migrations/20261025130000_atomic_ai_rate_limits.sql');
const projectExecutionConcurrencyMigration = read('supabase/migrations/20261025140000_project_execution_concurrency.sql');
const boundedRequestHelper = read('supabase/functions/_shared/request.ts');
const collaboration = read('supabase/functions/collaboration/index.ts');
const resourceIngest = read('supabase/functions/resource-ingest/index.ts');
const github = read('supabase/functions/github/index.ts');

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
assert.ok(ai.includes("readBoundedRequestBody(req, MAX_BODY_BYTES)"));
assert.ok(ai.includes('catch { throw new Error("Invalid JSON"); }'));
assert.ok(ai.includes('if (/^invalid json$|^invalid request encoding$/i.test(message)) return 400;'));
assert.ok(payments.includes("const readBoundedRequestBody = readBoundedRequestText"), "Payment handler must use the shared bounded request reader");


// Atomic per-action fixed-window rate limit: fail closed before any costly early-return action.
assert.match(ai, /const ACTION_RATE_LIMITS: Record<string, number>/);
for (const action of ["createProjectFromIntent", "applyBrainMutation", "generateDiscoveryPoll", "createPlan", "createArtifactVersion", "runVerification", "rollbackExecutionTransaction", "enqueueJob", "cancelJob", "deleteProject", "deleteCredential", "saveCredential", "testCredential", "listModels", "research", "chat"]) {
  assert.ok(ai.includes(action + ":"), "Action " + action + " must have a server-side rate limit");
}
assert.ok(ai.includes('admin.rpc("projectx_consume_rate_limit"'));
const aiHandlerForRateLimit = ai.slice(ai.indexOf("Deno.serve(async req =>"));
const authIndexForRateLimit = aiHandlerForRateLimit.indexOf("const user = await requireUser(req);");
const rpcIndexForRateLimit = aiHandlerForRateLimit.indexOf('admin.rpc("projectx_consume_rate_limit"');
const firstCostlyActionIndex = aiHandlerForRateLimit.indexOf('if (action === "createProjectFromIntent")');
assert.ok(authIndexForRateLimit >= 0 && rpcIndexForRateLimit > authIndexForRateLimit && firstCostlyActionIndex > rpcIndexForRateLimit,
  "Rate limiting must run after user auth but before costly action dispatch");
assert.doesNotMatch(aiHandlerForRateLimit, /const { count } = await admin\.from\("ai_usage"\)/,
  "The raceable count-then-run rate gate must not be used in the handler");
assert.ok(atomicRateLimitMigration.toLowerCase().includes('on conflict (user_id, action_key, window_start) do update'));
assert.ok(atomicRateLimitMigration.includes('primary key (user_id, action_key, window_start)'));
assert.ok(atomicRateLimitMigration.includes('p_action_key text'));
assert.ok(ai.includes('p_action_key: action'), 'Rate limits must be isolated by action');
assert.ok(atomicRateLimitMigration.includes('return v_request_count <= p_limit'));
assert.ok(atomicRateLimitMigration.includes('grant execute on function public.projectx_consume_rate_limit'));
assert.ok(projectExecutionConcurrencyMigration.includes("pg_advisory_xact_lock(hashtext(p_project_id::text))"));
assert.ok(projectExecutionConcurrencyMigration.includes("An execution job is already active for this project"));
assert.ok(projectExecutionConcurrencyMigration.includes("revoke insert, update, delete on public.job_queue from anon, authenticated"));
assert.ok(projectExecutionConcurrencyMigration.includes("grant execute on function public.enqueue_project_execution_job"));
const enqueueFunction = ai.slice(ai.indexOf("async function enqueueJob"), ai.indexOf("async function getJob"));
assert.ok(enqueueFunction.includes('admin.rpc("enqueue_project_execution_job"'));
assert.ok(enqueueFunction.includes('if(kind==="execution")'));
assert.ok(enqueueFunction.includes('if(!projectId) throw new Error("Execution jobs require a project.")'));
assert.ok(atomicRateLimitMigration.includes('revoke all on table') === false || atomicRateLimitMigration.includes('revoke all on public.projectx_api_rate_limits'));
assert.ok(!/grant execute on function public\.projectx_consume_rate_limit[\s\S]*?to anon/i.test(atomicRateLimitMigration));



assert.match(boundedRequestHelper, /req\.body\?\.getReader\(\)/);
assert.ok(boundedRequestHelper.includes("/^\\d+$/"), "Content-Length digits must be validated correctly");
assert.match(boundedRequestHelper, /totalBytes \+= value\.byteLength/);
assert.match(boundedRequestHelper, /if \(totalBytes > maxBytes\)/);
assert.match(boundedRequestHelper, /Request is too large/);
assert.ok(boundedRequestHelper.includes('"Invalid request encoding": 400'));
assert.ok(boundedRequestHelper.includes('"SIGN_IN_REQUIRED": 401'));
assert.ok(boundedRequestHelper.includes('"FORBIDDEN": 403'));
assert.ok(boundedRequestHelper.includes('"PROJECT_NOT_FOUND": 404'));
assert.ok(boundedRequestHelper.includes('return 500;'), 'Unknown infrastructure errors must map to 500');
assert.ok(payments.includes('requestErrorStatus(e)'), 'Payment handler must not classify backend failures as malformed requests');
assert.ok(payments.includes('from "../_shared/request.ts"'), 'Payment handler must share canonical bounded-request/status mapping');
assert.ok(boundedRequestHelper.includes('"Payment provider is not configured": 503'));
assert.ok(boundedRequestHelper.includes('"PROJECT_HAS_NO_FILES": 400'));
assert.ok(boundedRequestHelper.includes('message.startsWith("Missing Razorpay plan id for ")'), 'Missing payment plan configuration must not appear as a client error');
assert.ok(boundedRequestHelper.includes('export function parseJsonText'));
assert.ok(payments.includes('parseJsonText(raw,false)'), 'Webhook JSON parsing must convert malformed bodies to a 400-class error');
assert.ok(payments.includes('Object.prototype.hasOwnProperty.call(PLANS,plan)'), 'Payment plans must not accept inherited object properties');
for (const [name, source, limit] of [
  ["collaboration", collaboration, "128 * 1024"],
  ["resource-ingest", resourceIngest, "7 * 1024 * 1024"],
  ["deploy", deploy, "1 * 1024 * 1024"],
  ["github", github, "8 * 1024 * 1024"]
]) {
  assert.ok(source.includes("readBoundedJson(req, " + limit + ")"), name + " must parse through a bounded streaming reader");
  assert.ok(source.includes("requestErrorStatus(e)"), name + " must return the correct size-limit status");
}

assert.ok(github.includes('const {data:claimedState,error:claimError}'), 'GitHub OAuth state must be atomically consumed');
assert.ok(github.includes('if(claimError)throw claimError'), 'OAuth state deletion errors must not be ignored');
assert.ok(github.includes('if(connectionError)throw connectionError'), 'OAuth connection persistence errors must not be ignored');
assert.ok(github.includes('if(repoSyncError)throw repoSyncError'), 'Repository sync failures must not be reported as success');
assert.ok(github.includes('if(disconnectError)throw disconnectError'), 'Disconnect failures must not be reported as success');
assert.ok(collaboration.includes('if(!["admin","editor","viewer"].includes(role))throw new Error("INVALID_ROLE")'), 'Invitations must use a schema-valid workspace role');
assert.ok(collaboration.includes('if(acceptedError)throw acceptedError'), 'Invitation acceptance persistence failures must be surfaced');
assert.ok(collaboration.includes('const {error:deleteError}=await admin.from("workspace_invitations").delete()'), 'Invitation replacement must not ignore a failed delete');


assert.match(payments, /projectx_process_payment_webhook/);
assert.ok(payments.includes("readBoundedRequestBody(req,MAX_REQUEST_BYTES)"));
assert.match(payments, /MAX_REQUEST_BYTES=1_000_000/);
assert.ok(payments.includes("requestErrorStatus(e)"), "Payment handler must distinguish malformed requests from backend failures");
assert.ok(payments.includes("parseJsonText(raw,false)"), "Webhook payload JSON must use the canonical parser");
assert.match(payments, /razorpay/i);
assert.match(payments, /webhook/i);
assert.match(payments, /signature/i);
assert.match(payments, /sha256:/);
assert.doesNotMatch(payments, /from\('payment_events'\)\.upsert/);

// Webhook deduplication and side effects must share one database transaction.
assert.ok(paymentWebhookMigration.toLowerCase().includes('on conflict (event_id) do nothing'));
assert.ok(paymentWebhookMigration.includes('p_billing_enabled boolean'));
assert.ok(paymentWebhookMigration.includes('if not coalesce(p_billing_enabled, false) then'));
assert.ok(payments.includes('p_billing_enabled:BILLING_ENABLED'));
assert.ok(payments.includes('ignored:!BILLING_ENABLED'));
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
