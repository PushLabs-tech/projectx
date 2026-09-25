# ProjectX canonical launch checklist

This checklist reflects the current canonical runtime: `index.html` → `px-final.js` → Supabase `ai` Edge Function.

## 1. Core creation flow

- [x] One natural-language starting point.
- [x] First classify REAL-WORLD vs NON-REAL-WORLD.
- [x] Show classification and evolving understanding.
- [x] Ask one high-value discovery question at a time.
- [x] AI-derived lower-level category.
- [x] Evolving Project Brain.
- [x] AI-generated project-specific workspace sections.
- [x] Project-specific specialist agents.
- [x] Per-specialist model preferences with deterministic fallback routing.
- [x] AI-derived reusable domain intelligence.
- [x] Discovery plan captured in the canonical project brain.
- [x] Basic realtime project synchronization for shared cloud projects.
- [x] Explicit canonical project plans.
- [x] Canonical project mutations with version invalidation.
- [x] Type-aware software vs document outputs.

## 2. Create / edit / verify

- [x] Build software artifacts with `index.html`.
- [x] Generate real-world/document deliverables.
- [x] Browser runtime verification.
- [x] Type-aware tests.
- [x] Feed verified failures into rebuild/repair.
- [x] Direct safe file editing.
- [x] Natural-language visual editing entrypoint.
- [x] Responsive desktop/tablet/mobile preview.
- [x] Outcome readiness simulation.
- [x] Security checks on generated files.
- [x] Delivery/export.
- [x] Version snapshots, comparison and restore.
- [x] Project resource/URL capture.
- [x] Structured text/CSV/JSON/Markdown resource ingestion.
- [x] Selectively bounded resource context sent to AI.
- [ ] Binary/PDF/DOCX/XLSX/audio/video resource parsing and selective retrieval.
- [x] Decision capture in Project Brain.
- [x] Make it Great additive improvement flow.
- [x] Optimize flow for verified software projects.
- [x] Ask Me approval gate with mutation preview.
- [x] Autonomous build → test → repair → retest loop.
- [x] One-click full verification lifecycle.
- [x] Blueprint transformation flow.
- [x] Expanded creation types and presentation artifacts.
- [x] Project forks/alternative branches.
- [x] Project search.
- [x] Persistence schema versioning and local-project migration.

## 3. Research

- [x] Authenticated source-backed research action.
- [x] HTTPS-only source URLs.
- [x] Private/local host blocking.
- [x] Redirect rejection.
- [x] HTML/plain-text/JSON source support.
- [x] Source size limits.
- [x] Evidence extraction restricted to supplied sources.
- [x] Findings persisted in `research_findings`.
- [x] Findings restored with the project brain.

## 4. AI / provider layer

- [x] Server-side encrypted provider credentials.
- [x] Provider model discovery.
- [x] Deterministic model routing/fallbacks.
- [x] Provider-agnostic working modes: Fast, Balanced, Powerful, Ask Me, Mostly Automatic, Autonomous.
- [x] Gemini guest mode.
- [x] OpenAI, Anthropic, OpenRouter, NVIDIA, Bytez and OpenAI-compatible connection slots.
- [x] Public HTTPS validation for custom provider base URLs.
- [x] 30-day AI usage endpoint and UI.
- [x] Account security-event endpoint and UI.

## 5. Persistence / security

- [x] Supabase Auth integration.
- [x] Tenant-aware project authorization.
- [x] RLS enabled on private project data.
- [x] Project/file/message/version persistence.
- [x] Project Brain persistence.
- [x] Research finding persistence.
- [x] Optimistic server version check.
- [x] Audit log writes for project persistence.
- [x] Sandboxed preview execution.
- [x] Safe relative file paths.
- [x] No browser shell execution path.
- [x] No provider secrets committed to the repository.
- [x] Security headers for supported hosts.
- [x] Consent-gated analytics.

## 6. UX / accessibility / web essentials

- [x] Clean canonical navigation.
- [x] Loading states.
- [x] Empty states.
- [x] Form validation/error states.
- [x] Focus-visible keyboard states.
- [x] Disabled button states.
- [x] Reduced-motion support.
- [x] Mobile responsive layout.
- [x] Custom 404.
- [x] Page metadata.
- [x] Open Graph image.
- [x] Favicons.
- [x] robots.txt.
- [x] sitemap.xml.
- [x] Privacy and Terms pages.
- [x] Billing page.
- [x] Thank-you page.

## 7. Remaining work

### Code-complete / verified
The canonical runtime and current Supabase function have been updated and exercised by CI after recent changes. The remaining repository-level gaps are intentionally limited to richer binary-resource parsing and full team collaboration UX.

### Real external configuration required before a commercial production launch

These cannot be completed honestly from repository code alone:

- [ ] Production business/operator contact address in legal pages.
- [ ] Final production domain/DNS and hosting choice.
- [ ] Supabase Auth Site URL and exact production redirects.
- [ ] Production AI provider credentials and spending/rate policy.
- [ ] Supabase backup/retention and a tested production restore procedure.
- [ ] Enable Supabase Auth leaked-password protection.
- [ ] Real GitHub OAuth/repository integration, if repository automation is required.
- [ ] Real deployment-provider integration, if one-click customer deployment is required.
- [x] Basic realtime project-row synchronization.
- [ ] Full team collaboration UX (member invitations, presence, conflict UI), if required.
- [ ] Durable background workers, if long-running autonomous jobs are required.
- [ ] Payment merchant credentials, plans, webhooks and end-to-end live/test verification before selling subscriptions.

## 8. Verification commands

```bash
npm install
npm run check
npm run security:scan
npm audit --audit-level=high
npm run build
```

Do not mark the external configuration section complete until those real services and credentials have been configured and tested.


## 9. Production execution control plane

- [x] Renewable worker leases with explicit lease tokens.
- [x] Lease heartbeat for long-running execution and proxied jobs.
- [x] Automatic recovery of expired running jobs.
- [x] Lease-aware job completion and cancellation.
- [x] Server-side lease assertion immediately before execution commit.
- [x] Committed job/action idempotency guard for execution transactions.
- [x] Contract test coverage for the control-plane invariants.
- [ ] Live production soak test with real Supabase Edge Function deployment.
- [ ] Multi-worker concurrency test against a deployed database.


## Autonomous E2E gate
- Public creation flow smoke test
- Browser console/page-error capture during creation-shell boot
- Runs navigation source contract
- Mobile observability-release overflow check
- Existing build/check/security suite remains the prerequisite gate
