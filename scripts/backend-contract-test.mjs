import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ai = read('supabase/functions/ai/index.ts');
const cors = read('supabase/functions/_shared/cors.ts');
const payments = read('supabase/functions/payments/index.ts');
const schema = read('supabase/schema.sql');

assert.match(ai, /corsHeaders/);
assert.match(cors, /Access-Control-Allow-Origin/);
assert.match(ai, /Authorization/);
assert.match(ai, /persistProject/);
assert.match(ai, /429/);
assert.match(ai, /ai_provider_models/);
assert.match(ai, /project_id/);

assert.match(payments, /payment_events/);
assert.match(payments, /razorpay/i);
assert.match(payments, /webhook/i);
assert.match(payments, /signature/i);

assert.match(schema, /create table/i);
assert.match(schema, /projects/i);

console.log('PASS AI edge-function contract');
console.log('PASS CORS contract');
console.log('PASS payment webhook contract');
console.log('PASS database schema contract');
console.log('BACKEND CONTRACT CHECKS PASSED');
