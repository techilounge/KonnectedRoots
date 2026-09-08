# Security headers quick review

Source review 2026-09-08: `next.config.ts`, route/config searches and Firebase hosting configuration. No middleware header configuration was found. This does not independently measure Vercel/CDN response headers.

| Header/control | Current explicit application configuration |
| --- | --- |
| Content-Security-Policy | Missing |
| Strict-Transport-Security | Missing in source; platform may supply it, verify deployed responses |
| X-Content-Type-Options | Missing |
| Referrer-Policy | Missing |
| Permissions-Policy | Missing |
| CSP frame-ancestors / X-Frame-Options | Missing |

Phase 1: capture actual production/preview response headers; add compatible baseline headers; trial a CSP in report-only mode with a controlled reporting endpoint before enforcing it. Test Firebase Auth/OAuth popups and redirects, Stripe flows, Firebase Storage, image previews and Vercel assets. Define frame-ancestors deliberately and test integration requirements. Do not include arbitrary provider origins in browser CSP simply because server adapters call them. No broad CSP or other header change was introduced in this task.
