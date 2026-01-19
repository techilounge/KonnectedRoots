# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- **AI Photo Enhancement**: Restore, sharpen, and colorize old photos using Gemini 2.5 Flash Image.
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
