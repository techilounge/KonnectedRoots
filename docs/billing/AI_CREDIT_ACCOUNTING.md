# AI credit accounting

AI actions are server-metered in `verifyAuthAndDeductAICredits`. The caller's
Firebase ID token is verified with Firebase Admin; the UID comes from the
verified token, never from request data. A Firestore transaction checks the
server billing state, resets the month lazily, verifies the resolved plan and
AI Pack allowance, then increments `usage.aiActionsUsed`. A browser write to
`users/{uid}.usage` is rejected by Firestore rules.

For an eligible Family account, the transaction resolves the authenticated
member's Family workspace and debits `families/{familyId}.usage` so the 600 base
actions plus any AI Pack allowance are pooled across Family seats. Individual
accounts debit their own user usage document.

Current action weights are: name suggestion 1, biography 1, OCR 1, translation
2, photo enhancement 15, and deterministic Relationship Finder 0. A failed
provider call refunds the reserved action through the server path. Provider
telemetry uses the existing content-free transactional AI ledger and never
stores prompts, documents or response content.

The AI Pack contributes exactly 1,000 actions to an eligible active Pro or
Family subscription only while its server-owned paid entitlement is active.
The canonical state separates `aiPackItemExists`, `aiPackStatus`
(`none | pending | active`) and `aiPackPaidThrough`. The compatibility flag
`addons.aiPack` is true only for an active, future paid-through period. A newly
attached recurring item therefore remains pending and contributes no credits
until Stripe confirms a qualifying invoice payment.

The authenticated Functions callable adds the recurring item with immediate
invoicing and pending-update payment behavior. Its Firestore operation claim
and Stripe idempotency key are stable across double-clicks, concurrent calls
and safe retries. A qualifying signed `invoice.paid` or
`invoice.payment_succeeded` event verifies paid invoice lines and the live
account/subscription mapping, records `ai_pack_grants/invoice_{invoiceId}` and
activates the user and matching active Family workspace state in one Firestore
transaction. Existing event-keyed grants for that invoice are also checked. Duplicate event
delivery cannot create another grant. Failed payment, item removal, an expired
paid-through period or a base plan that no longer grants paid access cannot add
the 1,000-action allowance. The paid-through end comes exclusively from a
positive configured-Pack invoice line on a paid, zero-remaining, positive-paid
invoice; the live item period end alone never extends it. Older paid invoices
cannot regress a newer paid-through marker.

Local Test Clock expiry uses the owned frozen clock under strict demo/emulator
guards; production uses wall time. Billing views, server AI/export checks and
Functions Pack add/remove/resume state paths use that commercial expiry time.
An active base plus expired Pack during draft/open/unpaid renewal retains its
base allowance (Pro 200 / Family pooled 600), not the Pack bonus. The read-only
report's `renewal_pending` / `renewal_failed` labels are KonnectedRoots-derived
states, not Stripe subscription statuses or new persisted canonical enums.
Expired subscription reconciliation retains historical paid-through evidence
while disabling the compatibility entitlement flag; terminal states still clear
it. Add/observation paths may clear an expired marker while remaining pending;
they cannot grant or extend it.

Family-to-Pro switches current usage authority from preserved Family usage to
the owner's existing user bucket. Reconciliation and payment grants neither
reset nor copy consumption; the historical pool remains intact. Monthly bucket
refresh semantics are unchanged by the local expiry-clock adapter.

There is no client-side credit increment/decrement API. Retry idempotency for
provider accounting is provided by the existing reservation/settlement ledger;
future UI actions that need request-level retry semantics should supply a
stable operation key and extend that ledger rather than adding a browser
counter.
