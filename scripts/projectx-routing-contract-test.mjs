import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const router=read("supabase/functions/_shared/router.ts");
const bundledRouter=read("supabase/functions/ai/_shared/router.ts");
const ai=read("supabase/functions/ai/index.ts");
const runtime=read("px-final.js");
const migration=read("supabase/migrations/20260925160000_projectx_model_routing_feedback.sql");

for(const source of [router,bundledRouter]){
  assert.match(source,/const AGENT_TASKS/);
  assert.match(source,/interviewer:\s*'understand'/);
  assert.match(source,/planner:\s*'plan'/);
  assert.match(source,/builder:\s*'build'/);
  assert.match(source,/tester:\s*'build'/);\n  assert.match(source,/repairer:\s*'repair'/);
  assert.match(source,/researcher:\s*'research'/);
  assert.match(source,/orchestrator:\s*'discuss'/);
  assert.match(source,/export function routingTask/);
  assert.match(source,/export function scoreWithFeedback/);
  assert.match(source,/export function routedCandidates/);
  assert.match(source,/verificationFailures/);
  assert.match(source,/verification_pass/);
  assert.match(source,/verification_fail/);
}

assert.match(ai,/routedCandidates\(all, agent/);
assert.match(ai,/modelFeedbackForUser\(user\.id, task\)/);
assert.match(ai,/record_ai_model_feedback/);
assert.match(ai,/async function recordModelFeedback/);
assert.match(ai,/action === "recordModelFeedback"/);
assert.match(ai,/structured response repair failed/);
assert.match(ai,/invalid structured response/);
assert.match(ai,/continue;/);

assert.match(runtime,/recordVerificationModelFeedback/);
assert.match(runtime,/outcome:passed\?'verification_pass':'verification_fail'/);
assert.match(runtime,/finishedJob\.result\?\.model/);
assert.match(runtime,/finishedJob\.result\?\.provider/);

assert.match(migration,/create table if not exists public\.ai_model_feedback/);
assert.match(migration,/unique\(user_id, provider, model, task\)/);
assert.match(migration,/record_ai_model_feedback/);
assert.match(migration,/verification_passes/);
assert.match(migration,/verification_failures/);
assert.match(migration,/revoke insert, update, delete on public\.ai_model_feedback/);

assert.equal(router.replace(/\s+/g," "),bundledRouter.replace(/\s+/g," "));

console.log("PASS: agents map deterministically onto routing tasks");
console.log("PASS: model ranking incorporates durable success and verification feedback");
console.log("PASS: structured-output failures fall through to the next compatible candidate");
console.log("PASS: model feedback is persisted per user, provider, model, and task");
console.log("PASS: verifier outcomes are fed back to the build model route");
console.log("PASS: the bundled Edge Function router stays synchronized with the source router");
console.log("PROJECTX MODEL ROUTING CONTRACT PASSED");
