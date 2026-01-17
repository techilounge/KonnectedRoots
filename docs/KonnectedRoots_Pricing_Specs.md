You are implementing the Pricing \+ Entitlements system for KonnectedRoots (web-only).   
Goal: maximize adoption with a generous Free tier, and monetize via simple Pro/Family subscriptions \+ an AI add-on, while keeping Gemini/Firebase costs safe using AI credits.

\========================  
1\) PLANS \+ PRICING (USD)  
\========================

PLAN: Free  
Price: $0

PLAN: Pro  
Price: $5.99/month OR $59.99/year

PLAN: Family  
Price: $9.99/month OR $99/year  
Seats included: up to 6 member accounts under one Family subscription (owner \+ 5\)

ADD-ON: AI Pack  
Price: $3.99/month  
Adds: \+1,000 AI actions/month (pooled for Pro or Family)

Optional (config flag, off by default):  
\- 7-day free trial for Pro and Family (requires payment method)

\=================================  
2\) ENTITLEMENTS (FEATURE LIMITS)  
\=================================

Use these entitlements for gating in UI \+ server validation:

A) Trees & People  
\- Free:  
  \- max\_trees: 3  
  \- max\_people\_per\_tree: 500  
\- Pro:  
  \- max\_trees: unlimited  
  \- max\_people\_per\_tree: unlimited  
\- Family:  
  \- max\_trees: unlimited  
  \- max\_people\_per\_tree: unlimited

B) Collaboration  
Roles: Viewer, Editor, Manager  
\- Free:  
  \- max\_collaborators\_per\_tree: 2  
  \- allowed\_roles: Viewer only (comment allowed if implemented)  
\- Pro:  
  \- max\_collaborators\_per\_tree: 10  
  \- allowed\_roles: Viewer, Editor, Manager  
\- Family:  
  \- max\_collaborators\_per\_tree: 20  
  \- allowed\_roles: Viewer, Editor, Manager  
Notes:  
\- Collaboration should NOT be fully paywalled. Free supports limited invites to drive viral growth.  
\- Family plan “seats” are paid accounts inside the family workspace; collaborators are in-tree invites (can overlap, but seats have priority).

C) Exports  
\- Free:  
  \- png\_export: allowed (watermark=true)  
  \- pdf\_export: allowed (watermark=true)  
  \- export\_limit\_per\_month: 2 total (png+pdf combined)  
  \- gedcom\_export: not allowed  
  \- gedcom\_import: not allowed  
\- Pro / Family:  
  \- png\_export: allowed (watermark=false, unlimited)  
  \- pdf\_export: allowed (watermark=false, unlimited)  
  \- gedcom\_export: allowed  
  \- gedcom\_import: allowed

D) Media Storage (Firebase Storage)  
\- Free:  
  \- storage\_quota\_gb: 1  
  \- max\_file\_size\_mb: 5 (already enforced)  
\- Pro:  
  \- storage\_quota\_gb: 50  
  \- max\_file\_size\_mb: 5  
\- Family:  
  \- storage\_quota\_gb: 100 (shared across the family workspace)  
  \- max\_file\_size\_mb: 5  
Enforcement:  
\- Track used\_bytes per user (Free/Pro) or per family workspace (Family).  
\- Block uploads once quota is reached; show upgrade CTA.

E) AI Credits (Gemini via Genkit)  
AI features: Name Suggestions, Biography Generation, Relationship Finder  
Define “AI Action” so costs are predictable:

\- 1 AI action \= up to 1,000 input tokens \+ 500 output tokens.  
\- If a request exceeds this budget, it consumes multiple actions:  
  \- small (\<= 1 action) \=\> 1 action  
  \- medium (\~2x) \=\> 2 actions  
  \- large (\~3-5x) \=\> 3-5 actions (cap at 5; ask user to shorten input)

Monthly AI included:  
\- Free: 10 actions/month  
\- Pro: 200 actions/month  
\- Family: 600 actions/month (pooled across family seats)  
\- AI Pack add-on: \+1,000 actions/month (pooled)  
Hard rules:  
\- Never allow unlimited AI.  
\- Default AI model routing: use cost-efficient model (Flash/Flash-Lite) for Name Suggestions \+ short bios; reserve higher-cost model only when necessary.

AI Reset:  
\- Reset AI actions monthly on a fixed cadence (e.g., monthly on subscription renewal date OR calendar month). Pick ONE approach and be consistent.

\=====================================  
3\) BILLING \+ SUBSCRIPTION MANAGEMENT  
\=====================================

Billing approach: Stripe (recommended for web).  
Implement:  
\- Stripe Products/Prices:  
  \- Pro Monthly, Pro Yearly  
  \- Family Monthly, Family Yearly  
  \- AI Pack Monthly (as a subscription add-on)  
\- Stripe Checkout for new purchases  
\- Stripe Customer Portal for upgrades/downgrades/cancel/payment method  
\- Webhook → Firebase sync (source of truth \= Stripe)

Entitlement Source of Truth:  
\- Store user’s subscription status in Firestore:  
  users/{uid}.billing \= {  
    plan: "free" | "pro" | "family",  
    status: "active" | "trialing" | "past\_due" | "canceled" | "none",  
    renewsAt: timestamp,  
    stripeCustomerId,  
    stripeSubscriptionId,  
    addons: { aiPack: true/false }  
  }

Family workspace structure:  
\- families/{familyId} \= { ownerUid, seatLimit: 6, seats: \[uid...\], aiPoolRemaining, storageUsedBytes, planStatus }  
\- users/{uid}.familyId optional if they belong to a Family plan

Downgrade behavior (important):  
\- If user downgrades to Free:  
  \- Do not delete data.  
  \- Enforce read-only or “cannot add more” once over limits:  
    \- If tree has \>500 people: block adding new people until under limit or upgrade.  
    \- If exports exceed limits: block further exports.  
    \- If storage exceeds quota: block new uploads.  
  \- Collaboration: if collaborators \>2, keep existing but block new invites and block role elevation; optionally warn owner.

\=====================================  
4\) USAGE TRACKING (NEEDED FOR LIMITS)  
\=====================================

Track per user and per tree:  
\- trees/{treeId}.peopleCount  
\- trees/{treeId}.collaboratorCount  
\- users/{uid}.storageUsedBytes (or families/{familyId}.storageUsedBytes)  
\- users/{uid}.exportCountThisMonth \+ exportMonthKey  
\- users/{uid or familyId}.aiActionsRemaining \+ aiMonthKey

Server enforcement:  
\- Cloud Functions callable endpoints (or server actions) to validate:  
  \- addPerson  
  \- inviteCollaborator  
  \- exportTree  
  \- uploadMedia  
  \- runAI(feature)

Don’t rely on client-only checks. Security rules / callable functions must enforce.

\=====================================  
5\) UI / UX REQUIREMENTS  
\=====================================

Pricing page should clearly show:  
\- Free: “Start building your tree” (generous limits)  
\- Pro: “Unlimited tree building \+ serious exports \+ more collaboration \+ AI”  
\- Family: “One subscription for the whole family (up to 6 seats)”

Upgrade prompts at natural walls:  
\- When user hits 500th person  
\- When exporting beyond 2/month on Free  
\- When inviting a 3rd collaborator on Free  
\- When AI credits run out  
\- When storage quota is reached

\=====================================  
6\) DELIVERABLES  
\=====================================

Implement:  
1\) Firestore schema additions for billing \+ usage.  
2\) Stripe integration (checkout, portal, webhook).  
3\) Entitlements service in code: getEntitlements(user) → limits.  
4\) Server-side enforcement for each gated action.  
5\) Monthly reset jobs for AI/actions and export counters.  
6\) Family plan seat management UI (invite/remove seat members).  
7\) Tests: entitlement checks, downgrade behavior, webhook sync.

Ship with sane defaults:  
\- Free generous (3 trees, 500 people/tree)  
\- Pro and Family pricing as specified  
\- AI credits enforced everywhere  
\- No ads

