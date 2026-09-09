# Stripe webhook contract

`functions/src/stripeWebhook.ts` accepts POST requests only and verifies the
Stripe signature against the raw request body and `STRIPE_WEBHOOK_SECRET`.
Unsigned or malformed requests return 400 and have no side effects.

Supported event types are `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_succeeded`, and
`invoice.payment_failed`. Other event types are recorded as unsupported and
acknowledged without billing mutations. This list matches the deployed Stripe
SDK/account event names; it is not expanded to obsolete aliases.

Before processing, the handler claims `billing_events/{event.id}` in a
Firestore transaction. A duplicate delivery receives 2xx without repeating
subscription writes, AI Pack grants, or payment email. A processing failure is
marked failed and returns 500 so Stripe can retry.

Subscription state carries `latestStripeEventCreated`. An incoming event older
than the stored marker is ignored for state mutation. This protects against
`subscription.updated(newer)` followed by `subscription.updated(older)` while
allowing the event ledger to record both deliveries.

Only safe identifiers and timestamps are logged/stored: event ID/type, Stripe
created time, customer/subscription IDs, account ID, status, and error code.
Payment instrument details, signatures, request bodies and secrets are never
stored in the ledger.

`invoice.payment_succeeded` is the recurring billing point for the AI Pack
grant. Lines marked with the server product metadata create one
`ai_pack_grants/{eventId}` record for 1,000 actions. Re-delivery sees that
record and cannot grant the allowance twice. The active subscription item also
controls the derived monthly allowance.
