# AI credit accounting

AI actions are server-metered in `verifyAuthAndDeductAICredits`. The caller's
Firebase ID token is verified with Firebase Admin; the UID comes from the
verified token, never from request data. A Firestore transaction checks the
server billing state, resets the month lazily, verifies the resolved plan and
AI Pack allowance, then increments `usage.aiActionsUsed`. A browser write to
`users/{uid}.usage` is rejected by Firestore rules.

For an eligible Family account, the transaction resolves the authenticated
member's Family workspace and debits `families/{familyId}.usage` so the 600 base
actions plus any AI Pack allowance are pooled across Family seats. Individual
accounts debit their own user usage document.

Current action weights are: name suggestion 1, biography 1, OCR 1, translation
2, photo enhancement 15, and deterministic Relationship Finder 0. A failed
provider call refunds the reserved action through the server path. Provider
telemetry uses the existing content-free transactional AI ledger and never
stores prompts, documents or response content.

The AI Pack contributes exactly 1,000 actions to an eligible active Pro or
Family subscription. The Stripe recurring item is created only by the
authenticated Functions callable. An invoice with the AI Pack product metadata
is recorded once under `ai_pack_grants/{stripeEventId}`; duplicate webhook
delivery cannot create a second grant. No AI Pack is valid for Free or for a
past-due/canceled account.

There is no client-side credit increment/decrement API. Retry idempotency for
provider accounting is provided by the existing reservation/settlement ledger;
future UI actions that need request-level retry semantics should supply a
stable operation key and extend that ledger rather than adding a browser
counter.
