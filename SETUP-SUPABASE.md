# Supabase setup

## 1. Create project

Create a Supabase project and copy its project URL and publishable browser key.

Put only those publishable values in `config.js`.

## 2. Authentication

In Supabase Auth:

1. Enable Email/Password.
2. Set the Site URL to your real production origin.
3. Add your production and local redirect URLs.
4. Configure email confirmation according to your launch policy.
5. Do not use wildcard OAuth redirects in production.

## 3. Database

The schema and migrations are a sequence, not just two files. The repository currently contains legacy migration filenames as well as timestamped migrations, so do **not** assume a normal `supabase db push` will apply the full history correctly without first validating the migration ledger.

For a **disposable staging project only**, start with `supabase/schema.sql`, then review and apply every file under `supabase/migrations/` in dependency order. The current list includes security/RLS, analytics, canonical project brain, durable jobs, worker RPCs, billing entitlements, remote execution, execution transactions/control plane, deployment metadata, foreign-key/index hardening, payment webhook idempotency, and atomic AI rate limits. Confirm the exact order against dependencies and test from a clean database before adopting a repeatable production migration workflow.

Before any production migration:
- Normalize and review the migration history using Supabase CLI against a disposable project.
- Confirm the target project reference and backup/restore plan.
- Apply the migration set to staging, run SQL/function integration tests, and inspect RLS/grants.
- Obtain explicit release approval. Do not run migrations against production as part of this draft PR.

The security/billing migrations define backend-only payment events and credentials, remove plaintext connected-account token columns, and restrict client access. Source files do not prove these changes have been applied to a live database.

## 4. Secrets

Set backend-only secrets with the Supabase Dashboard or CLI. Never put these in `config.js`:

```bash
supabase secrets set \
  AI_CREDENTIALS_ENCRYPTION_KEY="YOUR_RANDOM_SECRET" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVER_ONLY_SECRET"
```

Add the Razorpay secrets only if billing is enabled; see `SETUP-PAYMENTS.md`.

Supabase documents Edge Function secrets as environment variables available to server-side functions and warns that secret/service-role keys must never be exposed to browsers.

## 5. Deploy functions

```bash
supabase functions deploy ai
supabase functions deploy payments --no-verify-jwt
supabase functions deploy projectx-worker --no-verify-jwt
```

`ai` validates ordinary user requests with Supabase Auth inside the function, and validates internal `runQueuedJob` requests with the dedicated worker token. `payments` validates authenticated requests and signed webhooks itself because a payment webhook does not carry a user JWT. `projectx-worker` validates the server-only `X-ProjectX-Worker-Token` because pg_cron/pg_net invokes it without a user JWT. The deployed worker token must be a random secret of at least 32 characters stored in Supabase Vault; never put it in browser config or the cron definition.

## 6. Tenant isolation test

Create two test accounts, A and B.

- A creates a project.
- B attempts to read A's project through the Data API.
- B attempts to update/delete A's project.
- A can access only A's project/workspace rows.

All unauthorized attempts must fail or return no rows.

## 7. Backup and restore

Enable the appropriate production database backup/retention plan in Supabase. Test a restore procedure before launch.

The Builder UI also provides project-level snapshots and restore under a project's Versions panel. This is not a replacement for database backups.

## 8. Production hardening

- Use a production domain with HTTPS.
- Use exact Auth redirect URLs.
- Keep the publishable key in the browser and all secret keys server-side.
- Review RLS and grants together.
- Review Edge Function logs.
- Rotate provider/payment credentials after any suspected exposure.
