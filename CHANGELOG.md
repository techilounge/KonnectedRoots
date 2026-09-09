# Changelog

## Unreleased — Phase 1 repository and architecture cleanup

- Centralized public/guarded server environment reads and standalone Node 20 Functions configuration; preserved dependency locks and credential/secret bindings.
- Fixed slug-based tree titles: anonymous private/missing metadata stays generic, public metadata resolves IDs/slugs, and authorized snapshots update the browser title. Added privacy/failure regression tests.
- Made the public sitemap deterministic and database-free, allowing a local production build without private Firebase Admin credentials.
- Removed the accidental empty marker, potentially personal root GEDCOM export, unused Genkit initializer and empty auth route-group layout. Personal GEDCOM exports are ignored; no history rewrite was performed.
- Removed genealogy debug dumps, sanitized provider-backed action/email failures, consolidated Invitation types and documented retained schema/endpoint/configuration debt.
- Replaced the starter README, refreshed AGENTS guidance, and added architecture, environment, route/Function, baseline and remediation reports. Full-tree export remains the separate PR #4 fix.

## Unreleased — P0/P1 dependency remediation

- Upgraded Next.js to 16.3.4 while preserving React 18.3.1; upgraded jsPDF, Sharp, PostCSS, Firebase and Genkit parents and refreshed compatible transitive dependencies.
- Aligned Firebase Admin on 13.10.0 and Functions on 7.3.2, preserving the declared Node 20 runtime. Replaced the deprecated unused Google Genkit plugin with its supported successor.
- Removed all audited critical findings and all Functions high findings. Root retains 12 high findings (seven production) in current Genkit/OpenTelemetry/CLI parents; documented reachability, controls and future upgrade requirements without audit suppression or unsafe major overrides.
- Added raster-to-PDF, GEDCOM, checkout and portal regressions and portable Functions test discovery for Node 20 on Windows. Fixed the layout-history loader declaration surfaced by updated lint rules.
- See [dependency remediation results](docs/security/DEPENDENCY_REMEDIATION_2026-09-09.md) and [complete high/critical inventory](docs/security/DEPENDENCY_INVENTORY_2026-09-09.md). Vercel Preview, CodeQL and Gitleaks passed for the remediation commit; authenticated browser verification requires preview sign-in. No merge or history changes.

## Unreleased — P0 security closure preparation

- Added pinned Gitleaks and CodeQL workflows, decoded/redacted history scans, a local security scan command and nested dependency/environment ignores.
- Added source/dependency audits, secure development and GitHub setup instructions, vault review, header review, manual history cleanup and private-visibility plans, and a CONTAINED incident record.
- Expanded AI credential tests for role enforcement, response projection, failed rotation cleanup, sanitized connection errors and public environment boundaries.
- Untracked Functions dependencies/generated output without deleting local files. Gitleaks uses tested PR/push ranges; full-history auditing is an explicit manual option while revoked historical material awaits remediation.
- No shared history rewrite, production credential rotation, IAM changes or visibility change performed. Remote workflow activation and owner history verification remain required.

## Unreleased — Multi-provider AI control plane

- Added server-only adapters for Gemini, DeepSeek, OpenRouter, OpenAI, Anthropic and custom OpenAI-compatible endpoints, with capability-aware feature routing and privacy policies.
- Added /admin/ai-configuration for provider credentials, reviewed models, routing, budgets and synthetic tests; keys use Google Secret Manager with Super Admin authorization and mutation audits.
- Migrated biography, names, translation, OCR and two-step photo restoration to the gateway. Removed obsolete direct Gemini model references and made deterministic Relationship Finder unlimited and unmetered.
- Added persistent circuit breakers, qualified fallback, transactional budget reservations and content-free provider telemetry. Replaced synthetic AI cost/activity figures in admin metering, reports and dashboard charts.
- Added private Firestore rules and automated unit/integration tests. See docs/AI_CONTROL_PLANE.md for IAM, migration and validation requirements.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Vercel Analytics**: Integrated Vercel Analytics for tracking page views and visitor insights.
- **Email Notification System**: Comprehensive email notifications for key user actions:
  - Welcome email on new user signup
  - Invitation accepted email to tree owners
  - Payment success/failure emails with Stripe integration
  - Plan expiration reminders (7-day warning)
  - Weekly activity digest (scheduled Mondays 9AM UTC)
  - Inactivity reminders after 30 days
- **Branded Email Templates**: Responsive HTML templates with KonnectedRoots branding, consistent styling, and mobile-friendly design.
- **Email Preferences**: User settings to control notification preferences (tree activity, weekly digest, reminders).
- **Cookie Consent Banner**: GDPR-compliant cookie consent with Accept All / Essential Only options.
- **GDPR Signup Consent**: Required checkbox agreeing to Privacy Policy and Terms on signup.
- **Privacy Policy Enhancements**: Added Legal Basis for Processing, Standard Contractual Clauses (SCCs), Right to Lodge Complaint, and Data Protection Contact (dpo@).
- **Skip Navigation Link**: Keyboard-accessible "Skip to main content" link for screen readers (WCAG 2.4.1).
- **Focus Indicators**: Consistent focus-visible styling on all interactive elements (WCAG 2.4.7).
- **Data Export UI**: New "Your Data & Privacy" section in Profile with data export request button.
- **AI Features Guide**: Added "Using AI Features" section to How-To guide with OCR, Translation, and Enhancement tutorials.
- **AI FAQ Updates**: Added cost breakdown and refund policy to FAQ.

### Changed
- **Header Accessibility**: Added ARIA labels to user menu dropdown.
- **Hosting Migration**: App frontend now hosted on Vercel (Firebase App Hosting deprecated).

### Fixed
- **Invitation Firestore Error**: Fixed "undefined field value" error when inviting users without existing accounts by using `null` instead of `undefined`.
- **Cloud Functions Deployment Timeout**: Fixed deployment timeout by using lazy Firestore initialization in `scheduledTasks.ts` and `stripeWebhook.ts`.

## [0.3.0] - 2026-09-07

### Added
- **Platform Admin Role & Subsystem**: Enterprise-grade role-based access control (RBAC) combining cryptographically signed Firebase Auth Custom Claims (`admin=true`, `role in ['admin', 'super_admin']`) and synchronized Firestore user documents.
- **Privileged Server Actions Layer** (`src/app/admin/actions.ts`): Secure, server-side administrative mutations using `firebase-admin` with caller token verification and automatic logging into the `audit_logs` collection.
- **Admin Bootstrapping CLI** (`scripts/set-admin.mjs`): Added `npm run set-admin <email> [role]` command to provision Platform Admins and Super Admins.
- **Platform Admin Portal (`/admin`)**:
  - **Executive Dashboard** (`/admin`): Real-time KPI telemetry cards and interactive Recharts visualizations (User Growth Area Chart, Subscription Donut, AI Usage Stacked Bar, Tree Velocity).
  - **User & Account Governance** (`/admin/users`): Full user directory with detail inspector, plan upgrades, credit grants, role promotions, and account suspensions.
  - **Trees & Content Governance** (`/admin/trees`): Global tree directory with node counters, collaborator stats, and direct tree inspection.
  - **Revenue & Subscriptions Hub** (`/admin/billing`): MRR, ARR, active subscriber directory, plan economics, and Stripe telemetry.
  - **AI Operations & Metering** (`/admin/ai-metering`): Feature-level Gemini compute monitoring, cost per call calculations, and top power users table.
  - **Analytics & Reporting Center** (`/admin/reports`): Multi-domain datasets with instant CSV and JSON export downloads.
  - **System Configuration & Feature Flags** (`/admin/configuration`): Global killswitches for GenAI, OCR, photo restoration, GEDCOM imports, and public registration.
  - **Live System Broadcast Announcement Banner** (`SystemBroadcastBanner.tsx`): Configurable platform-wide banners (Info, Warning, Success, Promo) with real-time visual preview.
  - **Audit Trail & Security Ledger** (`/admin/audit-logs`): Immutable administrative activity logs with structured JSON diff inspector.
  - **Support Inquiries** (`/admin/messages`): Inbound contact form management with status workflows and admin notes.
- **Interactive Admin Pagination System** (`AdminPagination.tsx`): Reusable pagination component with smart windowed page numbers, ellipsis, configurable page sizes (5, 10, 20, 25, 50, 100), range indicators, and boundary navigation across all 5 core admin views.
- **Universal Real-Time Live Search**:
  - Global debounced (280ms) search in `AdminHeader.tsx` with floating popover returning matching Admin Pages, Users, and Family Trees.
  - Debounced real-time live search with URL query param sync (`?q=`) and clear buttons `(X)` across all admin search bars.
- **Destructive Action Confirmation Modals**: Sign-Out confirmation dialog and `AlertDialog` confirmation modals for all administrative modifications (plan changes, credit grants, role updates, suspensions).
- **2026 SEO Overhaul & Google Search Console Preparation**:
  - Dynamic XML Sitemap generator (`src/app/sitemap.ts`) auto-generating `/sitemap.xml` with priority weighting, change frequencies, and dynamic public tree inclusion. Successfully verified in Google Search Console with 8 discovered pages.
  - Crawler Directives (`src/app/robots.ts`) auto-generating `/robots.txt` allowing public routes and strictly disallowing private administrative/auth routes to preserve crawl budget.
  - Schema.org Structured Data (`JsonLd.tsx`): Injected XSS-safe JSON-LD schemas for `Organization`, `WebSite` (with Sitelinks SearchBox), `SoftwareApplication`, `Product`/`Offers`, `FAQPage`, `HowTo`, `BreadcrumbList`, and `ContactPage`.
  - High-Intent Metadata Layouts: Created dedicated layout files with metadata and canonical tags for `/pricing` and `/contact`.
  - Dynamic Public Tree Indexing: Created `src/app/tree/[treeId]/layout.tsx` to dynamically index public trees while enforcing strict `noindex` on private trees.
  - Canonical Domain Alignment: Normalized canonical domain to `https://konnectedroots.app` matching GSC domain property `sc-domain:konnectedroots.app`.

### Changed
- **Admin Sidebar & Header UX**: Relocated desktop sidebar collapse button outside the search input into `AdminHeader.tsx` (`ChevronLeft`/`ChevronRight`) with secondary footer toggle. Fixed SVG branding logo dimensions and enforced `overflow-hidden` on the sidebar header to prevent layout overflow.

### Fixed
- **Firebase Admin credential security**: Removed the former embedded credential fallback. Vercel deployments require server-only `FIREBASE_SERVICE_ACCOUNT`; production credentials must never be committed.
- **Snapshot Permission Errors**: Deployed updated Firestore security rules granting public read access on `system/{configDoc}` for the broadcast banner.

## [0.2.1] - 2026-01-19

### Added
- **Validation Enhancements**: "Validate Tree" now checks for missing gender (Error) and default "New Person" names (Warning), matching Pre-Export validation stringency.
- **Orphan Detection**: Added checks for orphaned persons (no relationships) in both Validate Tree and Pre-Export checks.
- **Reset Positions Dialog**: Added confirmation dialog with warning and Layout History tip before resetting canvas positions.
- **Toast Auto-Dismiss**: "No issues found" validation toast now auto-dismisses after 5 seconds instead of sticking.
- **Improved Icons**: Changed "Reset Positions" icon to `RefreshCcw` to avoid confusion with the "Toggle Grid" icon.

### Changed
- **Default Gender**: Changed default gender for new persons from "Male" to `null` to enforce explicit user selection.
- **Privacy Documentation**: Documented Firestore/Storage rule decisions for public read access (invitations, photos) with helper functions for future hardening.

### Security
- **Input Validation**: Added Zod schema validation to server actions (`handleFindRelationship`) to prevent injection/malformed data.
- **Dependency Updates**: Fixed high-severity npm vulnerabilities in `@modelcontextprotocol/sdk`, `node-forge`, and `hono`.
- **Code Cleanup**: Removed unused and unsafe `saveFamilyTree` server action that accepted `any` type.

## [0.2.0] - 2026-01-18

### Added
- **AI Document Translation**: Optimize genealogy documents translation with genealogy-specific term preservation and side-by-side view.
- **AI Handwriting OCR**: Extract text from handwritten historical documents using Gemini Vision.
- **AI Photo Enhancement**: Restore, sharpen, and colorize old photos through the configurable AI gateway.
- **AI Credit System**: Implemented consolidated usage tracking, cost labels (e.g., 15 credits for enhancement), and real-time balance updates.
- **User Profile Usage Card**: Visual credit monitoring card in User Profile.
- **Pre-Export Validation**: GEDCOM export now validates tree data before exporting, warning about issues like invalid gender, missing names, parent-child age conflicts, and orphaned relationships.
- **Auto-Fix Orphaned References**: One-click "Fix All" button to automatically clean up orphaned spouse/parent/child references pointing to deleted people.
- **SEO-Friendly Tree URLs**: Tree URLs now use human-readable slugs (e.g., `/tree/doe-family`) instead of Firebase IDs. Backwards compatible with existing trees.
- **GEDCOM Import**: Import family trees from Ancestry, MyHeritage, and other platforms via GEDCOM file upload with drag-and-drop support (Pro/Family only).
- **FAQ Page**: Interactive FAQ page (`/faq`) with 6 categories, 20+ questions, search, and category filters.
- **How-To Guide Page**: Interactive tutorials (`/guide`) with 7 step-by-step guides, progress tracking, and difficulty levels.
- **Privacy Policy Page**: Comprehensive privacy policy (`/privacy`) covering data collection, security, and user rights.
- **Terms of Service Page**: Complete terms of service (`/terms`) with subscription terms, content policies, and legal disclaimers.
- **Pricing Comparison Table**: Animated comparison table on `/pricing` showing KonnectedRoots vs Ancestry, MyHeritage, and other platforms.
- **Add AI Pack Button**: Pro/Family subscribers can now add the AI Pack add-on directly from the pricing page.
- **How-To Link in Navbar**: Added How-To guide link to main navigation menu.
- **Tree Export**: Export family trees as PNG images, PDF documents, and GEDCOM files for backup/sharing.
- **Initials Avatars**: Persons without profile photos now display colored avatars with first+last name initials.
- **Image Hover Preview**: Hover over profile pictures to see enlarged 120x120 preview with name.
- **HoverCard UI Component**: Created reusable HoverCard component using Radix UI primitives.
- **Orphan Card Styling**: Unlinked persons (no relationships) now display with an orange border and background tint for easy identification on the canvas.
- **Undo/Redo**: Command-pattern based undo/redo for Add Person, Delete Person, Edit Person, and Create Relationship. Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z or Ctrl+Y (redo).
- **Email Invitations**: Send email invitations to collaborators via Resend API with verified domain support.
- **Resend Invitation Button**: Re-send pending invitation emails with a single click.
- **Auto-Link Invitations**: Pending invitations automatically link to new users on signup.
- **Public Invite Page**: Guests can view invitation details before logging in to accept.
- **Collaborator Profiles**: Share dialog now displays real collaborator emails fetched from Firestore.
- **Viewer-Only Mode**: Viewers can browse trees but cannot make edits (enforced via security rules and UI).

### Changed
- **Gender Required**: Gender field is now required when adding/editing a person. Default changed from "unknown" to "male".
- **Stripe Live Mode**: Switched from Stripe Test to Live mode for real payment processing.
- **Hero Carousel Image**: Updated family tree demo image with enhanced version.
- **Footer Reorganized**: 4-column layout with Quick Links, Legal (Privacy/Terms), and Connect With Us sections.
- **Navigation Updated**: Added FAQ, How-To Guide, and legal pages to footer navigation.

### Fixed
- **AI Credit Balance**: Fixed issue where credit balance would not update immediately after consuming credits (moved consumption to client-side).
- **CTA Button Redirects**: Fixed "Get Started Free" and "Create Your Family Tree Now" buttons redirecting logged-in users to signup instead of dashboard.
- **GEDCOM Export Gender Handling**: Fixed incorrect HUSB/WIFE assignment when one parent has "unknown" gender. Now correctly infers roles from the other parent.
- **GEDCOM Import ID Extraction**: Fixed `extractId` function to properly remove the "I" prefix from GEDCOM individual IDs, ensuring correct relationship matching on import.
- **Clean Delete for People**: Deleting a person now cleans up all orphaned references in related people's spouseIds, childrenIds, and parentId fields.
- **Clean Delete for Trees**: Deleting a tree now deletes all people in the subcollection before deleting the tree document, preventing orphaned data.
- **Export Styling**: Fixed missing borders, text, and image styling in PNG/PDF exports by inlining computed CSS styles.
- **Export Border Clipping**: Expanded foreignObject dimensions to prevent right/bottom borders from being clipped.
- **Firebase CORS**: Configured Firebase Storage CORS to allow cross-origin image loading for exports.
- **App Freeze on Delete**: Fixed UI freeze after closing the delete confirmation dialog.

### Changed
- **Placeholder Avatars**: Switched from `placehold.co` to `ui-avatars.com` for better styled initials avatars.

### Security
- **Critical**: Updated `next` to `16.1.1` to resolve CVE-2025-55182.
- Updated Genkit packages (`@genkit-ai/*`, `genkit`) to `1.27.0` to resolve peer dependency conflicts with Next.js 16.
- Removed insecure "one-time migration" rule from `firestore.rules` that allowed public read/delete access to `people` collection.
- Tightened `next.config.ts` to enforce build errors and linting checks in production.
- **Fixed Build**: Resolved multiple TypeScript errors (`AuthForm`, `NameSuggestor`) and Next.js 15 breaking changes in `layout.tsx`.
- **Configuration**: Added fallback environment variables for Firebase to ensure build resilience in CI/CD.
- **Configuration**: Temporarily enabled unoptimized images to fix landing page prerendering.

## [0.1.0] - 2025-12-31

### Added
- Initial release of KonnectedRoots.
- Core Family Tree functionality (`trees` and `people` collections).
- User Authentication (Login, Signup, Forgot Password).
- Dashboard for managing trees.
- Profile and Settings management.
