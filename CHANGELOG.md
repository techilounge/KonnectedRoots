# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Tree Export**: Export family trees as PNG images, PDF documents, and GEDCOM files for backup/sharing.
- **Initials Avatars**: Persons without profile photos now display colored avatars with first+last name initials.
- **Image Hover Preview**: Hover over profile pictures to see enlarged 120x120 preview with name.
- **HoverCard UI Component**: Created reusable HoverCard component using Radix UI primitives.
- **Orphan Card Styling**: Unlinked persons (no relationships) now display with an orange border and background tint for easy identification on the canvas.
- **Undo/Redo**: Command-pattern based undo/redo for Add Person, Delete Person, Edit Person, and Create Relationship. Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z or Ctrl+Y (redo).

### Fixed
- **Export Styling**: Fixed missing borders, text, and image styling in PNG/PDF exports by inlining computed CSS styles.
- **Export Border Clipping**: Expanded foreignObject dimensions to prevent right/bottom borders from being clipped.
- **Firebase CORS**: Configured Firebase Storage CORS to allow cross-origin image loading for exports.
- **App Freeze on Delete**: Fixed UI freeze after closing the delete confirmation dialog. Root cause was a timing conflict between Radix UI ContextMenu and AlertDialog components fighting over `pointer-events` body styles.

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
