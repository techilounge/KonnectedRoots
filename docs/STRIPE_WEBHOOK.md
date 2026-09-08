# Production Stripe webhook

Deploy the Firebase function `stripeWebhook` in project `konnectedroots-u5xtb` (us-central1).
Configure the production Stripe event destination with exactly these six events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Payment-success emails are sent only for `invoice.payment_succeeded`. Do not also subscribe to or handle `invoice.paid`: these are distinct events and the existing event-ID guard does not deduplicate them by invoice. Sequential redelivery of the same event ID is skipped; the existing guard is not an atomic concurrency lock.

The existing success email retains recipient lookup, plan and interval, amount, next billing date and hosted invoice link. Stripe secrets remain bound to the function; no credential rotation is needed for this event-name change.

Validate with `npm --prefix functions test`. Deploy only this function with `firebase deploy --only functions:stripeWebhook --project konnectedroots-u5xtb`.
