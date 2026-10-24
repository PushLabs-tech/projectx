# ProjectX Release Gates

This is the active checklist for repository changes in draft PR #55. Statuses distinguish source/CI evidence from live-service evidence. Passing CI does not prove that Supabase migrations, secrets, Auth, cron, provider integrations, or backups are correctly deployed.

## Gate 0 — Baseline and reproducibility

- [x] Record the canonical repository and baseline main commit (0570b00b17e505ebff38d50133e6bcd417028af3).
- [x] Map browser entrypoints, AI/payment/worker Edge Functions, migrations, test commands, and known external dependencies in BASELINE.md.
- [x] Record unknown live-state claims rather than infer them from source.
- [x] Keep work isolated on fix/beta-billing-guard-cancellation-ownership; main remains unchanged.
- [ ] Obtain a clean local checkout and reproduce install/build/check/E2E; current session could not clone locally.
- [x] Commit the npm-resolver-generated `package-lock.json` and standardize CI on the locked `npm ci` install.
- [ ] Confirm whether the legacy `bun.lock` is used by any contributor workflow; retire or regenerate it only after a repository-wide search.

## Gate 1 — MVP acceptance and threat model

- [x] Document the first golden-path acceptance contract.
- [x] Document trust boundaries, assets, threats, approval tiers and explicit free-beta exclusions in PROJECTX_MVP_THREAT_MODEL.md.
- [ ] Team review and acceptance of the golden path, unsupported list and residual-risk owners.
- [ ] Add an explicit risk/approval owner for every high-impact production operation.

## Gate 2 — P0 correctness and security

- [x] Keep subscription creation disabled unless PROJECTX_BILLING_ENABLED is exactly true.
- [x] Verify cancellation ownership before making the external provider call.
- [x] Add atomic webhook event claiming and database side effects in projectx_process_payment_webhook.
- [x] Preserve credits_used on existing entitlement updates.
- [x] Prevent webhook conflict updates from reassigning a subscription to a different user.
- [x] Bound and stream request bodies before JSON parsing in all current Edge Function handlers: ai, payments, projectx-worker, collaboration, resource-ingest, deploy, github.
- [x] Add atomic per-user/per-action fixed-window rate limiting before costly AI action dispatch.
- [x] Route internal runQueuedJob through a dedicated worker-token check before ordinary user JWT auth.
- [x] Add source-level regression contracts for billing, worker auth, rate limits, request caps and webhook processing.
- [x] Confirm latest PR head `e4481d80321d502409552f3201c92e5779aa71aa`: run [40140396994](https://github.com/PushLabs-tech/projectx/actions/runs/40140396994) passed locked `npm ci`, high-severity npm audit, `npm test`, production build, browser E2E, disposable PostgreSQL migration execution, webhook/rate-limit/grant assertions, and parallel enqueue race. E2E: 7 passed, 2 authenticated tests skipped because `PROJECTX_E2E_EMAIL` and `PROJECTX_E2E_PASSWORD` are not configured. This is CI evidence only, not authenticated live-backend verification.
- [x] Run disposable PostgreSQL tests for webhook duplicate delivery, owner mismatch/rollback, credit preservation, billing-disabled entitlement behavior, and service-role-only RPC grants (run [40140396994](https://github.com/PushLabs-tech/projectx/actions/runs/40140396994)).
- [x] Add an atomic per-project execution enqueue gate using a transaction-scoped advisory lock; per-user rate limits are not a substitute.
- [x] Race two concurrent enqueue calls in disposable PostgreSQL; CI confirmed exactly one active execution job per project in [run 40140396994](https://github.com/PushLabs-tech/projectx/actions/runs/40140396994).
- [ ] Audit every service-role operation for ownership/RBAC checks and add two-user integration tests.
- [ ] Test malformed JSON, body caps, cancellation, stale version, lease expiry, duplicate dispatch and worker restart against staging.
- [x] Exercise billing-disabled webhook handling against disposable PostgreSQL in CI; signed event is recorded but no paid entitlement/subscription is created.
- [ ] Verify deployed billing flag and webhook behavior on a disposable Supabase project with billing disabled; never enable real payment collection for beta.

## Gate 3 — Durable job engine

- [x] Source includes atomic claim/lease, heartbeat, cancellation and timeout handling.
- [x] Source includes transaction/idempotency and rollback controls.
- [x] Worker contract tests cover the token boundary and execution tool constraints.
- [ ] Test lease races, expired lease reclaim, duplicate dispatch and cancellation while running against a disposable Supabase/staging database.
- [ ] Add bounded retry/dead-letter visibility and ensure terminal failures are visible to the user.
- [ ] Test multiple worker instances concurrently against staging.

## Gate 4 — First real worker path

- [x] Source restricts writes to explicit tools/action contracts and bounded file/transaction sizes.
- [x] Source checks project target version and ties results to execution records.
- [ ] Prove a real authenticated project can create, execute, verify, reload and roll back in staging.
- [ ] Test adversarial tool inputs, path traversal, prompt injection, no-op writes, large outputs and provider timeouts.
- [ ] Capture execution evidence and ensure the UI does not claim success without persisted output and verification.

## Gate 5 — Copilot and integrations

- [x] Internal worker call has a dedicated token boundary in source.
- [x] GitHub/deployment functions contain workspace/project authorization checks in source.
- [ ] Validate the two-repository Copilot contract with the other agent/project if that repository is still in use.
- [ ] Test OAuth state/redirects, token scopes, credential rotation and disconnect/revocation.
- [ ] Test prompt injection from resources and provider outputs with high-impact approval gates.
- [ ] Do not claim live GitHub/deployment integration until provider credentials and a test repository/site have been exercised.

## Gate 6 — Preview, Git and deployment

- [x] Browser preview/runtime and CI browser contracts exist.
- [x] Deployment source tracks source hash, version, health and rollback metadata.
- [ ] Test sandbox escape attempts and browser-console/page-error smoke on the deployed build.
- [ ] Test Git changes on a disposable repository and confirm they do not write to protected branches unexpectedly.
- [ ] Test a deployment-provider test target, health check, rollback and provider failure path.
- [ ] Confirm real hosting behavior and headers. Repository _headers is not proof that GitHub Pages applies those headers.

## Gate 7 — Release readiness

- [x] Add npm high-severity dependency audit to CI.
- [x] Add weekly Dependabot checks for npm and GitHub Actions.
- [x] Confirm PR head `e4481d80321d502409552f3201c92e5779aa71aa` passes the locked npm/audit/test/build/E2E suite and disposable PostgreSQL migration contracts in [run 40140396994](https://github.com/PushLabs-tech/projectx/actions/runs/40140396994) (7 passed, 2 authenticated tests skipped due to absent E2E credentials). This documentation refresh creates a new head and requires one final CI verification.
- [ ] Add/verify structured logs, metrics, alerting and incident response for AI, worker, payment and deploy failures.
- [ ] Configure staging and production separation and verify actual Edge Function secrets without exposing values.
- [ ] Enable and test database backups and rehearse restore.
- [ ] Verify exact Supabase Auth Site URL/redirect allowlist, email policy and leaked-password protection. Verify intended private-storage access: live `builder-assets` and `builder-attachments` are private and no `storage` schema policies were found; branch ingestion uses a service-role Edge Function, so do not add broad client policies without proving a direct-client flow needs them.
- [ ] Verify privacy policy and terms against actual data/provider behavior.
- [ ] Test AI, worker and deployment kill switches and rollback.
- [ ] Keep payments disabled and do not sell subscriptions in beta.

## Gate 8 — Domain expansion

- [ ] Implement PDF/DOCX/XLSX/audio/video ingestion only with format-specific limits, parsing tests and selective retrieval evidence.
- [ ] Add collaboration presence/conflict UX only after membership, invite, ownership and concurrency flows are tested.
- [ ] Add new domains only after each has a real runtime, bounded permissions/resources, acceptance tests and a safe fallback.
- [ ] Physical-world/device workflows require equipment-specific safeguards and human supervision.

## Commands for a reproducible checkout

~~~bash
npm ci
npm run build
npm test
npm run e2e:ci
npm audit --audit-level=high
~~~

Do not mark a gate complete from source inspection alone when it requires live infrastructure. Do not apply migrations, enable payment collection, deploy functions, activate cron, change DNS, or modify production secrets as part of this draft PR.
