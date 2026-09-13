# Phase 2 billing baseline — 2026-09-09

This is the implementation audit captured from the Phase 1 merge baseline
`55503b9051eb57842c3d9609491f18b0daf168b3` before the Phase 2 changes. Stripe
remains the commercial source of truth. Firestore is a synchronized cache and
audit ledger; it is not a client-grantable entitlement source.

## Existing implementation inventory

| Area | Existing location | Before Phase 2 | Bypass or stale-state risk |
| --- | --- | --- | --- |
| Products/prices | `functions/src/config.ts`, `functions/src/stripeBilling.ts` | Price IDs came from Functions environment, but the checkout handler did not expose a shared catalog. | A future caller could accidentally add a browser price parameter. |
| Checkout | `createCheckoutSession` callable | Required Firebase Auth and used the token UID; accepted browser redirect fields and checked only the cached user status. | Redirects and stale status needed server ownership. |
| Portal | `createPortalSession` callable | Used the stored customer, then recovered by email or created a customer. | Email is not a stable account identity; ambiguous customers could be linked. |
| Webhook | `functions/src/stripeWebhook.ts` | Verified raw-body signatures and handled subscription/invoice events. | Read-then-write event idempotency and event ordering were not atomic. |
| Subscription sync | `users/{uid}.billing`, `families/{familyId}.plan` | Webhook synchronized plan, status, period and add-on flags. | Older events could overwrite newer state. |
| AI Pack | Subscription item plus `billing.addons.aiPack` | Added as a recurring Stripe item; allowance was derived in billing helpers. | No explicit invoice grant ledger existed. |
| Billing documents | `users/{uid}.billing`, `users/{uid}.usage`, `families/{id}.plan` and `usage`, `billing_events` | Mixed authority and derived fields lived in user/family documents. | Client UI read those fields directly. |
| User fields | `users/{uid}` | Legacy `plan` and `entitlements` fields coexisted with `billing`. | Legacy fields could disagree with Stripe state. |
| Custom claims | `useAuth.tsx`, admin rules | Claims are for admin roles only; no paid plan claim is authoritative. | Claims would be stale if used for billing. |
| Client plan detection | `useEntitlements.ts`, pricing and settings pages | Browser Firestore listener derived the displayed plan. | A stale or client-writable derived field could flash/grant paid UI. |
| Premium checks | `src/lib/billing/entitlements.ts`, `ExportDialog`, AI server actions | UI checks existed; AI credit debit and export usage were server actions. | GEDCOM and export generation occur in the browser, so UI-only checks are bypassable. |
| Export limits | `recordExportOnServer` | Monthly usage increment was transactional after client generation. | The output itself is client-side and cannot be made a server security boundary without moving generation. |
| AI credits | `verifyAuthAndDeductAICredits` | Verified an ID token and atomically incremented usage. | It used raw cached plan/status rather than the canonical paid-status policy. |
| Seats/members | Firestore `families/{id}/seats` and tree collaborators | Family seat limit and tree collaborator limits were separate concepts in code. | The product policy was not written down clearly. |
| Storage | `storage.rules`, `canUpload` | Browser reported usage and server helper calculated a quota. | Exact storage reconciliation is not yet a complete server measurement system. |
| Collaboration | tree roles and invitation rules | Tree role and plan checks were separate. | Billing alone must never replace a tree role. |
| Downgrade | webhook status plus derived limits | Existing data was retained by Firestore rules. | Behavior for over-quota content and canceled periods was implicit. |
| Cancellation | `cancelAtPeriodEnd` synchronized from Stripe | The flag was stored. | Entitlement retention until period expiry needed an explicit policy. |
| Failed payment | `invoice.payment_failed` email path | Notification was sent; subscription status arrived from Stripe subscription events. | The paid-access policy for `past_due` was not centralized. |

## Paid-capability classification before Phase 2

- AI, OCR, translation, biography and photo operations consumed provider/server
  resources and already crossed a server action. Their missing piece was a
  canonical billing-status resolver before the atomic credit debit.
- PNG/PDF/GEDCOM generation was browser-side. The server could meter exports and
  enforce GEDCOM eligibility, but it could not prevent a user from running local
  JavaScript. GEDCOM remains data portability; visual premium presentation is a
  UX and server usage gate until generation is moved server-side.
- Tree roles, invitations, and family seats were Firestore-authorized and must
  continue to combine the tree role with the account/workspace entitlement.
- Firebase custom claims were not used as a paid-capability authority.

Phase 2 replaces the risky paths with a server price catalog, authenticated
customer mapping, atomic webhook ledger, ordering markers, a server-resolved
billing view, and a documented entitlement policy.
