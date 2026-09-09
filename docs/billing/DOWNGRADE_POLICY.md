# Downgrade, cancellation and failed-payment policy

Paid access is granted only for `active` and `trialing` Stripe subscription
states. There is no undocumented grace period for `past_due` or `unpaid`.
Those states retain the account and its data but resolve to Free capabilities.
`incomplete`, `incomplete_expired`, `paused` and `canceled` also resolve to
Free. A support-approved policy change must update this document and tests
together.

`cancel_at_period_end=true` is not an immediate downgrade. The account keeps
the current paid entitlement while `currentPeriodEnd` is in the future. When
Stripe reports the terminal cancellation/expiration, the webhook changes the
account to Free.

Downgrade behavior is restrictive and preserves data:

- existing trees, people, relationships and files remain readable;
- new trees, people, collaborators, uploads, visual exports and AI actions are
  limited by the resolved Free policy;
- existing storage above the Free quota is retained, while additional uploads
  are blocked until usage is below quota or the account upgrades;
- Family membership and tree collaborators are not deleted automatically;
- GEDCOM remains a paid export in the current product policy; users retain the
  data already stored in the account and can upgrade to export it.

Failed payments trigger the existing transactional notification and rely on
Stripe subscription events for the authoritative status. The application does
not infer payment success from a browser return URL or a client plan field.
