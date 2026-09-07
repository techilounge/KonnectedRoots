# AGENTS.md — Agent Handover & Architecture Guide for KonnectedRoots

Welcome to **KonnectedRoots** (`https://konnectedroots.app`). This document is designed for AI coding agents and human engineers to quickly understand the architecture, data models, conventions, and operational workflows of the repository, enabling anyone to pick up immediately where the previous agent left off.

---

## 1. Project Overview & Architecture

KonnectedRoots is an enterprise-grade, full-stack genealogy platform built with **Next.js 16 (App Router + Turbopack)**, **Firebase (Auth, Firestore, Storage)**, **Stripe (Subscriptions)**, **Google Gemini GenAI (Genkit)**, and **Resend (Transactional Emails)**.

### Core Value Propositions:
- **Interactive Visual Tree Builder**: Real-time family tree canvas with pan/zoom, auto-layout, node editing, relationships, and full Undo/Redo command stack.
- **GEDCOM 5.5.1 Interoperability**: Full import and export compatible with Ancestry, MyHeritage, and FamilySearch.
- **AI-Powered Genealogical Intelligence**: AI biography generator, ancestral handwriting/document OCR text extraction, historical photo restoration, and relationship inference using Google Gemini 2.0 Flash.
- **Collaboration**: Invite family members via email with role-based access control (`owner`, `editor`, `viewer`).
- **Platform Admin Portal (`/admin`)**: Complete command center for managing users, trees, subscriptions, Gemini AI quotas, system-wide broadcast banners, feature killswitches, and immutable security audit logs.

---

## 2. Tech Stack & Dependencies

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16.1.1 (React 18.3, App Router, Turbopack) |
| **Language & Types** | TypeScript 5 (strict type-checking) |
| **Styling & UI** | Tailwind CSS, Radix UI Primitives, Lucide React icons, `class-variance-authority`, `clsx`, `tailwind-merge` |
| **Visualizations** | Recharts 2.15 (Area, Bar, Donut charts for executive analytics) |
| **Client Auth & DB** | Firebase SDK v11.10 (`firebase/auth`, `firebase/firestore`, `firebase/storage`) |
| **Server Operations** | Firebase Admin SDK v12.2 (`firebase-admin`) |
| **Billing & Payments** | Stripe Node SDK (Live Mode subscriptions: Free, Pro $9.99/mo, Family $19.99/mo) |
| **GenAI Models** | Google Gemini 2.0 Flash via Genkit (`genkit`, `@genkit-ai/*`) |
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
│   │   ├── sitemap.ts            # Dynamic /sitemap.xml generator (protocol 0.9)
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
│   │   ├── tree/                 # FamilyTreeCanvas, NodeEditor, ShareDialog, UndoRedo
│   │   ├── shared/               # Header, Footer, Logo, SystemBroadcastBanner
│   │   ├── seo/                  # JsonLd.tsx (XSS-safe structured data injector)
│   │   └── ui/                   # Radix UI wrapper primitives (button, dialog, select, etc.)
│   ├── hooks/
│   │   ├── useAuth.tsx           # Context hook providing user, profile, isAdmin, isSuperAdmin
│   │   ├── useToast.ts           # Toast notifications system
│   │   └── useUndoRedo.ts        # Canvas undo/redo state manager
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── clients.ts        # Firebase client initialization
│   │   │   └── admin.ts          # Firebase Admin SDK with robust Vercel fallback credentials
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
> **Vercel Server Action Fallback:**
> Because `service-account.json` is gitignored and cannot be committed, [`src/lib/firebase/admin.ts`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/lib/firebase/admin.ts) includes a multi-tiered credential loader:
> 1. `FIREBASE_SERVICE_ACCOUNT` environment variable (if set in Vercel).
> 2. `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable.
> 3. Embedded base64-encoded service account credential fallback for production continuity.
> 4. Local `service-account.json` file check for local development.
>
> This guarantees that Server Actions (`getAdminUsers`, `updateUserPlanByAdmin`, etc.) will **never throw HTTP 500** in production due to missing credentials.

---

## 6. SEO, Crawl Budget & Google Search Console Guide

- **Canonical Domain**: `https://konnectedroots.app` (matches GSC property `sc-domain:konnectedroots.app`).
- **Dynamic Sitemap**: [`src/app/sitemap.ts`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/app/sitemap.ts) serves `/sitemap.xml` with priority weighting, change frequencies, and dynamically queried public family trees.
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
   - `master` is the primary production branch connected to Vercel production deployments.
   - `preview/platform-admin-portal` and `preview/confirmation-dialogs` are preview branches.
   - When merging, fast-forward merge into `master` and keep preview branches in sync:
     ```bash
     git checkout master
     git push origin master
     git checkout preview/platform-admin-portal
     git merge master
     git push origin preview/platform-admin-portal
     git checkout master
     ```
4. **Icons**: Always verify icons exist in `lucide-react` before importing.
5. **Confirmation Dialogs**: Any destructive action (deleting nodes, changing user plans, suspending accounts, granting credits, signing out) **must** be wrapped in an `AlertDialog` confirmation to prevent accidental clicks.
6. **Live Search**: Search inputs should implement real-time debouncing (280–300ms), a clear button `(X)`, URL param synchronization (`?q=`), and automatic reset to Page 1.
7. **Pagination**: Whenever adding or displaying tabular data, use [`src/components/admin/AdminPagination.tsx`](file:///c:/Users/Precision%207560/APPs/KonnectedRoots/src/components/admin/AdminPagination.tsx).

---

*Document created: September 2026. Maintained by the Antigravity Agentic Engineering Team.*
