# Route and Function inventory

Inventory from Phase 1 source; externally deployed Functions and third-party callers were not enumerated. No externally reachable endpoint is removed based on static references.

## App Router pages

| Route | Source | Access boundary |
| --- | --- | --- |
| `/admin/ai-configuration` | `src/app/admin/ai-configuration/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/ai-metering` | `src/app/admin/ai-metering/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/audit-logs` | `src/app/admin/audit-logs/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/billing` | `src/app/admin/billing/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/configuration` | `src/app/admin/configuration/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/messages` | `src/app/admin/messages/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin` | `src/app/admin/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/trees` | `src/app/admin/trees/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/admin/users` | `src/app/admin/users/page.tsx` | Admin UI gate; server actions verify caller (AI credentials require claims/super_admin) |
| `/contact` | `src/app/contact/page.tsx` | Public page |
| `/dashboard` | `src/app/dashboard/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |
| `/faq` | `src/app/faq/page.tsx` | Public page |
| `/features` | `src/app/features/page.tsx` | Public page |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Public page |
| `/guide` | `src/app/guide/page.tsx` | Public page |
| `/invite/[inviteId]` | `src/app/invite/[inviteId]/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |
| `/login` | `src/app/login/page.tsx` | Public page |
| `/` | `src/app/page.tsx` | Public page |
| `/pricing` | `src/app/pricing/page.tsx` | Public page |
| `/privacy` | `src/app/privacy/page.tsx` | Public page |
| `/profile` | `src/app/profile/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |
| `/settings/billing` | `src/app/settings/billing/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |
| `/settings` | `src/app/settings/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |
| `/signup` | `src/app/signup/page.tsx` | Public page |
| `/terms` | `src/app/terms/page.tsx` | Public page |
| `/tree/[treeId]` | `src/app/tree/[treeId]/page.tsx` | Firebase browser Auth and Firestore/Storage rules; callable checks where used |

No `src/app/**/route.ts` API handlers exist. `robots.ts` and deterministic `sitemap.ts` are public metadata routes. Next server actions are framework endpoints, not custom REST APIs.

## Server actions

| Source | Exported action | Boundary |
| --- | --- | --- |
| `src/app/actions.ts` | `handleSuggestName` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleGenerateBiography` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleFindRelationship` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleTranslateDocument` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleExtractDocumentText` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleEnhancePhoto` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleUploadProfilePicture` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleRecordExport` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/actions.ts` | `handleContactMessage` | Per-action token/credit checks; contact is public; legacy upload requires review |
| `src/app/admin/actions.ts` | `getAdminDashboardData` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAdminUsers` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `updateUserPlanByAdmin` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `grantBonusCreditsByAdmin` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `setPlatformAdminRole` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `toggleUserAccountStatus` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAdminTrees` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getSystemConfiguration` | Public configuration read; no token |
| `src/app/admin/actions.ts` | `saveSystemConfiguration` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAuditLogs` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getContactMessages` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `updateContactMessageStatus` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAdminBillingMetrics` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAdminAIMeteringData` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `getAdminReportData` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/actions.ts` | `searchAdminGlobal` | verifyAdminCaller (claims OR server-read profile fallback), except public getSystemConfiguration |
| `src/app/admin/ai-configuration/actions.ts` | `getAIConfiguration` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `saveAIControl` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `saveProvider` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `mutateCredential` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `testProvider` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `syncModels` | Verified Admin claims; credential/custom endpoint writes require super_admin |
| `src/app/admin/ai-configuration/actions.ts` | `testModel` | Verified Admin claims; credential/custom endpoint writes require super_admin |

## Firebase Functions

| Export | Source | Trigger / boundary |
| --- | --- | --- |
| `acceptInvitation` | `functions/src/index.ts` | Callable; auth, invited email, inviter owner/manager checked in transaction |
| `setTreeOwnerClaim` | `functions/src/index.ts` | trees/{treeId} write; intentionally inert deprecated trigger retained |
| `updateTreeMemberCount` | `functions/src/index.ts` | trees/{treeId}/people/{personId} write; Admin count aggregation |
| `sendInvitationEmail` | `functions/src/index.ts` | invitations/{inviteId} write; creates/resends email |
| `onUserCreated` | `functions/src/index.ts` | users/{userId} creation; welcome email |
| `createCheckoutSession` | `functions/src/stripeBilling.ts` | Callable; authenticated user, selected plan/price, subscription checks |
| `createPortalSession` | `functions/src/stripeBilling.ts` | Callable; authenticated Stripe customer |
| `addAIPack` | `functions/src/stripeBilling.ts` | Callable; authenticated subscription/add-on path |
| `stripeWebhook` | `functions/src/stripeWebhook.ts` | HTTP POST; raw-body Stripe signature, event deduplication |
| `weeklyActivityDigest` | `functions/src/scheduledTasks.ts` | Monday 09:00 UTC, user preference filtering |
| `inactivityReminder` | `functions/src/scheduledTasks.ts` | Daily 10:00 UTC |
| `planExpirationReminder` | `functions/src/scheduledTasks.ts` | Daily 11:00 UTC |

## Duplicates, drift and deferred endpoints

- Removed the empty `(auth)` layout route group: actual login/signup/forgot-password pages are siblings outside it. No URL changes.
- Slug/document-ID resolution differed between tree metadata and browser data loading; Phase 1 fixes the false missing-tree title. Anonymous private/missing metadata stays generic.
- `handleUploadProfilePicture` has no inbound source caller; working uploads use `src/lib/uploadPersonPhoto.ts` in the browser. The legacy server action imports a browser Storage SDK without browser Auth. It is retained because generated server-action/external use is not proven absent; do not replace it with unguarded Admin writes.
- `setTreeOwnerClaim` is an explicitly inert exported Function. Deleting it would alter deployed trigger inventory; obtain owner confirmation and a controlled Functions deployment first.
- Admin standard actions accept a server-read profile role fallback, whereas AI credential control requires verified claims. Preserved and documented; unifying authorization needs a separate role migration/review.
- `getSystemConfiguration` is public because shared banners/feature UI consume it. Do not place secrets in its stored shape.
- Callable errors use HttpsError; Next actions mix safe error objects and exceptions. Provider-backed action/email failures now redact raw messages, but a cross-product error protocol is deferred.
- Public tree visibility does not grant anonymous Firestore read access under current rules. Metadata may describe only explicitly public records, while the actual tree UI still requires sign-in. Public sharing/rules redesign is deferred.
- Stripe checkout success/cancel URLs remain caller-supplied where previously accepted; URL allowlisting and billing/entitlement reconciliation are Phase 2 review items, not silently changed here.
