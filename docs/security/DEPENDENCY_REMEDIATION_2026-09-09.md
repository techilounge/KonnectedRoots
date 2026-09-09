# Dependency remediation — 2026-09-09

Status: **draft PR; Vercel Preview build passed; residual high findings and authenticated regression verification remain open**. Work started from `c264c23019be9295b3443aa102c1782f0e650308`, matching remote master, in the fresh post-rewrite checkout on `security/dependency-remediation`. No history rewrite, old-object import, credential change, backup restoration, merge, or production deployment was performed.

## Before / after

Network-backed npm audit results; these are affected-package counts, including inherited findings, not distinct CVEs. Audits exited nonzero because findings remain. The sandbox initially returned a misleading empty audit; only unrestricted registry responses were used as evidence. Advisory metadata changed during the run, so the final snapshots supersede intermediate install summaries.

| Scope | Low before → after | Moderate before → after | High before → after | Critical before → after | Total before → after |
| --- | --- | --- | --- | --- | --- |
| Root, all dependencies | 3 → 0 | 71 → 55 | 32 → 12 | 6 → 0 | 112 → 67 |
| Root, production only | 2 → 0 | 68 → 55 | 20 → 7 | 6 → 0 | 96 → 62 |
| Functions | 1 → 0 | 16 → 9 | 9 → 0 | 3 → 0 | 29 → 9 |

The [complete high/critical inventory](DEPENDENCY_INVENTORY_2026-09-09.md) records every baseline package, installed lockfile path/version, production/dev classification, direct/transitive classification, advisory identifier/range, minimum published audit-safe version, breaking assessment, and final resolved version/status. For inherited findings, remediation depends on child versions; npm's obsolete-major suggestions do not establish a safe supported parent.

## Upgrade decisions

| Dependency | Baseline → selected | Compatibility decision |
| --- | --- | --- |
| Next.js / eslint-config-next | 16.1.1 → 16.3.4 | Same major; React and React DOM stay 18.3.1, within Next's declared peer range. Includes August security fixes. |
| jsPDF | 4.0.0 → 4.2.1 | Same major; image-based PDF export exercised with actual Sharp/jsPDF packages. |
| Sharp | 0.34.5 → 0.35.4 | Deliberate pre-1.0 minor migration; requires Node ≥20.9. Raster decode/resize/encode tested. |
| PostCSS | 8.5.2; Next copy 8.4.31 → 8.5.28 | Same major; patched root and parent graph. |
| Firebase browser SDK | 11.10.0 → 12.18.0 | Major migration; existing modular Auth/Firestore/Storage/Functions APIs typecheck. Live login still requires preview verification. |
| Firebase Admin root / Functions | 12.7.0 / 13.6.0 → 13.10.0 | Root major migration; preserves namespace API and Node 20. Version 14 requires Node 22 and removes namespace APIs, so it is deliberately excluded. |
| Firebase Functions root / Functions | 5.1.1 / 7.0.3 → 7.3.2 | Root major alignment with actual deployed Functions package; v2 callable/webhook handlers compile. |
| Genkit, Next integration, CLI | 1.27.0 → 1.42.0 | Keep current stable parent graph; no obsolete 0.x downgrade. Residual OpenTelemetry/ZIP findings below. |
| Legacy Google Genkit integration | @genkit-ai/googleai 1.27.0 → @genkit-ai/google-genai 1.42.0 | Supported replacement for deprecated package. No source imports used the old integration; the working server gateway and all six AI features remain unchanged. |
| Functions Resend / Stripe | 6.7.0 / 20.1.2 → 6.26.0 / 20.4.1 | Same-major upgrades; preserve Stripe's existing major/API behavior. |

Compatible transitive updates resolve protobufjs (7.6.6), fast-xml-parser (5.11.1), websocket-driver (0.7.5), handlebars (4.7.9), gRPC, node-forge and other baseline high/critical findings through the supported parent graph. Consult the inventory for exact per-package versions. No new overrides, audit ignores, forced audit fixes, feature removals or weakened credential checks were introduced. The existing Babel runtime override is unchanged.

Sources: [Next August security release](https://nextjs.org/blog/august-2026-security-release), [Firebase Admin release notes](https://firebase.google.com/support/release-notes/admin/node), [Genkit supported Google integration](https://genkit.dev/docs/js/integrations/google-genai/), [jsPDF releases](https://github.com/parallax/jsPDF/releases). npm registry manifests supplied exact versions and engine/peer constraints.

## Residual high findings: explicit risk assessment

These are unresolved findings, not accepted-risk approvals. Application-source reachability review is not proof of deployed environment configuration. Review the runtime environment before approving release.

### OpenTelemetry / Genkit: seven production high package findings

Affected parents: `@genkit-ai/core`, `@genkit-ai/firebase`, `@genkit-ai/google-cloud`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/propagator-jaeger`. Latest Genkit 1.42.0 still constrains OTel core/trace packages to ~1.25 and SDK to ^0.52; its Google Cloud package constrains auto-instrumentations to ^0.49.1.

- [GHSA-q7rr-3cgh-j5r3 / CVE-2026-44902](https://github.com/advisories/GHSA-q7rr-3cgh-j5r3): malformed requests can crash an enabled Prometheus exporter. Patched SDK ≥0.217.0 and auto-instrumentations ≥0.75.0 cross these parent ranges. No app source enables Prometheus, auto-instrumentation registration, or Genkit Firebase/Google Cloud telemetry. `src/ai/genkit.ts` has no incoming source imports; current flows use the separate gateway. Exploitability through current application code is therefore not established, but runtime preload or `OTEL_METRICS_EXPORTER=prometheus` could make it reachable.
- [GHSA-45rx-2jwx-cxfr / CVE-2026-59892](https://github.com/advisories/GHSA-45rx-2jwx-cxfr): malformed Jaeger propagation headers can cause an uncaught exception. Patched propagator ≥2.9.0 is a major OTel migration. No app source selects the Jaeger propagator; runtime `OTEL_PROPAGATORS` or external instrumentation could activate it.
- Existing controls: provider calls go through the app's authenticated gateway; app telemetry is its own Firestore implementation. Required deployment controls: keep these unused exporters/propagators disabled, do not preload the vulnerable auto-instrumentation, and never expose a metrics/developer port publicly. Auth does not protect an independently exposed metrics listener.
- Upgrade path: adopt a Genkit release with a coherent patched OTel 2.x/SDK family and compatible Google exporters; test tracing/metrics initialization and shutdown together. Do not override one OTel leaf across majors while its peers remain 1.x. Owner should review this exception before merging and recheck upstream releases before deployment.

### Genkit development tooling: five additional high package findings

Affected: `genkit-cli`, `@genkit-ai/telemetry-server`, `@genkit-ai/tools-common`, `adm-zip`, `extract-zip`. These are dev-only and absent from the production-only high count.

- [GHSA-xcpc-8h2w-3j85 / CVE-2026-39244](https://github.com/advisories/GHSA-xcpc-8h2w-3j85): adm-zip <0.6.0 permits excessive allocation from a crafted archive. `@genkit-ai/tools-common` uses 0.5.18 to download/extract developer UI assets. Version 0.6.0 crosses its ^0.5 range and also has [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9), so there is no fully safe published target established by this audit. The ZIP reader is reachable when starting Genkit's developer UI, not via the app's export/OCR routes. Existing asset URL is a package-defined upstream URL; that reduces arbitrary user input but does not eliminate compromised-asset/cache risk.
- [GHSA-jmr9-qjv8-65gv / CVE-2026-56876](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) and [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3): extract-zip 2.0.1 permits symlink archive traversal/arbitrary writes. No patched published version exists. It remains a declared CLI dependency; no executable import was found in installed CLI JS or app code. This reduces current reachability, not the package finding.
- Controls: run developer tooling only with trusted assets in an isolated unprivileged workspace; keep it off public interfaces, production runtimes and untrusted archive inputs. The PR does not remove developer workflows to hide findings.
- Upgrade path: require an upstream CLI/tools-common release replacing or patching these extractors. Reject npm's genkit-cli 0.0.2 recommendation. Telemetry-server also inherits the OTel findings above.

### Remaining moderate findings

Root findings additionally inherit vulnerable OTel core, `uuid` and `qs`; Functions' nine moderate packages all trace to uuid <11.1.1 through Firebase Admin's Google clients. uuid's advisory concerns v3/v5/v6 with a caller-provided output buffer; app source does not call those APIs, and the SDK paths inspected use generated request IDs. This is a reduced-reachability assessment, not a waiver. A global uuid 11/13 override across older parents is deliberately avoided. Upgrade compatible Google client/Genkit parents once available, with the Node runtime/namespace migration reviewed separately. Root qs is used by Genkit's Express dependency; the app uses Next handlers and has no Genkit HTTP route registered. Keep Genkit developer servers isolated. All findings remain visible to npm audit.

## Validation

| Check | Result |
| --- | --- |
| Root `npm ci` | PASS from lockfile |
| `npm run typecheck` | PASS, zero errors |
| `npm run lint` | PASS, zero errors; 48 warnings from current rules |
| `npm test` | PASS, 50 tests |
| Root `npm run build` | Compiles and completes TypeScript; page-data collection fails closed without Firebase Admin credentials at sitemap.xml. No local production credentials supplied. |
| Root audits (all / omit dev) | Completed against registry; residual findings in table |
| Functions `npm ci` | PASS, repeated with actual Node 20.20.2 executable and npm CLI; no runtime engine mismatch on that run |
| Functions `npm run build` / Node 20 tsc | PASS |
| Functions tests on Node 20 | PASS, four tests; fixed Windows glob expansion with portable test discovery |
| Functions audit | Completed; no high/critical, nine moderate |
| Full rewritten-history Gitleaks | Reports three existing GCP API-key findings in public Firebase configuration locations; no private-key finding. Restrictions/owner reconciliation remain unverified. No history or scanner ignores changed. |
| Gitleaks staged changes / current directory | PASS. Temporary public npm registry metadata triggered a generic-key heuristic; the untracked downloaded metadata was removed after inventory generation, then the directory scan passed. No scanner exception added. |
| Vercel Preview | PASS for remediation commit `58aba6e02176ba7b31f8d29af4dcd09660b7a5a8`; GitHub deployment 6343739916 reports success / “Deployment has completed”. |
| GitHub CodeQL / Gitleaks | PASS on PR #3 for the remediation commit. |
| Authenticated browser regression | BLOCKED by Firebase browser-key HTTP referrer restriction after Vercel sign-in; exact preview origin rejected. See follow-up below. |

Root tests exercise credential fail-closed behavior, admin claim enforcement, AI configuration, OCR schemas, provider adapters, real raster normalization, quotas, deterministic relationships and the new Sharp/jsPDF and GEDCOM regressions. Functions tests mock external Stripe/Firestore boundaries and cover authenticated checkout/portal construction, unauthenticated rejection, active-subscription rejection and webhook email deduplication. No live charge, email or AI request was made.

The only app source change memoizes and declares the layout-history loader before its effect, satisfying the upgraded lint rule without disabling it. Authenticated browser login, admin navigation, tree canvas rendering/editing/undo and browser downloads still need a configured preview session; the unit tests do not replace those checks.

## Preview / reviewer gate

Do not merge automatically. Confirm the PR commit reaches **Ready** in Vercel Preview using existing trusted Preview credentials. Then sign in with a test user and test admin, load/edit a disposable family tree, undo/redo, export PNG/PDF/GEDCOM, run OCR and AI configuration checks with approved test providers, and exercise Stripe test-mode checkout/portal plus Functions in an emulator/test project. Record the deployment URL, commit and results here. Do not use production transactions or substitute fabricated build credentials.

Published [draft PR #3](https://github.com/techilounge/KonnectedRoots/pull/3). The remediation commit's successful [Vercel deployment](https://vercel.com/techilounges-projects/konnectedroots/8jrs6g1gCkwMzbogJiWR1bDxMbnP) serves [this immutable preview](https://konnectedroots-fj31xn2b0-techilounges-projects.vercel.app). A subsequent documentation-only commit records these results. Browser smoke tests could not pass the Vercel authentication gate, so login, admin pages, canvas interaction, downloads and live OCR/billing/Functions behavior are not claimed as verified.

### Browser follow-up after Vercel sign-in

The user authenticated to Vercel. Latest tested commit `302c2d3` also passed Vercel, CodeQL and Gitleaks. Browser verification on the branch preview confirmed:

- Landing and Login pages render; email/password and Google sign-in controls are present.
- Signed-out `/admin` displays restricted access and redirects to `/login?redirect=/admin`.
- Pricing renders correctly; monthly/yearly switching updates Pro and Family prices. No checkout session or payment was initiated.
- The application login attempt displays `auth/requests-from-referer-https://konnectedroots-git-security-depend-dd4f14-techilounges-projects.vercel.app/-are-blocked.` This is an environment HTTP-referrer rejection, not evidence that authenticated SDK behavior passed or failed after the upgrade.

Required owner configuration for the browser key used by this Preview: add only `https://konnectedroots-git-security-depend-dd4f14-techilounges-projects.vercel.app/*` to its existing website restrictions. Preserve every existing approved entry and Firebase-only API restrictions; do not allow `*.vercel.app` or remove restrictions. Also verify the exact hostname is in Firebase Authentication's authorized domains for Google sign-in. The HTTP-referrer rejection is confirmed; the Auth authorized-domain setting has not been inspected. See [Firebase key management](https://firebase.google.com/docs/projects/api-keys) and [the existing browser-key runbook](FIREBASE_BROWSER_KEY.md).

No cloud restriction, key, credential, or authorized-domain configuration was changed. Authenticated admin/tree/export/OCR/billing/Functions browser checks remain pending until this origin is approved and application sign-in succeeds.

### Authenticated preview regression results — 2026-09-09

After the owner approved the preview origin and signed in, the following checks passed in the live Preview:

- Dashboard loaded the authenticated TechiLounge account and existing trees.
- Admin overview loaded with live Firestore/Stripe/Functions status cards.
- AI Configuration loaded provider metadata and model health; the synthetic `extractDocumentText` controlled test completed successfully with valid JSON, 1,109 input tokens, 100 output tokens and reported cost `$0.001207`. No user credits were deducted.
- A disposable tree named `Dependency Regression 2026-09-09` was created. A person was added, edited to `Synthetic Regression`, saved, and the change persisted after reload.
- Canvas undo changed the person back to `New Person`; redo restored `Synthetic Regression`.
- Export dialog rendered PNG, PDF and GEDCOM options with the expected Pro/Family unlimited allowance. Clicking PDF began the export flow, but the browser download event was not captured before timeout; the pure package regression test still verifies Sharp raster data embeds into jsPDF. No payment or external upload was initiated.

The disposable test tree remains in the owner account for manual cleanup because deletion is a destructive action and was not performed automatically. The browser title for the dynamic tree route displayed `Tree Not Found` while the authenticated canvas and data loaded normally; this appears to be a metadata/title defect and is outside dependency remediation scope. Recheck before production release.
