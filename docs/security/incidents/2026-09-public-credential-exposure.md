# Public credential exposure — September 2026

Status: **CLOSED — 2026-09-09**. Record prepared 2026-09-08; previously CONTAINED pending history cleanup and verification. Exact detection timestamp was not supplied; detection occurred during September 2026. Closure is based on owner-confirmed credential lifecycle and GitHub Support purge plus fresh remote verification below.

## Categories and containment evidence

- Firebase Admin private key embedded in historical source, including encoded fallback. Owner reports rotation, permanent deletion of the old key, secure Vercel replacement, and successful production Admin validation after deletion.
- Stripe webhook signing secret in history. Owner reports rotation, successful Firebase Cloud Function redeployment and resolved GitHub secret alert.
- Firebase browser API key: public app configuration, not a server credential. Owner reports Firebase-only API restrictions excluding Generative Language API, website restrictions and successful Google sign-in. Preserve Firebase Auth handler domains.
- No historical Gemini/AI key was identified by this task's local scan. Do not invent an AI-secret incident from a browser-key match.

Owner reports sanitized source deployed, local replacement JSON removed, clipboard overwritten, and GitHub Secret Scanning enabled. These operational actions were supplied as context, not re-executed. Read-only GitHub metadata confirms Secret Scanning and Push Protection enabled on 2026-09-08.

Historical containment evidence: the initial current-source Gitleaks audit found no leaks, while the then-local history contained one Firebase Admin private-key finding and three public browser-key occurrences. The Stripe incident remained in scope despite no match in that initial scan. Those pre-cleanup results are superseded by fresh post-purge verification below. No production secret values are included in this record.

## Closure basis — 2026-09-09

- Owner confirms the exposed Firebase Admin credential was revoked/permanently deleted and replaced; the exposed Stripe webhook signing secret was rotated.
- Owner confirms local and normal repository history was cleaned with git-filter-repo. This verification did not repeat the rewrite or change branches/history.
- Owner confirms GitHub Support ticket **#4741386** is complete: Support deleted the requested affected historical PRs and cleared associated unreferenced GitHub commits.
- A fresh temporary mirror cloned directly from the current GitHub HTTPS remote validates all advertised normal branches/tags: nine branches and no tags, matching remote enumeration; `git fsck --full` passes. Only current PR #3 head/merge refs remain advertised. Historical PRs #1 and #2 return HTTP 404 through the authenticated GitHub API; PR #3 remains accessible, open and draft.
- Full-history Gitleaks 8.30.1 scanning of all fresh mirror refs, with decode depth 3 and full redaction, finds no remaining Firebase Admin private credential or Stripe webhook signing secret. A second scan retaining default rules and adding explicit Stripe webhook-secret detection confirms the same result. Both scans report only three `gcp-api-key` occurrences in known public Firebase client configuration, not private credentials; exit code 1 is preserved and no suppression is added.

See [fresh verification details and exact finding locations](../validation-results.md#post-github-purge-verification--2026-09-09). The fresh snapshot includes master `c264c23019be9295b3443aa102c1782f0e650308` and remediation head `970908be01a120f1ff268f3a13b0ec99a7842962`. Credential revocation/rotation and Support's unreferenced-object purge are owner-confirmed; remote ref/API enumeration and scans are independently observed. Git cannot enumerate GitHub's unreferenced storage or verify external stale clones/forks, and no old secrets or objects were retrieved. These limits do not change the recorded closure basis.

P0 credential closure does not mean npm audit is clean. The seven production-high Genkit/OpenTelemetry findings remain separately owner-accepted for this release under the controls in the [dependency remediation record](../DEPENDENCY_REMEDIATION_2026-09-09.md).

## Preventive changes prepared

- Digest-pinned official Gitleaks container action: decoded PR/push range scans and deliberate manual current-tree/full-history scans, all redacted.
- Pinned CodeQL workflow for Next.js and Functions source.
- Developer secret-handling rules, repository-settings instructions, dependency audit, vault tests and history/private-visibility runbooks.
- Nested dependency/environment ignores; final cleanup untracked 14,769 dependency files and 12 generated Functions lib files while preserving local installations.

## Ongoing preventive follow-up

CodeQL and Gitleaks checks and Vercel Preview have passed on PR #3. Continue required-check/Dependabot governance, private alert reconciliation and fresh-clone hygiene for collaborators; do not repeat history cleanup. Deployed IAM and remote rules were not independently re-tested by this documentation task. See validation-results.md for checks and limitations. Closure follows the evidence above, not repository visibility or dependency-risk acceptance.
