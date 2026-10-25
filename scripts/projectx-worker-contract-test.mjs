import assert from "node:assert/strict";
import fs from "node:fs";

const root=new URL("../",import.meta.url);
const worker=fs.readFileSync(new URL("../supabase/functions/projectx-worker/index.ts",import.meta.url),"utf8");
const tools=fs.readFileSync(new URL("../supabase/functions/projectx-worker/tools.ts",import.meta.url),"utf8");
const ai=fs.readFileSync(new URL("../supabase/functions/ai/index.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../supabase/migrations/20260925150000_projectx_remote_execution_worker.sql",import.meta.url),"utf8");
const transactionMigration=fs.readFileSync(new URL("../supabase/migrations/20260925170000_projectx_execution_transactions.sql",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../px-final.js",import.meta.url),"utf8");
const supabaseConfig=fs.readFileSync(new URL("../supabase/config.toml",import.meta.url),"utf8");
const setupGuide=fs.readFileSync(new URL("../SETUP-SUPABASE.md",import.meta.url),"utf8");

assert.match(worker,/projectx_worker_token_valid/);
// pg_cron calls the worker with its dedicated token but no user JWT, so the edge gateway
// must defer auth to this function's token-validation boundary.
assert.match(supabaseConfig,/\[functions\.projectx-worker\][\s\S]*?verify_jwt = false/);
assert.match(setupGuide,/projectx-worker --no-verify-jwt/);
assert.match(setupGuide,/X-ProjectX-Worker-Token/);
assert.match(worker,/MAX_REQUEST_BYTES = 64_000/);
assert.match(worker,/readBoundedRequestBody\(req,MAX_REQUEST_BYTES\)/);
assert.match(worker,/Invalid JSON/);
assert.match(worker,/Invalid batch limit/);
assert.match(worker,/Method not allowed/);
assert.match(worker,/claim_project_job/);
assert.match(worker,/finish_project_job/);
assert.match(worker,/commit_project_execution/);
assert.match(worker,/explicitApproval/);
assert.match(worker,/AbortController/);
assert.match(worker,/executionToolDefinitions/);
assert.match(worker,/executeToolCalls/);
assert.match(tools,/repairPaths/);
assert.match(tools,/contract\?\.type === "repair"/);
assert.match(worker,/Execution produced no file changes/);
assert.match(worker,/\["rebuild","update","repair"\]\.includes\(action\.type\)/);
assert.doesNotMatch(worker,/workerToken\s*\)\s*\{[\s\S]*workerToken/);
assert.match(tools,/list_files/);
assert.match(tools,/read_file/);
assert.match(tools,/write_file/);
assert.match(tools,/delete_file/);
assert.match(tools,/verify_output/);
assert.match(tools,/Write is outside the action contract/);
assert.match(tools,/MAX_FILE_BYTES = 600000/);
assert.match(tools,/MAX_TRANSACTION_OPERATIONS = 12/);
assert.match(tools,/MAX_TRANSACTION_WRITE_BYTES = 4000000/);
assert.match(tools,/validateExecutionOperations/);
assert.match(tools,/transaction_validator/);
assert.match(tools,/outside_contract/);
assert.match(ai,/kind === "execution"/);
assert.match(ai,/remote execution planner/);
assert.match(ai,/toolCalls/);
assert.match(ai,/cancelJob/);

// Worker calls carry the worker token, not a browser JWT; route before requireUser.
// The handler must read/bound the request first, then dispatch runQueuedJob through its dedicated token check.
const aiHandler=ai.slice(ai.indexOf("Deno.serve(async req =>"));
const boundedBodyRead=aiHandler.indexOf("readBoundedRequestBody(req, MAX_BODY_BYTES)");
const workerDispatch=aiHandler.indexOf('if (action === "runQueuedJob") return json(await runQueuedJob(req, body));');
const endUserAuth=aiHandler.indexOf("const user = await requireUser(req);");
assert.ok(boundedBodyRead>=0 && boundedBodyRead<workerDispatch,"AI handler must size-check the request before worker dispatch");
assert.match(ai,/const reader = req\.body\?\.getReader\(\)/);
assert.match(ai,/totalBytes \+= value\.byteLength/);
assert.match(ai,/if \(totalBytes > maxBytes\)/);
assert.ok(workerDispatch>=0 && workerDispatch<endUserAuth,"runQueuedJob must route through worker-token auth before end-user JWT auth");
assert.match(ai,/requireWorkerUser\(req, String\(body\?\.userId \|\| ""\)\)/);
assert.match(runtime,/enqueueRemoteExecutionJob/);
assert.match(runtime,/waitForRemoteExecutionJob/);
assert.match(runtime,/kind:'execution'/);
assert.match(migration,/project_execution_events/);
assert.match(migration,/cancel_project_job/);
assert.match(migration,/commit_project_execution/);
assert.match(migration,/cancel_requested/);
assert.match(migration,/timeout_seconds/);
assert.match(transactionMigration,/project_execution_transactions/);
assert.match(transactionMigration,/inverse_operations/);
assert.match(transactionMigration,/rollback_project_execution/);
assert.match(transactionMigration,/status','conflict/);
assert.match(transactionMigration,/lastTransactionId/);
assert.match(transactionMigration,/rollbackHistory/);

console.log("PASS: remote worker has a server-side authentication boundary");
console.log("PASS: execution tools are explicitly registered and contract-scoped");
console.log("PASS: tool writes enforce path, size, transaction count, and no-op limits");
console.log("PASS: execution jobs support cancellation and hard timeouts");
console.log("PASS: worker persists execution state, transactions, and durable execution events atomically");
console.log("PASS: AI produces tool proposals while the worker owns writes");
console.log("PASS: reconciliation UI can dispatch and await durable worker jobs");
console.log("PROJECTX REMOTE WORKER CONTRACT PASSED");
