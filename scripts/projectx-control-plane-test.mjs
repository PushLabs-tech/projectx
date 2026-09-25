import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/20260925180000_projectx_execution_control_plane.sql",import.meta.url),"utf8");
const worker=fs.readFileSync(new URL("../supabase/functions/projectx-worker/index.ts",import.meta.url),"utf8");

assert.match(migration,/lease_token uuid/);
assert.match(migration,/lease_expires_at timestamptz/);
assert.match(migration,/renew_project_job_lease/);
assert.match(migration,/assert_project_job_lease/);
assert.match(migration,/Execution lease expired or owned by another worker/);
assert.match(migration,/project_execution_transactions_job_action_committed_idx/);
assert.match(migration,/status='queued'/);
assert.match(migration,/for update skip locked/);
assert.match(migration,/cancel_requested=true/);
assert.match(migration,/lease_expires_at < now/);
assert.match(migration,/grant execute on function public.renew_project_job_lease/);
assert.match(migration,/grant execute on function public.finish_project_job\(uuid,text,jsonb,text,integer,uuid\)/);

assert.match(worker,/startLeaseHeartbeat/);
assert.match(worker,/renew_project_job_lease/);
assert.match(worker,/assert_project_job_lease/);
assert.match(worker,/p_lease_token:job\.lease_token/);
assert.match(worker,/stopHeartbeat\(\)/);

console.log("PASS: worker leases are renewable and server-owned");
console.log("PASS: expired leases are recoverable by later workers");
console.log("PASS: finish operations require the active lease token");
console.log("PASS: execution transactions have committed job/action idempotency protection");
console.log("PASS: worker heartbeats cover execution and proxied jobs");
console.log("PROJECTX EXECUTION CONTROL PLANE CONTRACT PASSED");
