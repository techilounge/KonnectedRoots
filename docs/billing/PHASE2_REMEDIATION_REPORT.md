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
- Kept AI debit and export metering server-side. GEDCOM eligibility is checked
  by the server action. Browser-generated export bytes remain a documented
  portability/UX boundary until a server export service is approved.
- Family AI usage is debited from the server-owned Family workspace pool, and
  missing billing period data fails closed rather than granting stale paid access.
- Added server-owned quota checks to Storage create/update rules while keeping
  deletes available to authorized tree editors and profile owners.
- Added an admin billing reconciliation-health view and updated pricing values
  to the current product structure.

## Policy decisions

- Free collaboration remains limited to viewer roles; tree role and billing
  entitlement are combined, never substituted for one another.
- Family seats are six account seats and are distinct from tree collaborators.
- Downgrades preserve data and block new usage beyond Free limits.
- Storage reporting is canonical and upload checks are server-authorized where
  available; full byte reconciliation remains a Phase 3/4 data-integrity item.
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
- Root `npm test`: 61 tests passed.
- Functions `npm run build`: passed under the compiled Node 20-targeted source.
- Functions billing regression suite: 11 tests passed when invoked directly with
  Node's test runner. The package `npm test` wrapper cannot spawn its child test
  process in this restricted Windows session (`spawn EPERM`).
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
