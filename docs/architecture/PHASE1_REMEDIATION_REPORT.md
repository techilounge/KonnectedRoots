# Phase 1 remediation report — 2026-09-09

Branch: `refactor/phase1-repository-architecture`, based on merged PR #3 master `d236a581a575cdacbf8a8a27c9d2c24eb4d46d21`. Prepared for draft review, not automatic merge. No dependency/lock changes, credential rotation, history rewrite, production settings change or Phase 2 billing redesign.

## Removed files and privacy

| Current-tree removal | Reason / reference review |
| --- | --- |
| Root family GEDCOM export | Contains 25 named individual records and dates with no synthetic marker; no source/test reference. Treated as potentially identifiable family data, not copied into logs/docs/fixtures |
| .modified | Empty accidental marker, no references; now ignored |
| src/ai/genkit.ts | Unimported empty-plugin initializer; current flows use the gateway. Explicit dev entry/scripts and packages remain |
| src/app/(auth)/layout.tsx | Empty route group with no pages; actual auth routes are outside it, so it did not wrap them |

No historical purge was attempted for the GEDCOM. **Owner review:** determine data provenance/consent and whether a separate privacy response is needed for historical copies. This finding concerns family data, not a new credential leak, and does not reopen the CLOSED P0 credential incident. Personal `.ged`/`.gedcom` exports are ignored; existing tests generate clearly synthetic genealogy records, so no replacement personal-data fixture is needed.

Uncertain public images/screenshots, `.idx`, `.vscode`, shadcn configuration, Firebase Hosting stanza, CORS artifact and operator scripts are retained with their purposes/limitations documented. Unreferenced public URLs and deployed triggers are not proven unused.

## Configuration and architecture corrections

- Added typed public config and a public-only barrel; all application public URL/Firebase/price reads use it. Browser-required Firebase fields fail with field names only; SSR placeholders are limited to credential-free static rendering.
- Added guarded server config with lazy private/runtime getters. Admin credential validation remains fail-closed; removed hardcoded Admin project/bucket defaults so explicit web settings/service-account project/ADC supply the runtime project.
- Added independent Functions config on Node 20. Stripe secret validation happens when accessed; existing secret bindings remain unchanged. Billing/email/invitation links use Functions APP_URL consistently, retaining the production default.
- Added an explicit server-only guard to server billing usage. Existing Admin/AI guards remain; no private export is added to a client barrel.
- Consolidated duplicated Invitation interfaces into a domain module and aliased the duplicate relationship type. Kept existing billing/AI domains rather than introducing one oversized model file.
- Removed GEDCOM person/family debug dumps. Provider-backed Next action errors use generic client messages and classified server logs; Resend responses no longer return raw provider failures or log recipient lists.
- Replaced the starter README and updated AGENTS/CHANGELOG; added the [system map](SYSTEM_ARCHITECTURE.md), [boundary report](BOUNDARY_REPORT.md), [route/Function inventory](ROUTE_FUNCTION_INVENTORY.md) and [environment reference](../configuration/ENVIRONMENT_VARIABLES.md).

No new environment names or secrets are required. The examples contain placeholders only. Optional vs required values, runtime-provided markers, CLI exceptions and Development/Preview/Production behavior are documented. No Firebase Console, Google Cloud, Vercel environment or repository visibility settings were changed.

## Tree title and build fixes

**Title root cause:** the browser resolves slugs and IDs; server metadata treated the slug as an ID and falsely returned `Tree Not Found`. Metadata now supports public slugs/IDs, uses canonical document IDs and returns indistinguishable generic noindex metadata for private/missing/ambiguous/failure cases. The authenticated Firestore snapshot updates the browser title without another private read; failure and cleanup reset it. Anonymous requests never receive private tree names/counts. Request-local memoization avoids repeated metadata reads.

**Build root cause:** static sitemap and tree layout imported eager Admin initialization, requiring credentials before route collection. The sitemap now lists eight deterministic public marketing/legal routes without database access, excluding all authenticated tree URLs. Runtime public tree metadata imports Admin lazily inside its error boundary. A clean local production build now succeeds without private Admin credentials. Privileged runtime actions still require configured credentials; no fake credentials or relaxed production loader were introduced.

The separate full-tree PDF/PNG clipping fix remains PR #4. This branch does not import that unmerged work or claim off-screen export completeness.

## Validation and before/after

| Check | Before / after |
| --- | --- |
| Root npm ci | PASS from unchanged lockfile; npm reported install-script approval warnings without install failure |
| Root typecheck | PASS after regenerating Next route types for the removed empty layout |
| Root lint | PASS, zero errors / 48 existing warnings |
| Root tests | 50 → 58 passing |
| Local production build | Previously failed page-data collection without Admin credentials → PASS, including static sitemap |
| Functions npm ci / build | PASS on Node 20.20.2 |
| Functions tests | 4 → 7 passing on Node 20.20.2 |
| Root audit | Unchanged: 67 total, 55 moderate, 12 high, 0 critical; exit 1 |
| Root production audit | Unchanged: 62 total, 55 moderate, 7 high, 0 critical; exit 1 |
| Functions audit | Unchanged: 9 total, 9 moderate, 0 high, 0 critical; exit 1 |
| Gitleaks current source | PASS, no findings; no scanner suppressions changed |
| Remote CodeQL / PR secret scan / Vercel | To be checked on the published draft PR; do not infer remote results from local commands |
| Authenticated Preview regression | Pending owner sign-in on the new Preview; no live charge or synthetic production mutation performed |

Added tests cover private/missing metadata equivalence, public slug/canonical resolution, ambiguity, transient failures, authorized title selection, database-free deterministic sitemap, public config isolation, safe logging, and lazy Functions settings. Existing provider/credential/Stripe tests remain. The test loader now supports dotted TypeScript filenames and directory entry points; security assertions were preserved.

The initial Functions verification request was blocked by an automatic approval usage-limit error. After approval-backed commands became available again, the required Node 20 install/build/audit and seven tests completed. Sandbox-only child-process failures were rerun through the normal approval path; neither those failures nor the initial block is represented as a pass.

The accepted seven production-high Genkit/OpenTelemetry findings remain under the same controls: unused/disabled exporters and propagators, no public telemetry listener, no runtime auto-instrumentation preload, and tracking patched parent releases. No new high/critical package or expanded telemetry reachability was introduced. npm audit is not clean.

## Remaining debt and Phase 2 deferrals

- Standard admin actions/rules accept protected server-read profile role fallback; AI credential control requires verified claims. Unifying this requires a deliberate authorization migration.
- UserProfile vs billing types differ in timestamp representation, optional fields, legacy `team` plans and entitlement/usage structure. Invitation is consolidated, but persisted-data schema changes are deferred.
- Existing browser billing usage/entitlement helpers and Functions billing truth need Phase 2 reconciliation; caller-supplied checkout redirect allowlisting is also deferred.
- Legacy server upload action has no source caller but uses browser Storage without browser Auth. Retire or redesign only after endpoint-use/authorization review.
- Inert `setTreeOwnerClaim` Function, legacy Hosting/CORS configuration and possibly unused public images need owner confirmation before removal.
- Firebase Studio demo emulators are not wired into application clients; document this hazard and use an isolated development project until emulator support is deliberately implemented.
- `visibility: public` does not grant anonymous tree access in current rules; future sharing/indexing needs an explicit publication contract.
- Genkit dev entry/scripts and dependencies remain pending developer-tooling ownership. No package was removed solely to improve audit counts.
- Broader admin/trigger personal-data logging review, common API error formats, emulator rules coverage and paid feature redesign are deferred.

## Preview and production regression checklist

On the draft Preview, verify Google login, email/password login, dashboard, tree open/title, add/edit/save, undo/redo, deterministic relationship finder, PDF and GEDCOM export, admin/users, admin/ai-configuration, synthetic OCR, pricing, and signed-out protected routes. Use a disposable synthetic tree and delete it afterward. Do not perform live charges. Record actual results separately from build status; only owner-authorized exact Preview hostnames may be temporarily added, with removal after testing.

After owner review and squash merge, repeat production sign-in, dashboard/tree/title and admin/AI smoke checks. Functions deployment remains a separate deliberate operation. Outstanding Preview/production checks are release gates, not assumed successes.
