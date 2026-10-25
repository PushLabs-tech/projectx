# ProjectX MVP Acceptance Contract and Threat Model

**Status:** Working acceptance contract for the free beta; review required before production claims.  
**Product boundary:** ProjectX helps users plan, create, preview, verify, version, and improve project artifacts. The beta is free and must not operate its own managed hosting, domain, payment collection, or arbitrary customer computer execution.

## 1. First supported golden path

A signed-in user asks ProjectX to create a responsive landing page for a local service, with a contact-form UI, mobile layout, and clear success/error states.

### Required observable outcomes

1. ProjectX creates a project record owned by the authenticated user and returns a stable project ID.
2. The system produces a plan with explicit requirements and acceptance checks before claiming that work is complete.
3. The user can inspect and approve the plan before high-impact mutations.
4. Generated files are saved as a versioned artifact; failure must preserve the last known-good version.
5. The preview runs in the isolated browser sandbox and cannot access privileged credentials, the local filesystem, or unrestricted network capabilities.
6. Verification results are tied to the project/artifact version they actually tested.
7. The user can reopen the project after refresh and see the same saved version.
8. Failed verification yields a bounded repair attempt, a re-run of verification, and an honest status; no green status is inferred from model text alone.
9. The user can compare versions and restore a previous version with an auditable result.
10. Each server operation enforces authentication, project/workspace ownership, input size, action quota, and timeout before costly side effects.

### Evidence required to call this path complete

- CI build, contract, security and browser E2E checks pass on the exact reviewed commit.
- An authenticated staging test creates, saves, reloads, verifies, compares and restores a project against a real test Supabase project.
- Two-user tests prove user B cannot read, mutate, cancel or delete user A's private project/job/resource.
- Browser preview tests include malicious HTML/JavaScript, path traversal, oversized files, external resource attempts, and stale project versions.
- Execution tests cover duplicate dispatch, expired leases, cancellation before/during execution, worker restart and rollback.
- UI status is backed by persisted artifact/version and verifier evidence.

## 2. Explicitly unsupported for the free beta

- Collecting real payments or selling subscriptions. Billing source must default to disabled.
- ProjectX-managed hosting, custom domains, datacenters or customer infrastructure.
- Arbitrary shell execution on the user's machine or unrestricted OS control.
- Autonomous physical-world/device actions without domain-specific safeguards and human supervision.
- Claims of successful deployment, external integration, test pass, or durable execution without verifiable evidence.
- Binary/PDF/DOCX/XLSX/audio/video ingestion beyond the formats and size limits actually tested.
- Production-grade team presence/conflict resolution until invitation, membership, concurrency and recovery flows are tested end-to-end.

## 3. Trust boundaries

| Boundary | Trust assumption | Required enforcement |
|---|---|---|
| Browser → Edge Function | Browser input is untrusted | Streaming body cap, schema validation, authenticated identity, safe error response |
| Supabase Auth → privileged DB client | JWT identifies a user but does not authorize arbitrary resources | Server-side ownership/workspace-role checks before every service-role read/write |
| AI model/provider → action broker | Model output is untrusted proposal data | Schema validation, allowlisted tools, path/resource limits, version checks, approval gates |
| Queue → worker | Jobs can be duplicated, stale, cancelled, or malformed | Atomic claim/lease, lease token, timeout, retry bounds, cancellation check, idempotent commit |
| Worker → AI Edge Function | Internal caller, not an end-user session | Dedicated high-entropy server-only worker token; no browser action can bypass this boundary |
| Payment provider → payment webhook | Network delivery can be forged, duplicated, delayed, or reordered | HMAC over raw bytes, byte cap, unique provider event ID, atomic database transaction, billing kill switch |
| Generated artifact → preview | Generated content may be hostile | Sandboxed iframe/runtime, restrictive permissions, no privileged token exposure, bounded resources |
| ProjectX → GitHub/deployment provider | External side effects are high impact | User-owned scoped credential, workspace role check, explicit approval, idempotency, health evidence and rollback |

## 4. Assets and threat scenarios

Assets include user/project data, generated artifacts, provider credentials, OAuth tokens, deployment tokens, worker secrets, billing state, usage/credit state, queue leases, audit evidence and build artifacts.

| Threat | Required mitigation | Evidence status |
|---|---|---|
| Anonymous abuse or oversized body | Reject unauthenticated requests; stream and cap bytes before parsing | Source caps added; latest CI pending |
| Cross-tenant access via service-role client | Ownership/RBAC check on every resource operation plus RLS/grants | Source contracts exist; deployed two-user test not verified |
| Browser invokes internal worker route | Dedicated token check before dispatch; action not exposed as a normal user action | Source dispatch and contract test exist; live endpoint not verified |
| Duplicate/replayed webhook | Signature check, unique event claim and side effects in one transaction | Source migration added; migration not applied/live-tested |
| Subscription ID from another user | Verify owner before provider cancellation; never reassign owner on webhook conflict | Source fix added; CI/live test pending |
| Prompt injection in a project/resource/web page | Treat content as data; restrict tools and require approval for high-impact actions | Partial source controls; adversarial end-to-end tests outstanding |
| Runaway model/build/repair loop | Per-action rate limits, request caps, hard timeout, bounded retries, kill switch | Atomic per-user action limits added; per-project concurrency and spend ceilings still open |
| Stale or duplicate execution | Target version, lease token, idempotency and transaction commit checks | Source controls and contract tests exist; staging concurrency/restart tests outstanding |
| Malicious dependency or supply-chain issue | Dependency audit, lockfile/package-manager consistency, reviewed upgrades | npm audit added; package-manager/lockfile consistency still needs resolution |
| False success claim | Status must reference saved artifact, verifier output and version | Source model exists; full vertical-slice evidence not verified |
| Data loss or bad migration | Migration review, staging upgrade, backup/restore rehearsal | Not verified; do not run migrations against production without an explicit release plan |

## 5. Approval tiers

- **Tier 0 — Read-only:** inspect project, list models, read status. Requires authentication and resource authorization.
- **Tier 1 — Reversible project mutation:** edit artifact, create version, run preview/tests. Requires project editor role, version check, limits, and a rollback path.
- **Tier 2 — External side effects:** push Git commits, deploy, invite members, cancel provider subscriptions, or alter workspace settings. Requires ownership/role checks, explicit user intent, idempotency where available, and auditable result.
- **Tier 3 — Production/security/financial:** enable payments, change production secrets, apply production migrations, activate cron/worker, alter DNS/hosting, delete production data, or enable OS/device execution. Requires a separate explicit release approval and a tested rollback. These are not authorized by this code PR.

## 6. Residual risks and owners

- **Backend/worker owner:** test migrations against a disposable Supabase project; verify queue concurrency, cancellation, retries and stale versions.
- **Frontend/product owner:** verify golden-path UI evidence and never imply unverified capabilities.
- **Release owner:** verify deployed project ID, function revisions, Auth redirects, RLS, Vault, cron, secrets, monitoring, backups and restore before production.
- **Joint review:** inspect final diff, migration privileges, provider costs, privacy/terms and rollback plan before merge.
