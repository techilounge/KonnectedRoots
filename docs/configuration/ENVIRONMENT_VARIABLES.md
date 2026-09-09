# Environment variables

Use `.env.example` as a list of placeholders, not a working credential file. Local Next.js settings go in gitignored `.env.local`; configure Vercel Development/Preview/Production independently. Public variables are bundled at build time and require rebuilding after changes. No actual project IDs, API keys, credential contents or price IDs are listed here.

`src/lib/config/env.client.ts` is the public typed configuration. Its explicit `NEXT_PUBLIC_*` reads allow Next.js substitution. `src/lib/config/index.ts` exports only this public module. Private consumers explicitly import the guarded `env.server.ts`, whose lazy getters preserve runtime validation. `functions/src/config.ts` is independent Node 20 configuration and must not import Next.js modules.

| Variable | Scope / classification | Requirement and environments | Consumers |
| --- | --- | --- | --- |
| NEXT_PUBLIC_APP_URL | Client/server, public canonical URL | Optional in all environments; defaults to canonical production site. Override deliberately for isolated sites, not automatically for every Preview | env.client; root/page layouts, robots, sitemap, tree metadata |
| NEXT_PUBLIC_FIREBASE_API_KEY | Client, public Firebase key | Required for browser features in Development/Preview/Production; never an Admin/AI secret | env.client → firebase/clients |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Client, public | Required for browser Auth in all environments | env.client → firebase/clients |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Client/server/CLI, public | Required for browser use; Admin service account project is authoritative or ADC resolves project; configure consistently | env.client, env.server → firebase/clients, firebase/admin; scripts/set-admin.mjs |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Client/server, public | Required for browser Storage; configure for Admin Storage where used | env.client, env.server → firebase/clients, firebase/admin |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Client, public | Optional for current Auth/Firestore/Storage features; supply registered web-app value | env.client → firebase/clients |
| NEXT_PUBLIC_FIREBASE_APP_ID | Client, public | Required for browser use | env.client → firebase/clients |
| NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION | Client/server, public verification token | Optional; only environments intended for search verification | env.client → app/layout |
| FIREBASE_SERVICE_ACCOUNT | Server/CLI, private credential | Required on Vercel when Admin operations execute; raw JSON or Base64 supported by Next runtime. Omit entirely for local ADC; an explicitly empty/invalid value fails closed. Not required for static sitemap/build | env.server → firebase/admin; set-admin.mjs accepts raw JSON only |
| GOOGLE_APPLICATION_CREDENTIALS | Server/CLI, sensitive local identity-file path | Optional explicit ADC/workload identity outside Vercel; no file contents committed | env.server → firebase/admin; Google SDK/CLI |
| AI_SECRET_PROJECT_ID | Server, private configuration (not a key) | Required when vault-backed AI credentials are used | env.server → ai/secrets |
| AI_CUSTOM_ALLOWED_ORIGINS | Server, private allowlist | Optional comma-separated HTTPS origins; required to enable custom AI endpoints | env.server → ai/providers/index |
| GEMINI_API_KEY | Server, secret | Optional legacy Google migration fallback; prefer Secret Manager | env.server → ai/config, ai/secrets |
| GOOGLE_API_KEY | Server, secret in this context | Optional secondary legacy AI fallback, not the Firebase browser key | env.server → ai/config, ai/secrets |
| NODE_ENV | Runtime-provided, public mode | Managed by Next/Node; development/test permits local Admin file/ADC, production does not | env.server → firebase/admin |
| VERCEL | Platform-provided, public marker | Optional outside Vercel; value 1 enforces Vercel credential policy | env.server → firebase/admin |
| VERCEL_ENV | Platform-provided, public environment label | Managed by Vercel; enforces server credential policy in Preview and Production | env.server → firebase/admin |
| K_SERVICE | Google platform marker, public | Optional; identifies hosted ADC environment | env.server → firebase/admin |
| FUNCTION_NAME | Google platform marker, public | Optional; identifies hosted ADC environment | env.server → firebase/admin |
| GAE_ENV | Google platform marker, public | Optional; identifies hosted ADC environment | env.server → firebase/admin |
| APP_URL | Functions, public application URL | Optional; canonical default. Set to exact test site for isolated test-mode billing/email | functions/config → stripeBilling, emailTemplates, index invitation links |
| STRIPE_SECRET_KEY | Functions, secret | Required only when Stripe operations execute; existing Functions secret bindings preserved | functions/config → stripeBilling, stripeWebhook |
| STRIPE_WEBHOOK_SECRET | Functions, secret | Required for webhook signature verification; existing secret binding preserved | functions/config → stripeWebhook |
| RESEND_API_KEY | Functions, secret | Required for successful email delivery; missing value returns explicit failure | functions/config → sendEmail |
| STRIPE_PRICE_PRO_MONTHLY | Functions, server-only catalog ID | Required to enable corresponding checkout product; never expose to the browser or trust a browser price | functions/config → billingCatalog → stripeBilling |
| STRIPE_PRICE_PRO_YEARLY | Functions, server-only catalog ID | Same | functions/config → billingCatalog → stripeBilling |
| STRIPE_PRICE_FAMILY_MONTHLY | Functions, server-only catalog ID | Same | functions/config → billingCatalog → stripeBilling |
| STRIPE_PRICE_FAMILY_YEARLY | Functions, server-only catalog ID | Same | functions/config → billingCatalog → stripeBilling |
| STRIPE_PRICE_AI_PACK | Functions, server-only catalog ID | Required for AI-pack purchase; never expose to the browser | functions/config → billingCatalog → stripeBilling |
| GITHUB_EVENT_PATH | CI, runner path | Required by secret scan range CLI | scripts/security-scan-range.cjs |
| GITHUB_EVENT_NAME | CI, public event name | Required by secret scan range CLI | scripts/security-scan-range.cjs |
| GITHUB_OUTPUT | CI, runner output path | Required by secret scan range CLI | scripts/security-scan-range.cjs |

## Firebase runtime consistency

- Browser: the six explicit web-app fields are the canonical path. SSR-only placeholders permit marketing-page builds; actual browser execution rejects missing required fields with field names only.
- Next Admin: service-account project wins; otherwise configured ADC resolves its project, with the public project setting supplied when available. Removed the hardcoded fallback to a different project. Vercel still rejects local files and implicit ADC. Local development/test may use gitignored `service-account.json`; this is never a production fallback.
- Functions: attached Google runtime identity plus `.firebaserc` deployment selection; Stripe/email settings are in Functions config. Root Next tsconfig excludes Functions source. Generated `functions/lib` is ignored.
- Firebase CLI: `.firebaserc` selects deployment target; it is not read by browser or Next runtime. `firebase.json` retains Functions/rules/indexes and the legacy Hosting stanza pending owner confirmation. Vercel is the actual web hosting path. No tracked `apphosting.yaml` exists.
- `.idx/dev.nix` starts demo emulators, but the app does not call `connect*Emulator`. Do not assume Firebase Studio traffic is isolated merely because emulators are running. Configure a dedicated development project; emulator wiring is deferred rather than silently redirecting runtime traffic.
- `cors.json` allows wildcard-origin GET only. It is a manual Storage CORS artifact, not deployed by Next or `firebase.json`. Retained pending owner confirmation; CORS does not replace Storage authorization. No cloud CORS/restrictions/authorized domains were changed.
- Browser keys are public Firebase configuration. Preserve Firebase-only API restrictions and exact approved website/Auth domains. Any temporary Preview hostname must be exact, never `*.vercel.app`, and should be removed after testing. See [browser-key runbook](../security/FIREBASE_BROWSER_KEY.md).

No new secret names or runtime migration are introduced. Functions secret bindings, Google IAM, provider vault contents and production variables remain unchanged. Missing optional AI/Stripe/email configuration disables those operations through existing error paths; it does not justify fabricated credentials.
