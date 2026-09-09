# AGENTS.md — Agent Handover & Architecture Guide for KonnectedRoots

Welcome to **KonnectedRoots** (`https://konnectedroots.app`). This document is designed for AI coding agents and human engineers to quickly understand the architecture, data models, conventions, and operational workflows of the repository, enabling anyone to pick up immediately where the previous agent left off.

---

## 1. Project Overview & Architecture

KonnectedRoots is an enterprise-grade, full-stack genealogy platform built with **Next.js 16 (App Router + Turbopack)**, **Firebase (Auth, Firestore, Storage)**, **Stripe (Subscriptions)**, **a multi-provider AI gateway**, and **Resend (Transactional Emails)**.

### Core Value Propositions:
- **Interactive Visual Tree Builder**: Real-time family tree canvas with pan/zoom, auto-layout, node editing, relationships, and full Undo/Redo command stack.
- **GEDCOM 5.5.1 Interoperability**: Full import and export compatible with Ancestry, MyHeritage, and FamilySearch.
- **AI-Powered Genealogical Intelligence**: AI biography generator, ancestral handwriting/document OCR text extraction, historical photo restoration, through the server-only AI gateway. Relationship Finder is deterministic and consumes zero AI credits.
- **Collaboration**: Invite family members via email with role-based access control (`owner`, `manager`, `editor`, `viewer`).
- **Platform Admin Portal (`/admin`)**: Complete command center for managing users, trees, subscriptions, Gemini AI quotas, system-wide broadcast banners, feature killswitches, and immutable security audit logs.

---

## 2. Tech Stack & Dependencies

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16.3.4 (React 18.3, App Router, Turbopack) |
| **Language & Types** | TypeScript 5 (strict type-checking) |
| **Styling & UI** | Tailwind CSS, Radix UI Primitives, Lucide React icons, `class-variance-authority`, `clsx`, `tailwind-merge` |
| **Visualizations** | Recharts 2.15 (Area, Bar, Donut charts for executive analytics) |
| **Client Auth & DB** | Firebase SDK v12.18 (`firebase/auth`, `firebase/firestore`, `firebase/storage`) |
| **Server Operations** | Firebase Admin SDK v13.10 (`firebase-admin`) |
| **Billing & Payments** | Stripe Node SDK (Live Mode subscriptions: Free, Pro $9.99/mo, Family $19.99/mo) |
| **GenAI Models** | Configurable Google, DeepSeek, OpenRouter, OpenAI, Anthropic and compatible-provider adapters (`src/lib/ai`) |
| **Email Service** | Resend API with custom branded HTML email templates |
| **Hosting & Analytics** | Vercel (Production & Preview environments) + `@vercel/analytics` |
| **SEO & Sitemaps** | Dynamic Next.js App Router metadata, Schema.org JSON-LD, `sitemap.ts`, `robots.ts` |

---

## 3. Directory Structure & Key Files

```text
KonnectedRoots/
├── firestore.rules               # Security rules for Firestore (RBAC & Platform Admin)
├── scripts/
│   └── set-admin.mjs             # CLI tool to grant custom claims & super_admin role
├── src/
│   ├── app/                      # Next.js App Router routes
│   │   ├── page.tsx              # Public landing page
│   │   ├── layout.tsx            # Root layout with global JSON-LD schemas & broadcast banner
│   │   ├── sitemap.ts            # Deterministic public /sitemap.xml (no Admin credentials)
│   │   ├── robots.ts             # Dynamic /robots.txt with crawl directives
│   │   ├── actions.ts            # Public server actions (contact messages, relationships)
│   │   ├── admin/                # Platform Admin Portal
│   │   │   ├── page.tsx          # Executive Dashboard with Recharts & paginated activity
│   │   │   ├── actions.ts        # Privileged server actions (users, trees, billing, system config)
│   │   │   ├── layout.tsx        # Protected admin layout with sidebar & header
│   │   │   ├── users/page.tsx    # Paginated user management + live search
│   │   │   ├── trees/page.tsx    # Paginated family trees governance + live search
│   │   │   ├── billing/page.tsx  # Revenue & subscriptions hub + live search
│   │   │   ├── ai-metering/      # GenAI token consumption & power users
│   │   │   ├── reports/page.tsx  # Granular reporting datasets + CSV/JSON exports
│   │   │   ├── configuration/    # Feature killswitches, broadcasts & maintenance mode
│   │   │   ├── audit-logs/       # Immutable security & admin ledger + live search
│   │   │   └── messages/page.tsx # Contact inquiries workflow
│   │   ├── dashboard/            # Authenticated user dashboard (my family trees)
│   │   ├── tree/[treeId]/        # Interactive family tree canvas & dynamic public metadata
│   │   ├── pricing/              # Plans & pricing comparison + Product schema
│   │   ├── features/             # Platform feature showcase + Breadcrumb schema
│   │   ├── guide/                # How-To step-by-step tutorials + HowTo schema
│   │   ├── faq/                  # Interactive FAQ + FAQPage rich snippet schema
│   │   ├── contact/              # Inbound customer contact form + ContactPage schema
│   │   ├── profile/              # User account settings & AI credit monitor
│   │   ├── settings/             # User settings & billing portal deep links
│   │   └── (auth)/               # login, signup, forgot-password, invite/[inviteId]
│   ├── components/
│   │   ├── admin/                # AdminSidebar, AdminHeader, AdminPagination
│   │   ├── tree/                 # FamilyTreeCanvasPlaceholder, NodeEditorDialog, ShareDialog, ExportDialog
│   │   ├── shared/               # Header, Footer, Logo, SystemBroadcastBanner
│   │   ├── seo/                  # JsonLd.tsx (XSS-safe structured data injector)
│   │   └── ui/                   # Radix UI wrapper primitives (button, dialog, select, etc.)
│   ├── hooks/
│   │   ├── useAuth.tsx           # Context hook providing user, profile, isAdmin, isSuperAdmin
│   │   ├── use-toast.ts           # Toast notifications system
│   │   └── useUndoRedo.ts        # Canvas undo/redo state manager
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── clients.ts        # Firebase client initialization
│   │   │   └── admin.ts          # Firebase Admin SDK with server-only credential initialization
│   │   ├── tree-validator.ts     # Family tree data integrity checks (dates, cycles, orphans)
│   │   ├── duplicate-detector.ts # Duplicate ancestor identification algorithm
│   │   └── gedcom-generator.ts   # GEDCOM 5.5.1 parser and serializer
│   └── types/
│       └── index.ts              # Canonical TypeScript definitions (User, Tree, Person, Roles)
```

---

## 4. Security & Role-Based Access Control (RBAC)

### Dual-Layer Security Model
1. **Firebase Auth Custom Claims**:
   - `token.admin === true`
   - `token.role in ['admin', 'super_admin']`
   - Enforced by `verifyAdminCaller()` in [`src/app/admin/actions.ts`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/app/admin/actions.ts) and `isPlatformAdmin()` in [`firestore.rules`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/firestore.rules).
2. **Firestore User Profile Synchronization**:
   - Stored in `users/{uid}.role` and `users/{uid}.isPlatformAdmin`.
   - Hydrated synchronously on the client via `useAuth.tsx` for instantaneous UI updates without token refresh latency.
3. **Privileged Server Actions**:
   - Never mutate administrative state on the client.
   - All mutations execute server-side via `firebase-admin` and automatically record an entry into the `audit_logs` collection.

### Admin Provisioning CLI:
```bash
# Promote an account to Platform Super Admin
npm run set-admin your-email@example.com super_admin

# Demote or assign standard admin
npm run set-admin your-email@example.com admin
```

---

## 5. Vercel & Firebase Admin Credentials Architecture

> [!IMPORTANT]
> Production Firebase Admin credentials must come from server-side environment variables or workload identity and must never be committed to the repository.
> - On Vercel, set server-only `FIREBASE_SERVICE_ACCOUNT` to raw service-account JSON or Base64-encoded JSON. Missing or invalid credentials fail initialization; no embedded credential, local file, or implicit ADC fallback is allowed.
> - Never expose this variable through `NEXT_PUBLIC_*` or Next.js `env` configuration. Parsing errors must not include credential contents.
> - Local development/test may use the gitignored root `service-account.json` when the environment variable is absent. Production never loads this file.
> - Outside Vercel, ADC is supported in development/test, with explicitly configured `GOOGLE_APPLICATION_CREDENTIALS` (including workload identity configuration), or Google-hosted Cloud Run/Functions/App Engine service identities. Other production environments must explicitly configure credentials.
> - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` contain public project configuration only.

---

## 6. SEO, Crawl Budget & Google Search Console Guide

- **Canonical Domain**: `https://konnectedroots.app` (matches GSC property `sc-domain:konnectedroots.app`).
- **Public sitemap**: src/app/sitemap.ts lists eight deterministic marketing/legal routes without Firestore or Admin credentials; authenticated tree URLs are excluded.
- **Crawl Directives**: [`src/app/robots.ts`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/app/robots.ts) serves `/robots.txt` strictly disallowing private routes (`/admin/*`, `/dashboard/*`, `/settings/*`, `/profile/*`, `/login`, `/signup`, `/forgot-password`, `/invite/*`, `/api/*`).
- **Dynamic Public Tree Indexing**: [`src/app/tree/[treeId]/layout.tsx`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/app/tree/[treeId]/layout.tsx) inspects tree visibility:
  - If `visibility === 'public'`: Generates custom title, description, and canonical URL.
  - If `visibility !== 'public'`: Strictly sets `robots: { index: false, follow: false }`.
- **Structured Data (JSON-LD)** via [`src/components/seo/JsonLd.tsx`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/components/seo/JsonLd.tsx):
  - `Organization` & `WebSite` with Sitelinks SearchBox on `/`
  - `SoftwareApplication` (`GenealogyApplication`) with pricing tiers
  - `Product` & `Offers` on `/pricing`
  - `FAQPage` on `/faq` (powers Google collapsible SERP snippets)
  - `HowTo` & `BreadcrumbList` on `/guide` and `/features`
  - `ContactPage` on `/contact`

---

## 7. Operational Guidelines for Future Agents

1. **Always Typecheck Before Committing**:
   ```bash
   npm run typecheck
   ```
   Must pass with 0 errors (`tsc --noEmit`).
2. **Always Run Production Build to Verify Routes**:
   ```bash
   npm run build
   ```
   Verifies Next.js Turbopack compilation and page static optimization across all 29+ routes.
3. **Git Branching Workflow**:
   - Start from current master, use a feature/fix/refactor branch, run checks, and open a draft PR.
   - Validate Vercel Preview, CodeQL/Gitleaks and authenticated behavior, then obtain review for an owner-approved squash merge and production smoke test.
   - Never merge automatically or force-push master. Functions/rules deployments are separate deliberate operations.
4. **Icons**: Always verify icons exist in `lucide-react` before importing.
5. **Confirmation Dialogs**: Any destructive action (deleting nodes, changing user plans, suspending accounts, granting credits, signing out) **must** be wrapped in an `AlertDialog` confirmation to prevent accidental clicks.
6. **Live Search**: Search inputs should implement real-time debouncing (280–300ms), a clear button `(X)`, URL param synchronization (`?q=`), and automatic reset to Page 1.
7. **Pagination**: Whenever adding or displaying tabular data, use [`src/components/admin/AdminPagination.tsx`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/components/admin/AdminPagination.tsx).

---

*Document created: September 2026. Maintained by the Antigravity Agentic Engineering Team.*

## 8. AI control plane

- Read [AI_CONTROL_PLANE.md](docs/AI_CONTROL_PLANE.md) before changing AI routing, credentials or budgets.
- All six AI features use the server-only gateway in src/lib/ai; no model IDs belong in flows. Relationship Finder must remain unmetered and deterministic.
- /admin/ai-configuration manages providers, reviewed model capabilities/prices, feature routing, budgets and controlled tests. Require verified Auth admin claims; credential mutations and custom endpoints require super_admin. Never authorize credential writes using profile flags alone.
- Provider API keys live only in Google Secret Manager. Firestore stores private metadata, never raw keys. Never use system/*, users/* or NEXT_PUBLIC_* for AI secrets. Every credential mutation records audit intent and result.
- Private AI collections: ai_configuration, ai_providers, ai_invocations, ai_usage_months, ai_model_health. Direct client access is denied; server actions enforce roles.
- Budget reservations and circuit state must persist across serverless instances. Telemetry must not record prompts, documents, images or response contents. Do not replace missing telemetry with invented figures.
- Run npm test in addition to typecheck, lint and build. Provider/Firestore tests are mocked; preview verification with configured IAM and provider credentials is a separate deployment step.

## 9. Required security controls

- Production secrets never belong in source, including encoded credentials. Firebase Admin uses secure server-side environment credentials or configured workload identity, never embedded fallbacks.
- Firebase Browser API key is public configuration (`NEXT_PUBLIC_FIREBASE_API_KEY`) but must be restricted to approved websites and Firebase APIs, never Generative Language API.
- AI provider secrets are server-only. Google Secret Manager is the credential vault; Google's legacy server environment migration fallback must never become public configuration.
- Stripe webhook signing secret is managed through Firebase Functions Secrets and bound to the webhook function. Never commit its value.
- GitHub Secret Scanning, Push Protection and Gitleaks are required controls. Run `npm run security:secrets` with the documented Gitleaks CLI installed; review staged changes and run the staged scan in docs/security/SECURE_DEVELOPMENT.md.
- Read docs/security/GIT_HISTORY_REMEDIATION.md before history cleanup. Never automatically force-push, delete remote branches, rotate production credentials or change visibility. P0 is CLOSED; do not repeat history remediation.
- See docs/security/validation-results.md for scan/build limitations. Workflow files are not evidence of active remote checks until pushed and run.
- The root Next.js `tsconfig.json` excludes `functions/src`; Firebase Functions are compiled from `functions/tsconfig.json` with their own dependencies and predeploy build.

## Phase 1 architecture guidance

- Read docs/architecture/SYSTEM_ARCHITECTURE.md, ROUTE_FUNCTION_INVENTORY.md and BOUNDARY_REPORT.md for actual runtime/data boundaries and retained exceptions.
- Public config is src/lib/config/env.client.ts; index.ts exports only public config. Server consumers explicitly import the guarded env.server.ts. Functions use their own functions/src/config.ts on Node 20.
- See docs/configuration/ENVIRONMENT_VARIABLES.md before configuring a runtime. Browser settings must identify one project; Admin service-account project or ADC is authoritative. No hardcoded Admin project fallback remains.
- Tree URLs can be slugs or document IDs. Anonymous private/missing/error metadata stays generic and noindex; the authenticated snapshot updates the browser title without an extra private read. Never expose private titles through anonymous metadata.
- P0 credential remediation is CLOSED. Accepted dependency findings remain documented; do not reopen history cleanup without new evidence, weaken scanners or hide public browser-key findings.
- Personal GEDCOM exports are ignored. Do not print family/person data in diagnostics. Only clearly synthetic fixtures belong in tests.
- Public assets, legacy Firebase Hosting/CORS configuration and deployed inert Functions are retained pending owner confirmation; lack of a source import alone is not deletion authorization.
- Domain Invitation is in src/types/invitations.ts; billing/AI types remain in their domains. Persisted team-plan, timestamp and entitlement drift is Phase 2 work, not a silent migration.
- The separate full-tree PDF/PNG fix is PR #4; it was not in Phase 1's starting master. Do not duplicate it or claim large-tree exports are fixed by this cleanup.