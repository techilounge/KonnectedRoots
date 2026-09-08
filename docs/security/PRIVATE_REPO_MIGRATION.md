# Private repository migration readiness

Status: manual plan only. Read-only API on 2026-09-08: owner `techilounge` is a personal GitHub account (`User`), repository public, Pages disabled. No visibility setting changed.

1. Complete containment first; decide whether history cleanup precedes the switch. Private visibility cannot revoke exposed credentials or erase forks/caches.
2. Open GitHub **Settings → Applications → Installed GitHub Apps → Vercel → Configure**. Confirm KonnectedRoots is included in selected repositories or the authorized scope. Check Vercel **Project Settings → Git** points to this repository.
3. In the Codex and ChatGPT GitHub connection settings, verify each connection has access to KonnectedRoots. After the switch, test reading a harmless file through each connection. They may require reconnecting or selecting the repository again.
4. Inventory third-party integrations, public documentation links, package/CDN/raw GitHub assets and webhook consumers. The application-source/config search found no `raw.githubusercontent.com` or GitHub Pages dependency, but external consumers cannot be inferred from source. Move any public raw assets to the app's public assets/CDN first. Do not publish a token to make a private raw URL work.
5. Verify Vercel deployment hooks remain configured and private; do not copy hook tokens into this runbook. Confirm GitHub Pages is not needed (currently disabled).
6. Check current Vercel plan/ownership constraints before switching. Vercel documents that Hobby cannot deploy private GitHub **organization** repositories. The current owner is personal, but verify the Vercel project/team and commit-author access; do not assume an ownership transfer will work on Hobby. See [Vercel Git deployment documentation](https://vercel.com/docs/git).
7. Check GitHub plan entitlements for private Secret Protection, Code Security and rulesets, including existing results and required checks. Arrange replacement controls or the appropriate plan before losing coverage. See GITHUB_SECURITY_SETUP.md.
8. Owner opens repository **Settings → General → Danger Zone → Change repository visibility → Make private**, reviews GitHub's consequences and confirms the repository name. This step is not automated.
9. Verify repository access with the owner and collaborators, then trigger a harmless trusted preview deployment. Verify production Git integration, hooks, Codex/ChatGPT access and security workflows. Do not share production credentials with untrusted previews.
10. Record results in the incident log. If deployment access fails, fix the App permissions/plan first; do not automatically restore public visibility and re-expose history.
