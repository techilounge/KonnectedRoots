# Phase 1 baseline — 2026-09-09

Before implementation, the clean `refactor/phase1-repository-architecture` branch matched freshly fetched `origin/master` at `d236a581a575cdacbf8a8a27c9d2c24eb4d46d21` (merged PR #3). Local Node is 24.19.0 and npm 11.17.0. The separate full-tree export PR #4 is not in this baseline and is not imported by Phase 1.

| Runtime/package | Baseline |
| --- | --- |
| Package manager | npm; root and Functions package-lock.json, independent installs |
| Next.js / React / React DOM | 16.3.4 / 18.3.1 / 18.3.1 |
| Firebase browser / Admin / Functions | 12.18.0 / 13.10.0 / 7.3.2 |
| Functions runtime | Node 20; separate tsconfig and generated lib directory |
| Genkit / Next integration / Google integration / CLI | 1.42.0 |
| Root accepted audit | 67 total, 12 high, 0 critical |
| Root production accepted audit | 62 total, 7 high, 0 critical |
| Functions accepted audit | 9 total, 0 high, 0 critical |

The seven production-high Genkit/OpenTelemetry findings remain accepted only under PR #3's documented disabled-exporter/propagator, no-public-listener, no-auto-instrumentation-preload and upstream-upgrade controls. P0 is CLOSED. This phase does not repeat historical remediation.

## Repository inventory and disposition before edits

| Category | Paths / purpose | Review decision |
| --- | --- | --- |
| Application | src/app, components, hooks, lib, types, ai/flows | Preserve working features; inspect runtime boundaries |
| Functions | functions/src; independent manifest, lock, tsconfig | Preserve Node 20 and deployed trigger names |
| Tests | scripts/*.test.cjs; functions/tests | Mocked providers/Firestore and package regressions; no emulator suite |
| Operational scripts | set-admin.mjs, sync-member-counts.ts, security-scan-range.cjs | Retain; operator actions are not run by cleanup |
| Documentation | README, AGENTS, CHANGELOG, docs/security, docs/AI_CONTROL_PLANE.md, planning specs | Preserve incident evidence; distinguish historical plans from current architecture |
| CI/security | .github/workflows, .github/codeql, .gitleaks.toml | Preserve controls and existing exclusions |
| Firebase | firebase.json, .firebaserc, firestore.rules/indexes, storage.rules, cors.json | CLI project alias is public; Hosting stanza and wildcard GET CORS need owner review, not console changes |
| Vercel | next.config.ts; dashboard-managed deployment configuration | No tracked vercel.json or apphosting.yaml; do not invent cloud settings |
| Developer tooling | .idx/dev.nix, .vscode/settings.json, components.json | IDX/VS Code are intentional editor configuration; shadcn aliases remain referenced |
| Generated/local | node_modules, functions/lib, .next, tsbuildinfo, .security-local, .vercel | Already ignored; do not commit or restore artifacts |
| Empty marker | .modified (zero bytes) | No source/script reference found; accidental marker eligible for removal |
| Personal data | Root GEDCOM export | 25 individual/name records and date records, no synthetic marker. Treat as potentially identifiable family data; remove current file without reproducing its contents or rewriting history |
| Public assets | public/*.png, public/images, logos/icons | Landing components reference several images; unreferenced screenshots/illustrations may have external URLs. Retain uncertain assets pending owner review |
| Legacy integration | src/ai/genkit.ts, src/ai/dev.ts and genkit npm scripts | genkit.ts has no inbound source imports; dev scripts remain explicit developer entry points. Do not remove packages merely to change audit counts |
| Domain models | src/types/index.ts, lib/billing/types.ts, lib/ai/types.ts, local Invitation | Consolidate only equivalent shapes; defer persisted billing schema changes |

## Baseline defects to verify

- Tree metadata looks up only document IDs; the authenticated page also resolves owner/collaborator slugs. A slug URL can therefore display an incorrect missing-tree title.
- Sitemap and tree layout import eager Admin initialization. Local production compilation/typechecking succeeds, then page-data collection requires private Admin credentials.
- Public URL reads and runtime environment reads are scattered; browser build placeholders and Admin project defaults differ.
- GEDCOM generation emits family/person information to console. Logging and raw provider errors need targeted review.

The inventory is based on tracked files and static references, not proof that unreferenced public URLs or deployed Functions are unused. No file is deleted solely on scanner output.
