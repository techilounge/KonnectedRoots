# Current-source secret audit

Audit date: 2026-09-08. Starting revision: `ddd3bdc` (master). Scope: all 15,011 tracked files, including vendored Functions dependencies, plus the security changes in this task. This is a source audit, not verification of deployed secret values or IAM.

## Method and patterns

Searched tracked text with Git, emitting only file, line and pattern names. Inspected matches for assignment versus reference/example use. Scanned a fresh `git archive HEAD` snapshot with Gitleaks 8.30.1, 100% redaction and decode depth 3. Gitleaks uses its default generated/dependency exclusions; the separate tracked-text search included these directories. No private credential values were printed.

Patterns: `-----BEGIN PRIVATE KEY-----`, `private_key`, `private_key_id`, `FALLBACK_SA_B64`, `whsec_`, `sk_live_`, `sk_test_`, `AIza`, `GEMINI_API_KEY=`, `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `RESEND_API_KEY=`, `FIREBASE_SERVICE_ACCOUNT=`, `OPENAI_API_KEY=`, `ANTHROPIC_API_KEY=`, `DEEPSEEK_API_KEY=`, `OPENROUTER_API_KEY=`, `VERCEL_TOKEN=`, `github_pat_`, `ghp_`. Gitleaks default rules additionally check other credential families and encoded material.

## Findings and reviewed files

| Location | Finding | Status |
| --- | --- | --- |
| `.env.example:1,10` | Empty environment placeholders | Not secrets |
| `scripts/firebase-admin.test.cjs:13` | Explicitly invalid synthetic private-key fixture | Not a usable credential |
| `src/lib/firebase/admin.ts:23` | Required JSON field names, no literal credential | Secure environment loader retained |
| `src/lib/firebase/clients.ts` | `NEXT_PUBLIC_FIREBASE_API_KEY` environment reference; mock build fallback | No literal production browser key |
| `functions/node_modules/**` | SDK credential field names and published Stripe/Svix examples/test fixtures | No project credential identified. Final cleanup untracked all 14,769 dependency files, retaining local packages; 12 generated Functions lib files were also untracked. |
| `src/lib/ai/{secrets,config,telemetry,gateway}.ts`, `src/lib/ai/providers/**`, admin AI actions, AI tests | Vault, metadata, role checks and error handling | See AI_SECRET_VAULT_REVIEW.md |
| `functions/src/stripeWebhook.ts` | Secret names bound in Functions runtime options | No literal signing secret |

Current snapshot Gitleaks: **no leaks found**. No raw production secrets are intentionally stored in tracked source. Pattern scanning cannot prove absence of every possible unknown encoding or secret format.

## Historical findings (not current-source leaks)

Local fetched history scan, including decode depth 3: one `private-key` finding in `src/lib/firebase/admin.ts` at historical commit `a17f7f3`; three `gcp-api-key` findings in `apphosting.yaml`, `.env.example`, and `src/lib/firebase/clients.ts`. The latter are Firebase browser configuration; the historical App Hosting variable was verified as `NEXT_PUBLIC_FIREBASE_API_KEY`. They are not classified as server credentials. No AI secret was identified. The owner-reported Stripe alert remains in cleanup scope even though this local Gitleaks scan did not detect it. Local refs do not cover GitHub PR caches or every remote ref.

No history was rewritten. Incident status remains **CONTAINED**, not CLOSED.
