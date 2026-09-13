# Payments Setup — Builder V7

The payment system is wired for Razorpay subscriptions but ships in placeholder/off mode until real merchant credentials and plan IDs are supplied. You do not need a bank account in the project yet; keep the placeholder environment values until the account is legitimately available.

## Included
- Server-side Razorpay subscription creation
- Pro and Max plan placeholders
- Webhook signature verification
- `x-razorpay-event-id` idempotency when supplied
- Subscription status storage
- Payment analytics ledger
- Checkout/plan-selection analytics
- Audit logs
- Billing status endpoint
- No card data stored by Builder

## When ready for a real merchant account
1. Create the Razorpay plans and copy their plan IDs.
2. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PRO_PLAN_ID`, and `RAZORPAY_MAX_PLAN_ID` as Supabase Edge Function secrets.
3. Configure the Razorpay webhook to point to `/functions/v1/payments`.
4. Enable the subscription/payment events you need in Razorpay.
5. Run the test-mode flow first.
6. Switch to live credentials only after merchant verification/KYC and your payment provider's go-live requirements are complete.

Razorpay recommends server-side verification and webhook handling for payment state changes.
