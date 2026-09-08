# P0 security validation — 2026-09-08

## Local results

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

## Completion and manual next steps

P0 is **not CLOSED and not fully complete**. Current code-side controls and the manual cleanup plan are prepared, but a full configured build and historical cleanup are not yet proven. Final pre-commit cleanup is being published on `security/p0-closure`, without merging to master or rewriting history. Existing successful deployments are not evidence that these new workflow files have run.

1. Review `security/p0-closure` and open a PR. Keep all local reports, replacement files and credentials outside Git.
2. Run a trusted Vercel preview build with server-only Firebase Admin credentials already configured in that environment. Verify the build reaches Ready, then test authentication and AI configuration. Do not paste credentials into chat or weaken the loader to make local builds pass.
3. Follow GITHUB_SECURITY_SETUP.md to verify workflow runs, enable Dependabot security updates and configure required checks. Verify CodeQL advanced/default setup does not conflict. Normal Gitleaks PR/push runs scan introduced ranges; explicit manual full-history scans still expose historical findings. Resolve those through the runbook, not global suppression.
4. Reconcile the owner-reported historical Stripe alert and any other GitHub-only findings; local history scanning is not exhaustive evidence of remote PR caches/forks.
5. Schedule an owner-led maintenance window and follow GIT_HISTORY_REMEDIATION.md. The plan is ready for review; **do not execute the force push until backup/ref inventory, replacement evidence, rewritten-history verification and build checks pass**.
6. After cleanup, re-scan GitHub, require fresh collaborator clones, verify Vercel integrations, and update the incident record. Only then consider closing the incident and changing visibility using PRIVATE_REPO_MIGRATION.md.

Google's legacy server environment fallback and missing explicit application security headers are documented separately. Final cleanup untracked Functions dependencies and generated lib output while retaining local files. Firebase Functions now has a predeploy build step so a fresh clone regenerates lib before deployment. The task did not rotate production secrets, change IAM, modify Firestore rules, remove branches or change repository visibility.
