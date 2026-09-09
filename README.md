# KonnectedRoots

A genealogy application with an interactive family-tree editor, collaboration, GEDCOM/PDF/PNG exports, an admin console and a server-side AI gateway for OCR, biographies and photo tools.

Next.js 16.3.4, React 18.3.1 and TypeScript power the web app. Firebase provides Auth, Firestore, Storage and Node 20 Functions. Stripe billing and Resend email run in Functions; AI credentials live in Google Secret Manager. Vercel hosts the web app.

## Repository

| Path | Purpose |
| --- | --- |
| src/app | App Router pages, metadata and server actions |
| src/components, src/hooks | UI and browser subscriptions |
| src/lib/config, src/lib/firebase | Public/private configuration and Firebase runtime boundaries |
| src/lib/ai, src/ai/flows | Server gateway, adapters and feature wrappers |
| src/lib/billing, src/types | Canonical plan limits, server-resolved billing view and domain models |
| functions/src | Separate Node 20 backend; generated lib is ignored |
| scripts, functions/tests | Regression tests and operator scripts |
| docs/architecture, docs/configuration, docs/security | System map, setup and evidence |

## Local development

Use a supported Node release meeting Next/Sharp requirements (Node 20.9+; Functions specifically Node 20) and npm. Phase 1 web validation used Node 24.19.0/npm 11.17.0. Root and Functions have independent lockfiles.

1. Run `npm ci` at the root.
2. Create gitignored `.env.local` using names from `.env.example`. Supply a dedicated development Firebase web-app configuration; placeholders do not enable browser access.
3. Configure local ADC/workload identity or the documented development credential path for Admin/AI operations. Never copy production credentials into source or test pipelines. See [environment setup](docs/configuration/ENVIRONMENT_VARIABLES.md).
4. Run `npm run dev` and open port 9002.

`npm run build` generates public routes/sitemap without private Admin credentials. Privileged runtime operations still fail closed when credentials are missing. `.idx` can start demo emulators, but clients are not automatically connected; do not assume emulator isolation.

## Functions development

Select Node 20, then run `cd functions`, `npm ci`, `npm run build`, `npm test` and `npm audit`. `npm run serve` builds and starts the Functions emulator using a separately installed Firebase CLI. Root Next TypeScript excludes Functions source. Use isolated test-mode billing/email configuration; do not run live charges for validation.

## Validation and security

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit
npm audit --omit=dev
```

Install Gitleaks per [secure development](docs/security/SECURE_DEVELOPMENT.md), scan current files with `gitleaks dir . --redact=100 --max-decode-depth=3 --config=.gitleaks.toml`, and scan staged changes before committing. `npm run security:secrets` scans fetched history; known public Firebase browser-key findings remain unsuppressed. P0 is CLOSED; do not repeat its history rewrite. Accepted dependency findings remain documented in [PR #3 remediation](docs/security/DEPENDENCY_REMEDIATION_2026-09-09.md).

## Development workflow

Current master → feature/fix/refactor branch → local checks and draft PR → Vercel Preview and CodeQL/Gitleaks → authenticated regression where required → review → owner-approved squash merge → production smoke test. Never force-push master or merge automatically. Functions/rules deployments are separate deliberate operations.

Use exact Preview hostnames for temporary Firebase website/Auth authorization, never `*.vercel.app`; remove temporary entries after testing. Never commit personal GEDCOM exports or private reports. Unreferenced public assets and deployed endpoints need owner review before deletion.

## Engineering references

- [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Routes and Functions](docs/architecture/ROUTE_FUNCTION_INVENTORY.md)
- [Environment variables](docs/configuration/ENVIRONMENT_VARIABLES.md)
- [Boundary review](docs/architecture/BOUNDARY_REPORT.md)
- [Phase 1 baseline](docs/architecture/PHASE1_BASELINE_2026-09-09.md) and [remediation report](docs/architecture/PHASE1_REMEDIATION_REPORT.md)
- [AI control plane](docs/AI_CONTROL_PLANE.md) and [agent guide](AGENTS.md)
- [Billing architecture](docs/billing/BILLING_ARCHITECTURE.md), [entitlement matrix](docs/billing/ENTITLEMENT_MATRIX.md) and [Phase 2 remediation report](docs/billing/PHASE2_REMEDIATION_REPORT.md)
