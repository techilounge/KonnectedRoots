# Public credential exposure — September 2026

Status: **CONTAINED**. Record prepared 2026-09-08. Exact detection timestamp was not supplied; detection occurred during September 2026. Owner should add the precise timestamp from private incident evidence. Do not mark CLOSED until history cleanup and verification finish.

## Categories and containment evidence

- Firebase Admin private key embedded in historical source, including encoded fallback. Owner reports rotation, permanent deletion of the old key, secure Vercel replacement, and successful production Admin validation after deletion.
- Stripe webhook signing secret in history. Owner reports rotation, successful Firebase Cloud Function redeployment and resolved GitHub secret alert.
- Firebase browser API key: public app configuration, not a server credential. Owner reports Firebase-only API restrictions excluding Generative Language API, website restrictions and successful Google sign-in. Preserve Firebase Auth handler domains.
- No historical Gemini/AI key was identified by this task's local scan. Do not invent an AI-secret incident from a browser-key match.

Owner reports sanitized source deployed, local replacement JSON removed, clipboard overwritten, and GitHub Secret Scanning enabled. These operational actions were supplied as context, not re-executed. Read-only GitHub metadata confirms Secret Scanning and Push Protection enabled on 2026-09-08.

Current-source Gitleaks audit found no leaks. Full locally fetched history still has one Firebase Admin private-key finding and three public browser-key occurrences. The Stripe incident remains in scope despite no matching local Gitleaks finding. No production secret values are included in this record.

## Preventive changes prepared

- Digest-pinned official Gitleaks container action: decoded PR/push range scans and deliberate manual current-tree/full-history scans, all redacted.
- Pinned CodeQL workflow for Next.js and Functions source.
- Developer secret-handling rules, repository-settings instructions, dependency audit, vault tests and history/private-visibility runbooks.
- Nested dependency/environment ignores; final cleanup untracked 14,769 dependency files and 12 generated Functions lib files while preserving local installations.

## Remaining evidence/actions

Publish workflows and verify runs; enable Dependabot security updates and required checks; reconcile private GitHub alerts; execute owner-coordinated history cleanup; invalidate stale clones; verify integrations and rescan remote history/caches. Deployed IAM and remote rules were not independently re-tested. See validation-results.md for local checks and limitations. Private visibility alone does not close the incident.
