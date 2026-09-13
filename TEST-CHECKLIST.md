# Builder launch checklist

## A. Core UI / old UI preservation

- [ ] Sidebar looks like the classic Builder UI.
- [ ] Home button works.
- [ ] Projects button works.
- [ ] Activity button works.
- [ ] Research button works.
- [ ] Integrations button works.
- [ ] Agents button works.
- [ ] Recent projects open correctly.
- [ ] Usage Manage opens Settings.
- [ ] Account opens Settings.
- [ ] Sign out works.
- [ ] New project works from the sidebar.
- [ ] Command center works.
- [ ] Search works.

## B. Agents / models

- [ ] Discuss chat works.
- [ ] Plan chat updates the plan.
- [ ] Build can write safe relative files.
- [ ] Visual can update front-end files.
- [ ] Research returns evidence-focused responses.
- [ ] Chat model dropdown is visible.
- [ ] Auto routing is visible.
- [ ] Manual model selection persists.
- [ ] Provider model discovery works.
- [ ] Fallback model is attempted after a provider/model failure.
- [ ] No provider secret appears in localStorage.

## C. UX / polish

- [ ] CTA is above the fold.
- [ ] Loading/thinking state is visible.
- [ ] Empty states are useful.
- [ ] Invalid form submissions show errors.
- [ ] Mobile sidebar opens/closes.
- [ ] Mobile sticky CTA works.
- [ ] Reduced-motion preference is respected.
- [ ] Buttons have hover/focus/disabled states.
- [ ] No broken buttons in old navigation.

## D. SEO / website essentials

- [ ] Custom 404 page works.
- [ ] Every public page has its own title.
- [ ] Every public page has a description.
- [ ] Open Graph image exists and loads.
- [ ] Favicon 16px exists.
- [ ] Favicon 32px exists.
- [ ] Apple touch icon exists.
- [ ] robots.txt points to the production sitemap.
- [ ] sitemap.xml uses the real production domain.
- [ ] Every image has meaningful alt text where applicable.
- [ ] Mobile breakpoints tested at 320, 375, 768 and 820px.
- [ ] Thank-you page works.
- [ ] Privacy page is reviewed.
- [ ] Terms page is reviewed.
- [ ] Cookie/analytics consent is reviewed for the countries where the service operates.
- [ ] Analytics ID is configured only if analytics is actually being used.
- [ ] Real business/contact address is inserted before launch.

## E. Security

- [ ] `npm audit --audit-level=high` passes.
- [ ] No unreviewed package was added.
- [ ] No suspicious/malicious package is present.
- [ ] Security headers are active in production.
- [ ] Prompt injection tests are performed against every agent.
- [ ] No API key is stored unencrypted.
- [ ] AI access requires a valid user session.
- [ ] RLS is enabled on every exposed private table.
- [ ] Grants are reviewed in addition to RLS policies.
- [ ] Tenant isolation is tested with two accounts.
- [ ] Audit logs are written for sensitive operations.
- [ ] Security events are reviewable.
- [ ] Mass-assignment paths are not exposed; server code accepts explicit fields only.
- [ ] Command execution is impossible through Build/Visual operations.
- [ ] Database/project restore procedure is tested.
- [ ] Internal dashboards are not publicly exposed.
- [ ] OAuth redirect URLs are exact and production-only.
- [ ] Cookies/auth storage settings match the deployment architecture.
- [ ] Webhook signatures are verified.
- [ ] Payment webhook events are idempotent.

## F. Supabase

- [ ] Auth site URL is correct.
- [ ] Redirect URLs are correct.
- [ ] Schema applied.
- [ ] Security/billing migration applied.
- [ ] Edge Function secrets configured.
- [ ] `ai` deployed.
- [ ] `payments` deployed.
- [ ] Provider key encryption secret is set.
- [ ] No server secret is in frontend files.
- [ ] Storage buckets are private where required.

## G. Payments

- [ ] Test plans created.
- [ ] Test keys configured.
- [ ] Pro plan ID configured.
- [ ] Max plan ID configured.
- [ ] Checkout tested.
- [ ] Webhook endpoint configured.
- [ ] Webhook signature verified.
- [ ] Subscription row created.
- [ ] Duplicate webhook is idempotent.
- [ ] Cancellation tested.
- [ ] Renewal/failure tested.
- [ ] Refund policy published.
- [ ] Live credentials added only after the complete test pass.

## H. Backup / restore

- [ ] Supabase backup/retention plan is enabled for the production project.
- [ ] A documented restore procedure exists.
- [ ] Project snapshot/restore has been tested.
- [ ] Critical environment secrets are stored in a secure password manager.
- [ ] Recovery owner and recovery contact are documented.

## Final automated checks

```bash
npm install
npm run check
npm run security:scan
npm audit --audit-level=high
```
