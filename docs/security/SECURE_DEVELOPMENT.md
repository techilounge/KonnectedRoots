# Secure development

Never commit API keys, service-account JSON, signing secrets, access tokens or encoded copies. Base64 is encoding, not protection. Never put a secret in `NEXT_PUBLIC_*`, Next.js `env`, browser storage, Firestore, logs, screenshots, tickets or test fixtures. Firebase browser configuration and Stripe publishable keys are public configuration, not server secrets.

Use Vercel Sensitive Variables for server credentials. Keep Production and Preview credentials separate with minimum permissions; do not grant arbitrary fork previews access to production secrets. Use Google Secret Manager for AI providers and Firebase Functions Secrets for Stripe/webhook/Resend server secrets. Bind required secrets explicitly to Functions. Firebase Admin uses server-side credentials or configured workload identity; no embedded fallback is permitted.

## Before committing (no hook framework required)

1. Install Gitleaks 8.30.1 from the [official releases](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). Verify the archive SHA-256 against that release's checksums. Add the extracted executable directory to PATH. It is not an npm dependency.
2. Stage only intended files. Review `git diff --cached` locally in a private terminal. Do not paste that output into chat or CI if it could contain a credential.
3. Run `gitleaks git . --pre-commit --staged --redact=100 --max-decode-depth=3 --config=.gitleaks.toml`. This examines staged changes, unlike a normal committed-history scan.
4. Run `gitleaks dir . --redact=100 --max-decode-depth=3 --config=.gitleaks.toml` for current files. Local secret files may trigger it; do not bypass an actual tracked leak.
5. Run `npm run security:secrets` before pushing. This scans all locally fetched history and intentionally fails on unresolved historical leaks. Fetch the intended refs first when verifying remote history.
6. Run typecheck, lint, tests and build. Never supply production credentials to untrusted PR builds merely to make CI green.

The official Gitleaks container action is pinned to the verified 8.30.1 image digest. PRs scan `base..head`; ordinary pushes scan `before..after`, excluding the old boundary commit. New feature-branch pushes scan from the merge base with the default branch through the pushed head. Merge commits are included. Manual dispatch defaults to current files; select `full_history` to deliberately scan all fetched history. Checkout has full history and no persisted token. All scans redact secrets and decode up to three levels; CI uploads no report artifact or PR comment. There is no baseline ignoring real historical secrets and no blanket `AIza` exemption. This CLI container does not use the separately licensed gitleaks-action wrapper.

`.gitleaks.toml` retains default rules and skips only dependency/generated directories: node_modules, .next, coverage, .firebase, root out/build and Functions lib. Lockfiles, source, docs and environment templates remain scanned. These exclusions are not permission to put credentials in generated files. Pre-commit cleanup removed 14,769 `functions/node_modules` files and 12 `functions/lib` generated files from the index, preserving local files. Nested node_modules and Functions lib are ignored; install dependencies from the lockfile and build Functions before deployment.

## If a secret may have leaked

1. Stop publishing the value. Contact the project owner privately through an existing trusted channel, or a GitHub private vulnerability report if enabled. If unavailable, use the owner's verified contact route; do not open a public issue with the value.
2. Report credential category, file/line, commit and time only. The owner should revoke/rotate first and validate the replacement service.
3. Review provider access logs and revoke affected sessions/tokens as appropriate. Restrict access to evidence and record actions without secret values.
4. Remove literals from current source, scan, test and deploy sanitized code.
5. Coordinate history cleanup using GIT_HISTORY_REMEDIATION.md. Do not rewrite shared refs without a scheduled owner-approved maintenance window.
6. Re-scan and update the incident record. Making a repository private does not revoke a leaked credential.
