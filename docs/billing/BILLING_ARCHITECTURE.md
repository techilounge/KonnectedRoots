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
cancel-at-period-end flag, add-on state and `latestStripeEventCreated`. A
separate `billing_events/{eventId}` ledger records safe event metadata and
processing state. `ai_pack_grants/{eventId}` records qualifying recurring
AI Pack invoice grants without storing payment payloads.

`getAuthoritativeBillingView` verifies the caller's Firebase ID token on the
server, reads the server-owned documents with Admin SDK, applies the paid-status
policy and returns a safe display view. `useEntitlements` consumes that action;
it no longer treats a browser Firestore listener as billing authority.

The canonical plan model is `free`, `pro`, or `family`; intervals are `month`
or `year`; the recurring `ai_pack` add-on is valid only with an active or
trialing paid plan. Current configured prices are Pro $5.99/month or $59.99/year,
Family $9.99/month or $99/year, and AI Pack $3.99/month. The configured Stripe
price IDs are server environment values and are never sent to the browser.

There is no implicit `past_due` grace period. `active` and `trialing` grant paid
access. `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` and
`canceled` resolve to Free capabilities. A subscription with
`cancel_at_period_end=true` remains paid until its current period ends; Stripe's
terminal event then removes paid access. A paid marker without a future period
end fails closed until the webhook supplies complete state.

The admin billing page reports synchronized state, mismatches, pending webhook
markers, past-due/canceled accounts and missing customer mappings. It is a
read-only reconciliation view; repairing a mismatch is an explicit support or
admin operation and is not performed broadly or destructively by a page load.

Storage Rules resolve an active Family owner's workspace and select its
server-owned `families/{familyId}.usage.storageUsedBytes` counter; Free/Pro
accounts use the owner's user counter. Replacement writes charge only the
positive size delta, and authorized deletes remain available. The current
upload paths do not atomically maintain either counter for every create,
replacement, or delete, so these Rules are a safe foundation rather than a
complete quota security boundary. Exact accounting and reconciliation,
including the shared Family 100 GB limit, are deferred to Phase 3/4.

Family AI actions are a workspace-scoped pool. Storage Rules resolve the Family
document when its membership and synchronized state are available, but exact
storage accounting remains deferred as described above. Tree collaborators remain
a separate role-based concept. Free trees allow two non-owner collaborators,
with at most one Editor and the remaining collaborator(s) as Viewers. Pro and
Family limits remain unchanged, and Family account seats are not tree
collaborator seats. Invitation creation and acceptance run through trusted
Functions transactions; client rules cannot directly create invitations or
mutate the collaborator map.

GEDCOM import/export is available on every plan as data portability. The server
authenticates the export request but does not increment `exportsUsed` for
GEDCOM; PNG/PDF continue to use the resolved visual allowance and watermark
rules.
