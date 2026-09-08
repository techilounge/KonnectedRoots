# AI control plane deployment and operations

The server-only gateway in `src/lib/ai/gateway.ts` routes biography, naming, translation, OCR, photo analysis and restoration. Existing server actions still verify and deduct application credits and refund failed requests. Flow modules are server-only libraries, not unauthenticated server actions. Relationship Finder remains deterministic and now bypasses metering entirely.

## Deployment checklist

1. Keep the existing server-only `FIREBASE_SERVICE_ACCOUNT` in the Vercel build and runtime environments. The prior credential remediation is unchanged. No new Google service-account keys are needed.
2. Enable the Google Secret Manager API in the intended project. Create empty, global secret containers named `konnectedroots-ai-google`, `konnectedroots-ai-deepseek`, `konnectedroots-ai-openrouter`, `konnectedroots-ai-openai`, `konnectedroots-ai-anthropic`, and `konnectedroots-ai-custom`. Create only those needed. The application adds versions; it deliberately cannot create secret containers.
3. On each container, grant the identity used by Firebase Admin `roles/secretmanager.secretAccessor` and `roles/secretmanager.secretVersionManager`. The required operations are `secretmanager.versions.access`, `secretmanager.versions.add`, and `secretmanager.versions.destroy`. Keep grants scoped to these secrets, not the entire project. Enable Cloud Audit Logs for Secret Manager data access if required by your retention policy. See [Google IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/secretmanager).
4. Set server-only `AI_SECRET_PROJECT_ID` to that project ID. No provider key goes in a public environment variable or Firestore document. Firebase public project and storage-bucket variables remain public configuration only.
5. Deploy `firestore.rules` with `firebase deploy --only firestore:rules` in the correct Firebase project, then deploy the application. No rules or application deployment was performed as part of this implementation.
6. Sign in with a verified Firebase Auth `super_admin` custom claim. Open `/admin/ai-configuration`, add provider API keys, and test connections. Refresh the ID token after an administrator claim change. The new console requires Auth claims; profile flags alone do not authorize access.
7. Review model capabilities, prices, routing and budgets; save the configuration. Run controlled tests, then verify biography, naming, OCR, translation, photo restoration, credit refunds and actual telemetry in a preview environment before production rollout.

## Environment variables

| Name | Use |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Existing server-only Firebase Admin raw JSON or Base64 JSON on Vercel. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public Firebase project configuration. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public Firebase bucket configuration. |
| `AI_SECRET_PROJECT_ID` | Secret Manager project, server-only. |
| `AI_CUSTOM_ALLOWED_ORIGINS` | Optional comma-separated exact HTTPS origins for custom endpoints; empty disables custom endpoints. |
| `GEMINI_API_KEY` | Temporary server-only migration source for Google when no provider metadata exists. |
| `GOOGLE_API_KEY` | Legacy alternative to `GEMINI_API_KEY`, also server-only. |

The Google migration source allows the current environment key to work without copying it into Firestore. Saving a vault key switches to a pinned Secret Manager version; removing a credential writes an explicit `none` source so the environment key cannot silently reappear. Remove the old environment variable after migration. Rotation destroys the previous managed version. Failed cleanup produces `AI_SECRET_CLEANUP_REQUIRED`; destroy the obsolete version manually after reviewing audit logs. Requests already in flight may finish with a previously loaded key.

Custom endpoints require a Super Admin and a deployment-managed origin allowlist. Use only trusted public origins controlled by the provider; do not allow metadata services, internal hosts, redirects or user-controlled domains. Endpoints must be HTTPS, contain no embedded credentials/query/hash, and supply OpenAI-compatible `/models` and `/chat/completions` endpoints. Custom providers are conservatively excluded from `direct_providers_only`, as their downstream routing cannot be verified.

## Collections and access

| Collection | Contents |
| --- | --- |
| `ai_configuration/control` | Model metadata, six feature policies and budgets. |
| `ai_providers/{provider}` | Enablement, credential source, fingerprint, pinned secret-version resource name, status/test timestamps and temporary mutation lock. No secret payload. |
| `ai_model_health/{hash}` | Provider/model failure counts, circuit expiry and update time. |
| `ai_invocations/{id}` | Pending reservation or completed provider attempt, usage, estimated cost, error code, timing and verified user/family/plan context. No prompt, document, image or output content. |
| `ai_usage_months/{YYYY-MM}` | UTC-month spending/reservations, tokens, counts, latency, success and feature/model aggregates. |
| `audit_logs` | Credential intent/result, configuration edits, connection tests, model syncs, circuit opening and budget threshold events. |

Firestore rules deny all direct client access to the five AI collections, including administrator browser SDK access. Server actions use verified, revocation-checked Auth tokens. Regular Admins manage catalogs/routes/budgets and run tests; only Super Admins mutate credentials or custom endpoints. New actions do not use public-readable `system/*` for private configuration. Existing feature kill switches still apply.

## Providers and initial models

Adapters: Google Gemini, DeepSeek Direct, OpenRouter, OpenAI, Anthropic and a custom OpenAI-compatible endpoint. Text/structured/vision capabilities are adapter- and model-dependent. Google and OpenRouter implement image generation/editing. Other adapters do not advertise image editing. OpenAI uses Chat Completions for compatibility. Anthropic structured output uses JSON instructions followed by server schema validation. Tool-calling capability can be cataloged, but these genealogy features do not invoke external tools.

### OpenRouter image setup

1. Save and test the OpenRouter credential in Providers, then Sync models. Discovery merges the chat and dedicated image catalogs. Existing reviewed records remain unchanged; review their capabilities manually.
2. In Models, find the exact OpenRouter model ID. Enable imageGeneration for image output, and imageEditing only when reference-image input is supported. Unsupported adapter capabilities cannot be selected; legacy unsupported selections can be unchecked.
3. Review the model's endpoint pricing. Set Per image to a conservative estimate covering output and reference-image charges for one image at the provider's default settings. Token prices are separate; use zero only for verified included/free charges. Unknown prices block testing. Resolution/tier pricing is not automatically inferred from catalog names.
4. Save changes. Under Feature Routing, set enhancePhoto Privacy to aggregator_allowed and save. Select the model in Health & Testing. Unavailable models show a reason and cannot be run. Live budget and circuit checks still apply on the server.
5. Run the controlled test, which may incur a provider charge. Verify returned image, reported spending and telemetry before routing user photos to this model.

OpenRouter uses POST /api/v1/images with n=1 and optional input_references, keeping provider fallback disabled. Responses must contain one base64 raster image; remote URLs, SVG, malformed data, animated and excessive-size images are rejected. Decoded PNG/JPEG/WebP images are normalized to PNG. Text requests continue using Chat Completions.

For image responses, finite nonnegative usage.cost is the complete reported charge; it replaces the estimate without adding image/token charges again. Missing cost retains the reserved estimate even if aggregate image token usage is present. Estimates are application budget controls, not invoice guarantees; actual provider charges may exceed the reservation and are recorded in full. No model-specific price is hardcoded. See [OpenRouter Image API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

Seeded models and conservative paid-tier USD estimates, verified 2026-09-07:

| Provider | Model | Input / million | Text output / million | Image |
| --- | --- | --- | --- | --- |
| Google | `gemini-3.8-flash` | 0.75 | 3.75 | — |
| Google | `gemini-3.1-flash-image` | 0.50 | 3.00 | 0.067 at 1K |
| DeepSeek | `deepseek-v4-flash` | 0.44 | 1.32 | — |
| DeepSeek | `deepseek-v4-pro` | 1.32 | 3.96 | — |
| DeepSeek | `deepseek-v4-flash-vision-exp` | 0.44 | 1.32 | — |

Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [DeepSeek models/pricing](https://api-docs.deepseek.com/quick_start/pricing/), [DeepSeek vision](https://api-docs.deepseek.com/guides/vision/), [OpenAI Chat Completions](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/methods/create), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [OpenRouter catalog](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).

DeepSeek defaults use peak, uncached rates. Google Flash promotional prices change January 1, 2027; update the catalog before that date. Prices are editable metadata, not billing promises. Sync discovers models without enabling them; existing reviewed records are preserved. Unknown capability/pricing fields require review. Other providers have no invented default model IDs or prices: sync or add the exact accessible ID and complete its metadata. Model discovery is capped at 1,000 Google models, 500 compatible models and 100 Anthropic models per sync.

## Routing defaults

| Feature | Primary | Fallback |
| --- | --- | --- |
| Biography, names, translation | DeepSeek V4 Flash | Gemini 3.8 Flash |
| OCR, photo analysis | Gemini 3.8 Flash | DeepSeek V4 Flash Vision Exp |
| Photo restoration | Gemini 3.1 Flash Image | None |
| Relationships | Local deterministic algorithm | No AI, no credits |

Unconfigured/disabled providers are omitted from eligible routes, allowing a Google-only migration. All seeded policies are fixed and direct-only. Cost/quality modes reorder only explicitly configured candidates, never the entire catalog. Lowest cost uses bounded request estimates; balanced uses cost divided by the administrator's quality priority; quality-first orders that priority. Quality priority is an operator preference, not a measured benchmark.

Fallback occurs on timeout, 429, provider 5xx/network outage or unavailable model. Invalid input, authentication failures, policy blocks and invalid structured output stop the request. Provider responses/errors and credentials are never logged. Circuits persist across serverless instances, default to three qualifying failures and a five-minute cooldown, and reset on successful responses. A cooled-down model can be tried again. Circuit openings are visible in Health & Testing and audit logs.

## Budgets, telemetry and recovery

Defaults are a $100 monthly target, $125 hard limit, 80% warning, 95% emergency, alert-only policy, $0.25 per feature request ($0.50 restoration). Feature monthly limits default to the platform limit. Set real operating budgets before rollout.

Before each provider attempt, a Firestore transaction reserves an upper estimate based on prompt bytes, a conservative normalized-image allowance and the output-token cap. Concurrent requests include outstanding reservations. Actual returned token counts reconcile the reservation, and image output is priced separately from text. Fallback attempts share the feature request cost cap. Missing usage and uncertain failures retain a conservative estimated charge. Budget policies can log alerts, prefer cheaper eligible models at warning/emergency levels or disable nonessential features at emergency level; the hard limit always blocks new reservations. Photo analysis and restoration are two separately recorded feature calls within the existing one-credit-deduction/refund workflow.

Provider prices, usage reporting and tokenizer assumptions can differ; these are application estimates, not a guarantee of the external invoice. Set provider-account spending limits as a second control. No historical synthetic telemetry is backfilled: the dashboards show recorded data from deployment onward. Aggregate counters use UTC months; user credit quotas remain separate.

If a worker dies or Firestore settlement fails, the pending reservation remains rather than allowing silent overspending. Inspect `ai_invocations` entries with `state=reserved`, correlate provider billing without logging content, and reconcile the matching monthly and feature reservation counters in an administrative transaction. Do not automatically expire reservations without confirming whether the provider charged. Reconcile before pruning invocation records. Configure retention/TTL operationally after deciding audit retention requirements. Budget/circuit notifications currently appear in audit logs and the console; no email/webhook integration is added.

## Validation and remaining deployment verification

`npm test` runs Node's test runner without worker isolation (Node 22.8+; validated with Node 24), including the prior Firebase credential tests. Coverage includes route/capability/privacy enforcement, failure selection, cost and budgets, concurrent reservations, idempotent settlement, circuit state, gateway authorization/fallback, credential metadata/audits, provider error sanitization, image token accounting and deterministic relationships. Firestore and provider integration tests use in-memory/mocked boundaries and never spend API credits.

Typecheck and lint are required. The local production build compiles and typechecks but cannot finish page-data collection without secure Firebase credentials. Live provider requests, actual Secret Manager IAM, Firestore rule deployment, authenticated console interaction and production end-to-end behavior must be verified in the configured preview environment. Do not use a build-only credential fallback or weaken Firebase initialization. No live secrets were created/rotated or cloud configuration changed during implementation.

## Implementation file inventory

- `.env.example`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/AI_CONTROL_PLANE.md`
- `firestore.rules`
- `package.json`
- `scripts/ai-control-plane.test.cjs`
- `src/ai/flows/enhance-photo.ts`
- `src/ai/flows/extract-document-text.ts`
- `src/ai/flows/generate-biography-flow.ts`
- `src/ai/flows/suggest-name.ts`
- `src/ai/flows/translate-document.ts`
- `src/ai/genkit.ts`
- `src/app/actions.ts`
- `src/app/admin/actions.ts`
- `src/app/admin/ai-configuration/actions.ts`
- `src/app/admin/ai-configuration/page.tsx`
- `src/app/admin/ai-metering/page.tsx`
- `src/app/admin/page.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/tree/AddPersonToolbox.tsx`
- `src/lib/ai/config.ts`
- `src/lib/ai/cost-engine.ts`
- `src/lib/ai/gateway.ts`
- `src/lib/ai/providers/anthropic.ts`
- `src/lib/ai/providers/deepseek.ts`
- `src/lib/ai/providers/google.ts`
- `src/lib/ai/providers/http.ts`
- `src/lib/ai/providers/index.ts`
- `src/lib/ai/providers/openai-compatible.ts`
- `src/lib/ai/providers/openai.ts`
- `src/lib/ai/providers/openrouter.ts`
- `src/lib/ai/registry.ts`
- `src/lib/ai/router.ts`
- `src/lib/ai/secrets.ts`
- `src/lib/ai/telemetry.ts`
- `src/lib/ai/types.ts`
- `src/lib/billing/constants.ts`
- `src/types/index.ts`
