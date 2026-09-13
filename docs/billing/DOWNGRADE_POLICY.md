# Downgrade, cancellation and failed-payment policy

Paid access is granted only for `active` and `trialing` Stripe subscription
states. There is no undocumented grace period for `past_due` or `unpaid`.
Those states retain the account and its data but resolve to Free capabilities.
`incomplete`, `incomplete_expired`, `paused` and `canceled` also resolve to
Free. A support-approved policy change must update this document and tests
together.

A future scheduled cancellation is not an immediate downgrade. The account
keeps the current paid entitlement until the earlier authoritative plan-period
or `scheduledCancellationAt` timestamp. This covers both
`cancel_at_period_end=true` and Stripe Clover/flexible-billing records whose
`cancel_at` equals the base plan item's `current_period_end`. An arbitrary
future `cancel_at` is preserved accurately without being labeled as period-end
cancellation. When Stripe reports terminal cancellation/expiration, the webhook
changes the account to Free and disables the AI Pack without deleting data.

Downgrade behavior is restrictive and preserves data:

- existing trees, people, relationships and files remain readable;
- new trees, people, collaborators, uploads, visual exports and AI actions are
  limited by the resolved Free policy;
- existing storage above the Free quota is retained, while additional uploads
  are blocked until usage is below quota or the account upgrades;
- Family membership and tree collaborators are not deleted automatically;
- GEDCOM import/export remains available as data portability on every plan and
  does not consume the visual PNG/PDF allowance. It has no paid-plan gate or
  premium formatting requirement after downgrade.

Free collaboration after downgrade allows up to two non-owner collaborators,
with at most one Editor and the remaining collaborator(s) as Viewers. Existing
membership is preserved; new invitations and invitation acceptance are checked
against the resolved Free policy by trusted server transactions.

Failed payments trigger the existing transactional notification and rely on
Stripe subscription events for the authoritative status. The application does
not infer payment success from a browser return URL or a client plan field.

## Family to Pro at paid-period end

The owner-approved Family-to-Pro change takes effect only at the current Family
base item's paid-period end through an authoritative Stripe Subscription
Schedule. Monthly remains monthly; yearly remains yearly. Family/600 (or
Family/1600 with valid Pack), 20 collaborators, 100 GB and six paid seats remain
in effect until Stripe actually applies the Pro base Price. No browser timer or
Firestore-only promise grants the target plan. There is no immediate refund,
proration credit, charge or invoice.

Before transition the owner can choose **Keep Family Plan**, which releases the
schedule and keeps normal Family renewal with no charge/refund. Both plan
mutation APIs require active renewing Family and reject payment attention;
Stripe Portal remains available to recover payment. A pending schedule blocks
AI Pack mutations until it is canceled, preventing a future phase from restoring
an item whose renewal was stopped.

At transition the owner receives Pro/200, 10 collaborators and 50 GB, or Pro/1200
with valid AI Pack. A renewing Pack remains attached once. A prepaid stopped
Pack remains valid only until its existing paid-through expiry, then returns to
Pro/200. Pending/failed Packs do not become active because the base plan changed.

The same Family workspace/owner and membership/seat documents remain preserved.
Paid Family-seat entitlement becomes inactive; non-owner seats no longer elevate
their accounts to Family. Records are not deleted or recreated on a later Family
upgrade. All genealogy data, media, collaborators, invitations, usage and billing
history remain. Existing over-limit collaboration is retained, with new mutations
checked against Pro limits. The transition carries a conservative known storage
floor from the shared counter into the owner counter; over-quota uploads remain
blocked under existing rules and deletes remain available. This does not claim
exact byte reconciliation or complete shared-pool enforcement, still Phase 3/4.

Stripe subscription/schedule/invoice events and explicit scoped reconciliation
repair stale scheduled fields and apply the actual current base item. The staged
Test Clock validation in LOCAL_STRIPE_LIFECYCLE_TEST.md has not been executed in
this implementation pass. Previously completed accounts/clocks are protected.

The subsequent owner scheduling attempt created a Family-only partial schedule;
it did not validate a future Pro transition. Such a partial retains Family and
null scheduled fields. A retry may resume the exact unchanged schedule only
after server receipt/creation-event provenance, customer/subscription/workspace,
test/live mode, item graph and pre-period-end eligibility are verified. Bare
ownership metadata is insufficient for partial recovery. Unexpected schedules
require support rather than replacement or adoption. The existing generic UI
retry remains appropriate; success must show Family Current Plan, the verified
Pro date and Keep Family Plan.

Keep Family explicitly releases a verified partial as well as a valid scheduled
downgrade and keeps Family renewing. It never calls subscription/schedule cancel.
New phase-configuration failures retain trusted recovery state (design B) so
retry uses the same object without duplicate schedules/phases or immediate
invoice/refund/proration. The correction pass only inspected real state using
GET/read operations; actual repair/cancel/transition validation remains pending
owner execution. See the exact current-object checkpoint in the local runbook.
