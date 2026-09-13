# Phase 2 server-authoritative billing remediation

**Latest owner validation (2026-09-12): COMPLETE for the real monthly Family +
AI Pack -> Pro + AI Pack downgrade specimen.** Owner-executed payment recovery
and both final read-only harnesses passed. See the final lifecycle evidence
section below; earlier implementation and pending checkpoints are historical.

## Implemented

- Added a server-only Stripe product/price catalog. Checkout accepts logical
  plan/interval values and rejects arbitrary price IDs, invalid intervals,
  browser redirect URLs and malformed add-on selections.
- Bound Checkout and Portal identity to the verified Firebase caller and the
  canonical UID/customer mapping. Ambiguous customer recovery fails closed.
- Added duplicate subscription checks, server-generated return URLs, and
  server-authenticated AI Pack eligibility.
- Added a dedicated, idempotent Pro-to-Family upgrade instead of attempting a
  duplicate Checkout subscription. The browser submits only Family plus a
  monthly/yearly interval. Functions validates the current Pro subscription and
  approved active $9.99/$99 Family price, atomically claims the change, replaces
  only the base item with immediate proration and Stripe pending-update payment
  gating, and withholds Family membership/entitlement until an applied paid
  subscription event. Failure leaves Pro and the existing AI Pack authoritative.
- Closed the AI Pack payment-before-entitlement gap. The add-on callable now
  claims a persisted operation, uses one Stripe idempotency key across retries,
  requests immediate proration invoicing with pending-update payment behavior,
  and exposes a pending state until a qualifying paid invoice activates the
  1,000-action allowance. Subscription-item presence alone no longer grants
  credits; payment failure, removal, expiration and terminal base-plan state
  fail closed.
- Added customer-facing AI Pack removal with authenticated ownership checks,
  trusted Price metadata matching, a stable Stripe idempotency key and no
  proration/refund. It removes only the recurring add-on item while retaining
  already-paid access through `aiPackPaidThrough`; the Pro/Family base item and
  base cancellation state remain unchanged.
- Added customer-facing AI Pack renewal resume for the prepaid stopped-renewal
  window. The authenticated callable accepts no Stripe identifiers, validates
  the server allowlisted price and customer/subscription/Family ownership, and
  restores exactly one recurring item with `proration_behavior=none` and a
  idempotency key scoped to the paid period and persisted resume operation. It
  creates no immediate invoice, payment, refund, proration or grant;
  paid-through, allowance, usage, the base item and base cancellation state
  remain unchanged. Expired access must use the normal paid add flow.
- Added atomic webhook event claiming, safe ledger fields, supported-event
  filtering, out-of-order timestamp protection and idempotent AI Pack grant
  records.
- Added a canonical paid-status/entitlement resolver. `active` and `trialing`
  are paid; past-due and terminal states resolve to Free without deleting data.
- Hardened payment-failure handling around that resolver. `past_due`, `unpaid`,
  `incomplete`, `incomplete_expired`, `paused` and `canceled` never grant paid
  Pro or Family capabilities, even when the canonical commercial record still
  retains its historical paid plan. Billing Settings and Pricing expose a
  payment-attention state and a Stripe Portal path instead of an Active label.
  Recovery to an active/trialing status restores the effective entitlement from
  the same authoritative records without recreating workspaces, seats or grants.
  Pricing now selects an explicit recovery state before the effective Free
  purchase branches: both paid cards and AI Pack controls are non-actionable,
  canonical Pro/Family identity remains visible, and the ordinary Free/signup
  purchase messaging is hidden. Click handlers also stop before calling billing
  Functions while payment attention or authoritative loading is present.
  Existing billing signals restore normal controls after webhook recovery.
  All paid mutation callables reject `past_due`, `unpaid`, `incomplete`,
  `incomplete_expired` and `paused` with a stable Stripe Portal recovery error;
  user/Family authority and transactional operation claims are rechecked, and
  live Stripe status is checked before subscription/add-on mutations. Portal
  creation remains available. A failed Family pending update continues to leave
  active Pro authoritative; failure copy mentions AI Pack only when the resolved
  existing add-on is valid.
  The authoritative view exposes `past_due` as the exact entitlement reason for
  that state; other collection failures retain the generic payment-required
  reason or the existing terminal-state reason.
- Added a deterministic local Stripe Test Clock workflow for a true monthly
  renewal failure and recovery. A separate guarded helper creates a new
  clock-bound test Customer and approved Pro subscription, stages the attached
  failure method, advances renewal creation and collection as separate reviewed
  actions, and retries only the exact scoped open renewal invoice. The existing
  lifecycle harness stays read-only and adds a focused recovery assertion.
- Canonicalized scheduled cancellation across Stripe representations. The
  webhook uses the base Pro/Family item period, recognizes a matching Clover
  `cancel_at`, preserves a different future cancellation timestamp separately,
  and never uses the AI Pack period for cancellation or entitlement semantics.
- Changed the client entitlement hook to consume a verified server billing view;
  browser Firestore state is no longer billing authority.
- Tightened user and family Firestore rules so clients cannot write billing,
  usage, plan, family billing or entitlement authority fields. Profile edits
  remain allowed.
- Kept AI debit and visual export metering server-side. GEDCOM is authenticated
  server-side for every plan and is treated as data portability: it does not
  consume `exportsUsed`, require a paid plan, or add premium formatting.
  Browser-generated export bytes remain a documented portability/UX boundary
  until a server export service is approved.
- Family AI usage is debited from the server-owned Family workspace pool, and
  missing billing period data fails closed rather than granting stale paid access.
- Family AI Pack entitlement is derived from the matching owner's
  `users/{uid}.billing` subscription state. This preserves an already-paid
  Pro-era AI Pack when the base item becomes Family, including stopped renewal
  through its future paid-through timestamp, without creating a second payment
  or grant. Owner and member views and server debits resolve the same pooled
  allowance; genuinely pending or expired owner state remains at the 600-action
  Family base allowance. A present owner snapshot with a mismatched Stripe
  customer/subscription clears the derived add-on state rather than trusting a
  stale Family copy; missing owner metadata remains eligible for reconciliation.
- A non-entitled base subscription cannot use an AI Pack to keep paid plan
  features alive. Existing prepaid AI Pack fields may remain in the canonical
  billing record for recovery history, but effective allowance and AI
  operations fail closed until the base subscription is entitled again. A new
  or failed AI Pack payment remains pending/inactive, does not extend
  `aiPackPaidThrough`, and does not create a grant.
- Pricing offers the owner-confirmed, end-of-period Family-to-Pro downgrade
  through a confirmation dialog and displays Scheduled/Keep Family Plan.
  Billing Settings shares these controls; Family remains Current Plan until
  the actual Stripe base Price changes.
- Storage Rules now select server-owned personal billing or the Family
  storage-authority projection on the owner's user document. Tree uploads read
  only tree + owner user documents; avatars read only the user. Positive growth
  checks use the conservative known personal/shared floor; equal/shrinking
  replacements and authorized deletes remain available above quota.
  Current upload/delete paths do not atomically maintain those counters, so
  exact quota enforcement and reconciliation—including the shared Family
  100 GB pool—remain deferred to Phase 3/4.
- Added an admin billing reconciliation-health view and updated pricing values
  to the current product structure.

## Policy decisions

- Free collaboration allows two non-owner collaborators, with at most one
  Editor and the remaining collaborator(s) as Viewers. Trusted invitation
  creation and acceptance transactions enforce the policy; existing tree role
  controls continue to govern read and edit access.
- Family seats are six account seats and are distinct from tree collaborators.
  Paid Family activation creates one server-owned owner seat. Customer-facing
  add/remove operations and transactional capacity enforcement for the other
  five seats remain an explicit gap; clients can no longer write seat membership
  directly.
- A Family-to-Pro webhook update preserves Family workspace data, usage, seats,
  trees, people and content. End-of-period/no-refund scheduling is implemented
  through the guarded application callable. The real monthly Family + AI Pack
  -> Pro + AI Pack lifecycle is now owner-validated, including payment-gated
  renewal and automatic applied-schedule release.
- Storage Rules use server-owned user usage and a projected known Family floor;
  trusted upload preparation refreshes authority, but the current counters are not
  atomically maintained by every upload/replacement/delete path; full byte
  reconciliation remains a Phase 3/4 data-integrity item.
- Owner-approved policy decisions are implemented: GEDCOM import/export is
  available on Free, Pro and Family without consuming visual export allowance;
  Free collaboration permits one Editor plus one Viewer, or two Viewers, per
  tree. GEDCOM and tree collaboration remain independent of Family account
  seats.
- No live production charges are part of this change. Test-mode lifecycle
  validation is required before approval.
- Payment-failure policy is an owner-approved fail-closed decision: there is no
  unpaid grace period. Family workspace documents, seats, trees, people, media
  and historical usage remain stored while paid access is paused. The separate
  disposable-account failure and recovery procedure is recorded in
  `LOCAL_STRIPE_LIFECYCLE_TEST.md`; the currently successful Family + AI Pack
  Sandbox account must not be used for intentional declines.

## Validation record

The code and documentation are prepared on `feat/phase2-billing-entitlements`.
Root and Functions checks must be run from clean installs under the declared
Node 20 Functions runtime. The accepted Phase 1 dependency baseline remains:

| Audit | Total | High | Critical |
| --- | ---: | ---: | ---: |
| Root | 67 | 12 | 0 |
| Root production | 62 | 7 | 0 |
| Functions | 9 | 0 | 0 |

The seven production-high Genkit/OpenTelemetry findings remain owner-accepted
for this release under the existing compensating controls. No audit ignore,
override or broad suppression was added.

## Local verification evidence

The following is an earlier implementation checkpoint. Its test counts are
historical; the final owner validation below records root 274/274 and Functions
212/212, including the clean-shell root rerun.

- Root `npm run typecheck`: passed.
- Root `npm run lint`: completed with the repository's existing warnings and no errors.
- Root `npm test`: passed 166 tests with 0 failures, including the Family
  lifecycle validation, scheduled-cancellation,
  authoritative allowance, live AI Pack Pricing synchronization,
  paid/pending/scheduled-removal AI Pack, payment-attention/fail-closed and
  GEDCOM accounting coverage.
- Test Clock coverage adds nineteen local-only safety and workflow tests for
  explicit actions/IDs, protected-account refusal, demo-emulator/test-key
  boundaries, approved Pro Price validation, Clover period selection, strict
  draft/open renewal-invoice scoping, generated failure/success PaymentMethod
  verification, legacy staged failure-method compatibility, rejection of Visa
  4242 and arbitrary cards for failure simulation, mismatched defaults, wrong
  Customer/subscription scope, live-mode objects and partial/wrong markers, and
  separation from the read-only lifecycle harness. No Stripe API action or
  emulator mutation is performed by these tests.
- Eight focused Pricing tests render the actual page with synthetic
  authoritative views and local callable doubles. They cover Pro/Family
  payment attention, non-actionable paid cards/add-ons, canonical identity,
  suppression of ordinary Free purchase messaging, normal active actions,
  authoritative reload guards, automatic recovery on rerender, and conditional
  Family-upgrade failure copy. Paused Family authority also has a server-view
  regression test. No external service is contacted.
- Functions `npm run build`: passed under the compiled Node 20-targeted source.
- Full Functions regression suite: passed 141 tests with 0 failures through the
  direct compiled Node test run (the package wrapper is restricted below), including the Family lifecycle validation,
  Clover cancellation, webhook ordering, AI Pack add/removal payment gating,
  concurrent callable idempotency, checkout, email, configuration and collaboration
  coverage.
- The package `npm test` wrapper completed its TypeScript build, then its
  `tests/run.cjs` child-process launch was rejected with `spawn EPERM` in this
  restricted Windows session. Running all seven test files directly in
  the same process completed 141 tests successfully.
- Sixteen focused callable regressions cover all paid mutations for both
  canonical plans across five payment-attention statuses, unchanged persisted
  billing/workspace state, a linked Family member, stale canonical versus live
  Stripe status, unreconciled Checkout subscriptions, transactional claim
  rechecks, Portal recovery availability, and unchanged failed Family
  pending-update behavior. Existing active Pro/Family lifecycle cases pass.
- Webhook ordering regression coverage includes sequential newer-then-older,
  concurrent older/newer, equal timestamps, user billing, and Family billing;
  all persisted-state assertions pass.
- Family upgrade coverage verifies monthly/yearly server price authority,
  rejection of the obsolete $99.99 amount, immediate prorated pending updates,
  one base item, unchanged AI Pack and paid-through state, unchanged usage,
  concurrent-call idempotency, failure without workspace elevation, paid
  webhook activation, one owner seat, no add-on grant for a base-only invoice,
  and downgrade data preservation.
- Family AI Pack regression coverage verifies owner-paid state survives the
  Family projection, owner and linked-member views resolve 1,600 pooled
  actions, two seats debit one counter, stopped-renewal/prepaid access remains
  active, expired and genuinely pending state returns to 600, and Family
  Pricing cannot invoke an immediate Pro mutation.
- Payment-failure coverage verifies every non-entitled Stripe status fails
  closed while preserving canonical Family/workspace data, that payment
  attention and entitlement reason are exposed, that recovery restores the
  1,600 pooled Family allowance without a new grant, and that the disposable
  harness exposes `PaymentAttention`, `PastDue` and `EntitlementFailClosed`
  read-only checks. `past_due` now reports that exact entitlement reason, and
  the harness also exposes a read-only `RecoveryActive` check. AI Pack
  pending/failure cases retain Pro 200 or Family 600 and create no +1,000 grant.
- Gitleaks found no secret in the tracked/untracked Phase 2 change set. A raw
  directory scan also reported the two expected Stripe Sandbox values in the
  ignored, untracked `functions/.secret.local` file (`stripe-access-token` and
  `generic-api-key`); these local test credentials are intentionally outside the
  change set and no ignore or suppression was added. The earlier full-history
  scan still reports the three documented public Firebase browser-key findings;
  no private billing or AI credential was added to source.
- Root production build passed in the current correction pass, including
  TypeScript and all 30 static pages. The initial sandbox attempt compiled but
  its TypeScript worker hit `spawn EPERM`; the same local build completed with
  approved worker access. Earlier exact `npm ci` reached the sandbox's blocked
  process-spawn path (`spawn EPERM`). The required clean-install behavior was
  also verified with `npm ci --ignore-scripts` after the failed cleanup; no
  package manifest or lockfile changed.
- Functions exact `npm ci` hit the same restricted process-spawn path; the
  dependency tree was restored with `npm ci --ignore-scripts`, after which the
  Functions build and direct billing tests passed.
- The local Stripe Sandbox lifecycle has validated Checkout and Customer Portal
  behavior through future scheduled cancellation on the isolated emulator
  account. Terminal cancellation/deletion remains a separate lifecycle step.
- Focused AI Pack tests persist and inspect pending, active, failed-payment,
  duplicate webhook, duplicate/concurrent callable, out-of-order,
  scheduled-removal, renewal-resume, expiration, terminal-cancellation and
  Family pooled state. Resume coverage verifies the no-charge/no-proration
  Stripe request, exact-once item restoration, stable retry key, unchanged
  paid-through/grants/base cancellation, Pro and Family allowances, browser
  input rejection, expired-state rejection, live UI behavior and Pricing's
  stopped-renewal state.
  The real Sandbox AI Pack add/remove/resume lifecycle completed successfully.
  The real disposable Sandbox upgrade is now active monthly Family with exactly
  one Family base item and one recurring AI Pack item, 1,600 effective pooled
  actions, one owner seat, grant count unchanged at two, unchanged
  `aiPackPaidThrough`, no scheduled base or add-on cancellation, no pending
  invoice items and no draft invoices. The correction derives this state from
  the existing owner billing record; no Stripe or emulator state was changed
  while implementing or validating the fix. No intentional payment failure,
  emulator reset/reseed, deployment, commit or push was performed for the
  payment-failure preparation pass.
- The Test Clock helper guard now
  validates the generated PaymentMethod rather than comparing it to Stripe's
  reusable fixture alias. Future staging writes a non-secret helper-owned scope
  marker; the existing unmarked staged object is accepted only when a fresh
  read-only Stripe retrieval proves the same defaults, exact disposable
  Customer, test mode, Visa and Stripe's documented `0341`
  decline-after-attach card. The implementation and automated validation pass
  did not advance the Test Clock, change a payment method, create Stripe
  objects, or mutate Stripe or Firebase.
  The earlier guard-correction read-only checkpoint confirmed
  clock `ready`, subscription `active`, both defaults equal to
  `pm_1UEeTSFLueI9mUztJAekyWFN`, test-mode Visa ending `0341`, no partial helper
  marker, `failingMethodVerified=true`, and `safeToAdvanceRenewal=YES`. The
  emulator remained canonical/effective Pro with allowance 200 and no payment
  attention; that correction pass did not advance the renewal boundary.
- The owner subsequently confirmed the real true-renewal lifecycle passed on
  `phase2-pastdue@example.test`: active Pro/200, failed renewal, canonical
  Pro/`past_due` with effective Free/10 and payment attention, then successful
  payment-method installation and payment of the exact failed renewal invoice.
  The same subscription returned to active Pro/200. The Pricing correction pass
  did not rerun that lifecycle, advance any clock, call Stripe APIs, or read or
  mutate Firebase Emulator data. Its browser-state and callable regression tests
  use synthetic local doubles.

The dependency audit baseline above is preserved verbatim from Phase 1. This
remediation does not claim a green audit or change those accepted residual
counts.

## Family-to-Pro scheduling correction (September 11, 2026)

**Historical implementation checkpoint.** Pending owner checks and test counts
below describe this September 11 pass. The completed monthly Family + AI Pack
specimen is recorded in the final owner-validation section; this checkpoint is
not its current lifecycle status.

Implemented Stripe-native Subscription Schedules on the same customer and
subscription. Authenticated schedule/cancel callables accept no browser Stripe
IDs, preserve monthly/yearly interval, require active renewing Family ownership,
and block every payment-attention state. Current Family phase/AI Pack items are
retained, only the future base Price changes to Pro, and all prorations are none.
No immediate refund, credit or invoice. Keep Family Plan releases the schedule
and preserves normal Family renewal. Operations have stable per-subscription
claims/idempotency keys; foreign or unreconciled schedules fail closed.

Canonical scheduledPlan/Interval/ChangeAt/ChangeType/ChangeStatus are a trusted
projection. The authoritative view exposes only safe customer-facing fields;
Pricing and Settings share confirmation, busy/error and scheduled/cancel UI,
using the existing live signals. Cancel the downgrade before changing AI Pack
renewal, preventing conflicting schedule phases. Once Stripe applies Pro,
transactional fresh reconciliation clears scheduled fields, releases the applied
schedule, preserves workspace/membership/data and disables Family paid seats.
The owner receives Pro/200 or valid Pro+Pack/1200; pending/failed Pack stays
inactive, prepaid stopped Pack expires on its existing date. A later Family
upgrade reuses the workspace/seat records and preserves paid-through state.
Existing collaborators remain; new mutations use Pro's 10 limit. Storage carries
forward a conservative known pool-usage floor, with Pro 50 GB rules/deletes
preserved; exact byte maintenance and Family reconciliation remain Phase 3/4.

Twenty-eight new Functions cases exercise actual persisted state, including
mapping, unchanged Family entitlement, schedule concurrency/retry recovery,
cancel idempotency, ownership/input rejection, all five payment-attention states,
Portal recovery, recurring/prepaid/pending/no Pack, workspace and seat
preservation, loss of member paid elevation, Pro mutation limits, out-of-order
and equal-second webhook delivery, transaction conflict re-fetch, stale-state
reconciliation, renewal failure/recovery and returning to Family. Ten new root
cases cover confirmation/payloads/live UI and guarded staged helper scopes.

Validation: root typecheck and 166 tests pass; lint has 0 errors/50 existing
warnings. Functions build and 141 direct tests pass; package npm test compiled
successfully then hit the known child-spawn EPERM (seven files). Local production
build compiled but hit sandbox worker EPERM; the permitted retry completed
successfully with 30 generated pages. Final `git diff --check` passed. Gitleaks change-set scan copied 70 modified or
untracked source paths and found no leaks. Ignored .secret.local was excluded.
The PowerShell harness and staged JavaScript helper also parse successfully.

The NEW disposable-account Test Clock workflow is prepared in the local runbook;
no new Stripe/Firebase operation, clock advance, email, deployment, commit, push
or merge was performed. The earlier completed lifecycle evidence remains intact.
Real schedule/no-immediate-invoice/cancel/period-boundary checks are still pending
owner execution. No dependency/lockfile or production configuration changed.

Files changed in this scheduled-downgrade pass (earlier uncommitted work retained):

- Functions source: `functions/src/billingSchedules.ts`,
  `functions/src/familyDowngrade.ts`, `functions/src/stripeWebhook.ts`,
  `functions/src/stripeBilling.ts`, `functions/src/billingCatalog.ts`,
  `functions/src/index.ts`.
- Functions tests: `functions/tests/familyDowngrade.test.cjs`,
  `functions/tests/index.test.cjs`, `functions/tests/stripeWebhook.test.cjs`.
- App/view: `src/app/billing/actions.ts`, `src/app/pricing/page.tsx`,
  `src/app/settings/billing/page.tsx`,
  `src/components/billing/FamilyDowngradeControls.tsx`,
  `src/hooks/useEntitlements.ts`, `src/lib/billing/types.ts`,
  `src/lib/billing/entitlements.ts`.
- Local harness/tests: `scripts/phase2-lifecycle.ps1`,
  `scripts/phase2-emulator-report.mjs`,
  `scripts/phase2-family-downgrade-test-clock.mjs`,
  `scripts/phase2-family-downgrade-test-clock.test.cjs`,
  `scripts/family-downgrade-ui.test.cjs`, `scripts/family-lifecycle.test.cjs`,
  `scripts/pricing-payment-attention.test.cjs`.
- Billing docs: `DOWNGRADE_POLICY.md`, `BILLING_ARCHITECTURE.md`,
  `STRIPE_WEBHOOKS.md`, `LOCAL_STRIPE_LIFECYCLE_TEST.md`,
  `PHASE2_REMEDIATION_REPORT.md` in `docs/billing/`.

## Partial Subscription Schedule correction (September 11, 2026)

**Historical partial-schedule checkpoint for the earlier Family-only specimen.**
The pending checks below describe that correction pass, not the final completed
Family + AI Pack specimen. Later applied-Pro checkpoints and the final owner
validation remain separate evidence.

Owner evidence supersedes the pending initial scheduling checkpoint above: a
schedule was created, but its future Pro phase was not configured. Actual repair,
cancel and phase transition are still pending owner execution. The correction
preserves all earlier uncommitted Phase 2 work and all real Sandbox objects.

Verified request construction defect: the previous `downgradePhases` copied the
entire response `automatic_tax` object into both update phases. The current
Stripe response contains `{ disabled_reason: null, enabled: false, liability:
null }`. `disabled_reason` is a response-only field absent from the supported
update parameter type. The old update therefore constructed the invalid
`phases[0][automatic_tax][disabled_reason]` and
`phases[1][automatic_tax][disabled_reason]` parameters. It also copied read
invoice-setting objects wholesale, with the same response/request-shape risk.
Writable fields are now mapped explicitly, with IDs normalized and absent/null
optional properties omitted. Unsupported non-null phase invoice customization
fails closed instead of being silently dropped.

The successful Stripe call was
`subscriptionSchedules.create({from_subscription:
'sub_1UEhOAFLueI9mUzt2c4H2m3L'})`, using the persisted
`kr-family-pro-create:<subscription>:<operation>` key. Stripe's creation event
`evt_1UEhn5FLueI9mUztXtWHyMl1` identifies request `req_1PdDox8plrEjIZ`, matches
that key and the unchanged attached schedule. Its metadata is empty because
`from_subscription` creation cannot also set phase/metadata parameters.

The next constructed call was
`subscriptionSchedules.update('sub_sched_1UEhn5FLueI9mUztf9fJ7EIR', payload)`.
The intended payload used `end_behavior=release`, request/current/future
`proration_behavior=none`, Family phase start/end 1789182728/1791774728,
Family Price `price_1SqLVSFLueI9mUztPucoRA0h`, quantity 1, and future Pro Price
`price_1Spd9RFLueI9mUztoNjc5HqO` starting at 1791774728, with duration month/1
and owner/subscription/workspace metadata. Both phases additionally contained
the invalid response-only tax field above. The original catch discarded Stripe's
error details and the available Functions logs retain no Stripe HTTP error
response. Consequently the exact original HTTP status/code/message and failed
request ID cannot be asserted from observed logs. The invalid reconstructed
payload is verified; attributing the remote rejection to that field is an
inference from the supported API contract, not a newly observed API error. No
POST was replayed to obtain it. New failures log sanitized stage/type/code/
parameter/request ID/status, never raw messages, bodies, recipients or secrets.

Chosen failure design B retains the same object and enough trusted state to
resume it. Before phase update, a Firestore transaction persists an exact
server-owned recovery receipt (ID, operation, UID/customer/subscription/workspace,
test/live mode, full/configuration fingerprints). A lost create response or this
legacy partial is recovered only by GET-only creation-event evidence matching
the saved operation and full unchanged schedule snapshot. Creation events are
wall time, not the frozen Test Clock object creation time; retrieval is bounded
to 10 pages and Stripe's 30-day retention, otherwise fails closed. Retry never
calls create for an attached schedule. It updates the same phase array to exactly
Family plus one same-interval Pro phase, preserves quantity/AI Pack, and uses a
v2 configure key rather than replaying the invalid v1 cached request. No automatic
compensating release occurs, especially for a schedule predating the request.

Repair requires exact authenticated owner/customer/subscription/workspace,
correct environment mode, unchanged trusted snapshot, exactly one Family-only
phase mirroring the live item graph, no future phase, active renewing Family and
the period boundary still in the future. Foreign ownership, missing provenance,
edited metadata/settings/items, conflicting phases, unexpected Price, terminal
status or payment attention are rejected. Keep Family can explicitly release a
verified partial by safely switching its scoped claim; it never cancels the
subscription. A valid scheduled downgrade still releases normally. The existing
generic error/retry UI is retained; it never claims a one-phase object is scheduled.

Fresh reconciliation distinguishes scheduled, owned partial, actual applied
Pro, known terminal states and unknown/external conflict. User and Family
scheduled fields stay null for partials; only a fresh live verified future Pro
phase publishes the date. Reconciliation does not append phases or auto-repair
partials. Applied-Pro cleanup additionally verifies the owned full phase graph.
Out-of-order/equal-timestamp events reconstruct live state, preserve the ledger
and cannot manufacture a scheduled downgrade from schedule existence.

The exact read-only helper checkpoint reports the current schedule owned and
repairable, future phase count 0, scheduled downgrade unverified, and
`safeToRetryScheduling=YES`. It remains active monthly Family, with one owner
seat, no AI Pack, null scheduled fields, the same sole invoice
`in_1UEhOAFLueI9mUztKql8QNGT`, refund total 0 and unchanged ready clock/frozen time.
Section 18 of LOCAL_STRIPE_LIFECYCLE_TEST.md records every requested status field,
the exact current-object read-only command and the conditional single owner UI
retry. No Stripe/Firebase data mutation or real retry occurred in this pass.

Twenty-one new Functions cases (49 scheduling cases total) and three new root helper
cases cover Clover response mapping/v2 key, configuration failure with persisted
Family/null state, same-object repair with no duplicate create/phase or immediate
billing API, legacy receipt recovery, missing/external provenance, mode/scope,
Price/future/settings/metadata/terminal conflicts, an external edit detected by
the final live reread immediately before configuration, safe partial Keep Family,
out-of-order partial projection and terminal/conflict reconciliation. Existing
monthly/yearly, recurring/prepaid/pending AI Pack, payment-attention, ledger,
concurrency, cancel and downgrade/return-to-Family cases remain.

Validation: root typecheck passes, lint has 0 errors/50 existing warnings and
169/169 tests pass. Functions builds pass and all 162/162 tests pass directly
in-process under the declared
Node 20.20.2 runtime. npm test builds but its seven-file wrapper hits
sandbox spawn EPERM. Root production build compiled, then hit sandbox worker
EPERM; the permitted outside-sandbox local retry passed with 30 generated pages.
Final `git diff --check` passes. Gitleaks scanned all 70 modified/untracked
source paths, with no leaks or new
suppression. Ignored local secrets/emulator logs were not copied. Node 20.20.2
also completed the exact read-only status checkpoint using the existing local
binary; npm exec's offline runtime lookup hit ENOTCACHED, so no runtime/package
installation was attempted. Dependency and lockfile diffs remain empty.

Files changed by this correction (earlier changes remain uncommitted):

- Source: `functions/src/billingSchedules.ts`, `functions/src/familyDowngrade.ts`,
  `functions/src/stripeWebhook.ts`.
- Tests/helper: `functions/tests/familyDowngrade.test.cjs`,
  `scripts/phase2-family-downgrade-test-clock.mjs`,
  `scripts/phase2-family-downgrade-test-clock.test.cjs`.
- Documentation: `docs/billing/BILLING_ARCHITECTURE.md`,
  `docs/billing/STRIPE_WEBHOOKS.md`, `docs/billing/DOWNGRADE_POLICY.md`,
  `docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md`, this report. The runbook's two
  pre-existing invalid punctuation bytes were normalized to UTF-8 preserving text.

No dependencies/lockfiles, production configuration, credentials, Stripe or
Firebase Emulator data changed. No clock advance, reset/reseed, outbound email,
deployment, commit, push or merge. No new CI/deployment result is claimed.

API basis: [Stripe schedule creation](https://docs.stripe.com/api/subscription_schedules/create),
[schedule updates](https://docs.stripe.com/api/subscription_schedules/update),
[event retrieval/retention](https://docs.stripe.com/api/events/list), and the
installed Stripe 20.4.1 `SubscriptionScheduleUpdateParams.Phase` writable types.

## September 12 correction: authoritative billing toast feedback

Status: implemented locally; all earlier uncommitted Phase 2 work is retained.
No commit, push, deployment, merge, dependency/lockfile change, real Stripe
mutation, clock advance, emulator reset/reseed or outbound email. The current
already-applied Family-to-Pro specimen was not changed or revalidated by a real
reconciliation call. Browser/assistive-technology confirmation and remote CI
for these uncommitted changes remain pending.

The existing Radix system now renders neutral success/error surfaces with
green/red icon and title accents, readable light/dark text, reduced-motion
animation, automatic and visible keyboard/manual dismissal, polite success and
foreground error announcements, and bounded mobile bottom stacking. Pricing,
Billing Settings and Family downgrade controls share one session tracker and
one root authoritative observer. It announces Pro, Family, paid AI Pack,
Pack stop/resume, scheduled downgrade, retained Family, effective Pro transition
and actual payment recovery only from confirmed server state. No raw exception
text or Stripe identifiers are displayed. Portal return alone cannot prove a
payment-method update, so that unsupported success claim is withheld.

Accepted requests show processing/Confirming, not success. The shared read
dispatch marker excludes stale responses, even if dispatched in the same
millisecond as acceptance. Loading/errors/account mismatches cannot confirm an
action. At 45 seconds feedback offers Refresh status; ambiguous failures retain
safe confirmation state instead of assuming Stripe made no change. Routine
usage synchronization, repeated billing signals and reloads do not repeat
success. Session storage holds only minimal display/feedback state and is
cleared on logout/account switch; canceled checkout feedback ends quietly.

Applied-Pro schedule release is followed by one bounded fresh transactional
Stripe reread. Only detached, verified `released` state publishes the server
confirmation boolean. Keep Family waits for that boolean; observed Family-to-Pro
waits for release first. The current already-Pro baseline receives no misleading
duplicate toast when later cleanup finishes. No notification triggers automatic
Stripe mutation or bypasses existing payment/owner controls.

New tests cover activation/Pack confirmations, independent checkout/Pack goals,
schedule/keep release gating, stop/resume, Pro/Family payment recovery, definitive
and ambiguous failures, 45-second delay, stale/same-millisecond reads, repeated
signals, session reload/redirect/account reset, an intent preceding the global
baseline, canceled checkout, initial/background silence, existing payment guards,
actual observer wiring and actual toast/feedback props. Accent contrast is
checked against the configured light/dark backgrounds (WCAG AA >=4.5:1).
Functions tests verify final persisted confirmation for successful cleanup,
failed release and POST success without detachment; rereads remain bounded.

Final local validation:

| Check | Result |
| --- | --- |
| Root `npm run typecheck` | Pass, 0 errors |
| Root `npm run lint` | Pass, 0 errors; 50 existing warnings |
| Root `npm test` | 200/200 pass; 31 new notification/component cases |
| Root production build | Pass, 30 pages; sandbox worker EPERM resolved by permitted local outside-sandbox build |
| Functions `npm run build` | Pass |
| Functions Node 20.20.2 suites | 165/165 pass, both in-process and the existing seven-file worker wrapper outside the sandbox; 3 new persisted release-confirmation cases |
| Functions plain sandbox `npm test` | Build passed, wrapper worker spawning hit EPERM; successful Node 20 wrapper retry above |
| `git diff --check` | Pass |
| Gitleaks current source | 316 tracked/untracked current source files, no leaks, exit 0; default rules retained and no new suppression |
| Dependencies and locks | No diffs |

Current-source scanning copied the current tracked and nonignored untracked
files, including docs/templates/locks, into a checked temporary directory. No
old Git objects, ignored local credentials or emulator logs were reused. The
scan directory was safely removed afterward. This is a source scan, not a new
history-remediation claim or an npm-audit-clean claim. Existing accepted audit
findings and product policies remain unchanged.

Files touched by this notification correction (earlier Phase 2 changes remain):

- Billing UI: `src/app/pricing/page.tsx`, `src/app/settings/billing/page.tsx`,
  `src/components/billing/FamilyDowngradeControls.tsx`;
  new `src/components/billing/BillingActionFeedback.tsx` and
  `src/components/billing/BillingNotifications.tsx`.
- Confirmation/session logic: new `src/lib/billing/notificationTracker.ts`,
  `src/lib/billing/notifications.ts`, `src/lib/billing/notificationFreshness.ts`;
  `src/hooks/useEntitlements.ts`, `src/app/billing/actions.ts`,
  `src/lib/billing/types.ts`, `functions/src/stripeWebhook.ts`.
- Existing notification system/root wiring: `src/components/ui/toast.tsx`,
  `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts`, `src/app/layout.tsx`.
- Tests: new `scripts/billing-notifications.test.cjs` and
  `scripts/billing-toast-ui.test.cjs`; `scripts/billing.test.cjs`,
  `scripts/family-downgrade-ui.test.cjs`,
  `scripts/pricing-payment-attention.test.cjs`,
  `functions/tests/familyDowngrade.test.cjs`.
- Docs: `docs/billing/BILLING_ARCHITECTURE.md`,
  `docs/billing/STRIPE_WEBHOOKS.md`,
  `docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md`, this report.

The viewport's transparent padding does not intercept underlying controls;
toast cards remain interactive for dismissal. Browser positioning and actual
screen-reader announcements still require the owner smoke tests in the runbook.
Implementation follows the installed API and
[Radix Toast accessibility/duration/type guidance](https://www.radix-ui.com/primitives/docs/components/toast).

## Final applied Family-to-Pro reconciliation integration (September 12)

Status: implemented and validated locally. All prior uncommitted Phase 2 work
remains. No real Stripe/Firebase Emulator mutation, release/update/cancel, clock
advance, reset/reseed, outbound email, dependency/lockfile change, deployment,
commit/push/merge. The real current account was inspected with reads/GETs only.

**Runtime finding (A versus B):** scoped Stripe events and Emulator ledger show
the actual Pro subscription transition at 05:11:06 UTC, processed by the old
05:03 worker and marked failed at 05:11:08.401 UTC. That worker was retired at
05:24:52 UTC, before the final 05:27:45 source update and later 14:15 reload.
Thus an earlier build was running (A). The available generic handler-error log
does not identify the underlying exception, so a specific Stripe failure or
event-order cause is not claimed. The failed ledger entry and unconfirmed
attached schedule explain why cleanup was not completed; no app caller was
available to invoke scoped reconciliation. Current subscription, schedule and
invoice webhook routing is exercised by successful automatic-release tests;
no remaining routing defect was reproduced (B is not established). Future
eligible events auto-release when the runtime has loaded current code and Stripe
allows release; the actual current object was not retried during this task.

**Real read-only gate:** current `sub_sched_1UEjA4FLueI9mUztFQF4OnxL` is active
and structurally applied_pro; ownership verified, current Pro/month, zero future
phases. `appliedDowngradeDetected=true`, `appliedScheduleReleaseEligible=true`,
`scheduleReleaseNeeded=true`, `safeToReconcileAppliedSchedule=YES`. Canonical
Pro/active, scheduled plan/date null, retained paid seats false/seat count 1 and
refund total zero. The expected customer, subscription and workspace match.
Original Family and normal boundary-renewal invoice IDs are recorded in the
runbook; no new invoice or post-cleanup pass is claimed.

Release eligibility now separates structural detection from permission: exact
scope/clock/UID, verified active attachment, approved Pro base and same-interval
two-phase Family-to-Pro history, quantity 1 and approved add-on graph, no future
phase/pending update/cancellation, matching operation metadata/server receipt,
matching workspace mappings/inactive seats and test/live catalog evidence. A
missing, inactive, foreign or conflicting case reports NO. The read-only helper
adds the four requested fields and never releases. Server cleanup uses the
same structural safety gates plus authoritative mapping/receipt checks.

Billing Settings now exposes a contextual **Refresh billing status** action
through `ScheduledBillingReconciliation`. A synchronous click guard prevents
duplicate invocations; the existing Functions client sends only `{}` to the
unchanged authenticated `reconcileScheduledBilling` definition. The server
derives the subscription. Mount, ordinary refreshes, timers and live reads cannot
invoke a mutation. After request acceptance, a new authoritative read must prove
released/detached state and active Pro before neutral **Billing status refreshed**.
Pending or ambiguous results offer read-only Refresh status. Current already-Pro
cleanup generates no duplicate plan-change toast; all existing toast tests pass.

The per-target transaction, event ledger, release key
`kr-family-pro-complete:<scheduleId>` and bounded fresh reread remain. Release
creates no customer, subscription, invoice, refund or proration; same workspace,
membership, genealogy and usage are retained. Pro/200, collaborator limit 10 and
50 GB remain; paid Family seats stay inactive. The untouched read-only lifecycle
harness still requires Stripe schedule clearance before a ProAfter downgrade
pass. Exact status command and **one** gated owner UI action are in
LOCAL_STRIPE_LIFECYCLE_TEST.md.

Changed files in this correction:

- Source: `functions/src/billingSchedules.ts`, `functions/src/stripeWebhook.ts`,
  `scripts/phase2-family-downgrade-test-clock.mjs`,
  `src/app/settings/billing/page.tsx`; new
  `src/components/billing/ScheduledBillingReconciliation.tsx`.
- Tests: `functions/tests/familyDowngrade.test.cjs`,
  `scripts/phase2-family-downgrade-test-clock.test.cjs`; new
  `scripts/scheduled-billing-reconciliation-ui.test.cjs`.
- Docs: `docs/billing/BILLING_ARCHITECTURE.md`,
  `docs/billing/STRIPE_WEBHOOKS.md`, `docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md`,
  this report. No lifecycle harness, callable definition or dependency change.

New coverage: 32 helper cases for positive scope/catalog/provenance and negative
foreign/future/wrong mappings/UID/Price/interval/mode/quantity/receipt/payment/
pending gates plus detached no-op; 8 actual UI cases for explicit empty payload,
no mount mutation, click deduplication, fresh confirmation, retained attachment,
delayed/read-only refresh and safe errors/account/payment restrictions;
14 Functions cases for scoped authentication, idempotent release, fresh persisted
authority, preserved Pro/workspace/inactive seats, unsafe no-release cases and
future subscription/schedule/invoice webhook routing with duplicate delivery.

Final validation:

| Check | Result |
| --- | --- |
| Root typecheck | Pass, 0 errors |
| Root lint | Pass, 0 errors; 50 existing warnings; new reconciliation component has no warnings |
| Root tests | 240/240 pass (40 new helper/UI cases); existing notification tests remain passing |
| Root production build | Pass, 30 pages after permitted local outside-sandbox worker retry; initial sandbox compile passed then worker spawn EPERM |
| Functions build | Pass |
| Functions sandbox `npm test` | Build passed; seven-file worker wrapper hit spawn EPERM |
| Declared Node 20.20.2 suites, directly in-process | 179/179 pass (14 new Functions cases) |
| `git diff --check` | Pass |
| Gitleaks current source | 318 current tracked/nonignored untracked files, no leaks, exit 0; no new scanner suppression |
| Dependency/lockfile diffs | Empty |

Final GET/read-only status again proves the same active applied schedule,
customer/subscription/workspace, active Pro, inactive Family seats, unchanged two
invoice IDs and zero refunds. All four safety fields remain true/YES. The
temporary source-scan copy was removed only after its exact absolute path was
verified within the workspace; no ignored credentials/logs, stale Git objects or
old history were reused. This is not an audit-clean or new remote CI claim.

The real cleanup and post-cleanup harness pass remain owner-executed steps. Run
the exact read-only status command in the local runbook first. Only when its
fresh gate is YES and current built code is loaded: local sign-in as the
disposable owner -> `/settings/billing` -> **Refresh billing status** once.
No Stripe API/Dashboard or direct callable-HTTP construction is required.

## Family + Pack -> Pro + Pack renewal boundary correction (2026-09-12)

**Historical implementation/pre-recovery checkpoint.** The owner subsequently
completed recovery and both final harnesses; the final lifecycle evidence below
supersedes the pending/draft/attached state in this checkpoint.

Completed locally on `feat/phase2-billing-entitlements`, preserving the existing
uncommitted Phase 2 work. No commit/push/deploy/merge, dependency/lockfile change,
real Stripe mutation, clock advance, reconciliation invocation, emulator write,
reset/reseed or outbound email occurred during that correction pass. Real recovery
was subsequently completed by the owner, as recorded below.

### Proven entitlement cause and bounded 500 conclusion

The real Test Clock advanced to 1791818571, beyond Pack paid-through
1791818570000. Both subscription reconciliation and root view/report expiry
checked Date.now(), still September wall time, so they preserved the compatibility
active flag and incorrectly resolved Pro/1200 from an expired payment. The Stripe
ordering marker 1789229310000 also used wall time, not frozen time. The existing
paid-grant path had a separate forward-period risk: it preferred the live Pack
item period end over the paid invoice line period and deduplicated by event ID
only. It did not grant from the draft invoice in this incident (count stayed 1).

GET-only scoped commercial-clock resolution now fixes expiry in root authoritative
views/AI/export authorization and Functions reconciliation/add/remove/resume
state paths. Production retains wall-time behavior. These adapters never extend
payment, trust browser clock/customer values or mutate the real specimen.

The exact real webhook 500 exception is **not proved**. Read-only ledger evidence
for `evt_1UEtTfFLueI9mUztNDIxiPQD` shows failed processing after Pro billing had been
written, with release unconfirmed and the same schedule attached. This is
consistent with failure in release or subsequent confirmation but does not prove
either, particularly with concurrent events. The old catch discarded `error` and
logged only the generic logger/caller stack. Earlier transaction-lock timeout
messages cannot be attributed to this event. Mock release and transaction-abort
reproductions prove recovery behavior, not the unknown real exception.

Stage wrappers retain/rethrow the original exception for a local debugger.
Logging and failed-ledger metadata now preserve safe event/type/object/subscription
IDs, allowlisted name/code, safe static/redacted error message and failing stage.
No raw exception/stack/body/customer payment fields or secrets are logged, and
client responses stay static. Failed-metadata writes also log safely and still
return HTTP500. Transaction claim results no longer leak between retried attempts;
failed entries are retryable, processed duplicates return 200 with no work, and
live-processing duplicates return static 503 with no work so Stripe keeps retrying.
A 120-second lease permits recovery after a worker/ledger-write loss; acknowledging
a live lease as processed would incorrectly stop those retries and is avoided.

### Payment, cleanup and usage results

| Checkpoint | Effective allowance / result |
| --- | --- |
| Active Family without Pack | pooled 600 |
| Active Family with current paid Pack | pooled 1600 |
| Active Pro phase, recurring Pack, expired old paid-through, draft/open/finalized-unpaid renewal | user-owned Pro 200; no renewal grant |
| Active Family equivalent unpaid renewal | pooled 600; no renewal grant |
| Qualifying paid renewal | Pack line paid-through extends; Pro 1200 / Family pooled 1600 |
| Duplicate paid aliases/re-delivery | same invoice grant; specimen progression remains 1 -> 2 |
| Failed renewal, base still active | no Pack grant; base Pro 200 / Family 600 |
| Base past_due/unpaid/incomplete/etc. | effective Free 10; workspace/history retained |
| Stopped recurring renewal | prepaid bonus only until existing paid-through, then no bonus |
| Owned applied-Pro schedule release while invoice draft | detached schedule; invoice/payment/grants/refunds unchanged |

Payment requires a signed paid invoice with zero remaining, positive amount paid,
correct mapped customer/subscription/workspace and positive configured-Pack
line. Its period end is the only new paid-through authority. Subscription period
advancement, item existence, schedule phase and invoice created/finalized never
grant. New invoice-keyed grants check legacy event-keyed invoice grants in the
same transaction; concurrent aliases create one grant. Different older paid
invoices cannot shorten the later boundary or regress the payment ordering marker.

Cleanup retains the existing owned receipt/catalog/mode/history/current-Pro
guards, per-schedule Stripe release key, release outside Firestore transaction,
and bounded fresh confirmation transaction. It does not invoice/pay/refund or
grant Pack. Live rereads and optimistic retries converge concurrent subscription,
schedule and payment events, including late old Family schedule snapshots.
There is no global customer lock or nested reconciliation transaction.
The retained workspace/seats/data/Family pool are preserved with paid elevation
inactive after Pro. Current debits use existing user usage; payment/reconciliation
neither duplicate nor reset consumption. Storage accounting remains deferred.

### Historical real read-only evidence and prepared owner recovery

Fresh status and emulator report agree: clock ready at **1791818571**, active Pro,
one recurring Pack, old paid-through **1791818570000**, **one grant**, derived
`renewal_pending`, current Pack validity=false, effective **200**; paid Family
elevation inactive and retained seat count=1. Renewal
`in_1UEtTdFLueI9mUztb1bOKZRj` remains draft/unattempted with amountDue/remaining=998,
amountPaid=0 and Pack line end=1794496970000. The applied schedule
`sub_sched_1UEtKMFLueI9mUzt0y8bT1oG` remains active/attached with releaseNeeded=true
and safeToReconcileAppliedSchedule=YES. Same three invoices, zero refunds, same
customer/subscription/workspace. The raw emulator active flag was not edited;
the fresh effective calculation correctly rejects its expired paid-through.

The [local runbook](LOCAL_STRIPE_LIFECYCLE_TEST.md#family--pack---pro--pack-draft-renewal-checkpoint-2026-09-12)
contains the exact read-only status and staged owner recovery. A new explicit
`finalize-renewal --invoice <exactId> --confirm yes` stage in the existing helper
proves the exact draft renewal/period/catalog/scope and performs one idempotent
finalization only. It never pays/advances/releases/writes DB. Finalization is not
payment confirmation: observe normal collection; stop for owner review if still
open/unattempted. Do not use the differently scoped past_due helper or advance
this clock. Require paid-through 1794496970000, grants 1 -> 2 and Pro/1200, then
perform explicit UI cleanup only if still needed and fresh safe gate YES. Final
ProAfterFamilyDowngradeWithAIPack and AllReadOnly harnesses were unexecuted at
this checkpoint; both subsequently passed in the owner validation below.
The lifecycle harness remains read-only with unchanged strict release/payment
assertions; only evidence reporting was extended.

### Regression coverage and validation

Added **34 root** tests (13 server clock adapter guards; 21 helper reporting,
parser/finalization and unsafe-input guards) and **33 Functions** tests (25 full
stateful lifecycle/concurrency/retry cases; 8 diagnostic/clock policy cases).
The persisted-state tests cover each unpaid/paid/failure checkpoint, legacy and
concurrent paid aliases, invoice-only period authority, expired prepaid access,
Family pooled equivalent, server debit denial at Pro/200 then acceptance after
payment, independent release/no extra financial mutation, workspace/seat/ID/
usage preservation, late old Family schedules, failed-event/lease recovery and
safe diagnostics. Fakes use real compiled handler/callable code and versioned
atomic Firestore commits; no network/emulator/Stripe mutations occur in tests.

| Validation | Result |
| --- | --- |
| Root typecheck | pass, 0 errors |
| Root lint | pass, 0 errors; 50 existing warnings |
| Root npm test | 274/274 pass |
| Root npm run build | sandbox compiled then worker spawn EPERM; allowed local retry passed 30 pages |
| Functions npm run build | pass |
| Functions npm test wrapper | build passed; test-file worker spawn EPERM in sandbox, not a wrapper pass |
| All seven declared Functions suites directly under Node 20.20.2 | 212/212 pass |
| git diff --check | pass |
| Gitleaks current source including changed/nonignored untracked files | 320 files, no leaks; unchanged scanner configuration, no new suppressions |
| Dependencies and locks | unchanged by this correction |

### Files changed in this correction only

Existing earlier uncommitted work is not included in this 17-file manifest:

- `functions/src/stripeWebhook.ts`
- `functions/src/stripeBilling.ts`
- `functions/tests/familyDowngrade.test.cjs`
- `functions/tests/stripeWebhook.test.cjs`
- `src/app/billing/actions.ts`
- `src/lib/billing/serverUsage.ts`
- `src/lib/billing/evaluationTime.server.ts` (new)
- `scripts/billing-evaluation-time.test.cjs` (new)
- `scripts/phase2-family-downgrade-test-clock.mjs`
- `scripts/phase2-family-downgrade-test-clock.test.cjs`
- `scripts/phase2-emulator-report.mjs`
- `scripts/phase2-lifecycle.ps1` (reporting only)
- `docs/billing/BILLING_ARCHITECTURE.md`
- `docs/billing/STRIPE_WEBHOOKS.md`
- `docs/billing/AI_CREDIT_ACCOUNTING.md`
- `docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md`
- `docs/billing/PHASE2_REMEDIATION_REPORT.md`

That implementation checkpoint made no final real paid/released claim. The
subsequent owner-confirmed final state is recorded below. No new remote CI,
deployed behavior or clean npm audit claim is made; accepted security records remain.

## Final owner-validated monthly Family + AI Pack -> Pro + AI Pack lifecycle (2026-09-12)

**Status: COMPLETE for this real local Stripe Sandbox specimen.** The owner
executed recovery and supplied the final evidence below. This documentation
update did not rerun the harnesses or perform Stripe/emulator operations. Earlier
pending checkpoints remain historical and are not outstanding recovery tasks.

| Specimen | Value |
| --- | --- |
| Email | `phase2-family-downgrade+pack@example.test` |
| UID | `FgMEvbGB3xGBOlFTJ9xq1DVTj90n` |
| Customer | `cus_VFNWuViU6dpFC6` |
| Subscription | `sub_1UEslgFLueI9mUztYc0OLSEg` |
| Preserved Family workspace | `phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n` |
| Test Clock | `clock_1UEslSFLueI9mUztSncNOSAU` |
| Frozen time | `1791818571` (unchanged during recovery) |
| Renewal invoice | `in_1UEtTdFLueI9mUztb1bOKZRj` |

### Completed owner-executed sequence

1. Family + AI Pack began active with the pooled allowance of 1600.
2. The end-of-period Family -> Pro downgrade was scheduled while preserving
   the recurring AI Pack item.
3. Stripe applied the Pro phase while the new $9.98 renewal invoice was draft.
4. Corrected commercial-clock logic resolved the intermediate state as Pro/200:
   recurring Pack present, prior paid-through expired, no new Pack entitlement.
5. The owner explicitly finalized the invoice using the guarded helper.
6. Finalization produced open/unattempted state; effective allowance remained
   Pro/200 because finalization alone was not payment evidence.
7. The owner used Stripe Sandbox **Charge customer** once with the existing
   successful Visa test payment method.
8. The invoice paid successfully for $9.98, with zero remaining balance.
9. Signed payment processing extended Pack paid-through to `1794496970000`;
   grant count moved exactly **1 -> 2**.
10. Effective allowance became **Pro + AI Pack / 1200**, user-owned.
11. The authoritative payment webhook also released/detached the applied
    downgrade schedule automatically.
12. No manual **Refresh billing status** action was required.
13. Final `ProAfterFamilyDowngradeWithAIPack` and `AllReadOnly` harnesses passed.

### Final invoice and entitlement evidence

| Field | Final owner-confirmed result |
| --- | --- |
| Invoice status / attempted / attemptCount | `paid` / `true` / `1` |
| Invoice amountDue / amountPaid / amountRemaining | `998` / `998` / `0` cents |
| AI Pack invoice-line period end | `1794496970000` |
| Canonical plan / status / interval | `pro` / `active` / `month` |
| AI Pack status / derived state | `active` / `paid_renewing` |
| Recurring Pack / current paid-through valid / entitlement valid | `true` / `true` / `true` |
| Pack renewal payment pending | `false` |
| Pack paidThrough / grant count | `1794496970000` / **2** |
| Effective plan / paid entitlement / AI allowance | `pro` / `true` / **1200** |
| Allowance ownership | `user-owned` |
| Family workspace / retained seat records / paid seat limit | preserved / **1** / **0** |
| Collaborators per tree / storage entitlement | **10** / **50 GiB** |
| Schedule release | fully released/detached automatically by authoritative webhook processing |
| scheduleReleaseNeeded / safeToReconcileAppliedSchedule / scheduleId | `false` / `NO` / `null` |
| Stripe item graph | exactly one Pro monthly item and exactly one AI Pack monthly item |
| Pending invoice items / draft invoices / refund total | **0** / **0** / **0** |

The same customer, subscription and Family workspace were retained. `AllReadOnly`
additionally confirmed exactly one Pro base item with no other base-plan item,
an active renewing base subscription, an authoritatively active renewing Pack,
and a Stripe Pack item count of exactly one. There is no outstanding manual
schedule reconciliation for this completed specimen. The original webhook 500
exception remains unproved; successful later recovery does not establish its cause.

### Final owner validation results and environment note

| Validation | Owner-confirmed result |
| --- | --- |
| ProAfterFamilyDowngradeWithAIPack | **PASS** |
| AllReadOnly | **PASS** |
| Root test suite in clean PowerShell environment | **274 tests / 274 passed / 0 failed** |
| Functions build / tests | passed / **212 tests / 212 passed** |
| Accepted lint baseline | **0 errors / 50 existing warnings** |

The owner's initial root test run in the lifecycle PowerShell shell produced
nine failures because that shell intentionally enabled the commercial Test Clock
adapter environment. Removing the lifecycle emulator/clock variables and rerunning
in a clean PowerShell environment produced 274/274 passes and zero failures.
This was environment contamination, not a product regression. Keep the isolated
unit-test shell separate from the lifecycle shell; no code/test changes were
needed for that rerun. Earlier sandbox wrapper/build limitations remain historical
execution evidence and are not replaced by a new claim about remote CI.

The accepted Phase 1 audit baseline above remains unchanged: Root 67 total / 12
high / 0 critical; Root production 62 / 7 / 0; Functions 9 / 0 / 0. The seven
production-high Genkit/OpenTelemetry findings remain owner-accepted under the
documented controls: vulnerable exporters/propagators unused or disabled, no
public telemetry/metrics listener, no runtime preload of vulnerable
auto-instrumentation, and tracking patched upstream parent releases. **npm audit
is not clean**; no new audit, ignore, override or suppression is claimed.

Only this report and the local lifecycle runbook were edited for the final
owner-evidence documentation update. All other uncommitted work was preserved;
no commit/push/deploy/merge, dependency/lockfile change, Stripe mutation, clock
advance or Firebase Emulator reset/reseed/write was performed.

## Storage Rules correction: local validation 2026-09-13

The production Rules design could read tree + user + Family, exceeding Storage's
two-unique-Firestore-document limit. The local correction uses server-owned
`users/{uid}.storageAuthority`, protected from ordinary client creates/updates.
Accepted owner/Family billing mutations atomically refresh linked-user storage
projections; live-state triggers and authenticated upload preparation handle
membership, known usage changes and existing-account initialization. Active
Family billing owners and linked members who own trees receive the same 100 GiB
quota foundation. Preserved workspace linkage alone grants no paid elevation.

Local validation: 74/74 real Firestore + Storage emulator tests, 274/274 root
tests, 220/220 Functions tests under Node 20, root typecheck, root production
build and Functions build passed. Storage Rules runtime compiler returned zero
errors and zero warnings. Lint remains 0 errors / 50 existing warnings. Source
secret scanning passed; the whole-folder scan separately reports the existing
ignored local Stripe credentials without suppressions. Exact object-byte
accounting, complete Family quota enforcement and remaining seat lifecycle stay
deferred. No production state, credentials or deployment was changed.

Root audits remain 67 total / 12 high / 0 critical, production 62 / 7 / 0.
Functions currently reports 8 moderate / 0 high / 0 critical, both before and
after this task; the previously accepted 9-total checkpoint is retained as
history. No Functions dependency changed. See
[the full correction report](STORAGE_RULES_REMEDIATION_2026-09-13.md) for the
proposed files, access-budget table, audit comparison and manual rollout steps.
