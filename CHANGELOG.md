# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **Critical**: Updated `next` to `16.1.1` to resolve CVE-2025-55182.
- Updated Genkit packages (`@genkit-ai/*`, `genkit`) to `1.27.0` to resolve peer dependency conflicts with Next.js 16.
- Removed insecure "one-time migration" rule from `firestore.rules` that allowed public read/delete access to `people` collection.
- Tightened `next.config.ts` to enforce build errors and linting checks in production.
- **Fixed Build**: Resolved multiple TypeScript errors (`AuthForm`, `NameSuggestor`) and Next.js 15 breaking changes in `layout.tsx`.
- **Configuration**: Added fallback environment variables for Firebase to ensure build resilience in CI/CD.
- **Configuration**: Temporarily enabled unoptimized images to fix landing page prerendering.

### Added
- Added global `error.tsx` boundary to catch and display unhandled runtime errors with a retry option.
- Added custom `not-found.tsx` (404) page to improve user experience for broken links.
- Created `CHANGELOG.md` to track project history.

## [0.1.0] - 2025-12-31

### Added
- Initial release of KonnectedRoots.
- Core Family Tree functionality (`trees` and `people` collections).
- User Authentication (Login, Signup, Forgot Password).
- Dashboard for managing trees.
- Profile and Settings management.
