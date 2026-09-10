# Phase 2 server-authoritative billing remediation

## Implemented

- Added a server-only Stripe product/price catalog. Checkout accepts logical
  plan/interval values and rejects arbitrary price IDs, invalid intervals,
  browser redirect URLs and malformed add-on selections.
- Bound Checkout and Portal identity to the verified Firebase caller and the
  canonical UID/customer mapping. Ambiguous customer recovery fails closed.
- Added duplicate subscription checks, server-generated return URLs, and
  server-authenticated AI Pack eligibility.
- Added atomic webhook event claiming, safe ledger fields, supported-event
  filtering, out-of-order timestamp protection and idempotent AI Pack grant
  records.
- Added a canonical paid-status/entitlement resolver. `active` and `trialing`
  are paid; past-due and terminal states resolve to Free without deleting data.
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
- Updated Storage Rules to select the server-owned Family or user counter and
  charge only positive replacement deltas while keeping deletes available.
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
- Downgrades preserve data and block new usage beyond Free limits.
- Storage Rules use server-owned user or Family counters and upload checks are
  server-authorized where available, but the current counters are not
  atomically maintained by every upload/replacement/delete path; full byte
  reconciliation remains a Phase 3/4 data-integrity item.
- Owner-approved policy decisions are implemented: GEDCOM import/export is
  available on Free, Pro and Family without consuming visual export allowance;
  Free collaboration permits one Editor plus one Viewer, or two Viewers, per
  tree. GEDCOM and tree collaboration remain independent of Family account
  seats.
- No live production charges are part of this change. Test-mode lifecycle
  validation is required before approval.

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

- Root `npm run typecheck`: passed.
- Root `npm run lint`: completed with the repository's existing warnings and no errors.
- Root `npm test`: 67 tests passed, including six GEDCOM accounting tests.
- Functions `npm run build`: passed under the compiled Node 20-targeted source.
- Functions billing regression suite: 25 tests passed, including ten
  collaboration policy and Firestore-rule tests.
  Node's test runner. The package `npm test` wrapper cannot spawn its child test
  process in this restricted Windows session (`spawn EPERM`).
- Webhook ordering regression coverage includes sequential newer-then-older,
  concurrent older/newer, equal timestamps, user billing, and Family billing;
  all persisted-state assertions pass.
- Current-source Gitleaks scan: passed. The full-history scan still reports the
  three documented public Firebase browser-key findings; no private billing or
  AI credential was added.
- Root production build and exact `npm ci` both reached the sandbox's blocked
  process-spawn path (`spawn EPERM`). The required clean-install behavior was
  also verified with `npm ci --ignore-scripts` after the failed cleanup; no
  package manifest or lockfile changed.
- Functions exact `npm ci` hit the same restricted process-spawn path; the
  dependency tree was restored with `npm ci --ignore-scripts`, after which the
  Functions build and direct billing tests passed.
- Stripe test-mode end-to-end lifecycle and authenticated Preview regression are
  intentionally pending the draft PR deployment and isolated test account.

The dependency audit baseline above is preserved verbatim from Phase 1. This
remediation does not claim a green audit or change those accepted residual
counts.
