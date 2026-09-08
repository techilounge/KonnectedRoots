# AI secret-vault review

Reviewed 2026-09-08: `src/lib/ai/secrets.ts`, `config.ts`, gateway/telemetry, provider HTTP adapters, `src/app/admin/ai-configuration/actions.ts`, Firestore rules, and mocked integration tests.

| Guarantee | Implementation/evidence |
| --- | --- |
| No raw keys in Firestore/audit | Credential action writes configuration metadata, pinned version and digest; audit details contain provider ID and fixed descriptions. Existing successful rotation test asserts no submitted key appears anywhere in recorded writes. |
| No raw credential retrieval by browser/admin | Configuration response explicitly projects safe provider fields and returns `secretVersion: null`. New projection tests cover both admin roles, even when unexpected payload fields are present in provider metadata. Super Admin supplies a key to the server; there is no read-key action. |
| No public environment credentials | Server modules import `server-only`; new source-boundary test rejects public provider-secret variable names. Firebase public project config is permitted. |
| Minimal fingerprint | SHA-256 truncated to 12 hex characters, not trailing key characters. This reveals no original key characters; it is identification metadata, not encryption. Keep this stronger behavior rather than exposing a suffix. |
| Safe rotation | A transaction acquires a provider lock; new vault version is created, then metadata is committed, then previous version destroyed. Failed publication destroys the unpublished version and preserves the old pointer. Failure to destroy a version is audited and requires manual cleanup. |
| Role enforcement | Verified/revocation-checked Firebase Auth claims; only `role: super_admin` can save/remove. New tests cover save/remove for all six providers and admin/user/missing roles before any vault access. |
| Server-side tests and sanitized errors | Provider connection tests occur in server actions. HTTP failures map to fixed codes without response bodies. New test verifies unexpected connection exceptions never appear in return data, metadata or audits. |
| Vault isolation | Secret names fixed to configured project and provider. Numeric project aliases require server metadata verification before reading/destroying. No arbitrary secret path or client-supplied project is accepted. |

**Documented migration exception:** Google can still read server-only `GEMINI_API_KEY`/`GOOGLE_API_KEY` when no provider document exists and credential source is `environment`. This is a secure server environment fallback, not Google Secret Manager. Therefore “all keys are only in the vault” is not literally true for the migration path. OpenRouter, DeepSeek, OpenAI, Anthropic and custom provider retrieval use vault versions. Do not remove an active environment credential in this task.

To finish Google's vault migration manually: (1) ensure the Google secret container/IAM is provisioned; (2) as Super Admin save the key in AI Configuration; (3) verify source shows vault and run a connection/controlled test; (4) remove the legacy environment variables in each Vercel environment only after successful validation; (5) redeploy and re-test. This does not rotate the provider key itself.

Tests use synthetic values and mocked providers/Firestore. They do not prove deployed IAM, concurrent remote service behavior or rule deployment. No Firebase Emulator security suite was found. Existing Firestore rules deny direct client access to AI private collections; live/emulator authorization verification remains a deployment check. No IAM changes, production rotations or rule weakening were performed.
