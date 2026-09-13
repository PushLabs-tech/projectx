# Security policy and architecture

## Threats explicitly addressed

- Vulnerable dependencies: CI runs `npm audit --audit-level=high`.
- Malicious packages: dependency count is intentionally small; review package changes and CI audit results before merging.
- Prompt injection: untrusted project/message data is delimited and cannot override server instructions.
- Unencrypted AI credentials: encrypted before database persistence.
- Unpermissioned AI access: AI Edge Function requires a valid user session.
- Tenant isolation: Supabase RLS + workspace/project membership checks.
- Excessive DB permissions: backend-only tables revoke client privileges.
- Unreviewed code: security scan + smoke test + pull-request workflow.
- Audit logs: sensitive AI/payment operations write audit records.
- Security monitoring: security event table and provider/function logs are available for operational monitoring.
- Mass assignment: server functions accept explicit whitelisted fields rather than arbitrary database objects.
- Command injection: no shell execution is exposed through Build/Visual operations.
- Backups/restore: database backup runbook + project snapshots.
- Insecure deserialization: bounded JSON parsing and no executable deserialization path.
- Exposed internal dashboards: no admin dashboard is served publicly by this package.
- Misconfigured OAuth: production setup requires exact redirect URLs.
- Security headers: `_headers`, `netlify.toml` and `vercel.json` provide the same baseline header policy.

## Secrets

Never commit:

- provider API keys
- Supabase secret/service-role keys
- payment secrets
- encryption keys
- webhook secrets

`config.js` may contain only browser-safe publishable configuration.
