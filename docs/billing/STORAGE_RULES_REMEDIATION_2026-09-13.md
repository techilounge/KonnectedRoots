# Storage Rules and Family quota correction — 2026-09-13

Status: follow-up implementation and validation against committed first
implementation `4edd73e11007d68540c381b056edea90c2b44646`, awaiting owner review.
Branch remains `codex/fix-storage-rules-family-quota`. The original implementation
started at `494f997a9993553e3fc2b70c4d639ab91fcb0a63` (merged PR #7 email hotfix).
Its original 74-test validation/inventory below is a historical checkpoint;
current follow-up corrections and validation are recorded in the final section.
No follow-up changes were staged, committed, pushed, deployed or opened as a PR.
No production records, Stripe state, credentials, dependency versions, runtime
version or public-media policy changed. Both pre-existing scratch scripts remain
unchanged.

## Root cause and compiler warnings

The old tree upload rule could access `trees/{treeId}`, `users/{ownerUid}` and
`families/{familyId}`. Cloud Storage Rules permit only two unique Firestore
documents per evaluation, so legitimate Family uploads could exceed the limit.
Repeated/cached reads do not make a third unique document valid. See
[Firebase's rule limits](https://firebase.google.com/docs/rules/rules-behavior).

| Previously reported warning | Correction / observed result |
| --- | --- |
| Unused function `canReadTree` | Removed; public reads have no caller for it. |
| Invalid function name `firestore.get` | Retained the documented supported lookup, limited to tree/user documents. The new compiled rules emit no such warning. |
| Invalid variable name `request` | Reworked helpers with typed/defaulted map access. The new compiler emits no such warning; no scanner/compiler suppression added. |
| Null where map expected (two warnings) | Removed the map-or-null Family binding and Family lookups. Optional maps use defaults/type guards. The object-existence check returns a numeric growth value, not a nullable map. |

The installed Firebase CLI 15.28.2 loaded the actual root Storage and Firestore
rules into fresh, isolated demo emulators. A separate direct compile with its
Storage Rules runtime 1.1.3 returned:

```json
{"errors":[],"warnings":[],"loaded":true}
```

Thus there are **zero Storage Rules compiler errors and zero warnings**.
Production compilation/deployment is not claimed. Supported cross-service access
is documented in the [Storage Rules API](https://firebase.google.com/docs/reference/security/storage).

## Authority design and lifecycle

No existing single user document encoded the effective entitlement of linked
non-owner Family members who own trees. The new server-owned
`users/{uid}.storageAuthority` is a storage-only projection, not a replacement
commercial authority or byte ledger. Its fields are `familyId`, `ownerUid`,
`plan`, `status`, `paidUntil`, matching Stripe customer/subscription IDs, and
`storageUsedBytes` (a retained conservative known floor). Personal Pro authority
continues to come directly from `users/{uid}.billing` in the same lookup.

Family projection requires a server-owned user link, the actual workspace's
owner, Family base plans on both workspace and owner, nonempty matching Stripe
customer/subscription IDs, active/trialing statuses on both, and a valid minimum
paid-period/cancellation cutoff. Missing/mismatched ownership or commercial
mapping grants no Family elevation. Preserved workspace linkage alone is
insufficient. Rules check the projection's linked Family ID and expiry; for the
billing owner they also check live owner billing/status/IDs in that same user
document. When Family paid elevation is unavailable, a prepared account falls
back to its own valid active/trialing Pro (50 GiB), otherwise Free (1 GiB).
Active Family remains first in precedence; a Family-to-Pro billing owner retains
its own valid Pro entitlement.

Ordinary client creates/updates cannot write `storageAuthority`, `billing`,
`usage`, `family`, `entitlements` or `plan`. Existing platform-admin authority is
retained. No browser metadata, file naming, URL unpredictability or client usage
mutation is treated as authority.

Lifecycle maintenance:

1. `updateBillingIfNewer` and `updateFamilyIfNewer` collect current linked-user
   snapshots before their writes and commit projections with the accepted
   authoritative owner/Family mutation. Owner payment attention revokes linked
   users in the owner transaction even while the separate Family document still
   shows its prior active state. Older events remain rejected; the event ledger,
   equal-timestamp behavior, safe retries and per-customer concurrency remain.
2. Managed subscription reconciliation applies projected storage state with its
   existing atomic user/Family mutation, retaining the original conservative
   user/Family usage maximum at Family-to-Pro downgrade.
3. Verified Family owner activation initializes its projection with the existing
   owner link; it creates no additional customer-facing seats.
4. `onStorageUserWritten` and `onStorageFamilyWritten` first compare normalized
   storage inputs before any Admin read. Relevant events re-read current documents
   inside transactions. Owner base-billing transitions refresh linked users;
   personal storage-counter/membership changes refresh just that user. Both triggers enable retries for transient
   failures. Stale event snapshots cannot restore old paid
   state. Field comparisons ignore map order and avoid repeated unchanged writes.
   Out-of-band trusted writes have asynchronous trigger propagation; the normal
   billing paths above update projections atomically.
5. Authenticated `prepareStorageUpload` refreshes existing accounts lazily. An
   empty payload selects the caller's avatar account; `{treeId}` requires current
   owner/editor/manager permission and resolves the owner server-side. Person-photo
   and avatar callers invoke it before upload. It writes only projection state,
   never billing, membership or counters. Storage independently rechecks roles.
   A linked account with missing/mismatched projection denies positive growth
   until prepared; existing deletes and valid non-growing replacements remain
   possible. This is explicit initialization, not silently downgrading active
   linked members to Free.

Projection fanout is limited to a single workspace. A 450-result guard fails the
transaction rather than silently omitting members; current six-seat product
scope remains unchanged. This is not full seat management. Future expansion
requires a reviewed scalable invalidation design. No production backfill or
commercial-record migration was executed.

## Rule behavior and Firestore access budget

Image uploads require the existing `image/.*` content-type policy and size
strictly below `5 * 1024 * 1024` bytes. Product labels use GB; the existing binary
limits remain Free 1 GiB, Pro 50 GiB, Family 100 GiB. Tree roles remain
owner/editor/manager, with viewer/unrelated/anonymous writes denied. Collaborator
plan never changes the tree owner's quota. Avatars remain writable only by their
UID owner. Public reads are preserved.

Create charges the full new size. Replacement checks only positive byte growth;
equal/shrinking image replacements can succeed above quota. Authorized deletes
are independent of quota and image checks. The shared create/update predicate
uses existing `resource` metadata to compute growth. This also exercises correct
replacement decisions with CLI 15.28.2, whose Storage emulator currently labels
an overwrite CREATE while supplying its previous metadata; no emulator code or
rule permission was bypassed.

The table reports maximum unique document access per evaluation, including
invalid/denied requests (early rejection may use fewer). No Storage expression
reads a Family document. Backend projection transactions are outside this Rules
budget.

| Operation | Firestore documents accessed | Maximum count |
| --- | --- | ---: |
| Tree image create | `trees/{treeId}` + `users/{tree.ownerId}` | 2 |
| Tree image update / metadata update | Same tree + owner user | 2 |
| Tree image delete | `trees/{treeId}` only | 1 |
| Tree image read/list where matched | None | 0 |
| Avatar create | `users/{uid}` only | 1 |
| Avatar update / metadata update | `users/{uid}` only | 1 |
| Avatar delete | None; Auth UID check | 0 |
| Avatar read/list where matched | None | 0 |
| All unmatched Storage paths | None; denied | 0 |

## Accounting honesty and deferred work

Positive growth compares against `max(user.usage.storageUsedBytes,
user.storageAuthority.storageUsedBytes)`. Projection refresh conservatively
preserves the maximum of known user usage, previous projected floor and linked
Family usage. Missing/mismatched owner input cannot erase the actual user's
known floor. Downgrade and unlink do not reset known usage or delete content.
Shrinking replacements and deletes stay available above quota.

**Exact atomic byte accounting is not implemented.** Every create/update/delete
does not maintain these counters; simultaneous uploads can each see the same
known floor. Complete shared 100 GB enforcement is therefore not claimed.
Phase 3/4 must implement trusted object-event accounting/reconciliation, handle
replacements/deletes/concurrent reservations, attribute retained/shared objects
and safely lower stale conservative floors. A member may retain a conservative
shared floor after unlink until that trusted reconciliation resolves actual
personal usage. Remaining five-seat lifecycle and public-media privacy policy
remain separately deferred.

## Original implementation validation evidence (74-test checkpoint)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 274/274 passed, 0 failed |
| `npm run lint` | Passed, 0 errors / 50 existing warnings |
| `npm run build` | Passed; compiled and generated all 30 pages/routes |
| `npm --prefix functions run build` | Passed |
| `npm --prefix functions test` with existing local Node 20 | 220/220 passed, 0 failed; includes all seven email secret-binding regressions |
| `npm run test:storage-rules` | 74/74 passed against real Firestore + Storage rule decisions |
| Actual Storage Rules runtime compilation | Loaded, 0 errors / 0 warnings |
| Publishable current-source Gitleaks (all tracked files + proposed new files) | No findings; includes changed source and lockfiles, excludes pre-existing scratch scripts/local ignored secrets |
| Whole working-directory Gitleaks | 2 findings in existing gitignored `functions/.secret.local`: `stripe-access-token` on `STRIPE_SECRET_KEY`, `generic-api-key` on `STRIPE_WEBHOOK_SECRET`. Values redacted; neither tracked nor changed. No suppressions added. |
| `git diff --check` | Passed; Git line-ending notices are not whitespace errors |

The Rules suite covers Free/Pro/Family boundaries, all six non-paid statuses,
trialing, paid-period/cancellation expiry, preserved/missing/mismatched Family
state, owner/editor/manager/viewer/unrelated/anonymous decisions, collaborator
quota independence, positive/equal/shrinking replacements, deletes over quota,
avatar ownership/size/type/quota, public reads, unmatched paths, forged metadata,
and browser create/update denial for every privileged user field. It additionally
persists actual compiled billing mutation transactions into Firestore and checks
member revocation/recovery/old-event rejection, owner downgrade and retained
floors, authenticated upload preparation, live trigger handling, unchanged-map
loop prevention and mismatched owner protection. It is not a source-regex test.
Existing transaction test fixtures now model nested query fields and retain the
first read version so retry assertions remain meaningful.

Emulators use only demo project `demo-konnectedroots-storage-rules` on loopback
ports 18380/18399, hub 18440, logging 18450 and Firestore websocket 18451. The
runner refuses occupied ports; it does not reset/reuse billing emulator data.
Logs stay in ignored `.storage-rules-test/`. Firebase CLI and Java are separately
installed tools, not production npm dependencies.

To reproduce locally after installing Firebase CLI and Java, install root and
Functions locked dependencies, build Functions, then run `npm run
test:storage-rules`. The suite loads the actual compiled projection/webhook
helpers against the demo Firestore instance; it does not start Functions, Auth or
Stripe emulators and never uses the billing lifecycle project.

On this Windows/Temurin Java 21 host, selector startup initially failed creating
an AF_UNIX loopback wakeup socket. The test subprocess uses a nonexistent Unix
socket directory so Java falls back to TCP loopback; no system/runtime/production
setting changes. CLI prints `Unexpected rules runtime error: Picked up
JAVA_TOOL_OPTIONS: ...` for Java's setting notice, and `Firestore Emulator has
exited upon receiving signal: SIGINT` at orderly shutdown. These are the observed
emulator process notices, not Rules compiler warnings. Expected negative
Firestore tests print permission-denied diagnostics. An initial restricted
Functions test/build attempt had `spawn EPERM`; reruns with required local
process permission passed. An initial fixture retry check was corrected by
preserving first transaction read versions, with the final full suite passing.

## Development dependency and npm audit impact

Added exactly one test-only package, `@firebase/rules-unit-testing@5.0.2` (Firebase
12 peer and Node >=20). It supplies authenticated/anonymous test contexts and real
Storage/Firestore decision assertions. No production dependency versions changed;
lock comparison shows one added package, none removed, and zero existing version
changes. Functions package files/locks and Node 20 runtime remain unchanged.

| Audit scope | Owner-accepted prior checkpoint: total/high/critical | Live before addition | Live after addition | Task delta |
| --- | --- | --- | --- | --- |
| Root | 67 / 12 / 0 | 67 / 12 / 0 | 67 / 12 / 0 | 0 |
| Root production | 62 / 7 / 0 | 62 / 7 / 0 | 62 / 7 / 0 | 0 |
| Functions | 9 / 0 / 0 | 8 / 0 / 0 | 8 / 0 / 0 | 0 |

The live Functions difference from the accepted historical checkpoint reflects
current advisory results, not this dependency addition: all eight are moderate,
and no Functions dependency or lock changed. Root remains 55 moderate/12 high;
production 55 moderate/7 high. **npm audit is not clean.** Accepted residual
Genkit/OpenTelemetry production-high findings and their documented compensating
controls remain unchanged. No audit fix, override, ignore or suppression added.

## Original implementation inventory and Git state (historical)

26 proposed files, grouped by purpose:

- Rules: `storage.rules`, `firestore.rules`.
- Server projection/lifecycle: `functions/src/storageAuthority.ts` (new),
  `functions/src/stripeWebhook.ts`, `functions/src/index.ts`.
- Browser preparation/types: `src/lib/billing/storage.ts` (new),
  `src/lib/uploadPersonPhoto.ts`, `src/hooks/useAuth.tsx`,
  `src/lib/billing/types.ts`.
- Real Rules harness: `firebase.storage-rules-test.json` (new),
  `scripts/run-storage-rules-tests.cjs` (new),
  `tests/storage/storage.rules.test.cjs` (new), `.gitignore`, `package.json`,
  `package-lock.json`.
- Existing regression fixtures: `functions/tests/stripeWebhook.test.cjs`,
  `functions/tests/familyDowngrade.test.cjs`, `functions/tests/index.test.cjs`,
  `functions/tests/emailSecretBindings.test.cjs`,
  `scripts/family-lifecycle.test.cjs` (Storage source-regex check replaced by real
  emulator coverage; other assertions retained).
- Documentation: `docs/billing/BILLING_ARCHITECTURE.md`,
  `docs/billing/ENTITLEMENT_MATRIX.md`, `docs/billing/STRIPE_WEBHOOKS.md`,
  `docs/billing/PHASE2_REMEDIATION_REPORT.md`,
  `docs/architecture/SYSTEM_ARCHITECTURE.md`,
  `docs/billing/STORAGE_RULES_REMEDIATION_2026-09-13.md` (new).

At the original pre-commit checkpoint, `git status --short` contained 20 modified
tracked files and six new proposed files (tests collapsed by default), plus the
two unchanged scratch scripts. HEAD then remained at the starting merge commit;
these implementation files are now committed in `4edd73e`. The follow-up state
is recorded below. Scratch scripts, `functions/src/sendEmail.ts`,
`functions/src/scheduledTasks.ts`, Functions dependency files and email secret
bindings remain intact. No credentials were printed or changed.

Proposed commit message, **not executed**:

```text
fix(storage): enforce Family quota authority within two Firestore reads
```

## Manual rollout after review — commands not executed

Use the ordinary reviewed branch/PR workflow before any deployment. Re-run
validation on the reviewed commit. Keep existing production secrets and Node 20;
new projection functions need no Stripe or Resend secret bindings. Deploy
Firestore protection first, then backend projection/refresh support, publish the
reviewed browser build containing upload preparation, initialize/verify a
synthetic owner's and supported linked member's projection through the callable,
and only then deploy Storage Rules. No broad production backfill or billing
mutation is required. Older clients with missing Family projection can see
positive-growth denials until initialized/refreshed.

Exact targeted Firebase commands from the repository, **only after owner
review/approval**:

```powershell
firebase deploy --project konnectedroots-u5xtb --only firestore:rules
firebase deploy --project konnectedroots-u5xtb --only "functions:prepareStorageUpload,functions:onStorageUserWritten,functions:onStorageFamilyWritten,functions:stripeWebhook"
# Publish/verify the reviewed browser build and trusted projection initialization before proceeding.
firebase deploy --project konnectedroots-u5xtb --only storage
```

No blanket Functions deployment, email-hotfix change, Node migration, Stripe
configuration change or data deletion is included. Production compilation,
Firestore cross-service IAM authorization and an authenticated synthetic upload
smoke test remain deliberate post-review deployment checks, not local claims.

## Follow-up correction and validation since 4edd73e

Local review blockers are corrected; this follow-up remains uncommitted and
awaiting owner review. No deploy, push, PR creation, merge or dependency change.

### Quota precedence

Removed the early projected-Family-to-Free branch. After the deliberate linked
missing/mismatched-projection guard, Storage Rules resolve: valid active Family
projection -> 100 GiB; otherwise valid personal active/trialing Pro -> 50 GiB;
otherwise Free -> 1 GiB. Personal Pro never overrides actually active Family.
Non-entitled personal Pro remains Free. Owner downgrade keeps known usage floors.

### Exact trigger relevance predicates

Both exported helpers compare named scalar inputs, not serialized maps. Nonempty
strings remain strings; missing/empty/non-string identifiers become null. Bytes,
periods and cancellation timestamps use the existing nonnegative safe-integer
normalization (invalid/missing -> 0). Map ordering and unrelated fields are ignored.

`storageUserInputsChanged(before, after)` compares exactly:

- `family.familyId`
- `usage.storageUsedBytes`
- `billing.plan`, `billing.status`, `billing.currentPeriodEnd`
- `billing.scheduledCancellationAt`
- `billing.stripeCustomerId`, `billing.stripeSubscriptionId`

`storageFamilyInputsChanged(before, after)` compares exactly:

- `ownerUid`
- `usage.storageUsedBytes`
- `plan.plan`, `plan.status`, `plan.currentPeriodEnd`
- `plan.scheduledCancellationAt`
- `plan.stripeCustomerId`, `plan.stripeSubscriptionId`

Creation may initialize state. User deletion is relevant only for a previously
linked possible Family billing owner (`billing.plan=family`); the transaction
verifies actual workspace ownership before meaningful remaining-member
invalidation and never recreates the deleted user. Family deletion with prior
owner/base-Family authority invalidates existing member projections; empty or
unrelated deletions short-circuit. These deletion fanouts revoke cached paid
elevation rather than performing meaningless synchronization. Live documents
are re-read, so stale delete/create events cannot replace current authority.

Each handler evaluates its relevance predicate before `admin.firestore()` or any
transaction/query. A `storageAuthority`-only write changes none of these inputs
and returns immediately, avoiding recursive transactions/reads entirely. Profile,
photo, email-preference/activity, AI/export usage and AI Pack-only updates also
short-circuit. The prior fieldwise no-op write guard remains an additional safeguard.

### Single-user upload preparation and fanout

`syncUserStorageAuthority` now always refreshes just its selected user. Avatar
preparation selects the authenticated UID; tree preparation verifies
owner/editor/manager and selects the tree owner. Neither queries linked users,
even for the Family billing owner. Known storage floors remain conservative.

Trusted user triggers request owned-Family fanout only for relevant base-billing
input transitions, after verifying the live Family owner. Membership/personal
storage-counter changes refresh the user only. Relevant Family authority/pool
transitions and meaningful authority deletion retain fanout. Existing webhook
ordering/idempotency/atomic projection fanout and all Resend bindings are unchanged.

### Stripe-ID data minimization decision

Retained projected Stripe customer/subscription IDs. The Storage owner branch
uses both to bind a still-active cached Family projection to the current owner
billing subscription. Dropping them would weaken stale/mismatched-subscription
detection or require another authoritative lookup beyond the two-document budget.
The uniform owner/member projection schema remains; selective removal/migration
and broader user-document read privacy are outside this correction. These IDs
are commercial identifiers, not API keys or webhook credentials. No secret was
added and no read-privacy policy changed.

### New tests and final validation

Added 11 real Storage/Firestore tests: active Family beats personal Pro; inactive
Family falls back to active/trialing personal Pro at the exact 50 GiB boundary;
Free and past_due personal Pro stay at 1 GiB; linked missing projection fails
closed until preparation; owner Family-to-Pro retains floor and 50 GiB;
avatar/tree preparation leaves deliberately stale unrelated member projections
and update times untouched; owner/Family authority deletion invalidates remaining
members while retaining floors. Existing trigger tests now supply actual
before/after Change snapshot shapes and still exercise live-state reconciliation.

Added 43 Functions tests: every listed relevant field, ignored profile/AI/export/
AI Pack/projection-only changes, reordered maps/normalized absent values,
creation/deletion handling, and upload preparation for avatar/owner/editor/manager
without a Family query. Irrelevant handlers use a Firestore factory that throws
if accessed; single-user preparation/counter tests reject any linked-user query.

| Validation | Final follow-up result |
| --- | --- |
| Root typecheck | Passed |
| Root tests | 274/274 passed |
| Root lint | 0 errors / 50 existing warnings |
| Root production build | Passed |
| Functions build / tests under existing Node 20 | Passed / 263/263 passed |
| Real Firestore + Storage Rules tests | 85/85 passed |
| Actual Storage Rules runtime compiler | 0 errors / 0 warnings, loaded |
| Gitleaks publishable changed source | No findings; existing config unchanged |
| `git diff --check` | Passed |

Current audit: root 67 total/12 high/0 critical; production 62/7/0; Functions
8 moderate/0 high/0 critical. No task delta or dependency/lock changes. The
accepted historical Functions 9-total checkpoint and residual production-high
Genkit/OpenTelemetry controls remain documented. Audit is not clean. Exact
atomic/shared byte accounting and remaining seat lifecycle remain Phase 3/4.
Two-document Storage budget and the original access-count table are unchanged.

### Exact follow-up files and Git status

Six modified tracked files and one new test file since `4edd73e`:

```text
 M docs/billing/BILLING_ARCHITECTURE.md
 M docs/billing/PHASE2_REMEDIATION_REPORT.md
 M docs/billing/STORAGE_RULES_REMEDIATION_2026-09-13.md
 M functions/src/storageAuthority.ts
 M storage.rules
 M tests/storage/storage.rules.test.cjs
?? functions/tests/storageAuthority.test.cjs
?? scripts/V1-phase2-lifecycle-V1.ps1
?? scripts/V2phase2-lifecycleV2.ps1
```

The final two entries are pre-existing unchanged scratch scripts, not proposed
changes. Nothing staged; HEAD remains `4edd73e11007d68540c381b056edea90c2b44646`.
Dependencies/locks, Firestore protections, client code, Stripe webhook/email
hotfix and Node 20 configuration are unchanged by this follow-up.

Proposed follow-up commit message, not executed:

```text
fix(storage): tighten projection refresh and Pro fallback
```
