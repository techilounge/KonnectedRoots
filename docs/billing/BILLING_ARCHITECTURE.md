# Billing architecture

Stripe is the source of truth for commercial billing. The Functions runtime is
the only place that resolves Stripe price IDs, creates customers, creates
Checkout or Portal sessions, and writes synchronized billing authority fields.
The browser may request a logical `plan` and `interval`, but it cannot choose a
price, customer, redirect, subscription, plan, status, credit balance or seat
entitlement.

The canonical account mapping is:

```text
Firebase Auth UID <-> users/{uid}.billing.stripeCustomerId
```

Stripe Customer metadata includes `kr_uid` and, for a Family subscription,
`kr_family_id`. A stored customer is checked before use. Email lookup is only a
recovery aid for customers already tagged with the same UID; multiple candidates
are rejected for manual reconciliation. A missing/deleted customer is never
silently merged by email in the Portal path.

The synchronized fields are stored under `users/{uid}.billing` and,
where applicable, `families/{familyId}.plan`. The webhook writes the plan,
status, interval, price ID, subscription/customer IDs, period timestamps,
canonical `cancelAtPeriodEnd` state, exact `scheduledCancellationAt` timestamp,
AI Pack item/payment state and `latestStripeEventCreated`. AI Pack authority is
represented by `aiPackItemExists`, `aiPackStatus` and `aiPackPaidThrough`.
Scheduled add-on removal also uses `aiPackCancelAtPeriodEnd`,
`aiPackScheduledRemovalAt` and a short-lived server-owned removal operation;
renewal restoration uses a separate short-lived server-owned resume operation.
`addons.aiPack` remains a compatibility entitlement flag and is true only while
that paid-through state is active. A
separate `billing_events/{eventId}` ledger records safe event metadata and
processing state. New `ai_pack_grants/invoice_{invoiceId}` records qualifying recurring
AI Pack invoice grants without storing payment payloads.
An in-place Pro-to-Family change also records a short-lived server-owned
`planChange*` operation under the billing record. The browser can observe its
safe pending/failed state but cannot choose its Stripe price, subscription,
customer or Family workspace.

`getAuthoritativeBillingView` verifies the caller's Firebase ID token on the
server, reads the server-owned documents with Admin SDK, applies the paid-status
policy and returns a safe display view. `useEntitlements` consumes that action;
it no longer treats a browser Firestore listener as billing authority.

Family AI Pack state is a derived projection of the billing owner's authority.
When an active Family document and its owner identify the same Stripe customer
and subscription, the owner billing snapshot supplies the AI Pack item,
status, paid-through and renewal fields for the Family entitlement view. This
prevents a Family workspace created during a base-plan switch from interpreting
the owner's already-paid surviving AI Pack item as a new pending purchase.
The same matching-owner resolution is used for server AI debits and exports,
so every linked seat sees the same pooled allowance. It does not create a new
commercial authority, payment, grant or paid-through period. A live recurring
or prepaid stopped-renewal owner state resolves to 1,600 Family actions; an
unpaid pending, expired or absent owner state resolves to the 600-action base
pool. Subscription webhooks also project the owner fields into the derived
Family plan snapshot when the identifiers match.

The canonical plan model is `free`, `pro`, or `family`; intervals are `month`
or `year`; the recurring `ai_pack` add-on is valid only with an active or
trialing paid plan. Current configured prices are Pro $5.99/month or $59.99/year,
Family $9.99/month or $99/year, and AI Pack $3.99/month. The configured Stripe
price IDs are server environment values and are never sent to the browser.
The approved current Family prices are
`price_1SqLVSFLueI9mUztPucoRA0h` for $9.99 monthly and
`price_1UDyX3FLueI9mUztJ3CqVJ2C` for $99 yearly. Before Family Checkout or an
upgrade, Functions retrieves the configured price and requires active USD
recurring Price metadata, the requested interval and exactly 999 or 9900 cents.
The deactivated $99.99 yearly price therefore cannot pass the server catalog
validation even if an environment is misconfigured to reference it.

An active Pro owner upgrades to Family through `upgradeToFamily`, not through a
second Checkout subscription. The callable accepts only logical
`plan=family` and `interval=month|year`, verifies the UID/customer/subscription
mapping and exactly one trusted Pro base item, and rejects a scheduled base
cancellation or an unreconciled item graph. A Firestore transaction claims one
stable operation and creates only an inactive Family workspace. Stripe then
updates the existing Pro item with `proration_behavior=always_invoice` and
`payment_behavior=pending_if_incomplete`. This invoices only the prorated base
price difference and leaves the change pending until required payment succeeds.
The existing AI Pack item is omitted from the mutation and remains attached
exactly once; its paid-through time, grant count and monthly usage are not reset.

While payment is pending or fails, the synchronized user remains Pro and the
inactive workspace is not linked as a paid membership. A qualifying applied
subscription event changes the canonical user and Family plan to active Family,
clears the plan-change operation, links the owner to the workspace and creates
one server-owned owner seat. A failed Family proration records a safe failed
state for the UI without granting Family. The Pricing page listens to the
authoritative user/Family documents and transitions to Current Plan without a
browser reload.

Adding AI Pack uses Stripe's current subscription-item API with
`proration_behavior=always_invoice` and
`payment_behavior=pending_if_incomplete`. The callable first claims a persisted
operation under the user's billing record, then uses that operation in a
stable Stripe idempotency key. The item may exist while payment is pending, but
the entitlement remains inactive until a qualifying
`invoice.paid` or `invoice.payment_succeeded` webhook verifies the paid invoice/live subscription and writes
the paid-through state transactionally. This ordering handles subscription
updates arriving before or after invoice payment, and it prevents a retry from
creating a second item.

Removing AI Pack deletes only the subscription item whose trusted Stripe Price
metadata has `kr_addon=ai_pack`. The callable accepts no Stripe identifiers,
verifies the UID/customer/subscription and Family owner mappings, requires one
base plan item and exactly one matching add-on item, and uses a stable Stripe
idempotency key. Stripe receives `proration_behavior=none`: recurring AI Pack
billing stops immediately, with no automatic refund or credit. The already-paid
entitlement remains active through `aiPackPaidThrough`; the user and Family
authority records show `aiPackCancelAtPeriodEnd=true` and the matching
`aiPackScheduledRemovalAt` until that time. The Pro/Family item and its scheduled
  cancellation fields are never changed by this operation.

An AI Pack with a live recurring item is active and renewing. After renewal is
stopped, the item is absent but the add-on remains active through the matching
future `aiPackPaidThrough` and `aiPackScheduledRemovalAt` timestamps. Before that
time expires, the authenticated `resumeAIPack` callable can restore renewal. It
accepts no Stripe identifiers, verifies the UID/customer/subscription and Family
owner mappings, requires exactly one trusted base-plan item and no existing
trusted AI Pack item, and resolves the allowlisted AI Pack price on the server.
It adds one subscription item with `proration_behavior=none`, so Stripe creates
no immediate proration, invoice, payment, refund or new grant. The stable
idempotency key is scoped to the subscription, existing paid-through period and
persisted resume operation; concurrent or repeated calls cannot create duplicate
items, while a later stop/resume cycle gets a new operation. The paid-through
timestamp, allowance, usage, base item and base cancellation state remain
unchanged. Once the item is verified, the server and subscription webhook clear
the scheduled add-on-removal fields. After paid-through expiry, the resume path
fails closed and the normal paid `addAIPack` flow is required.

There is no implicit `past_due` grace period. `active` and `trialing` grant paid
access. `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` and
`canceled` resolve to Free capabilities. A scheduled future cancellation remains
paid until the earlier authoritative plan-period or cancellation timestamp.
The webhook recognizes Stripe's legacy/current `cancel_at_period_end=true`
representation and Clover/flexible-billing `cancel_at`. It sets
`cancelAtPeriodEnd=true` only when the explicit flag is set or `cancel_at`
equals the Pro/Family plan item's `current_period_end`; a different future
`cancel_at` is preserved in `scheduledCancellationAt` without being mislabeled.
The AI Pack item never supplies the base entitlement period. Stripe's terminal
subscription deletion event removes paid access. An add-on item removed through
the authenticated removal operation retains only the already-paid entitlement
until `aiPackPaidThrough`; other item disappearance fails closed. An expired
`aiPackPaidThrough` value fails closed even if a stale compatibility flag remains.
A paid marker without a future plan period fails closed until the webhook
supplies complete state.

The canonical billing record keeps the commercial plan, Stripe identifiers,
status and payment history so reconciliation and recovery remain possible. The
effective entitlement is resolved separately on every authoritative server
view and usage transaction. While a paid base status is non-entitled, the
Family workspace, seats, trees, people, media and usage remain intact, but
Family paid elevation and all paid AI allowances are disabled. An already-paid
AI Pack may retain its future paid-through marker for recovery bookkeeping; it
cannot independently grant Pro or Family capabilities while the base plan is
non-entitled. When Stripe returns to `active` or `trialing` with a valid period,
the same workspace and pooled allowance become effective again without a new
workspace, seat or grant.

The admin billing page reports synchronized state, mismatches, pending webhook
markers, past-due/canceled accounts and missing customer mappings. It is a
read-only reconciliation view; repairing a mismatch is an explicit support or
admin operation and is not performed broadly or destructively by a page load.

Storage Rules read only the tree and its owner's user document for tree media,
and only the user document for avatars. Personal Free/Pro quota is resolved from
server-owned user billing. Family quota uses `users/{uid}.storageAuthority`, a
server-owned projection of the linked workspace and its billing owner's matching
subscription, paid status and paid-period cutoff. A retained `familyId` alone
never grants 100 GiB. Both owner and linked non-owner tree-owner paths use this
projection, keeping every Storage evaluation within two unique Firestore reads.

The existing authoritative billing transactions update linked users' storage
projections with their accepted owner/Family mutation, including revocation.
Live-document triggers maintain the projection after membership/usage writes;
`prepareStorageUpload` lazily initializes existing accounts and refreshes the
selected tree owner's projection before browser image uploads. It accepts only a
tree selection (or an empty avatar selection), verifies Auth/tree roles, and
never accepts browser quota, billing, membership or usage values.

Positive replacement growth is checked against the greater of known user usage
and the retained projected Family usage floor. Equal/shrinking image replacements
and authorized deletes remain available above quota. These checks do not update
object-byte counters. Exact accounting and reconciliation, including complete
shared Family 100 GB enforcement, remain Phase 3/4 work. Conservative known
floors survive downgrade/unlink; a future trusted reconciler must resolve actual
per-account bytes and decreases. See
[the Storage Rules correction report](STORAGE_RULES_REMEDIATION_2026-09-13.md) for
lifecycle details, access counts, emulator evidence and deployment order.

Family AI actions are a workspace-scoped pool. A Family document is selected as
billing and usage authority only when `plan.plan=family`, its status grants paid
access and its paid period remains current. With no add-on the pool is 600
actions; one paid AI Pack increases that same pool to 1,600. Each linked member
debits `families/{familyId}.usage`; no member receives an independent 1,600
allowance. Storage Rules consume the server-owned user projection of this
Family authority instead of reading the Family document; exact storage
accounting remains deferred as described above. Tree collaborators remain
a separate role-based concept. Free trees allow two non-owner collaborators,
with at most one Editor and the remaining collaborator(s) as Viewers. Pro and
Family limits remain unchanged, and Family account seats are not tree
collaborator seats. Invitation creation and acceptance run through trusted
Functions transactions; client rules cannot directly create invitations or
mutate the collaborator map.

Family membership documents and `families/{familyId}/seats/*` writes are
server-owned. Paid activation creates the owner seat, which counts toward the
six-account limit; the per-tree collaborator limit remains 20 and is unrelated
to those seats. Customer-facing member invitation/removal and transactional
capacity enforcement for the remaining five seats are not implemented in this
Phase 2 branch. The schema and read-only report expose the correct limit, but a
six-seat lifecycle cannot be described as fully enforced until those server
operations exist.

Family-to-Pro is now represented by a Stripe Subscription Schedule on the existing
subscription. `scheduleDowngradeToPro` accepts only an empty request or
`{plan: "pro"}`. It authenticates the Family owner, checks canonical and live
payment state, verifies customer/subscription/workspace ownership and the
allowlisted current Family base Price, and resolves the Pro Price on the server.
Monthly Family maps to monthly Pro; yearly Family maps to yearly Pro.

The migrated current phase retains its Family items/settings until the base
item's `current_period_end`. The next phase changes only that base Price and
preserves any renewing AI Pack item. Update and phase prorations are `none`;
there is no immediate refund, credit or invoice. The schedule uses
`end_behavior=release`; reconciliation also releases our applied Pro schedule
outside its transaction so later paid operations need not wait another period.
No schedule cancellation API is used. `cancelScheduledDowngrade` releases the
owned schedule before the transition, leaving Family renewing normally.

A server-owned, per-subscription `basePlanChangeOperationId` and action exclude
conflicting add-on/plan claims and supply stable Stripe create/configure keys.
Repeated requests use the one attached schedule. After creation, a server-owned
`basePlanScheduleRecovery` receipt records its exact ID, owner/customer/workspace,
mode, operation and response fingerprint before phase configuration. Failure
retains that same schedule and operation (design B); it does not automatically
release an attached schedule. A lost creation response or the legacy untagged
partial can be proven using GET-only Stripe creation events: the event request
key must match the saved operation and the entire original schedule snapshot
must still match. Recovery never replays a create POST for an attached schedule.
Missing evidence, mode/scope mismatch, changed settings/items or conflicting
phases fail closed. Event recovery is bounded to 10 pages/1,000 creation events
and Stripe's 30-day event retention; existing persisted receipts do not depend
on Stripe's create-key cache. Test Clock object creation time is frozen time and
must not be used to filter wall-time event creation. Never adopt a foreign
schedule merely because it is attached. While a downgrade
is scheduled, Keep Family Plan must be selected before add/remove/resume AI Pack
changes; their normal lifecycle is unchanged otherwise. Active, renewing Family
subscriptions are supported; trial, pending updates, base cancellation and
payment-attention states cannot start this operation. Portal recovery remains
available.

A verified partial contains exactly the unchanged current Family phase ending
at the live base item's period end, with no future phase, trial, one-off invoice
items, unsupported phase invoice customization or cancellation. It stays Family
with all scheduled fields null. Retry replaces the phase array with exactly
that Family phase plus one same-interval Pro phase; quantity and the optional
AI Pack remain unchanged. Writable tax/invoice/threshold fields are constructed
explicitly rather than copying Stripe GET response objects, especially the
response-only `automatic_tax.disabled_reason`. The corrected phase request uses
a versioned `kr-family-pro-configure:v2` key so it cannot replay the failed v1
request's cached result. Current/future/request prorations are none and
`end_behavior=release`. Only a fresh live reread proving the two intended phases
populates scheduled fields. Generic UI retry remains valid for this verified
partial; it never displays a scheduled date based on mere schedule existence.

Keep Family may explicitly release this same verified partial, including
switching its pending scheduling claim to the scoped cancel action. It must
recheck ownership/snapshot/live eligibility and never cancel the subscription.
A lifecycle-independent configuration fingerprint identifies the released
partial for reconciliation while active repair requires the full unchanged
response fingerprint. Unknown or externally altered partials require support.

The trusted projection includes `scheduledPlan=pro`, `scheduledInterval`,
`scheduledChangeAt` (milliseconds), `scheduledChangeType=downgrade` and
`scheduledChangeStatus=scheduled`. The raw schedule ID and operation fields
stay server-owned and are omitted from the public billing view/callable result.
Scheduling does not overload `cancelAtPeriodEnd` or alter effective limits.
`useEntitlements` uses the existing authoritative action and document signals;
Pricing and Billing Settings show the date, confirmation and Keep Family Plan.

Once the live base Price is Pro, reconciliation writes user billing and the
preserved Family plan projection in one transaction. It clears scheduled fields,
sets workspace paid seats inactive/seatLimit=0, and keeps workspace ID, owner,
membership, seats, trees, media, collaboration, invitations, history and pooled
usage intact. The owner resolves to Pro/200 or Pro/1200 with a valid Pack;
non-owner Family seat holders receive no Family elevation. Returning to Family
reuses the same workspace/members, including a still-valid prepaid stopped Pack.
Existing excess collaborators remain; new additions enforce Pro's limit of 10.
The owner's known storage usage retains a conservative maximum of its old user
counter and the retained Family counter at transition, preventing a known pool
overage from being reset away. Pro's 50 GB rules apply, with deletion allowed;
exact object-byte accounting/reconciliation remains deferred to Phase 3/4.

GEDCOM import/export is available on every plan as data portability. The server
authenticates the export request but does not increment `exportsUsed` for
GEDCOM; PNG/PDF continue to use the resolved visual allowance and watermark
rules.

Stripe scheduling references used for this implementation:
[Subscription Schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
and [mixed intervals](https://docs.stripe.com/billing/subscriptions/mixed-interval).
The schedule inherits the subscription billing mode; it does not migrate an
existing customer. Phase duration is used for mixed intervals. The NEW test-only
Family subscription helper explicitly selects flexible billing so a later
monthly AI Pack can be added to a yearly base without changing the base interval.

## Confirmed billing notifications (local correction, September 12)

One root-layout billing observer uses the existing authoritative view and live
Firestore signals. Pricing and Billing Settings register browser-session feedback
intents; accepted callables and redirect query parameters never establish success.
The observer confirms only a server read dispatched after request acceptance,
using shared monotonically ordered dispatch marks (including same-millisecond
requests). Loading, failed and other-account views cannot confirm an action.

The existing Radix toast system supplies neutral light/dark surfaces, green
success or red error icons/titles, six-second success dismissal, eight-second
error dismissal, visible keyboard dismissal and foreground/background live
announcements. Mobile stacking is bounded at the bottom, respects safe areas
and supports reduced motion. Two independently confirmed checkout/AI Pack results
can coexist. Inline processing changes to Confirming; after 45 seconds, Refresh
status offers a read-only retry. Ambiguous transport errors retain the intent
and never assert that Stripe made no change or automatically repeat a mutation.

Session storage contains only the account UID, minimal safe display snapshot,
local feedback action/ID and timing; no auth tokens, raw Stripe IDs or payment
details. Completion removes the intent; the last view suppresses repeated
signals, route changes and reloads. Logout/account changes reset feedback, and a
checkout cancel return quietly ends checkout feedback. Routine usage changes are
silent. An initial paid view is not a purchase. Observed major activation and
payment-attention-to-paid recovery can announce a real transition.

Keep Family requires the fresh server-owned schedule-release confirmation as
well as active Family with no scheduled downgrade. Family-to-Pro notification
requires an observed Family-to-Pro transition followed by confirmed release;
an already-Pro initial view stays quiet when cleanup completes. These booleans
are display evidence, never an authorization input. There is no automatic
reconciliation callable in the observer. A Portal return has no authoritative
payment-method-change evidence in this phase, so it does not claim a payment
method was updated; actual paid recovery can still announce Payment received.

## Explicit applied-Pro reconciliation integration (September 12)

Billing Settings renders `ScheduledBillingReconciliation` only when the
authoritative view reports pending schedule cleanup (or that same explicitly
requested cleanup is awaiting confirmation). Active Pro owners can click
**Refresh billing status** once. The existing Functions client sends only `{}`
to `reconcileScheduledBilling`; the authenticated server derives the canonical
subscription. Read dispatch, mount, live signals, the 45-second timeout and
Refresh status fallback never invoke that callable. Pending-click protection is
synchronous, so two clicks before a rerender still produce one request.

Applied release requires the verified two-phase Family-to-Pro graph, active Pro,
one approved base of quantity 1, approved retained add-on graph, no future phase,
pending update or cancellation, correct test/live mode, operation metadata and
the matching server-owned creation receipt. Customer, owner UID, subscription
and retained workspace mappings must agree. The webhook continues to use the
same per-target transaction, release idempotency key and bounded fresh reread.
No customer, subscription, invoice, refund or proration creation is introduced.
Inactive/payment-attention and unknown/external cases never authorize release.

The explicit action waits for a later authoritative read proving detached
released state, active Pro and no cleanup needed. Confirmation is the neutral
inline **Billing status refreshed**; it is not a purchase or plan-change toast.
The existing session observer keeps an already-Pro baseline quiet. Delayed or
ambiguous results offer a read-only Refresh status and never assert a successful
release merely because a POST returned. Family workspace, genealogy/membership
and usage are preserved; paid Family seats remain inactive and Pro limits remain
200 AI actions, 10 collaborators per tree and 50 GB without a valid AI Pack.

## Pack renewal authority at a scheduled boundary (2026-09-12)

Item existence, renewal intent, current payment validity and base entitlement
are separate. Family + currently paid Pack is pooled 1600; after an active Pro
phase applies with the old Pack period expired and the new invoice unpaid, the
owner resolves to user-owned Pro/200. A qualifying paid renewal invoice extends
only its Pack line period and restores Pro/1200 once. Family renewal has the
equivalent 600 -> 1600 gate. Base payment-ineligible statuses still resolve Free/10.
Schedule release cannot manufacture payment or grants.

Production expiry remains wall-clock based. The server-only
`src/lib/billing/evaluationTime.server.ts` adapter obtains commercial time through
GET-only owned customer/Test Clock reads exclusively in development/test under
the exact demo project and loopback Auth/Firestore emulator conditions, outside
Vercel. It reuses the existing server-only sandbox key (environment or gitignored
local Functions secret file); production never reads that file. No browser key,
clock ID, timestamp or customer request parameter is trusted. Functions uses its
own scoped clock adapter, shared by reconciliation and Pack state operations.
Missing/foreign clock evidence fails the local check instead of overgranting
from a wall-time fallback. Root server views and AI/export authorization evaluate
the same commercial time, including matching owner authority for Family seats.
Clock GETs inside retryable usage/reconciliation transactions are reread on retries;
there is no Stripe mutation in those transactions. The root GET adapter has
bounded ten-second requests and static errors. This adds local API-read overhead;
it does not claim to have identified the previous emulator 500/lock failure.

No new persisted Stripe-like Pack status is introduced. Existing canonical
`none/pending/active`, item/payment/removal fields and invoice grant history remain.
The read-only harness derives `renewal_pending`, `renewal_failed`, `paid_renewing`,
`prepaid_stopped`, `expired` or `unpaid_item` and reports invoice payment fields.
The current real emulator compatibility flag is deliberately left untouched;
fresh read-only effective resolution rejects its expired paid-through marker.
User/Family consumption is preserved; switching authority to Pro neither copies
nor resets the retained pool. Exact storage reconciliation remains deferred.
