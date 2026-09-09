# Security validation — PR #3 final documentation

## Current PR #3 state

Authenticated Vercel Preview testing is complete. The owner accepts the seven documented residual production-high Genkit/OpenTelemetry findings for this release, subject to vulnerable exporters/propagators remaining unused/disabled, no public telemetry/metrics listener, no runtime preload of vulnerable auto-instrumentation, and tracking upstream patched parent releases. This is conditional risk acceptance, not a clean npm audit. No audit ignores, overrides or suppressions are added.

| Audit scope | Total | High | Critical |
| --- | --- | --- | --- |
| Root | 67 | 12 | 0 |
| Root production | 62 | 7 | 0 |
| Functions | 9 | 0 | 0 |

Root installation, typecheck, lint (zero errors, 48 warnings) and 50 tests passed. Functions installation/compilation and four tests passed on Node 20. Vercel Preview, CodeQL and Gitleaks passed for the tested remediation. The local Next build still requires configured Firebase Admin credentials to complete page-data collection; the configured Preview build succeeded.

Authenticated dashboard/admin access, AI Configuration, the synthetic OCR controlled test, disposable tree creation, person editing/persistence and undo/redo passed. The owner confirms authenticated Vercel Preview PDF export completed: Chrome downloaded `Dependency_Regression_2026_09_09 (1).pdf`, the downloaded PDF opened successfully, and expected family-tree/person content was visible. This resolves the earlier automation download-event timeout. The owner reports manual deletion of the disposable regression tree after testing. The `Tree Not Found` dynamic-route browser-title issue is a non-blocking Phase 1 metadata defect. Stripe/Functions evidence is compilation and mocked regression testing, not live payment or deployed Functions end-to-end verification.

See [dependency remediation](DEPENDENCY_REMEDIATION_2026-09-09.md) for preserved test evidence, release conditions and the full inventory link. PR #3 remains unmerged. This finalization changes documentation only.

The [P0 credential incident](incidents/2026-09-public-credential-exposure.md) is **CLOSED** on the separate credential-revocation, history-rewrite, GitHub Support purge and fresh remote verification evidence below. Dependency risk acceptance is independent of that closure. PR #3 remains draft; it has not been marked ready or merged.

## Post-GitHub-purge verification — 2026-09-09

A new temporary HTTPS mirror was cloned directly from `https://github.com/techilounge/KonnectedRoots.git`, without local reference repositories or stale pre-rewrite objects. Verification was read-only. The snapshot has remediation head `970908be01a120f1ff268f3a13b0ec99a7842962` and master `c264c23019be9295b3443aa102c1782f0e650308`.

- Remote `git ls-remote` and mirror ref enumeration agree: nine normal branches, no tags, and only `refs/pull/3/head` and `refs/pull/3/merge`. No older PR refs are advertised. Authenticated GitHub API requests for historical PRs #1 and #2 return HTTP 404; current PR #3 remains accessible and open/draft.
- `git fsck --full` passed. `git rev-list --all --count` reports 204 reachable commits; Gitleaks reports 200 commits scanned in its history/diff traversal, approximately 187.66 MB.
- Gitleaks 8.30.1 full-history scanning used `git`, `--log-opts=--all`, `--redact=100` and `--max-decode-depth=3`. A second full-history scan used a temporary configuration extending all default rules with explicit Stripe webhook signing-secret detection (`whsec_` followed by at least 16 alphanumeric characters), with no added allowlists. Both scans returned exactly the same three findings below and exit code 1; neither scan was clean. No private-key or Stripe webhook signing-secret finding was detected. Redacted reports remain outside the repository.

| Remaining rule/category | Historical file and line | Commit |
| --- | --- | --- |
| `gcp-api-key` — public Firebase browser configuration | `apphosting.yaml:13` | `1ddf5094e1da6d32a711893829cf6723f78c44cb` |
| `gcp-api-key` — public Firebase browser configuration | `.env.example:2` | `2c1f2f7e86fc374f31a28999a84151680c316345` |
| `gcp-api-key` — public Firebase browser configuration | `src/lib/firebase/clients.ts:7` | `28c8b60ebe8c508e2dcac7d4a45c57c55df2ea3a` |

These are known public Firebase browser API-key occurrences, not Firebase Admin private credentials, AI provider secrets or Stripe webhook secrets. They remain reported without suppression. Browser-key restrictions were previously owner-confirmed; this verification did not inspect or change cloud restrictions.

The owner confirms GitHub Support ticket **#4741386** completed deletion of the affected historical pull requests and clearing of associated unreferenced commits. Fresh reachable remote history contains no detected revoked Firebase Admin private credential or rotated Stripe webhook secret. Together with prior owner-confirmed credential revocation/replacement, Stripe rotation and git-filter-repo cleanup, this supports P0 closure. Remote ref/API checks and scans are independently observed; Support's unreferenced-object purge and credential lifecycle actions are owner-confirmed. Git cannot enumerate GitHub's unreferenced storage, and scanning does not establish the contents of third-party forks or stale external clones. No old credential values or objects were retrieved for comparison. No history, scanner suppressions or production configuration were changed.

## Historical P0 validation — 2026-09-08 (superseded)

The following records describe the earlier P0 preparation task, not the current PR state. Its zero-audit reports and unexecuted-history-cleanup steps are superseded by the current results above and must not be used as current evidence or instructions to repeat the rewrite.

### Historical local results

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, zero errors |
| `npm run lint` | PASS, zero errors; 22 existing warnings |
| `npm test` | PASS, 47 tests, including five commit-range selection tests |
| `npm run build` | Root Next.js build now excludes `functions/src`, which has its own package and TypeScript build. Before this boundary fix, Vercel failed because root TypeScript could not resolve Functions-only `resend`; local page-data validation still requires Firebase Admin credentials. |
| Root `npm audit --json` | PASS, zero reported vulnerabilities |
| Functions `npm audit --json` | PASS, zero reported vulnerabilities |
| Gitleaks 8.30.1 current tracked snapshot | PASS, no leaks; also scanned proposed source/docs/tests with reviewed config and decode depth 3 |
| Gitleaks local history | FAIL as expected: one historical private-key finding and three Firebase browser-key findings. The browser key is public config, not an Admin/AI credential. |
| Workflow YAML | All three new YAML files parse successfully |
| `git diff --check` | PASS |
| Firebase Emulator security suite | Not present; existing provider/Firestore tests are mocked |
| CodeQL | Workflow prepared; not run locally or activated remotely by this task |

Official Gitleaks 8.30.1 was downloaded to a temporary directory and verified against the official release SHA-256 checksums. Reports are redacted and stored outside the repository. A new synthetic fingerprint initially triggered the generic-key heuristic; the fixture was replaced with a clearly synthetic zero digest and re-scanned successfully. No real-key allowlist was added.

### Historical completion and manual next steps

P0 is **not CLOSED and not fully complete**. Current code-side controls and the manual cleanup plan are prepared, but a full configured build and historical cleanup are not yet proven. Final pre-commit cleanup is being published on `security/p0-closure`, without merging to master or rewriting history. Existing successful deployments are not evidence that these new workflow files have run.

1. Review `security/p0-closure` and open a PR. Keep all local reports, replacement files and credentials outside Git.
2. Run a trusted Vercel preview build with server-only Firebase Admin credentials already configured in that environment. Verify the build reaches Ready, then test authentication and AI configuration. Do not paste credentials into chat or weaken the loader to make local builds pass.
3. Follow GITHUB_SECURITY_SETUP.md to verify workflow runs, enable Dependabot security updates and configure required checks. Verify CodeQL advanced/default setup does not conflict. Normal Gitleaks PR/push runs scan introduced ranges; explicit manual full-history scans still expose historical findings. Resolve those through the runbook, not global suppression.
4. Reconcile the owner-reported historical Stripe alert and any other GitHub-only findings; local history scanning is not exhaustive evidence of remote PR caches/forks.
5. Schedule an owner-led maintenance window and follow GIT_HISTORY_REMEDIATION.md. The plan is ready for review; **do not execute the force push until backup/ref inventory, replacement evidence, rewritten-history verification and build checks pass**.
6. After cleanup, re-scan GitHub, require fresh collaborator clones, verify Vercel integrations, and update the incident record. Only then consider closing the incident and changing visibility using PRIVATE_REPO_MIGRATION.md.

Google's legacy server environment fallback and missing explicit application security headers are documented separately. Final cleanup untracked Functions dependencies and generated lib output while retaining local files. Firebase Functions now has a predeploy build step so a fresh clone regenerates lib before deployment. The task did not rotate production secrets, change IAM, modify Firestore rules, remove branches or change repository visibility.
