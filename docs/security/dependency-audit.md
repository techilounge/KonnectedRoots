# Dependency audit

Date: 2026-09-08. Reviewed root and Functions package manifests and lockfiles. Ran `npm audit --json` independently in both directories.

| Scope | Critical | High | Moderate | Low | Exit |
| --- | --- | --- | --- | --- | --- |
| Next.js root | 0 | 0 | 0 | 0 | 0 |
| Firebase Functions | 0 | 0 | 0 | 0 | 0 |

No audit-directed upgrade is required by these results; no `npm audit fix` or forced upgrade was run. This is the registry audit result at this time, not a guarantee that every dependency has no vulnerabilities. Repeat after lockfile changes and on Dependabot alerts.

Root uses Next.js 16.1.1, Firebase Admin 12.x and Firebase Functions 5.x; Functions uses Admin 13.x and Functions 7.x with Node 20. Any consolidation across these major versions requires manual API/runtime compatibility review and testing. Root and Functions have separate lockfiles and must both be audited. Pre-commit cleanup untracked 14,769 Functions dependency files and 12 generated lib files without deleting local files. Restore dependencies with `npm ci` in Functions and regenerate lib with `npm run build`; lockfiles and source remain tracked.

Dependabot security updates were disabled at audit time. Follow GITHUB_SECURITY_SETUP.md to enable them. Do not blindly force dependency upgrades.
