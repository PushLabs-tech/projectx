import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ai = read('supabase/functions/ai/index.ts');
const cors = read('supabase/functions/_shared/cors.ts');
const payments = read('supabase/functions/payments/index.ts');
const deploy = read('supabase/functions/deploy/index.ts');
const schema = read('supabase/schema.sql');

assert.match(ai, /corsHeaders/);
assert.match(cors, /Access-Control-Allow-Origin/);
assert.match(cors, /https:\/\/pushlabs-tech\.github\.io/);
assert.doesNotMatch(cors, /https:\/\/pushlabs-tech\.github\.io\/projectx/);
assert.match(ai, /Authorization/);
assert.match(ai, /persistProject/);
assert.match(ai, /"runQueuedJob"/);
assert.match(ai, /action === "runQueuedJob"/);
assert.match(ai, /action === "runQueuedJob"[\s\S]*?runQueuedJob\(req, body\)/);
assert.ok(ai.indexOf('if (action === "runQueuedJob") return json(await runQueuedJob(req, body));') < ai.indexOf("const user = await requireUser(req);"), "worker dispatch must validate its worker token before requiring a user session");
assert.match(ai, /429/);
assert.match(ai, /providerListModels/);
assert.match(ai, /project_id/);
assert.match(ai, /research/);
assert.match(ai, /research_findings/);
assert.match(ai, /usage/);
assert.match(ai, /securityEvents/);
assert.match(ai, /assertSafeBaseUrl/);

assert.match(payments, /payment_events/);
assert.match(payments, /from\('payment_events'\)\.insert/);
assert.match(payments, /eventError\?\.code==='23505'/);
assert.match(payments, /MAX_BODY_BYTES/);
assert.match(payments, /billing_subscriptions'\)\.select\('id'\)/);
assert.ok(payments.indexOf("eq('provider_subscription_id',sid).eq('user_id',u.id)") < payments.indexOf("api.razorpay.com/v1/subscriptions/"));

assert.match(payments, /razorpay/i);
assert.match(payments, /webhook/i);
assert.match(payments, /signature/i);

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
console.log('PASS payment webhook contract');
console.log('PASS database schema contract');
console.log('BACKEND CONTRACT CHECKS PASSED');
