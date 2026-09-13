# Local Stripe Sandbox lifecycle test

**Latest owner validation (2026-09-12): COMPLETE for the real monthly Family +
AI Pack -> Pro + AI Pack downgrade.** Both final harnesses passed after
owner-executed payment recovery and automatic schedule release. The final owner
validation section below supersedes this specimen's earlier pending checkpoints.

Final partial-schedule recovery checkpoint is recorded in section 18. Do not
recreate the existing customer/subscription or advance its clock to repair it.

This runbook exercises the Phase 2 billing code without deploying Functions,
using production Firebase data, or changing any Vercel configuration. It uses
the dedicated Firebase demo project `demo-konnectedroots-phase2`, local Auth,
Firestore, Functions and Storage emulators, and a Stripe Sandbox. Actual Stripe
secret keys and webhook signing secrets must exist only in ignored local files.
Never commit those files or paste their values into source, documentation,
issues, pull requests, logs, or chat.

## Safety boundary

- Confirm the Git branch is `feat/phase2-billing-entitlements`.
- Use a Stripe Sandbox/test environment. Never supply a live-mode key.
- Do not run `firebase deploy`, `vercel env`, or any production data command.
- Use the exact project and hosts in this guide. The scripts fail closed for
  any other project or remote host.
- `functions/.env.local` and `functions/.secret.local` are ignored. Delete them
  when the lifecycle test is complete.

The disposable emulator account is:

```text
Email: phase2-billing@example.test
Password: LocalPhase2!2026-Test
Display name: Phase 2 Billing Test
```

The password is intentionally documented because the account exists only in
the local Auth Emulator and uses the reserved `.test` domain.

## Prerequisites

- Install the Stripe CLI and authenticate it only to a Stripe Sandbox.
- Install a Java runtime supported by the Firebase Local Emulator Suite.
- Install Firebase CLI and the repository's root and Functions dependencies.
- Keep four PowerShell windows available for Stripe forwarding, Firebase
  emulators, Next.js, and seed/report commands.

## 1. Prepare the Stripe Sandbox catalog

Open or create a Sandbox in the Stripe Dashboard, then authenticate Stripe CLI
to that Sandbox. Confirm the selected account is a test/sandbox account before
creating anything.

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
stripe login
stripe balance retrieve
```

Create isolated local-test products and prices. These commands use the current
Phase 2 prices and put the metadata required by the Functions mapping on each
price.

```powershell
$proProduct = stripe products create --name='KonnectedRoots Pro Phase 2 Local' | ConvertFrom-Json
$familyProduct = stripe products create --name='KonnectedRoots Family Phase 2 Local' | ConvertFrom-Json
$aiProduct = stripe products create --name='KonnectedRoots AI Pack Phase 2 Local' | ConvertFrom-Json

$proMonthly = stripe prices create -d "product=$($proProduct.id)" -d 'currency=usd' -d 'unit_amount=599' -d 'recurring[interval]=month' -d 'metadata[kr_plan]=pro' | ConvertFrom-Json
$proYearly = stripe prices create -d "product=$($proProduct.id)" -d 'currency=usd' -d 'unit_amount=5999' -d 'recurring[interval]=year' -d 'metadata[kr_plan]=pro' | ConvertFrom-Json
$familyMonthly = stripe prices create -d "product=$($familyProduct.id)" -d 'currency=usd' -d 'unit_amount=999' -d 'recurring[interval]=month' -d 'metadata[kr_plan]=family' | ConvertFrom-Json
$familyYearly = stripe prices create -d "product=$($familyProduct.id)" -d 'currency=usd' -d 'unit_amount=9900' -d 'recurring[interval]=year' -d 'metadata[kr_plan]=family' | ConvertFrom-Json
$aiPackMonthly = stripe prices create -d "product=$($aiProduct.id)" -d 'currency=usd' -d 'unit_amount=399' -d 'recurring[interval]=month' -d 'metadata[kr_addon]=ai_pack' | ConvertFrom-Json

$proMonthly.id
$proYearly.id
$familyMonthly.id
$familyYearly.id
$aiPackMonthly.id
```

## 2. Create ignored Functions environment files

Open `functions/.env.local` and add the non-secret values below, replacing each
price placeholder with the corresponding Sandbox price ID from the preceding
commands.

```dotenv
APP_URL=http://127.0.0.1:9002
STRIPE_PRICE_PRO_MONTHLY=<Pro monthly Sandbox price ID>
STRIPE_PRICE_PRO_YEARLY=<Pro yearly Sandbox price ID>
STRIPE_PRICE_FAMILY_MONTHLY=<Family monthly Sandbox price ID>
STRIPE_PRICE_FAMILY_YEARLY=<Family yearly Sandbox price ID>
STRIPE_PRICE_AI_PACK=<AI Pack Sandbox price ID>
LOCAL_BILLING_TEST_DISABLE_EMAIL=true
```

Open `functions/.secret.local` and add the Sandbox secret key. Do not add a
live-mode key.

```dotenv
STRIPE_SECRET_KEY=<paste the Stripe Sandbox secret key here>
STRIPE_WEBHOOK_SECRET=<paste the Stripe CLI signing secret here after step 3>
```

Do not configure `RESEND_API_KEY` for this test. The email path also contains a
fail-safe suppression guard requiring the explicit flag, Functions emulator,
local Firestore host, demo project and a non-production runtime.

## 3. Start Stripe webhook forwarding

In a dedicated PowerShell window, start forwarding to the local v2 Functions
endpoint:

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
stripe listen --forward-to http://127.0.0.1:5001/demo-konnectedroots-phase2/us-central1/stripeWebhook
```

Copy the signing secret printed by Stripe CLI into
`functions/.secret.local` as `STRIPE_WEBHOOK_SECRET`, then leave this window
running. This secret is temporary and belongs only to this local forwarding
session.

## 4. Start Firebase emulators

Start the emulators after both Functions local files are complete:

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
firebase --config firebase.billing-test.json emulators:start --project demo-konnectedroots-phase2
```

Expected endpoints are Auth `9099`, Functions `5001`, Firestore `8080`, Storage
`9199`, and Emulator UI `4000`. The command uses the existing Functions source,
Firestore rules/indexes, and Storage rules. It does not select or modify a
production Firebase project.

## 5. Seed the disposable account

In another PowerShell window, set only the local emulator routing variables and
run the idempotent seed script:

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
$env:GCLOUD_PROJECT='demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
node scripts/phase2-emulator-seed.mjs
```

The script prints only the UID, email, plan and status. It creates or resets the
matching Firestore profile to the Phase 2 Free schema and deliberately does not
create a Stripe Customer. Checkout must exercise application customer creation.

## 6. Start Next.js against the emulators

Use a fresh PowerShell window so these variables cannot affect another task.
The public Firebase values below identify the demo app locally and are not
credentials. The fixed flags connect all browser SDKs before their first use;
the server flags let Next.js Admin use the emulators without a service account.

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
$env:NEXT_PUBLIC_APP_URL='http://127.0.0.1:9002'
$env:NEXT_PUBLIC_FIREBASE_API_KEY='demo-local-api-key'
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN='demo-konnectedroots-phase2.firebaseapp.com'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID='demo-konnectedroots-phase2'
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='demo-konnectedroots-phase2.appspot.com'
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID='123456789'
$env:NEXT_PUBLIC_FIREBASE_APP_ID='1:123456789:web:phase2local'
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS='true'
$env:USE_FIREBASE_EMULATORS='true'
$env:GCLOUD_PROJECT='demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
npm run dev
```

Open `http://127.0.0.1:9002/login` and sign in with the disposable account.

## 7. Exercise Pro Checkout and synchronization

1. Open `/pricing`, select monthly Pro, and complete the Stripe-hosted Checkout
   with Stripe's documented successful test card `4242 4242 4242 4242`, any
   future expiry, any CVC and any postal code.
2. Confirm the browser returns to the local dashboard.
3. Confirm Stripe CLI forwards `checkout.session.completed`,
   `customer.subscription.created` and any associated invoice event with 2xx
   responses.
4. Confirm the Functions log contains the safe email-suppression message and no
   recipient, message body or provider request.
5. Run the state report:

```powershell
node scripts/phase2-emulator-report.mjs
```

The report should show `plan: pro`, `status: active`, `interval: month`, a future
period end, non-null Customer/subscription IDs, a positive
`latestStripeEventCreated`, and processed billing ledger entries. In the app,
open `/settings/billing` and confirm the authoritative Pro entitlements match.

## 8. Validate Customer Portal and cancellation ordering

Configure the Sandbox Customer Portal in Stripe if it has not been configured.
From `/settings/billing`, open the portal and schedule cancellation at period
end. After the forwarded `customer.subscription.updated` event:

```powershell
node scripts/phase2-emulator-report.mjs
```

The state must remain `plan: pro`, `status: active`, with a future period end
and `scheduledCancellationAt`. `cancelAtPeriodEnd` must be true when Stripe
either returns its explicit period-end flag or returns `cancel_at` equal to the
Pro plan item's `current_period_end`. The paid entitlement remains active until
that timestamp. Billing Settings must show `Expires On` and must not imply that
another renewal will occur.

For this disposable Sandbox test, immediately cancel the subscription afterward
to generate the terminal event. Copy the reported subscription ID into a local
PowerShell variable, then run:

```powershell
$subscriptionId='<subscription ID printed by the safe local report>'
stripe subscriptions cancel $subscriptionId
node scripts/phase2-emulator-report.mjs
```

After `customer.subscription.deleted` is forwarded, the report must show Free
plan/canceled state, cleared active add-on state, and the test user's Firestore
document still present. Existing user data is not deleted by downgrade.

## 9. Resume the existing AI Pack test without a second item or charge

Use this guarded recovery only for the current disposable Sandbox subscription
that already has the AI Pack item plus one unattached 393-cent proration item.
Do not click **Add to Your Plan**, create another Checkout Session or call
`addAIPack` again. Keep Stripe forwarding and the existing emulators running so
the corrected Functions code receives the events.

Load the safe emulator identifiers and confirm the subscription already has the
AI Pack item. The metadata-only update emits a fresh subscription event so the
new canonical state becomes `pending`; it does not create an item or charge.

```powershell
$state = node scripts/phase2-emulator-report.mjs | ConvertFrom-Json
$customerId = [string]$state.stripeCustomerId
$subscriptionId = [string]$state.stripeSubscriptionId
if (-not $customerId -or -not $subscriptionId) { throw 'Missing Sandbox billing identifiers.' }

stripe subscriptions retrieve $subscriptionId
stripe subscriptions update $subscriptionId -d 'metadata[kr_ai_pack_payment_verification]=2026-09-10'
node scripts/phase2-emulator-report.mjs
```

The report must now show `aiPackItemExists: true`, `aiPackStatus: pending`,
`aiPack: false`, the Pro base allowance of 200, and no new AI Pack grant. Next,
inspect pending invoice items. Stop if there is anything other than the one
expected AI Pack proration for 393 cents associated with this subscription.

```powershell
$pending = stripe invoiceitems list -d "customer=$customerId" -d 'pending=true' -d 'limit=100' | ConvertFrom-Json
$pending.data | Select-Object id, amount, currency, invoice, subscription, description
if ($pending.data.Count -ne 1 -or [int]$pending.data[0].amount -ne 393 -or $pending.data[0].currency -ne 'usd') {
  throw 'Expected exactly one pending 393-cent USD AI Pack proration. Stop without creating an invoice.'
}
```

Create a draft invoice that includes pending items only for the existing
subscription. `auto_advance=false` keeps the invoice in draft and prevents an
automatic collection attempt, so this step still does not charge the test
customer.

```powershell
$invoice = stripe invoices create `
  -d "customer=$customerId" `
  -d "subscription=$subscriptionId" `
  -d 'collection_method=charge_automatically' `
  -d 'auto_advance=false' `
  -d 'metadata[kr_ai_pack_existing_item_recovery]=true' | ConvertFrom-Json

$invoiceId = [string]$invoice.id
$invoice = stripe invoices retrieve $invoiceId | ConvertFrom-Json
if ($invoice.status -ne 'draft' -or [int]$invoice.amount_due -ne 393 -or $invoice.lines.data.Count -ne 1) {
  throw 'Draft invoice is not the expected single 393-cent AI Pack proration. Do not finalize or pay it.'
}
$invoice
```

Before continuing, verify in the returned draft and Stripe Dashboard that it
contains exactly the existing AI Pack proration, the amount due is 393 cents,
and there are no unrelated pending items. If any value differs, leave the
invoice in draft and investigate; do not finalize or pay it.
If this shell is interrupted after draft creation, retrieve and reuse
`$invoiceId`; do not rerun `stripe invoices create`.

The following two commands are the only payment step. Run them once after the
draft review. Finalization keeps automatic advancement disabled; the explicit
`pay` call makes the single Sandbox collection attempt and should produce the
qualifying `invoice.payment_succeeded` webhook.

```powershell
stripe invoices finalize $invoiceId -d 'auto_advance=false'
stripe invoices pay $invoiceId
node scripts/phase2-emulator-report.mjs
```

On success, the report must show `aiPackStatus: active`, a future
`aiPackPaidThrough`, `aiPack: true`, Pro allowance 1,200, and exactly one new
AI Pack grant. On failure, the add-on must stay pending/inactive and no grant
may be created. This procedure invoices the already-created pending proration;
it never creates a second subscription item.

The current Stripe Clover API rejects combining `subscription` with
`pending_invoice_items_behavior`. Supplying `subscription=$subscriptionId`
alone includes the pending items associated with that subscription and avoids
the invalid mutually exclusive parameter combination.

When a PowerShell URL contains a query string immediately after an interpolated
variable, delimit the name explicitly. Use
`"${variable}?query=value"`, not `"$variable?query=value"`, so PowerShell does
not parse the question mark as part of the variable expression.

## 10. Verify customer-facing AI Pack removal

Run this step only during an owner-authorized disposable Sandbox lifecycle. It
changes the Sandbox subscription but does not charge or refund the customer.
Start from the verified active AI Pack state and keep Billing Settings open so
the Firestore-driven UI transition can be observed.

1. Open `/settings/billing` as the disposable billing account.
2. Confirm the page shows the active 1,200 Pro or 1,600 pooled Family allowance.
3. Select **Remove AI Pack**, review the confirmation, and confirm **Stop AI Pack
   renewal** once.
4. Confirm the dialog states that the base plan remains active and paid AI Pack
   access continues through the displayed date.
5. Without reloading, confirm the UI changes to **AI Pack ends on <date>** and
   the increased allowance remains available.
6. Run the safe emulator report and retrieve the subscription. Verify the base
   Pro/Family item remains, the AI Pack item is absent, no pending invoice item
   or draft invoice was created, and the base cancellation fields are unchanged.
7. Exercise a retry only as a controlled test; it must return the already-removed
   result without deleting the base item.

Removal uses Stripe subscription-item deletion with
`proration_behavior=none`. It stops the next AI Pack renewal and intentionally
does not create an automatic credit or refund. Firestore retains the paid
entitlement through `aiPackPaidThrough`, records that same time in
`aiPackScheduledRemovalAt`, and then resolves the allowance back to the base
plan after expiration.

## 11. Verify customer-facing AI Pack renewal resume

Run this step only during an owner-authorized disposable Sandbox lifecycle. It
restores the recurring AI Pack item but must not create an immediate invoice,
payment, refund, proration item or grant. Start from the stopped-renewal state
created in the previous section while `aiPackPaidThrough` is still in the future.

1. Keep `/settings/billing` open and confirm it shows **AI Pack ends on <date>**
   with the increased 1,200 Pro or 1,600 pooled Family allowance.
2. Select **Keep AI Pack**, review **Keep AI Pack renewing?**, and confirm the
   dialog says the account will not be charged today.
3. Confirm **Keep AI Pack** once. During synchronization, the page may show
   **Resuming...** or **Resuming AI Pack renewal**.
4. Without reloading, confirm **AI Pack renewal resumed** appears and the page
   returns to the normal active AI Pack state with **Remove AI Pack** available.
5. Run the safe emulator report and retrieve the Stripe subscription. Verify
   there is exactly one Pro/Family item and one metadata-tagged AI Pack item,
   `aiPackPaidThrough` is unchanged, the grant count is unchanged, and the base
   cancellation fields are unchanged.
6. Confirm Stripe created no immediate invoice, payment, refund, pending invoice
   item or draft invoice. The next normal paid renewal remains the only event
   that can extend the paid-through entitlement and create another grant.

The resume callable uses the server-configured price and
`proration_behavior=none` with an idempotency key scoped to the subscription,
existing paid-through period and persisted resume operation. If paid-through has
expired, the resume action is rejected and the normal paid **Add AI Pack** flow
must be used.

## 12. Verify the upgraded Family + AI Pack account

The disposable Sandbox account has already completed the Pro-to-Family monthly
upgrade. Its current state is active monthly Family, one Family base item, one
AI Pack item, unchanged AI Pack paid-through/grant state, one owner seat and no
pending invoice items or draft invoices. Do not run Checkout, click an upgrade
button, remove/re-add AI Pack, downgrade, reset or reseed the emulators.

1. Keep Stripe forwarding, Functions emulation and Next.js running. Run the
   read-only assertions:

```powershell
.\scripts\phase2-lifecycle.ps1 -Test FamilyWithAIPack -WaitSeconds 45
.\scripts\phase2-lifecycle.ps1 -Test AllReadOnly
```

2. Sign in as the disposable account and open `/pricing`. Confirm Family says
   **Current Plan**, the AI Pack says **AI Pack Active**, and the Pro card says
   **Downgrade to Pro** but is disabled with the end-of-period explanation.
3. Open `/settings/billing` without changing billing state. Confirm Family,
   Active, Monthly, the appropriate next renewal, `0 / 1600` (or the current
   used count over 1,600), and no AI Pack payment-processing message.
4. Refresh the page once and confirm the same values remain. The server view,
   owner-paid-through state and Family pooled usage path must agree; no second
   payment, grant or add-on item is needed.
5. The focused assertion requires exactly one approved Family monthly item
   (`price_1SqLVSFLueI9mUztPucoRA0h`, 999 cents), exactly one AI Pack item and
   zero Pro items:

```powershell
.\scripts\phase2-lifecycle.ps1 -Test FamilyWithAIPack -WaitSeconds 45
```

The report must show an active linked owner seat, a six-seat limit, 20
collaborators per tree, Family-pooled ownership and a 1,600-action effective
allowance. `aiPackPaidThrough`, grant count 2 and the monthly used count must be
unchanged unless a distinct qualifying AI Pack renewal invoice actually paid.
There must be no leftover pending invoice item or draft invoice.

The current Phase 2 branch creates and enforces the owner seat only. It does not
yet expose customer-facing Family member add/remove operations, so do not claim
that a six-account member lifecycle has passed from this owner upgrade test.

## 13. Family-to-Pro scheduled downgrade

The dedicated owner-authenticated app action now schedules the existing Stripe
subscription to move from Family to Pro at the base paid-period end. Monthly
maps to monthly, yearly to yearly. Family remains fully entitled until Stripe
applies Pro; scheduling creates no immediate refund, proration credit/charge or
invoice. Pricing and Billing Settings show Scheduled/date and Keep Family Plan,
which releases the schedule and retains Family renewal with no invoice/refund.

The current phase and future Pro phase preserve the renewing AI Pack item. A
prepaid stopped Pack retains only its existing paid-through entitlement; failed
or pending Pack never becomes active at downgrade. Cancel the scheduled base
change before altering Pack renewal, preventing stale future item graphs.
Family workspace/owner/membership/seat records and genealogy/media/history are
retained. At Pro activation the owner resolves to Pro/200 or valid Pack/1200,
Family paid seats become inactive and members lose Family elevation. Existing
excess collaboration remains, while new additions enforce Pro's limit. Storage
uses Pro 50 GB and a conservative retained pool-usage floor; exact reconciliation
remains Phase 3/4 and deletes stay allowed.

Both plan mutation APIs block payment attention; Portal recovery remains
available. Reconciliation reads live Stripe authority in the same retryable
transaction as user/Family updates, clearing or repairing stale scheduled state.
Customer Portal configuration is unchanged by this pass; use the app controls
for this policy, and do not assume externally configured Portal switches share
the timing. See section 17 for the staged NEW-account test, not yet executed.

## 14. Test payment failure separately on a disposable account

Do not use the successful `phase2-billing@example.test` Family + AI Pack account
for an intentional failure. Create a separate Firebase Emulator user and use a
separate Stripe **test-mode** customer. The lifecycle harness accepts an email
override and remains read-only:

```powershell
$FailureEmail = "phase2-payment-failure@example.test"
.\scripts\phase2-lifecycle.ps1 -Email $FailureEmail -Test BillingReport
```

Before any failure test, confirm that Auth and Firestore are the guarded local
emulators, Functions are forwarding locally, and the Stripe CLI/Dashboard is in
Sandbox/Test mode. The harness refuses non-test Stripe keys and never prints the
key or webhook secret. Do not copy credentials into this runbook.

Create the failure account through the local app instead of running the seed
script, because the seed script targets the successful account that must remain
unchanged:

1. In the local browser, sign out of the successful account, open
   `http://127.0.0.1:9002/signup`, and register
   `phase2-payment-failure@example.test` with a distinct local-only password.
2. Confirm the Auth Emulator and Firestore Emulator UI show the new account and
   its Free user profile. Do not copy or modify the successful account's UID,
   Family ID or Stripe identifiers.
3. In the Stripe Sandbox Dashboard, confirm **Test mode** is selected. In the
   Stripe CLI window, `stripe balance retrieve` must identify the test/sandbox
   account before continuing.
4. Run the `BillingReport` command above. It must report this failure email,
   effective Free plan, no Stripe customer/subscription yet and no Family
   workspace. The first Checkout creates a separate Sandbox customer.

### Failed new paid-plan Checkout

1. Start from a new Free disposable account and open `/pricing` in the local
   browser.
2. Choose Pro or Family and the desired interval. In hosted Stripe Checkout,
   use Stripe's documented decline test card `4000 0000 0000 0002` and any
   future expiry/CVC. Submit once.
3. Keep Stripe event forwarding running. The expected sequence is a failed
   Checkout invoice/payment event followed by a subscription status event such
   as `incomplete` (or `past_due` after Stripe retries). The account may retain
   its commercial plan marker for history, but it must expose Free capabilities,
   no paid AI allowance and no Family paid elevation.
4. Inspect without mutation:

```powershell
.\scripts\phase2-lifecycle.ps1 -Email $FailureEmail -Test PaymentAttention
.\scripts\phase2-lifecycle.ps1 -Email $FailureEmail -Test EntitlementFailClosed
```

Confirm the Stripe subscription remains identifiable, no AI Pack grant exists,
and any Family workspace identifier is preserved without paid membership.

### Failed Pro-to-Family upgrade

1. Use another disposable account that first has a successful active Pro
   subscription. In Stripe Sandbox, replace only that disposable customer's
   default payment method with the same documented decline test card.
2. In the local authenticated browser, open `/pricing` and choose **Upgrade to
   Family**. Submit once; do not click the button again while the operation is
   pending.
3. Expect the Family proration invoice to fail and, depending on Stripe's
   pending-update timing, `invoice.payment_failed` followed by
   `customer.subscription.pending_update_expired` or a failed subscription
   update. Verify the report shows effective Pro, the existing AI Pack at 1,200
   when its paid-through state is valid, no linked paid Family workspace/owner
   seat, no duplicate base/add-on item and unchanged usage/grants.

### Failed AI Pack purchase

1. Use a separate disposable active Pro or Family account without a paid AI
   Pack. Set that customer's Sandbox payment method to the decline test card.
2. In the local browser, open `/pricing` and choose **Add to Your Plan** once.
3. Expect the add-on invoice to fail. The Stripe item may remain staged while
   the operation is pending, but `aiPackStatus` must not become active,
   `aiPackPaidThrough` must not be extended, and `ai_pack_grants` must not gain
   a record. Pro remains 200; Family remains 600 pooled. The UI stays in a
   payment-attention/processing state and prevents duplicate attempts.

### Existing subscription past_due and recovery

Use the deterministic Test Clock procedure in the next section. A generic
decline card fails when attached and therefore cannot model a later renewal
failure. The dedicated workflow uses Stripe's attached-customer failure method,
`pm_card_chargeCustomerFail`, on a new clock-bound customer.

The lifecycle harness commands in this section only read the local Emulator and
Stripe Sandbox state. Browser Checkout and Dashboard changes described above
are deliberately separate mutations. Do not reset or reseed the emulators,
delete the successful account, or run a production deployment as part of a
failure test.

## 15. Deterministic true renewal `past_due` with a Test Clock

This procedure validates an existing subscription's monthly renewal failure.
It is different from the already-validated Pro-to-Family upgrade failure:

- The upgrade uses `pending_if_incomplete`. Its failed proration leaves the
  current Pro subscription active while a Family plan change remains pending or
  fails.
- This procedure advances an already-active Pro subscription to its normal
  `subscription_cycle` invoice. The failed renewal changes the canonical
  subscription to `past_due` and causes paid entitlements to fail closed.

A Stripe Test Clock makes the renewal boundary deterministic without changing a
computer clock or waiting a month. Stripe requires the Customer to be attached
to the Test Clock when the Customer is created; an existing non-clock customer
cannot be attached later. This procedure therefore uses a third account,
`phase2-pastdue@example.test`. It must not use or modify either
`phase2-billing@example.test` or `phase2-payment-failure@example.test`.

The lifecycle harness remains read-only. The separate
`scripts/phase2-pastdue-test-clock.mjs` helper is explicitly mutating and is
limited to the exact demo emulator, Stripe test keys, a disposable
`phase2-pastdue...@example.test` identity, and Stripe objects tagged for this
scenario. Every post-creation action requires the exact clock, Customer and
subscription IDs. Collection and recovery additionally require the exact
invoice ID. The helper exposes separate `create`, `set-failing-method`,
`advance-renewal`, `advance-collection`, `set-success-method`, `retry-invoice`
and read-only `status` actions. It validates the configured monthly Pro Price
as an active test-mode USD price for 599 cents with `kr_plan=pro`; it never
prints the Stripe key. Attaching a Stripe reusable test fixture returns a new,
Customer-scoped `pm_...` PaymentMethod rather than leaving the fixture alias as
the default. The helper therefore verifies the generated PaymentMethod instead
of comparing defaults to `pm_card_chargeCustomerFail` or `pm_card_visa`.

### 15.1 Start from a new emulator account

Keep the current Auth and Firestore Emulator data. Do not run the seed or reset
scripts. Keep Functions, Stripe event forwarding and Next.js running as
described earlier in this runbook.

```powershell
$PastDueEmail = "phase2-pastdue@example.test"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "demo-konnectedroots-phase2"
```

Sign out in the local browser, open `http://127.0.0.1:9002/signup`, and create
the exact `$PastDueEmail` account. Confirm the Auth Emulator and Firestore
Emulator show a fresh Free profile with no Stripe IDs and no Family workspace.
Read it without mutation:

```powershell
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test BillingReport
```

Stop if the report identifies any prior Stripe Customer, subscription, paid
plan or Family workspace.

### 15.2 Create the clock-bound Pro subscription

The `create` action performs one staged setup: it creates a Test Clock, creates
the disposable Customer on that clock, attaches `pm_card_visa`, and creates one
approved monthly Pro subscription without an AI Pack. Customer metadata carries
`kr_uid` and `kr_test_scenario`; subscription metadata carries `kr_uid`,
`kr_plan=pro`, `kr_interval=month`, the configured Price ID and the scenario.
Forwarded signed webhooks write the Stripe Customer/subscription IDs and
authoritative billing state to the matching emulator user. The helper does not
write billing fields directly to Firestore.

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs create --email $PastDueEmail
```

Copy the three IDs printed by that command. Do not discover or substitute IDs
from either earlier account.

```powershell
$ClockId = "clock_REPLACE_FROM_CREATE_OUTPUT"
$CustomerId = "cus_REPLACE_FROM_CREATE_OUTPUT"
$SubscriptionId = "sub_REPLACE_FROM_CREATE_OUTPUT"

npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test ProActive -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test BillingReport
```

The baseline must be canonical/effective Pro, canonical `active`, paid
entitlement `true`, allowance 200, payment attention `false`, one Customer, one
subscription, one Pro item and no AI Pack.

### 15.3 Install the attached-customer failure method

`pm_card_chargeCustomerFail` is Stripe's test PaymentMethod for a method that
can remain attached to a Customer but fails when it is charged. This is the
required behavior for a recurring renewal test. The helper attaches it only to
the disposable Customer. Stripe returns a generated `pm_...` ID. The helper
adds a non-secret scenario, role, user, Customer and subscription marker to
that generated object, makes that same generated ID the Customer and
subscription default, and then verifies the marker plus Stripe's test-mode
Visa `0341` decline-after-attach card characteristics. It does not create an
invoice or advance time.

An already-staged generated PaymentMethod created by the earlier helper has no
helper marker. It remains eligible only when a fresh read-only Stripe retrieval
proves all of the following: both defaults equal that exact ID, it belongs to
the supplied disposable Customer, it is a test-mode Visa card with last four
digits `0341`, and the surrounding Test Clock, Customer and subscription pass
the existing exact scope checks. Any partial or mismatched helper marker fails
closed. A `4242` success card, another card number, a live-mode object, a wrong
Customer or a mismatched default is rejected.

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs set-failing-method --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId
```

The read-only status must report the same generated `pm_...` ID for both
defaults, `paymentMethodType=card`, `cardBrand=visa`, `cardLast4=0341`,
`failingMethodVerified=true`, `Safe to advance renewal: YES`, and an active or
trialing subscription. For a newly staged method, the helper marker must also
be present and verified. The one legacy staged method may report the explicit
`stripe_test_card_last4_0341_legacy_unmarked` verification basis. Stop on any
other result.

### 15.4 Advance through renewal creation and collection

Stripe creates a normal renewal invoice at the period boundary in `draft`
status, then normally finalizes and attempts automatic collection after its
finalization delay. The helper keeps those mutations reviewable as two commands.
First, it reads the Pro subscription item's Clover-compatible
`current_period_end`, advances the clock once to that exact renewal boundary,
and polls only until the clock returns to `ready`:

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs advance-renewal --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId
```

The output must identify the same Customer and subscription and the newly
created renewal invoice. Copy that exact invoice ID and inspect it before
advancing collection:

```powershell
$RenewalInvoiceId = "in_REPLACE_FROM_ADVANCE_OUTPUT"

npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
```

Stop unless the selected invoice has `billing_reason=subscription_cycle`,
`status=draft`, `amount_paid=0`, and a positive `amount_due`. This proves the
scenario is a true renewal and not a pending plan update. The next command reads
the invoice's scheduled finalization time (falling back to one hour after
creation), advances the clock once to 60 seconds after that time, and waits for
the clock to become ready. It does not pay or retry the invoice directly.

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs advance-collection --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test PaymentAttention -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test PastDue -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test EntitlementFailClosed -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test BillingReport
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test AllReadOnly
```

The Stripe subscription must be `past_due`. The selected invoice must have
`billing_reason=subscription_cycle`, `status=open`, `amount_paid=0`, and a
positive `amount_remaining`. The app must preserve canonical Pro and both
Stripe IDs while exposing effective Free, paid entitlement `false`, allowance
10, payment attention `true`, and `entitlementReason=past_due`. No tree, person,
media, history or billing record is deleted.

While signed in as `$PastDueEmail`, open `/settings/billing`. Confirm **Payment
required**, **Past due**, and **Fix payment method in Stripe Portal** appear and
the page does not describe the paid entitlement as simply Active. Open
`/pricing`; paid-plan mutations must be unavailable while the page directs the
user to resolve billing. Both paid cards must show non-actionable recovery
messaging rather than `Upgrade to Pro` or `Upgrade to Family`; the Free card
must describe temporary Free access while billing is paused. AI Pack mutations
and the comparison's ordinary signup CTA must be unavailable. There should be
one clear Billing Settings/Stripe Portal recovery link. Paid mutation callables
also reject payment-attention statuses with a stable repair-billing error;
Portal creation remains the supported recovery action.

### 15.5 Recover the exact subscription and invoice

The first command attaches `pm_card_visa` only to this Customer, marks the
generated success PaymentMethod for this exact helper scope, and verifies that
generated ID as both defaults plus Stripe's test-mode Visa `4242`
characteristics. The second command validates that `$RenewalInvoiceId` belongs
to this Customer/subscription, is a normal open unpaid renewal, and pays it once
with the verified generated success PaymentMethod ID.

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs set-success-method --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs retry-invoice --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
```

Wait for forwarded webhooks, then verify recovery without mutation:

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-pastdue-test-clock.mjs status --email $PastDueEmail --clock $ClockId --customer $CustomerId --subscription $SubscriptionId --invoice $RenewalInvoiceId
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test RecoveryActive -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test ProActive -WaitSeconds 60
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test BillingReport
.\scripts\phase2-lifecycle.ps1 -Email $PastDueEmail -Test AllReadOnly
```

The invoice must be paid and the same subscription must return to `active`.
Canonical and effective plan must both be Pro, paid entitlement must be `true`,
allowance must be 200, and payment attention must be `false`. There must still
be exactly one Customer, one subscription, one Pro item, no AI Pack, and no
duplicate billing record. Leave the Test Clock and both previously validated
accounts in place; this workflow performs no reset, seed, deletion or cleanup.

The owner confirmed this full true-renewal failure/recovery lifecycle passed on
the disposable past-due account. Do not rerun it to verify the Pricing UI
correction. The focused Pricing tests render synthetic `past_due` and recovered
`active` views and use local callable doubles. On the currently recovered local
account, read-only manual verification is limited to opening `/pricing` and
`/settings/billing`, checking active Pro/200 and normal controls, and inspecting
the browser Network panel without clicking a plan, AI Pack, Portal, or Test Clock
mutation action. A future naturally occurring payment-attention state should
restore normal Pricing controls automatically after its recovery webhook,
without a browser refresh.

## 16. Reset local emulator state

Historical optional cleanup only. Do not run this section during the scheduled
downgrade work; preserve the existing emulators and completed lifecycle accounts.

After all Sandbox subscriptions are canceled, clear only the guarded demo Auth
and Firestore emulators:

```powershell
node scripts/phase2-emulator-reset.mjs
Remove-Item -LiteralPath 'functions/.env.local'
Remove-Item -LiteralPath 'functions/.secret.local'
```

The reset script calls only hard-coded `127.0.0.1` emulator endpoints and fails
unless the exact demo project and hosts are present. It never calls a Google
production endpoint. Deleting the two ignored local files does not affect
Vercel, Firebase production configuration, or Stripe Sandbox objects.

## 17. NEW disposable Family downgrade Test Clock workflow — pending

**Historical initial workflow, pending at the implementation checkpoint.** The
owner subsequently completed the real monthly `+pack` specimen, as recorded in
the final owner-validation section below. Do not create/reseed that account or
repeat its completed recovery. Separate yearly, stopped-renewal and other
optional scenarios are not claimed as completed by this monthly evidence.

This runbook prepares manual actions only. No stage was executed during the
implementation pass. Preserve the running emulators, existing billing harness,
ignored local test secrets and all completed lifecycle accounts/clocks. Do not
run section 5 or 16, reset, reseed, deploy or use a production endpoint.

Use a NEW local Auth account `phase2-family-downgrade@example.test`. Sign up in
the emulator-connected local app, wait for its server-created Free profile, and
sign in as that account. The helper only accepts this email namespace (suffixes
allowed), exact demo/loopback emulator guards and a sandbox secret from existing
ignored configuration. Completed `phase2-billing`, `phase2-payment-failure` and
`phase2-pastdue` accounts are refused. All steps are separate; there is no
one-shot script or automatic advancement loop.

Keep the local webhook listener running (section 3 forwards all event types),
and rebuild Functions before owner testing to make the new exports available.
This is a later local-only build/reload, with no emulator reset or deployment.
Ensure email suppression retains its strict local guards.

```powershell
Set-Location 'C:\Users\Precision 7560\APPs\KonnectedRoots'
$env:GCLOUD_PROJECT = 'demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$billingDowngradeEmail = 'phase2-family-downgrade@example.test'
# After NEW account signup: creates ONLY its Clock/customer and trusted mapping.
$billingDowngradeCustomer = npm exec --yes --package=node@20 -- node scripts/phase2-family-downgrade-test-clock.mjs create-customer --email $billingDowngradeEmail | ConvertFrom-Json
# Separate explicit purchase: configured Family monthly; webhook grants authority.
$billingDowngradeSubscription = npm exec --yes --package=node@20 -- node scripts/phase2-family-downgrade-test-clock.mjs create-family --email $billingDowngradeEmail --clock $billingDowngradeCustomer.clockId --customer $billingDowngradeCustomer.customerId --interval month | ConvertFrom-Json
```

`create-family` creates only an inactive workspace foundation and a real sandbox
subscription/payment on the allowlisted Family price; forwarded webhooks alone
activate paid billing/membership. It never fabricates paid entitlements. An
already subscribed/mapped account is refused rather than recreated. On a failed
stage stop and inspect status/Stripe objects; do not erase an existing mapping
or change interval to bypass its guard. Use a new disposable suffix if recovery
requires manual support. For a separate yearly trial use a NEW `+year` account
and `--interval year`; the server maps the same yearly interval to Pro.

Wait for webhooks and the owner's Family seat. Capture the baseline before
requesting any scheduled change, using read-only commands:

```powershell
$env:PHASE2_TEST_EMAIL = $billingDowngradeEmail
$billingDowngradeBaseline = npm exec --yes --package=node@20 -- node scripts/phase2-emulator-report.mjs | ConvertFrom-Json
$billingDowngradeIds = @{
    Email = $billingDowngradeEmail
    ExpectedWorkspaceId = $billingDowngradeSubscription.familyId
    ExpectedCustomerId = $billingDowngradeSubscription.customerId
    ExpectedSubscriptionId = $billingDowngradeSubscription.subscriptionId
    ExpectedSeatCount = $billingDowngradeBaseline.familyWorkspace.seatCount
}
$billingDowngradeScope = @('scripts/phase2-family-downgrade-test-clock.mjs', 'status', '--email', $billingDowngradeEmail, '--clock', $billingDowngradeSubscription.clockId, '--customer', $billingDowngradeSubscription.customerId, '--subscription', $billingDowngradeSubscription.subscriptionId, '--family', $billingDowngradeSubscription.familyId)
$billingDowngradeBefore = npm exec --yes --package=node@20 -- node @billingDowngradeScope | ConvertFrom-Json
powershell -ExecutionPolicy Bypass -File scripts/phase2-lifecycle.ps1 -Test FamilyActive -Email $billingDowngradeEmail
```

Confirm Family/600, 20 collaborators, 100 GB, six-seat entitlement, one base
Family item and no Pack. This does not claim a full customer seat-management or
exact byte-reconciliation lifecycle. If synthetic non-owner seats are present,
record all seat IDs/counts and their member views; do not mutate old fixtures.

B. In `/pricing`, choose **Downgrade to Pro** and confirm the date/no immediate
refund/Family preservation explanation. Current Family remains active, Pro is
Scheduled. Settings shows the same date and Keep Family Plan. Compare read-only
invoice IDs and refund total with baseline; they must be unchanged.

```powershell
& scripts/phase2-lifecycle.ps1 -Test FamilyDowngradeScheduled @billingDowngradeIds
$billingDowngradeAfter = npm exec --yes --package=node@20 -- node @billingDowngradeScope | ConvertFrom-Json
Compare-Object $billingDowngradeBefore.invoiceIds $billingDowngradeAfter.invoiceIds
$billingDowngradeBefore.refundTotal -eq $billingDowngradeAfter.refundTotal
```

Expected comparison: no invoice differences and refund equality `True`. Verify
native two-phase schedule, exact same-interval Pro target at the current base
period end, no immediate proration invoice and the same customer/subscription.
Repeat the schedule request safely; it must not create another schedule/phase.

C. Choose **Keep Family Plan** and confirm. The owned schedule is released,
Family stays renewing, Pack is unchanged, no invoice/refund. Verify:

```powershell
& scripts/phase2-lifecycle.ps1 -Test FamilyDowngradeCanceled @billingDowngradeIds
$billingDowngradeCanceled = npm exec --yes --package=node@20 -- node @billingDowngradeScope | ConvertFrom-Json
Compare-Object $billingDowngradeBefore.invoiceIds $billingDowngradeCanceled.invoiceIds
$billingDowngradeBefore.refundTotal -eq $billingDowngradeCanceled.refundTotal
```

D. Schedule again via app and verify Scheduled as in B. ONLY after owner review,
explicitly advance this NEW, exact scoped clock:

```powershell
npm exec --yes --package=node@20 -- node scripts/phase2-family-downgrade-test-clock.mjs advance-step --email $billingDowngradeEmail --clock $billingDowngradeSubscription.clockId --customer $billingDowngradeSubscription.customerId --subscription $billingDowngradeSubscription.subscriptionId --family $billingDowngradeSubscription.familyId --confirm yes
# Read-only; rerun until clock ready and forwarded webhooks reconcile.
npm exec --yes --package=node@20 -- node @billingDowngradeScope
& scripts/phase2-lifecycle.ps1 -Test ProAfterFamilyDowngrade @billingDowngradeIds
```

Expected owner Pro/200, 10 collaborators, 50 GB, same customer/subscription and
Family workspace/owner/membership/seat records. Scheduled fields clear and the
applied schedule is released. Non-owner Family seats cease paid elevation; their
records remain. Existing trees/media/relationships/invitations and pooled usage
are preserved. Known storage overage is retained; deletion allowed and new
collaboration respects Pro limits. Verify Pricing/Settings transition without a
manual refresh. Stripe can emit a normal renewal invoice at this boundary; the
no-new-invoice assertion applies to scheduling/canceling, not normal renewal.

E. Repeat A–D with a separate NEW `phase2-family-downgrade+pack@example.test`.
Change the email variable, sign up that new user and create its own customer and
Family subscription. Before capturing B's baseline, buy AI Pack through the app,
wait for paid invoice/grant and verify **FamilyWithAIPack**/1600. After transition
use **ProAfterFamilyDowngradeWithAIPack** with that account's own preservation IDs;
expect 1200, one Pack item, original paid-through/grant semantics and no duplicate
subscription/customer/workspace. Stopped-renewal/prepaid Pack is also covered by
local tests; a later separate manual scenario can stop renewal before scheduling
and verify it expires without recreation. Never use a pending Pack as evidence
of 1600/1200 paid access.

Yearly Family + monthly Pack has a shorter monthly item on its clock. The helper
therefore advances at most 28 days per explicit `advance-step`; inspect status
and each reconciliation before manually requesting another step. There is no
automatic year-long loop. No existing clock is advanced by this helper's tests.

If scheduled fields are stale after a delayed event, the authenticated
`reconcileScheduledBilling({})` callable provides a scoped trusted repair. It
retrieves Stripe state and can release an already-applied owned Pro schedule; it
never creates a payment or schedules a new plan change. Recheck
owner and member views afterward. Unknown/externally modified schedules require
support review; do not adopt them by ID or change Portal production settings.

## 18. Existing Family-only partial: read-only checkpoint and one retry

The owner attempt created `sub_sched_1UEhn5FLueI9mUztf9fJ7EIR` but did not
configure its future Pro phase. The correction inspected Stripe with GET-only
requests and read the existing emulator documents. No callable, clock advance,
schedule mutation, email, reset or reseed was performed.

The creation event `evt_1UEhn5FLueI9mUztXtWHyMl1` / request
`req_1PdDox8plrEjIZ` matches the saved server operation's exact create key.
Its full original schedule fingerprint matches the current attached object,
including billing settings and phases. This proves provenance despite its
currently empty schedule metadata; bare attachment/empty metadata alone would
not suffice. Test Clock `schedule.created` is frozen time, whereas the creation
event uses wall time. The helper therefore paginates creation events rather than
filtering by the schedule's frozen creation timestamp.

Read-only status for the existing objects:

```json
{
  "scheduleId": "sub_sched_1UEhn5FLueI9mUztf9fJ7EIR",
  "scheduleStatus": "active",
  "scheduleOwnershipVerified": true,
  "currentPhasePlan": "family",
  "currentPhaseInterval": "month",
  "futurePhaseCount": 0,
  "futurePhasePlan": null,
  "futurePhaseInterval": null,
  "futurePhaseStart": null,
  "partialScheduleDetected": true,
  "partialScheduleRepairable": true,
  "scheduledDowngradeVerified": false,
  "safeToRetryScheduling": "YES"
}
```

The unchanged Family phase is 1789182728 through 1791774728, with the approved
monthly Family Price, quantity 1 and no AI Pack. Canonical Family remains active,
600 actions, 20 collaborators/tree, 100 GB and one active owner seat. Scheduled
plan/date remain null. The only invoice remains
`in_1UEhOAFLueI9mUztKql8QNGT`; refund total is zero. Clock remains ready/frozen at
1789182728. Actual repair, Keep Family and transition validation remain pending.

From the repository root, this exact command is **read-only** and scoped to the
current objects (the schedule is resolved from that subscription):

```powershell
$env:GCLOUD_PROJECT = 'demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$phase2Node20 = 'C:\Users\Precision 7560\AppData\Local\npm-cache\_npx\ebaba8b9e55fd0a9\node_modules\node\bin\node.exe'
& $phase2Node20 scripts/phase2-family-downgrade-test-clock.mjs status --email phase2-family-downgrade@example.test --clock clock_1UEhMKFLueI9mUzteBak3hkv --customer cus_VFBj4yxBl11Hss --subscription sub_1UEhOAFLueI9mUzt2c4H2m3L --family phase2_family_downgrade_RBK1Iqljzjgyz7vwWqzQcFGMD4ah
```

This workstation's installed Node 20.20.2 binary completed that exact status
read. An npm exec lookup of node@20 hit ENOTCACHED in the restricted offline
environment; no package/runtime/dependency was installed or changed. The direct
existing binary avoids the registry lookup. Other workstations should use their
own installed Node 20 executable.

After the built Functions code reloads, and only while fresh status still says
YES, the owner's **single retry action** is local `/pricing` -> **Downgrade to
Pro** -> confirm **Schedule Downgrade** once, authenticated as this existing
disposable account. It sends only `{ plan: 'pro' }`; do not recreate any object,
call a clock stage or use a Stripe Dashboard mutation to recover. It must repair
this exact attached schedule to Family plus one Pro monthly phase starting at
1791774728. No second create POST, subscription, immediate invoice/refund or
proration is expected. The correction pass did not perform this action.

Rerun status afterward. Require the same schedule ID, one future Pro monthly
phase, `scheduledDowngradeVerified=true`, canonical active Family, authoritative
scheduled Pro date, unchanged invoice list/refund total and owner seat. UI must
show Family Current Plan, **Downgrades to Pro on <date>** and **Keep Family Plan**.
Do not advance the clock until this succeeds. If status says NO, stop for support
review; missing evidence or changed/foreign schedules must not be adopted.

## September 12: notification validation and current applied specimen

The preceding partial-schedule checkpoint/retry instructions are historical,
not a command to run against the now-applied Family-to-Pro specimen. The owner
reports that the account already shows Pro. This correction did not mutate that
specimen, advance its clock, reset/reseed the emulators or send email.

Schedule cleanup now confirms live detached/released Stripe state in a second
transaction before publishing its confirmation flag. A lost/failed release or
a retained attachment cannot create a success notification. Any later owner-run
reconciliation must confirm release first. An already-Pro browser baseline must
stay quiet when cleanup finishes; only a browser session that actually observed
the Family-to-Pro transition can receive Your plan changed to Pro once after
release confirmation.

Owner browser verification remains pending for the new toast presentation:

- With disposable local sandbox accounts, confirm Pro/Family activation and
  paid AI Pack activation each show one green confirmation after live authority.
- Stop/resume AI Pack renewal and schedule/keep Family: immediate button/inline
  processing, then Confirming, then one confirmation with authoritative dates.
- Payment-attention state must still block paid mutations; real recovery shows
  Payment received once. Portal navigation alone must not claim a card update.
- Repeated status refreshes, route changes and reloads must stay quiet after
  confirmation. A canceled checkout quietly clears its processing feedback.
- A slow update offers Refresh status after 45 seconds without claiming failure
  or retrying Stripe. Verify static error text, light/dark contrast, mobile
  placement, reduced motion, keyboard dismissal and screen-reader announcements.

Automated tests use only synthetic Stripe/Firestore doubles and rendered
component props. They do not establish a real lifecycle or screen-reader pass.

## Final applied-Pro integration: current read-only checkpoint and one owner action

This checkpoint supersedes the historical partial-schedule retry instructions.
The current applied schedule is `sub_sched_1UEjA4FLueI9mUztFQF4OnxL`; the old
partial schedule is not the current cleanup target. The real period-boundary
transition has already passed. Do not advance its clock again, recreate any
object, reset/reseed or release the schedule through Stripe API/Dashboard.

Read-only verification in this correction returned:

| Field | Current result |
| --- | --- |
| scheduleReconciliationStatus / scheduleStatus | applied_pro / active |
| scheduleOwnershipVerified | true |
| currentPhasePlan / currentPhaseInterval / futurePhaseCount | pro / month / 0 |
| appliedDowngradeDetected | true |
| appliedScheduleReleaseEligible | true |
| scheduleReleaseNeeded | true |
| safeToReconcileAppliedSchedule | YES |
| canonicalPlan / canonicalStatus | pro / active |
| scheduledPlan / scheduledChangeAt | null / null |
| paidSeatsActive / retained seat count | false / 1 |
| refundTotal | 0 |

The helper checks exact disposable Auth UID/email, clock/customer/subscription
and generated Family workspace scope; current ownership/attachment and active
Pro; two-phase approved Family-to-Pro history with no future phase; interval,
quantity, metadata/operation and matching server-owned receipt; approved live
catalog and test mode; no pending update, payment problem or cancellation; and
preserved inactive Family-seat authority. Missing/conflicting evidence closes
the gate. It only uses reads/GETs; it never releases a schedule.

Exact read-only status command, from the repository root, using this
workstation's already-installed Node 20 (no install or registry lookup):

```powershell
$env:GCLOUD_PROJECT = 'demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:NODE_ENV = 'development'
& 'C:\Users\Precision 7560\AppData\Local\npm-cache\_npx\ebaba8b9e55fd0a9\node_modules\node\bin\node.exe' scripts/phase2-family-downgrade-test-clock.mjs status --email phase2-family-downgrade@example.test --clock clock_1UEhMKFLueI9mUzteBak3hkv --customer cus_VFBj4yxBl11Hss --subscription sub_1UEhOAFLueI9mUzt2c4H2m3L --family phase2_family_downgrade_RBK1Iqljzjgyz7vwWqzQcFGMD4ah --interval month
```

**Exactly one owner UI action, only if a fresh status still says YES and the
local runtime has loaded the current built Functions/client code:** sign into
`phase2-family-downgrade@example.test` locally, navigate to
`/settings/billing`, and click **Refresh billing status** once. No Stripe IDs are
sent from the browser. The button invokes `reconcileScheduledBilling({})`; it
does not run on page load. Do not also click scheduling, clock or Stripe
Dashboard actions. This correction did not perform that click.

The server releases only the exact eligible applied schedule, then rereads live
Stripe inside a bounded second transaction. The UI waits for a new authoritative
read with confirmed release/detachment and unchanged active Pro. It shows neutral
**Billing status refreshed**, without a new Pro purchase/change toast for this
already-Pro account. If delayed, **Refresh status** only reads status; it does
not repeat the release callable. Error text is static and does not assume a
lost response means Stripe made no change.

After that later owner action, rerun the same read-only status command. Expect
`scheduleReconciliationStatus=none` (or a detached/released representation),
`scheduleId=null`, `scheduleStatus=null`, `scheduleReleaseNeeded=false` and
`safeToReconcileAppliedSchedule=NO`. Require the same customer/subscription/
workspace, active Pro, inactive paid Family seats, seat count 1 and Pro/200,
10 collaborators per tree, 50 GB. Before-cleanup invoice IDs were the original
Family invoice `in_1UEhOAFLueI9mUztKql8QNGT` and ordinary boundary renewal
`in_1UEjDSFLueI9mUzt7ImigLME`. Require that list and zero refunds to remain
unchanged; do not mistake the two legitimate existing invoices for a cleanup
invoice.

The existing `phase2-lifecycle.ps1` remains read-only and unchanged. Its
ProAfterFamilyDowngrade branch still throws **Scheduled state was not
cleared/released** if Stripe retains the schedule. Do not weaken it; the current
attached checkpoint is not a final harness pass. After cleanup only, verify:

```powershell
.\scripts\phase2-lifecycle.ps1 -Test ProAfterFamilyDowngrade -Email phase2-family-downgrade@example.test -ExpectedWorkspaceId phase2_family_downgrade_RBK1Iqljzjgyz7vwWqzQcFGMD4ah -ExpectedCustomerId cus_VFBj4yxBl11Hss -ExpectedSubscriptionId sub_1UEhOAFLueI9mUzt2c4H2m3L -ExpectedSeatCount 1
```

No real post-cleanup pass is claimed before the owner performs the single action.

## Family + Pack -> Pro + Pack draft-renewal checkpoint (2026-09-12)

**Historical pre-recovery checkpoint.** The draft/unpaid/attached state below
was accurate before the owner completed recovery. See the final completed
owner validation below for the current evidence; no recovery is pending now.

This is a separate specimen from the earlier no-Pack schedule. READ-ONLY checks
confirmed `phase2-family-downgrade+pack@example.test`, owned ready clock
`clock_1UEslSFLueI9mUztSncNOSAU` frozen at **1791818571**, customer
`cus_VFNWuViU6dpFC6`, subscription `sub_1UEslgFLueI9mUztYc0OLSEg`, workspace
`phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n` and still-active applied
schedule `sub_sched_1UEtKMFLueI9mUzt0y8bT1oG`. Do not advance this clock again.

Current renewal `in_1UEtTdFLueI9mUztb1bOKZRj` is draft, unattempted, subscription_cycle,
998 cents due/remaining and zero paid. Its Pro 599 / Pack 399 lines cover
1791818570 -> 1794496970. One recurring Pack survives, but the old paid-through
**1791818570000** has expired. There is still **one grant**. Fresh GET-only reporting
now shows recurring item=true, current paid validity=false, renewal payment
pending=true, Pack entitlement=false, effective **Pro/200**, user-owned usage.
Family workspace/one retained seat are preserved with paid elevation inactive;
refund total remains zero. The three original invoice IDs are unchanged:
`in_1UEslgFLueI9mUztUVLyE0JC`, `in_1UEspKFLueI9mUzt8gRykgcb`, and the renewal above.

The old webhook `evt_1UEtTfFLueI9mUztNDIxiPQD` ledger is failed. Its ordering marker
is wall-time 1789229310000, not frozen commercial time. The billing write completed
before the failed ledger marker; schedule release remained unconfirmed. The old
logger discarded the underlying exception. Exact 500 cause is **unproved**;
earlier transaction-lock messages do not establish causation for this event.
No failed event was retried against this specimen by Codex.

### Historical owner recovery plan — subsequently completed by the owner

The commands/actions below preserve the earlier prepared plan. They are not
outstanding tasks and must not be rerun as recovery instructions for the now-paid,
detached specimen. Owner execution/results are recorded in the final section below.

Use current source and the built Functions code. Keep the existing emulator
data and Stripe forwarding session; do not reset, reseed or deploy. Load the
existing local runtime configuration. The root expiry adapter additionally
requires NODE_ENV development/test, the exact demo project/loopback emulator
hosts and no Vercel context. No credential/settings changes are needed.

**1. Fresh READ-ONLY status** from the repository root:

```powershell
$phase2Node = 'C:\Users\Precision 7560\AppData\Local\npm-cache\_npx\ebaba8b9e55fd0a9\node_modules\node\bin\node.exe'
$env:GCLOUD_PROJECT = 'demo-konnectedroots-phase2'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:NODE_ENV = 'development'
$phase2PackScope = @('--email', 'phase2-family-downgrade+pack@example.test', '--clock', 'clock_1UEslSFLueI9mUztSncNOSAU', '--customer', 'cus_VFNWuViU6dpFC6', '--subscription', 'sub_1UEslgFLueI9mUztYc0OLSEg', '--family', 'phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n', '--interval', 'month')
& $phase2Node scripts/phase2-family-downgrade-test-clock.mjs status @phase2PackScope
```

**2. Confirm the intermediate state.** Locally sign in as this disposable owner,
open Billing Settings/Pricing and confirm active Pro/200 while payment is pending.
Do not click **Refresh billing status** yet. Reading either page must not release
the schedule or grant Pack payment. Stop if clock, IDs, scope or invoice differ.

**3. Explicit owner-only invoice finalization**, only while that exact fresh
renewal is still draft/unattempted, with the expected expired paid-through:

```powershell
& $phase2Node scripts/phase2-family-downgrade-test-clock.mjs finalize-renewal @phase2PackScope --invoice in_1UEtTdFLueI9mUztb1bOKZRj --confirm yes
```

This new separate stage in the existing helper proves exact scope, owner,
workspace, active Pro base, one Pack, approved monthly catalog, invoice/period/
amount, no payment conflicts and owned applied schedule if attached. It performs
one invoice-finalize operation with stable `kr-family-pro-finalize:<invoiceId>`
key and `auto_advance=true`. It does not pay, advance the clock, release a schedule,
write Firestore, recreate a customer/subscription, or make an extra invoice/refund.
It rejects an already-open/paid invoice; use read-only status rather than rerunning.
Finalization is not evidence of payment or a promised immediate collection.

**4. Observe collection with READ-ONLY status** (same step 1 command). Let normal
Stripe collection/payment webhooks run. If it remains open/unattempted, stop for
owner review of an explicit payment of this exact invoice in Stripe Sandbox;
do not use the differently scoped past_due helper or advance the clock. No
automatic or arbitrary invoice-pay command is prepared here. If payment fails,
Pack stays invalid and base entitlement follows Stripe's actual subscription status.

**5–6. Verify payment authority.** Require paid status, zero remaining balance,
correct customer/subscription/Pack line, paid-through **1794496970000**, grant
count **1 -> 2 exactly**, and effective **Pro/1200**. Duplicate paid event aliases
must leave count at 2. An open/finalized unpaid invoice must remain Pro/200.

**7. Cleanup only if still needed.** A payment webhook may already release the
owned applied schedule automatically. Otherwise, require fresh status
`scheduleReleaseNeeded=true` and `safeToReconcileAppliedSchedule=YES`; in the
local owner's Billing Settings click **Refresh billing status once**. This action
cannot manufacture payment. Expect fresh detached/released proof and neutral
confirmation, with no repeated Pro plan-change success toast.

**8–9. Final READ-ONLY harnesses**, after payment and release are actually proven:

```powershell
.\scripts\phase2-lifecycle.ps1 -Test ProAfterFamilyDowngradeWithAIPack -Email phase2-family-downgrade+pack@example.test -ExpectedWorkspaceId phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n -ExpectedCustomerId cus_VFNWuViU6dpFC6 -ExpectedSubscriptionId sub_1UEslgFLueI9mUztYc0OLSEg -ExpectedSeatCount 1
.\scripts\phase2-lifecycle.ps1 -Test AllReadOnly -Email phase2-family-downgrade+pack@example.test -ExpectedWorkspaceId phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n -ExpectedCustomerId cus_VFNWuViU6dpFC6 -ExpectedSubscriptionId sub_1UEslgFLueI9mUztYc0OLSEg -ExpectedSeatCount 1
```

The harness remains READ-ONLY. Only reporting was extended; its schedule-cleared
and paid-Pack assertions remain strict. This earlier draft/attached checkpoint
was not a final harness pass. Codex executed none of stages 2–9 or recovery
mutations during implementation; the owner subsequently completed recovery and
both harnesses passed, as recorded below.

## Final completed owner validation — monthly Family + AI Pack -> Pro + AI Pack (2026-09-12)

**Status: COMPLETE for this real local Stripe Sandbox specimen.** The owner
confirmed the recovery, final financial/entitlement evidence and harness results.
These are owner-executed results, not a fresh Codex-run payment or verification.
The earlier historical plan/checkpoints are retained; they no longer describe
pending work for this specimen. No manual reconciliation remains necessary.

| Specimen | Value |
| --- | --- |
| Email / UID | `phase2-family-downgrade+pack@example.test` / `FgMEvbGB3xGBOlFTJ9xq1DVTj90n` |
| Customer / subscription | `cus_VFNWuViU6dpFC6` / `sub_1UEslgFLueI9mUztYc0OLSEg` |
| Family workspace | `phase2_family_downgrade_FgMEvbGB3xGBOlFTJ9xq1DVTj90n` |
| Test Clock / frozen time | `clock_1UEslSFLueI9mUztSncNOSAU` / `1791818571` |
| Renewal invoice | `in_1UEtTdFLueI9mUztb1bOKZRj` |

### Actual completed lifecycle

1. Family + AI Pack began active at the pooled allowance of **1600**.
2. The end-of-period downgrade scheduled Family -> Pro while preserving AI Pack.
3. Stripe changed the base to Pro while the new **$9.98** renewal invoice was draft.
4. Corrected commercial-clock logic resolved **Pro/200**: recurring Pack item
   present, expired prior paid-through, no entitlement for the new unpaid period.
5. The owner explicitly finalized the invoice with the guarded helper.
6. The invoice became open/unattempted and correctly remained **Pro/200**.
7. The owner used Stripe Sandbox **Charge customer once** with the existing
   successful Visa test payment method.
8. The invoice paid successfully for **$9.98**.
9. Signed payment processing extended Pack paid-through to **1794496970000**;
   grant count moved exactly **1 -> 2**.
10. Effective allowance became **Pro + AI Pack / 1200**, user-owned.
11. The authoritative payment webhook automatically released/detached the
    applied downgrade schedule.
12. No manual **Refresh billing status** was required.
13. `ProAfterFamilyDowngradeWithAIPack` and `AllReadOnly` both **passed**.

The clock stayed frozen at 1791818571 during recovery. Finalization alone did
not grant Pack; the successful payment supplied the new period's authority.
Automatic schedule cleanup was an effect of authoritative payment processing,
not an independent manual step or manufactured payment/grant.

### Final owner-confirmed state

| Evidence | Final result |
| --- | --- |
| Invoice status / attempted / attemptCount | `paid` / `true` / `1` |
| Invoice amountDue / amountPaid / amountRemaining | `998` / `998` / `0` cents |
| Pack invoice-line period end / paidThrough | `1794496970000` / `1794496970000` |
| Canonical plan / status / interval | `pro` / `active` / `month` |
| Pack status / derived state | `active` / `paid_renewing` |
| Recurring item / current paid-through valid / entitlement valid | `true` / `true` / `true` |
| Pack renewal pending / grant count | `false` / **2** |
| Effective plan / paid entitlement / AI allowance | `pro` / `true` / **1200** |
| Allowance ownership | `user-owned` |
| Family workspace / retained seat records / paid Family seat limit | preserved / **1** / **0** |
| Collaborators per tree / storage | **10** / **50 GiB** |
| Schedule | fully released/detached automatically by authoritative webhook processing |
| scheduleReleaseNeeded / safeToReconcileAppliedSchedule / scheduleId | `false` / `NO` / `null` |
| Stripe graph | exactly one Pro monthly item and exactly one AI Pack monthly item |
| Pending invoice items / draft invoices / refund total | **0** / **0** / **0** |

The same customer/subscription/workspace were preserved. `AllReadOnly` additionally
confirmed exactly one Pro base item, no other base-plan item, an active renewing
base subscription, an authoritatively active renewing Pack and a Stripe Pack item
count of exactly one. The final gate `NO` reflects no attached schedule needing
release; it is not a failed cleanup test. The original 500's exact exception
remains unproved, independently of this successful final recovery.

### Final harness and test results

| Validation | Owner-confirmed result |
| --- | --- |
| ProAfterFamilyDowngradeWithAIPack | **PASS** |
| AllReadOnly | **PASS** |
| Root suite in clean PowerShell environment | **274 tests / 274 passed / 0 failed** |
| Functions build / suite | passed / **212 tests / 212 passed** |
| Accepted lint baseline | **0 errors / 50 existing warnings** |

The initial root run in the lifecycle PowerShell shell produced nine failures
because that shell intentionally enabled the commercial Test Clock adapter
environment. The owner removed the lifecycle emulator/clock variables and reran
in a clean PowerShell environment: **274/274 passed, zero failures**. This was
environment contamination, not a product regression. Keep lifecycle and isolated
unit-test shells separate; no application/test changes were needed for this rerun.

The [remediation report](PHASE2_REMEDIATION_REPORT.md) retains the accepted Phase 1
audit baseline and residual production-high Genkit/OpenTelemetry findings under
their existing compensating controls. This completed lifecycle does not make
`npm audit` clean and adds no ignores, overrides or suppressions.

This final update changes billing documentation only. All existing uncommitted
work is preserved. No commit/push/deploy/merge, Stripe mutation, Test Clock
advance, Firebase Emulator reset/reseed/write or dependency/lockfile change was
performed by Codex for this documentation update.
