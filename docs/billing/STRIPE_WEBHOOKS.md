# Stripe webhook contract

`functions/src/stripeWebhook.ts` accepts POST requests only and verifies the
Stripe signature against the raw request body and `STRIPE_WEBHOOK_SECRET`.
Unsigned or malformed requests return 400 and have no side effects.

Supported event types are `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`,
`customer.subscription.pending_update_applied`,
`customer.subscription.pending_update_expired`,
`invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.paid`, and
`subscription_schedule.created`, `.updated`, `.released`, `.completed`,
`.canceled`, `.aborted` (each with the `subscription_schedule` prefix). Other event types
are recorded as unsupported and acknowledged without billing mutations. This
list matches the deployed Stripe SDK/account event names; it is not expanded to
obsolete aliases.

Before processing, the handler claims `billing_events/{event.id}` in a
Firestore transaction. A duplicate delivery receives 2xx without repeating
subscription writes, AI Pack grants, or payment email. A processing failure is
marked failed and returns 500 so Stripe can retry.

For an in-place Pro-to-Family upgrade, Stripe receives
`proration_behavior=always_invoice` with
`payment_behavior=pending_if_incomplete`. Current Pro authority remains in
effect while Stripe holds the Family item in `pending_update`. The webhook maps
the applied current Price item, not stale subscription metadata, so a successful
`customer.subscription.pending_update_applied` event is the point at which
active Family billing can be synchronized. Only after both user and Family
billing transactions accept that event does a second transaction link the
owner and create the owner seat. An expired pending update or failed qualifying
Family proration records a safe failed operation and leaves Pro authoritative.

Subscription state carries `latestStripeEventCreated`. The existing path for
accounts without a managed base schedule compares event timestamps and writes
inside each target's Firestore transaction; older payload mutations are ignored
and equal timestamps accepted. Unrelated customers are never globally serialized.

Accepted owner billing and Family plan transactions also refresh server-owned
storage-authority projections for users linked to the same workspace. Projection
reads occur before writes, and the incoming authoritative state is used for the
same transaction's projection writes. Payment attention therefore revokes linked
members' paid Storage elevation with the accepted billing mutation. Managed
subscription reconciliation refreshes the same projections with its atomic
user/Family write. The event ledger, ordering markers and safe retries are
preserved; no Stripe mutation is added inside these transactions. Live-state
triggers and authenticated upload preparation cover membership/known usage
changes. See [the Storage correction](STORAGE_RULES_REMEDIATION_2026-09-13.md).

For a subscription with an attached schedule or server-owned
`hasBasePlanSchedule` history, events invoke `reconcileStripeSubscription`. It
reads the current authoritative user document, then retrieves live Stripe
subscription/customer/schedule state within the retryable transaction. It reads
the same owned workspace before atomically writing both user and Family state.
A transaction conflict repeats the live Stripe reads, including equal-second
races. Event payload plan/schedule snapshots are not applied; older deliveries
can request fresh reconciliation without reducing the maximum event marker.
Explicit `reconcileScheduledBilling` is authenticated, scoped to the caller's
stored subscription and uses the same path without inventing a newer event
marker. This repairs delayed deliveries, process restarts and stale projections.

Our active Family-to-Pro schedule projects a same-interval Pro target/date while
the current base item stays Family. At phase transition, the actual Pro item
clears the scheduled fields and stops Family paid-seat elevation; documents and
pooled usage remain. A valid recurring/prepaid AI Pack is preserved by the same
paid-through reconciliation, and a pending Pack cannot gain entitlement. The
applied owned schedule is released outside the transaction with an idempotency
key, retaining the subscription; release failures leave the event retryable.
Never call schedule cancel, which would terminate the subscription.

Schedule created/updated/released/completed/canceled/aborted events resolve the
subscription from its attached/released identifier or our scoped metadata, then
re-read current Stripe authority. Subscription updates and invoice paid/failed
signals perform the same reconciliation for managed accounts. `invoice.paid`
can grant a qualifying paid Pack invoice; `invoice.payment_succeeded` remains the
sole notification event. Invoice identity prevents duplicate grants across aliases. The
existing event ledger, signature checks, failed-event retries and commercial
payment guards remain in place. Enable these event deliveries in a later,
separately approved deployment; this pass changes no Stripe endpoint settings.

Family plan state is a derived workspace projection. During a Family
subscription update, the Family transaction reads the matching owner billing
document and carries forward the owner's existing AI Pack state when the
customer and subscription IDs match. A paid-through recurring or stopped-
renewal add-on therefore remains active for the Family pool; a genuinely
pending or expired owner state remains inactive. This projection does not create
an invoice, payment, grant or independent AI Pack authority. Authoritative
server views and Family usage transactions apply the same owner resolution so
members consume one shared pool. If a present owner snapshot has a different
Stripe customer or subscription, the Family add-on projection is cleared until
the server reconciles the subscription; a missing owner snapshot is retained for
that reconciliation rather than being treated as a new purchase.

Subscription cancellation state is canonicalized from the authoritative
Pro/Family plan item. `cancel_at_period_end=true` remains supported. When Stripe
Clover/flexible billing instead supplies a future `cancel_at`, the webhook
compares it with that plan item's `current_period_end`. Equality sets the
compatible `cancelAtPeriodEnd=true` field; a different future timestamp remains
available as `scheduledCancellationAt` and is not described as period-end
cancellation. AI Pack item periods are ignored for this comparison. Terminal
`customer.subscription.deleted` events clear the period, scheduled cancellation
and AI Pack state and synchronize the account to Free/canceled.

Payment failure is fail-closed. Subscription events may retain the canonical
Pro or Family plan and Stripe identifiers for history, but `past_due`, `unpaid`,
`incomplete`, `incomplete_expired`, `paused` and `canceled` do not grant paid
access. These Stripe statuses remain distinct in the canonical record so the UI
and reconciliation report can describe the actual state. Family webhook
projections preserve the workspace document, seats and
usage while disabling paid Family elevation. An existing prepaid AI Pack can
retain its canonical paid-through fields during a recoverable non-terminal base
status, but the authoritative server view and usage transactions exclude its
allowance until the base subscription is entitled again. No payment-failure
event creates an AI Pack grant or extends paid-through. A later qualifying
active/trialing event restores the effective state through the existing
idempotent, timestamp-ordered transactions.

Only safe identifiers and timestamps are logged/stored: event ID/type, Stripe
created time, customer/subscription IDs, account ID, status, and error code.
Payment instrument details, signatures, request bodies and secrets are never
stored in the ledger.

An AI Pack subscription item is evidence that the add-on was requested, not
evidence that its first charge succeeded. Subscription events synchronize
`aiPackItemExists` and set a newly observed item to `aiPackStatus=pending` with
`addons.aiPack=false`. They preserve an already paid entitlement while the live
item still exists, the base subscription is eligible and `aiPackPaidThrough`
remains in the future. When the authenticated removal callable has claimed the
operation, the item may disappear while that prepaid entitlement remains valid.
Reconciliation then sets `aiPackCancelAtPeriodEnd=true`, uses
`aiPackPaidThrough` as `aiPackScheduledRemovalAt`, and clears the short-lived
removal operation. Item disappearance without that server-owned removal marker
and terminal base-plan state fail closed.

`invoice.paid` and `invoice.payment_succeeded` are the activation and renewal
signals for AI Pack. The signed invoice must be paid, have zero remaining
balance, positive amount paid, and a positive line for the configured Pack Price.
The handler retrieves the subscription and validates the account/workspace
mapping and eligible base/item state, then writes time-gated Pack state,
paid-through bounded by that invoice line and one `ai_pack_grants/invoice_{invoiceId}` record
transactionally for the user and, when applicable, the Family workspace.
Re-delivery cannot grant twice. An
`invoice.payment_failed` event records/sends the existing failure notification
but never activates a pending AI Pack. A base-only Family upgrade proration is
not an AI Pack grant: it neither changes `aiPackPaidThrough` nor creates an
`ai_pack_grants` record. If invoice payment arrives before its
related subscription event, the later subscription transaction preserves the
valid paid-through state. Legacy event-keyed invoice grants are checked inside
the transaction. Neither live item period end nor an event timestamp supplies
a paid renewal boundary; older invoices cannot shorten a later paid boundary.

## Draft renewal window and failure diagnostics (2026-09-12)

The local Test Clock's frozen time is the expiry authority for an owned,
allowlisted disposable customer under the exact development/test Functions
Emulator, demo project, loopback Firestore host and sandbox-key conditions.
Stripe event `created` remains the event ordering marker: it used wall time in
the real specimen and cannot replace commercial clock time. Production continues
using wall time. Local clock reads use GET only and reject invalid ownership or
clock evidence. No paid-through value is extended by these reads.

While the base is active Pro, an expired Pack plus draft/open/finalized-unpaid
renewal resolves to Pro/200. An active Family equivalent resolves to pooled
Family/600. A recurring item or scheduled phase is renewal intent, not payment.
Created/finalized invoice signals are acknowledged without grants. Successful
qualifying payment extends only the Pack line's paid period, once per invoice;
Pro then resolves to 1200, Family to pooled 1600. Failed renewal never grants;
an authoritative past_due/unpaid/etc. base resolves to Free/10 as before.
Stopped-renewal prepaid access lasts only through the existing paid-through time.

Applied owned Pro schedule release is independent of invoice collection. It
still occurs outside the retryable transaction with the existing per-schedule
idempotency key and bounded fresh confirmation transaction. It cannot finalize,
pay or modify an invoice, produce a refund, or create a Pack grant. Late schedule
payloads read the current live graph and cannot restore obsolete Family state.
Subscription/schedule/payment transactions read the target authority, retry on
conflicts and preserve usage/workspaces; no unrelated customer serialization or
nested reconciliation transaction was introduced. GETs inside reconciliation
are repeated on transaction retries, not reused as stale snapshots.

The event claim now returns the successful transaction attempt's result rather
than retaining an outer mutable boolean across retries. Failed ledger entries
can be reclaimed; processed duplicates return 200 without work. Live processing
leases return static 503 without work, preserving Stripe retries instead of
acknowledging away recovery after a worker dies or a failure-ledger write fails.
A 120-second processing lease permits retry after a crashed worker or failed
failure-metadata write. Billing mutations and invoice grants remain independently
idempotent. This is not a claim of exactly-once external email delivery after a
process crash; the existing payment_succeeded email path remains unchanged.

Stage wrappers retain and rethrow the original exception for a local debugger.
Structured logs/failed-ledger metadata contain safe event/type/object/subscription
IDs, allowlisted error name/code, a static allowlisted or redacted message and
operation stage. Release, reconciliation/confirmation, grant, ledger-claim and
failed-ledger-write failures are distinguishable. Raw exceptions, stacks, request
bodies, customer/payment fields and secrets are never passed to the logger.
Signature and processing responses use static text. A failed failure-ledger write
does not replace the original handler response or throw away its diagnostic.

The real 16:08:32 UTC failure cannot be assigned an exact exception: the old catch
discarded the error and logged only its own generic caller stack. The ledger is
failed, but Pro state was committed and release is unconfirmed. That locates the
observed failure after a billing write, without proving whether release, its
confirmation or another concurrent event caused it. Mock release/transaction
failures reproduce safe retry paths, not the unknown real exception. Earlier
emulator lock messages are not proof of this event's cause.

Stripe references: [subscription webhook/payment signals](https://docs.stripe.com/billing/subscriptions/webhooks)
and [invoice finalization](https://docs.stripe.com/api/invoices/finalize).

## Partial Family schedule recovery

Managed subscription reconciliation distinguishes `scheduled`, `partial_owned`,
`applied_pro`, managed terminal `released`/`canceled`/`completed`, `none`, and
`unknown` conflicting/external state. A Family-only partial has no authoritative
scheduled Pro fields. Its ownership requires the server-owned unchanged
recovery receipt or a GET-only creation event whose request idempotency key
matches the saved operation and whose original response fingerprint is unchanged.
Metadata/attachment alone cannot authorize partial repair. Missing or altered
evidence fails closed; reconciliation does not append phases or repair Stripe.

The live attached schedule, base Price, interval, quantity, add-on graph and
exact phase boundary are reread within each Firestore transaction attempt.
Only the verified two-phase future Pro state publishes scheduled fields to the
user/Family documents. Out-of-order schedule/subscription events cannot infer
Pro from a one-phase schedule or resurrect old scheduled state. Already-applied
Pro cleanup releases only the verified owned Family-to-Pro graph outside the
transaction; unknown schedules are never released. Terminal objects retained by
the receipt can be inspected without claiming a still-active future downgrade.

New creation/configuration failures retain an exact recovery receipt and stable
operation; retry configures the same schedule with a v2 request key and no new
create POST, invoice/refund API or proration. The callable logs only sanitized
stage/type/code/parameter/request ID/status for failures, never raw error bodies,
messages, recipients, keys or payment details. The old local logs contain no
Stripe error response, so that original HTTP error is not asserted as observed.

## Schedule-release confirmation and UI feedback (September 12)

An applied, owned Family-to-Pro schedule is released outside the retryable
Firestore transaction with its existing idempotency key. A second transaction
rereads the live subscription and retained schedule and publishes
`scheduleReleaseConfirmed=true` only when the subscription is detached and the
managed schedule inspection is `released`. The follow-up is bounded to one
reread: a successful POST that still leaves an attachment remains unconfirmed,
and a later safe reconciliation can retry. Release failure does not invent a
confirmation. Keep Family uses the same fresh released/detached evidence after
its existing release flow. Event-ledger and per-target transaction ordering remain.

The server billing view exposes only `billingScheduleCleanupRequired` and
`billingScheduleReleaseConfirmed`, not receipts or Stripe identifiers. One client
observer uses fresh authoritative views for action confirmations and observed
payment recovery. Callable acceptance shows processing/confirmation only; stale
reads, duplicate webhook signals and routine usage refreshes generate no success.
No customer or Test Clock mutation was performed during this toast correction.

## Applied-Pro final integration and runtime audit (September 12)

Shared inspection now distinguishes structural `appliedDowngradeDetected` and
`scheduleReleaseNeeded` from safe release eligibility. Automatic release also
requires active Pro, approved item quantities/catalog/mode, no future phase,
pending update or cancellation, matching operation metadata/creation receipt,
and matching authoritative user/customer/subscription/Family workspace mappings.
Both manual and webhook paths use this same scoped guard; no background sweep
or mutation on browser mount was added. Detached managed state requires trusted
receipt/ownership evidence before publishing release confirmation.

Read-only Stripe event and Emulator ledger inspection found the current Pro
transition `customer.subscription.updated` at **2026-09-12 05:11:06 UTC**.
It was received at **05:11:07.488 UTC** and marked **failed** at
**05:11:08.401 UTC**. The existing billing projection records Pro/applied_pro
but release is unconfirmed. This was not a missing transition event or a
successfully processed ledger entry: the old handler failed to finish cleanup.

The local runtime log shows its webhook worker loaded at **05:03:34 UTC** and
remained in use for the 05:11 transition. It was retired at **05:24:52 UTC**,
before the final release-confirmation source update at **05:27:45 UTC** and later
**14:15 UTC** runtime reload. This establishes **A: an earlier worker/build was
running**, rather than delivery of this event to the final current build. The
log retains only the generic `Webhook handler error`; its underlying exception
cannot be identified from the available evidence. Do not attribute a specific
Stripe failure or an event-order race without further evidence.

Current synthetic tests exercise real webhook routing for subscription.updated,
schedule.updated and invoice.paid, prove release/detachment with fresh persisted
confirmation, and prove duplicate delivery is a no-op. No current routing defect
was reproduced (**B is not established**). Future eligible transitions have the
automatic path when the runtime has loaded this build and Stripe release
succeeds; failed releases remain safely retryable, not falsely confirmed. The
real current cleanup was intentionally not invoked. See the one owner action
and unchanged read-only harness in LOCAL_STRIPE_LIFECYCLE_TEST.md.

API basis: [schedule release](https://docs.stripe.com/api/subscription_schedules/release)
keeps the underlying subscription and exposes released/detached authority;
[webhook guidance](https://docs.stripe.com/webhooks) requires safe handling of
duplicate and out-of-order delivery. No event resend or mutation was used here.
