# ProjectX Forensic Baseline

**Snapshot date:** 2026-10-25 (Asia/Kolkata)  
**Repository:** `PushLabs-tech/projectx`  
**Default branch:** `main`  
**Baseline source commit:** `0570b00b17e505ebff38d50133e6bcd417028af3`  
**Working branch:** `fix/beta-billing-guard-cancellation-ownership`  
**Review PR:** [#55 — security and beta reliability fixes](https://github.com/PushLabs-tech/projectx/pull/55)  
**Snapshot branch head when this report was prepared:** `3e8587fd3aacbcd98aff9d95afdf3a4ee2c130be` (subsequent commits continue this draft patch)  
**Status:** Draft PR; not merged; no database migration or function deployment performed. Latest inspected head: `c693badf1764f0f8eea7849c15b0e8ee6c63314f`.

## 1. Evidence boundary

This packet is based on source files, migrations, tests, workflow configuration, commit metadata, and GitHub Actions logs inspected through GitHub. A local worktree was not available in this session, so **no local build or test command is claimed**. The CI environment is the reproducible execution evidence.

The live GitHub Pages URL could not be retrieved by the browser inspection tool in this session. That failure does **not** establish that the site is down. The currently deployed frontend, actual Supabase project, deployed Edge Function revisions, Auth redirect settings, live RLS policies, secret values, payment environment flags, cron job, storage policies, and backup/restore process remain **not verified**. No secrets or secret values were printed or changed.

## 2. Repository / branch / change state

- `main` remains at `0570b00b17e505ebff38d50133e6bcd417028af3`, “Fix first batch of ProjectX workspace and mobile UI defects (#54)”.
- Changes are isolated to the existing draft PR branch. Main has not been modified by this work.
- The draft PR is unmerged and nothing has been deployed.
- Several GitHub API updates were committed as individual commits on the branch. The branch has more commits than the number of logical batches; before merging, review the final diff as a single patch and consider squashing only through a normal PR workflow.
- GitHub Actions on `51bdbe83bb68dcd2e1219130ad0c8c8064cecbda` passed the project checks and browser E2E. The E2E log reported **7 passed, 2 skipped**; the skipped tests are authenticated-account flows requiring `PROJECTX_E2E_EMAIL` and `PROJECTX_E2E_PASSWORD`.
- On branch head `4c0c9e4b34f596f151efab21c9a3a34dfa178fe4`, GitHub Actions passed `npm audit --audit-level=high`, `npm test`, and browser E2E (the run completed successfully after the earlier observation). See the [branch CI runs](https://github.com/PushLabs-tech/projectx/actions).
- **Latest-head CI verified:** PR-triggered workflow run [40138571213](https://github.com/PushLabs-tech/projectx/actions/runs/40138571213) for exact head `c693badf1764f0f8eea7849c15b0e8ee6c63314f` completed successfully. All workflow steps passed, including npm dependency installation, `npm audit --audit-level=high`, `npm test` (including static security scan), Chromium install, and browser E2E. E2E result: **7 passed, 2 skipped**. The skipped tests are authenticated workspace flows because `PROJECTX_E2E_EMAIL` and `PROJECTX_E2E_PASSWORD` were absent; those live authenticated flows remain unverified.

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
- **Executed in GitHub Actions, passed:** `npm audit --audit-level=high`, `npm test`, and `npm run e2e:ci` for branch head `4c0c9e4b34f596f151efab21c9a3a34dfa178fe4`. This is a historical green result and must not be substituted for CI on later commits.
- **Executed in GitHub Actions, passed on prior branch head:** `npm test` and `npm run e2e:ci` on `51bdbe83bb68dcd2e1219130ad0c8c8064cecbda` (7 passed, 2 authenticated tests skipped).
- **Latest observed run, passed:** PR-triggered workflow run [40138571213](https://github.com/PushLabs-tech/projectx/actions/runs/40138571213) on exact head `c693badf1764f0f8eea7849c15b0e8ee6c63314f`. A push-triggered duplicate run was cancelled by branch concurrency after dependency install, npm audit, and ProjectX checks passed; the PR-triggered run fully completed successfully.
- **Not run locally:** `npm run build`, `npm test`, local Playwright, database migration tests, or authenticated live integration checks in this session.
- The workflow currently uses `npm install` rather than `npm ci`; the repository has `bun.lock` but no committed `package-lock.json`. Therefore the npm dependency resolution is not pinned by a tracked npm lockfile. The audit checks the resolved CI dependency tree, not a reproducible, committed dependency graph.

## 6. Security and reliability findings

### High priority
1. **Worker-to-AI authentication ordering (source fix in PR):** the worker sends its dedicated token without an end-user JWT. The AI endpoint previously called `requireUser()` before dispatching `runQueuedJob`, which conflicted with the worker caller. The route now dispatches that internal action before end-user JWT authentication, and `runQueuedJob` validates the dedicated worker token.
2. **Worker gateway auth (source config fix in PR):** the cron request carries `X-ProjectX-Worker-Token`, not a user JWT. `supabase/config.toml` now disables the Supabase JWT gateway check for `projectx-worker`, relying on the function's custom token check. This only takes effect when deployed with this config; live configuration is not verified.
3. **Bounded HTTP request bodies (source fix in PR):** AI, payment and worker handlers now enforce byte limits during stream reads, not only after buffering an unlimited body. AI max is 5,000,000 bytes; payment max is 1,000,000 bytes; worker control request max is 64,000 bytes.
4. **Payment webhook replay and free-beta guard (source + migration in PR):** duplicate event claims and DB side effects are processed in one transaction, preserving `credits_used` on entitlement conflict. With billing disabled, signed events are recorded but do not apply paid entitlement effects. The new RPC migration must be applied before deploying the new payments handler; that has not happened.
5. **Subscription cancellation ownership (source fix in PR):** the authenticated caller's ownership is verified before the provider cancellation call; database update errors are surfaced.
6. **Atomic server-side action rate limiter (source implementation added in this PR):** a new migration creates a service-role-only RPC with an atomic fixed-window counter; the AI handler calls it before the listed costly/user-triggered actions, fails closed if the RPC fails, and has per-action caps. Contract assertions were added. This is not a monthly credit cap, not a strict rolling 60-second window, and not yet verified against PostgreSQL or a deployed database. Live concurrent-request tests, migration application, and coverage review remain gates.

### Medium priority
7. **Dependency reproducibility:** `bun.lock` is present but CI uses npm and there is no committed npm lockfile. CI does not yet use `npm ci`.
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

1. **CI result is green on latest inspected head:** run [40138571213](https://github.com/PushLabs-tech/projectx/actions/runs/40138571213) passed all workflow steps at `c693badf1764f0f8eea7849c15b0e8ee6c63314f`. Re-run CI automatically after any later commit, review the final unified diff as one logical patch, and do not merge solely because CI is green.
2. **Rate-limit validation:** run PostgreSQL migration/lint validation; test fixed-window boundary and concurrent calls on a disposable database; ensure the actions listed in `ACTION_RATE_LIMITS` match cost/abuse exposure. Add a separate monthly credits/usage quota only if the product's stated credit rules require one.
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
