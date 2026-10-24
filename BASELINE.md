# ProjectX Forensic Baseline

**Snapshot date:** 2026-10-25 (Asia/Kolkata)  
**Repository:** `PushLabs-tech/projectx`  
**Default branch:** `main`  
**Baseline source commit:** `0570b00b17e505ebff38d50133e6bcd417028af3`  
**Working branch:** `fix/beta-billing-guard-cancellation-ownership`  
**Review PR:** [#55 — security and beta reliability fixes](https://github.com/PushLabs-tech/projectx/pull/55)  
**Latest CI-verified PR head at this snapshot:** `ee54fd7bbf503affa748ed7c1a2dfc226c7c448d` via run [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616).
**Status:** Draft PR; not merged; no live database migration or Edge Function deployment performed. CI verification for the latest PR head is recorded in run [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616).

## 1. Evidence boundary

This packet is based on source files, migrations, tests, workflow configuration, commit metadata, and GitHub Actions logs inspected through GitHub. A local worktree was not available in this session, so **no local build or test command is claimed**. The CI environment is the reproducible execution evidence.

The live GitHub Pages URL could not be retrieved by the browser inspection tool in this session. That failure does **not** establish that the site is down. The connected Supabase project was inspected read-only: its migration ledger, public table inventory, Edge Function inventory and advisor findings were queried. The three RPCs and rate-limit table introduced by this PR are absent from that database; no database changes were made. Some live migration version IDs differ from matching repository filename prefixes. Storage inventory was inspected read-only: `builder-assets` and `builder-attachments` are private buckets and no policies are present on the `storage` schema. The branch's resource-ingest path uploads via a service-role Edge Function; confirm the intended direct-download/signed-URL path in staging before considering any client policies. Exact deployed function source parity, Auth redirects, secret values, payment feature-flag value, cron/Vault configuration and backup/restore process remain **not verified**. No secrets or secret values were printed or changed.

## 2. Repository / branch / change state

- `main` remains at `0570b00b17e505ebff38d50133e6bcd417028af3`, “Fix first batch of ProjectX workspace and mobile UI defects (#54)”.
- Changes are isolated to the existing draft PR branch. Main has not been modified by this work.
- The draft PR is unmerged and nothing has been deployed.
- Several GitHub API updates were committed as individual commits on the branch. The branch has more commits than the number of logical batches; before merging, review the final diff as a single patch and consider squashing only through a normal PR workflow.
- GitHub Actions on `51bdbe83bb68dcd2e1219130ad0c8c8064cecbda` passed the project checks and browser E2E. The E2E log reported **7 passed, 2 skipped**; the skipped tests are authenticated-account flows requiring `PROJECTX_E2E_EMAIL` and `PROJECTX_E2E_PASSWORD`.
- On branch head `4c0c9e4b34f596f151efab21c9a3a34dfa178fe4`, GitHub Actions passed `npm audit --audit-level=high`, `npm test`, and browser E2E (the run completed successfully after the earlier observation). See the [branch CI runs](https://github.com/PushLabs-tech/projectx/actions).
- **Latest PR head CI verified:** PR-triggered run [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616) passed on `ee54fd7bbf503affa748ed7c1a2dfc226c7c448d`. Both jobs succeeded: `checks` (locked npm install, high-severity audit, ProjectX/security contracts, production build and browser E2E) and `migration-contracts` (applied the three new SQL migrations to disposable PostgreSQL 17, ran transactional/rate-limit/grant assertions, and raced parallel enqueue calls). E2E: **7 passed, 2 skipped** because authenticated CI credentials were absent; authenticated live flows remain unverified. Source follow-up after this snapshot has also hardened GitHub OAuth state consumption and checked GitHub/deployment/collaboration writes; those commits must pass the next workflow run before merge.


## 2B. Additional source reliability fixes (2026-10-25)

After the PostgreSQL migration contracts were added, a second review improved correctness in adjacent handlers:

- The shared HTTP error map is now used by the payment handler; malformed JSON is classified as 400, oversized input as 413, missing provider configuration as 503, and unexpected backend failures default to 500.
- Payment plan names are validated as own properties, avoiding inherited prototype names being treated as valid plans.
- GitHub OAuth state is consumed once with a delete-returning claim, avoiding replay races; state, connection, repository-sync, repository-create, project/membership read and disconnect errors are not reported as success or mislabeled not-found.
- Deployment target writes/reads and rollback status writes surface persistence failures rather than silently returning success.
- Collaboration invite roles are limited to schema-supported values. Failed invite cleanup, invite acceptance writes, and membership reads are surfaced. Invitation email delivery status reflects the provider response instead of merely checking whether the Resend secret exists.
- Static backend contracts were extended for these controls. Latest source-level contracts/build were green on the previously verified head, but the commits after that head require a fresh CI result before merge.

## 2A. Read-only connected Supabase assessment (2026-10-25)

This section records a metadata-only assessment. No SQL migration was applied, no function was deployed, and no Auth/Storage/secret setting was changed.

- The connected database is active and its migration ledger currently ends at version `20260925154758` (`projectx_fk_index_hardening`).
- The repository contains legacy migration filenames such as `002_security_billing.sql` and `003_v7_analytics.sql`, plus timestamped files. More importantly, the live ledger records worker migrations at versions `20260920110012` and `20260920110039`, while the repository's correspondingly named worker migration files have prefixes `20260920130000` and `20260920131000`. This is migration-history drift that must be reconciled with a reviewed plan before a CLI migration push. Do **not** blindly run `supabase db push`.
- A read-only catalog query confirmed the new branch's `public.projectx_api_rate_limits` table and the RPCs `projectx_consume_rate_limit`, `projectx_process_payment_webhook`, and `enqueue_project_execution_job` are **not present**. Therefore the new Edge Function source must not be deployed before those migrations have been safely applied and verified against a disposable/staging database.
- The connected project's deployed function inventory shows `ai`, `payments`, `projectx-worker`, `github`, `deploy`, `resource-ingest`, and `collaboration` as active with platform JWT verification disabled. Source code performs its own auth/token/signature checks, but exact deployed-source parity and secret configuration were not verified.
- Supabase security advisors reported: RLS enabled without policies on `public.github_connections` and `public.github_oauth_states` (fail-closed but potentially blocks intended GitHub OAuth access), leaked-password protection disabled, and `pg_net` installed in `public`. Performance advisors reported unused indexes, which should be evaluated against query workload before any removal. No remediation was applied because these are live configuration/schema concerns requiring a target-safe plan.
- The project has no confirmed branch-specific migration objects from this PR. The absence is expected while the PR is unmerged, but it is a release blocker for deployment of the updated handlers.

## 3. Source / architecture map

### Browser
- `index.html` is the primary application entry.
- README identifies the canonical browser flow as `index.html → px-final.js → projectx-core.js`.
- Related runtime modules include `px-ui.js`, `projectx-execution.js`, `projectx-transaction.js`, `projectx-reconciliation.js`, `projectx-repair.js`, `projectx-sandbox.js`, and stylesheets.
- `vite.config.js` sets the GitHub Pages base path; `package.json` builds the static site and copies `config.js` into the build output.
- The codebase retains older/alternate runtime files. Do not delete them solely because they look legacy; tests and artifact flows may still depend on them.

### AI and project persistence
- Browser AI actions use `supabase/functions/ai/index.ts`.
- The AI Edge Function uses provider adapters/router code, decrypts user-saved provider credentials server-side, persists projects/files/messages/versions/research findings, exposes usage/security actions, and includes a worker-only `runQueuedJob` action.
- Supabase schema and migrations describe workspaces, members, projects, project files/messages/versions, research findings, encrypted provider credentials, usage/audit/security events, queue/lease state, execution transactions and billing tables. Source migrations do not prove those changes have been applied to a live database.

### Durable execution worker
- `supabase/functions/projectx-worker/index.ts` polls/claims queued jobs, maintains lease heartbeats, checks cancellation and timeout state, invokes the AI planner, validates tool proposals, and commits through server-side database RPCs.
- The worker's database contract is described in migrations under `supabase/migrations`; test scripts assert lease, cancellation, transaction and tool-contract behavior.
- The worker cron in the migration invokes the Edge Function using `X-ProjectX-Worker-Token` from Vault rather than an end-user JWT. The source config now sets `verify_jwt = false` for this function because the function verifies its own high-entropy token. This is a **source configuration fact only**; deployed configuration, Vault contents, cron activation, and worker execution are unverified.

### Payments
- `supabase/functions/payments/index.ts` contains Razorpay subscription creation/cancellation/status and signed webhook handling.
- `supabase/migrations/002_security_billing.sql` defines backend-only `payment_events` and billing-related tables/policies.
- The new migration `20261025120000_payment_webhook_idempotency.sql` defines an atomic processing function. It has not been applied to a live Supabase database.

## 4. Setup and configuration classification

The repository's `.env.example` lists names only; values there are blank. Do not commit actual secrets.

| Variable / config | Classification | Handling |
|---|---|---|
| `SUPABASE_URL` | External-service endpoint; generally browser-visible | Keep aligned with the intended Supabase project. |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | Public client key | May be used in browser only with correct RLS and server authorization. |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | Secret / elevated privilege | Server-side only; never put in `config.js` or frontend bundles. |
| `AI_CREDENTIALS_ENCRYPTION_KEY` | Secret | Backend-only; availability and rotation policy not verified. |
| `GEMINI_API_KEY`, `BYTEZ_API_KEY`, `TROUBLESHOOT_API_KEY` | Provider/service secrets | Backend-only; do not assume a free quota or a configured provider from their presence in the example file. |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payment secrets | Backend-only; payment features must remain disabled during free beta. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_PRO_PLAN_ID`, `RAZORPAY_MAX_PLAN_ID` | External payment configuration (key ID/plan IDs are not secret credentials) | Not proof that merchant, plans, webhook, or checkout are live. |
| `GA_MEASUREMENT_ID` | Client-visible analytics configuration | Ensure optional analytics remains consent-controlled. |
| `PROJECTX_BILLING_ENABLED` | Server-side feature gate | Source defaults to off unless exactly `true`; actual deployed value has not been inspected. |

`config.js` contains browser-side Supabase endpoint/publishable-key configuration. Values were not reproduced in this report. A public publishable key is not a substitute for RLS or correct server-side authorization.

## 5. Verification commands and CI evidence

Configured scripts:
- `npm run dev`: Vite dev server.
- `npm run build`: Vite production build plus `config.js` copy.
- `npm run check`: syntax checks plus project-specific runtime, execution, worker, control-plane, routing, observability, forensic and backend contract tests.
- `npm run security:scan`: repository static scanner.
- `npm test`: `check` plus the static scanner.
- `npm run e2e:ci`: Playwright E2E suite.
- CI now runs `npm audit --audit-level=high` after installing dependencies.

Evidence status:
- **Executed in GitHub Actions on latest PR head:** run [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616) passed locked npm install, high-severity dependency audit, `npm test`, production build, and E2E, plus a separate disposable-PostgreSQL 17 migration-contract job. E2E: 7 passed, 2 skipped. No local test run is claimed.
- **Executed in GitHub Actions, passed on prior branch head:** `npm test` and `npm run e2e:ci` on `51bdbe83bb68dcd2e1219130ad0c8c8064cecbda` (7 passed, 2 authenticated tests skipped).
- **Latest observed PR run, passed:** [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616) on `ee54fd7bbf503affa748ed7c1a2dfc226c7c448d`. It passed the npm/audit/test/build/browser suite and the new PostgreSQL migration test job. The SQL job applied the payment-webhook, per-action rate-limit and execution-enqueue migrations to a fresh disposable PostgreSQL 17 database, ran idempotency/rollback/credit preservation/RPC-grant checks, and confirmed parallel duplicate enqueue requests serialize to exactly one active execution.
- **Not run locally:** `npm run build`, `npm test`, local Playwright, or a local PostgreSQL suite. GitHub Actions now runs the build and browser suite and performs migration-contract tests against a disposable PostgreSQL 17 service. Authenticated live-backend checks remain unverified.
- The PR now commits an npm-generated `package-lock.json`, and CI uses `npm ci --ignore-scripts --no-audit --no-fund` followed by `npm audit --audit-level=high`; dependency resolution is pinned for the npm CI path. `bun.lock` remains in the repository and appears to describe a previous manifest, so confirm whether contributor workflows still rely on it before retiring or regenerating it.

## 6. Security and reliability findings

### High priority
1. **Worker-to-AI authentication ordering (source fix in PR):** the worker sends its dedicated token without an end-user JWT. The AI endpoint previously called `requireUser()` before dispatching `runQueuedJob`, which conflicted with the worker caller. The route now dispatches that internal action before end-user JWT authentication, and `runQueuedJob` validates the dedicated worker token.
2. **Worker gateway auth (source config fix in PR):** the cron request carries `X-ProjectX-Worker-Token`, not a user JWT. `supabase/config.toml` now disables the Supabase JWT gateway check for `projectx-worker`, relying on the function's custom token check. This only takes effect when deployed with this config; live configuration is not verified.
3. **Bounded HTTP request bodies (source fix in PR):** AI, payment and worker handlers now enforce byte limits during stream reads, not only after buffering an unlimited body. AI max is 5,000,000 bytes; payment max is 1,000,000 bytes; worker control request max is 64,000 bytes.
4. **Payment webhook replay and free-beta guard (source + migration in PR):** duplicate event claims and DB side effects are processed in one transaction, preserving `credits_used` on entitlement conflict. With billing disabled, signed events are recorded but do not apply paid entitlement effects. The new RPC migration must be applied before deploying the new payments handler; that has not happened.
5. **Subscription cancellation ownership (source fix in PR):** the authenticated caller's ownership is verified before the provider cancellation call; database update errors are surfaced.
6. **Atomic per-user/per-action rate limiter:** the migration and handler key counters by `(user_id, action_key, window_start)`. CI applies the migration to disposable PostgreSQL 17 and proves limits are isolated by user/action and excess requests are rejected. This is not a monthly credit cap or a strict rolling 60-second window. Production database migration, live traffic/concurrency tests and review of cost/abuse exposure remain gates.

### Medium priority
7. **Dependency reproducibility:** `package-lock.json` is now committed and CI uses `npm ci`; `bun.lock` remains a legacy/ambiguous file. Confirm whether it is still used; remove or regenerate it only after a repository-wide search.
8. **Static scanner scope:** `scripts/security-scan.mjs` is a source-pattern scanner, not a substitute for secret scanning, dependency audits, tenant-isolation tests, or production configuration checks. The high-severity npm audit step and Dependabot configuration were added in this branch; repository security-setting status was not inspected.
9. **HTTP security headers:** `_headers` exists alongside `netlify.toml`; a static `_headers` file is not a proof that the same headers are applied by GitHub Pages. Confirm the actual host and live response headers.
10. **Auth isolation test evidence:** contract tests and RLS policies exist in source, but the two authenticated E2E tests were skipped because CI credentials were absent. No two-user isolation test was run against a deployed database.
11. **External dependency and operational config:** production provider credentials, Supabase Auth Site URL/redirect allowlist, leaked-password protection, storage RLS, backups, restore rehearsal and production soak/concurrency tests are not verified.

## 7. Capability evidence matrix

| Capability | Source / UI | Automated evidence | External/live evidence | Current status |
|---|---|---|---|---|
| Public app shell and responsive layout | Present | Public browser E2E passed on prior SHA | Live host not retrievable in this inspection | Beta |
| Project create/read/edit and version lifecycle | Present in runtime and schema | Runtime/execution/transaction contract tests pass in CI | Real save/reopen/restore against deployed Supabase not verified | Beta |
| AI provider routing | Router/adapters and encrypted credential flow present | Routing/backend contracts pass | No provider request or quota/terms validation performed | Limited |
| User auth and tenant isolation | Auth checks, ownership code and RLS migrations present | Contract suite passes; authenticated browser tests skipped | Live RLS and two-user isolation not verified | Limited |
| Browser preview/sandbox | Iframe and path validation code present | Build-runner/browser contracts pass | No adversarial test on deployed runtime | Beta |
| Durable worker execution | Queue, lease, cancellation, transaction and worker source present | Worker/control-plane contracts pass | Cron/Vault/config/database deployment and multi-worker soak not verified | Limited |
| Research | Research handler and findings persistence present | Source contracts pass | Actual source-fetch behavior/provider configuration not live-tested | Limited |
| Payment/paid plans | Razorpay source exists but feature gate defaults off; webhook RPC migration added | Static contracts and CI checks pass on earlier heads | Migration not applied; provider config and end-to-end transactions not verified | Unavailable during free beta |
| PDF/DOCX/XLSX/audio/video parsing | Explicitly unchecked in `TEST-CHECKLIST.md` | No complete binary-ingestion test evidence | Not verified | Planned / limited |
| Managed hosting, domains, ProjectX-owned infrastructure | Must not be introduced for beta | Not applicable | Not enabled | Unavailable by product decision |
| Database backups / restore | Setup guidance exists | No proof from source tests | Backup policy and actual restore not verified | Unavailable / unverified |

## 8. Contradictions and gaps in documentation

- `TEST-CHECKLIST.md` marks many features complete but leaves binary document/media parsing, real GitHub OAuth, deployment-provider integration, production backup/restore, leaked-password protection, real payment verification, durable worker deployment and multi-worker soak testing unchecked.
- The same checklist describes a worker/transaction control plane as code-complete, while live production soak and concurrency testing remain unchecked. Treat source contracts as evidence of source behavior, not proof of live operation.
- `SETUP-SUPABASE.md` originally documented only AI and payments deployment. This branch adds explicit worker deployment and token-auth notes; actual remote deployment remains unverified.
- The handoff references `projectx_master_task_tracker.md` and `projectx_release_gates.md`; those exact root paths were not found in the inspected branch. `MASTER-SPEC.md`, `TEST-CHECKLIST.md`, `SECURITY.md`, and `FORENSIC-AUDIT-2026-09-18.md` are present and should be treated as repository documents, not evidence of current deployed state.

## 9. Recommended next batches, in order

1. **CI snapshot:** run [40141230616](https://github.com/PushLabs-tech/projectx/actions/runs/40141230616) passed both jobs on `ee54fd7bbf503affa748ed7c1a2dfc226c7c448d`, including disposable PostgreSQL migration contracts and a concurrent enqueue race. This report refresh triggers another CI run. Review the final unified diff as one logical patch; green CI is not production proof.
2. **Rate-limit follow-through:** PostgreSQL migration application and isolated user/action-counter behavior now pass CI. Still check production migration history before applying, stress-test rate-limit concurrency/expiry on staging, and ensure `ACTION_RATE_LIMITS` matches cost/abuse exposure. Add a separate monthly credits/usage quota only if the product's stated credit rules require one.
3. **Lock down dependency reproducibility:** establish one package manager, generate and commit its lockfile, update CI to use the frozen/locked install, and preserve npm audit.
4. **External Supabase verification (read-only first):** verify current migrations and function deployment/config; confirm `PROJECTX_BILLING_ENABLED` is false for beta; confirm Vault token/cron function boundary; inspect RLS/grants/storage policies; test two-user isolation. Do not apply migrations or deploy new code without confirming backups/rollback and the actual target project.
5. **Live acceptance:** browser smoke on the actual deployed host, inspect headers/console/network, sign in with a dedicated test account if credentials are available, and test create → save → reopen → version/rollback. Record skipped tests honestly.
6. **Operational gate:** document backup/restore evidence, error/incident handling, auth/provider setup, request limits, quota/no-paid-fallback behavior and a safe rollback procedure.
7. **Defer feature expansion:** binary resource parsing, team collaboration, more agents, ProjectX-owned hosting and live paid plans remain later work, not beta blockers to fake as complete.

## 10. Rollback notes for this branch

- Code rollback: revert the relevant PR commits or close the unmerged PR; `main` has not been touched.
- Before applying the webhook migration, ensure the target database backup/restore path is known. The migration creates a function and grants execution; do not assume code rollback alone removes the migration. If the migration is applied, use a reviewed follow-up migration to revoke/drop the function only after confirming no deployed handler depends on it.
- Keep `PROJECTX_BILLING_ENABLED` false throughout the free beta. Never enable it merely to make a test pass.
- Do not rotate secrets, change production data, or deploy from this baseline task.

---
This report intentionally distinguishes repository-source evidence, CI evidence, and unavailable live-service evidence. It does not certify production readiness or complete security.
