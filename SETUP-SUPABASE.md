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

Run:

```text
supabase/schema.sql
supabase/migrations/002_security_billing.sql
```

The migration enables audit/security/billing tables, removes plaintext connected-account token columns from the base design, and revokes client access to backend-only tables.

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
```

`ai` remains JWT-protected by the Supabase function gateway. `payments` validates authenticated requests and signed webhooks itself because a payment webhook does not carry a user JWT.

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
