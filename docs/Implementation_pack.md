**Implementation pack**: **Stripe product/price setup**, **Firestore schema**, and **Cloud Functions webhook handler pseudocode** (Gen 2 / Node 20), plus the key endpoints your agent should build.

---

## **1\) Stripe setup (Products, Prices, Metadata)**

### **Products (3)**

Create these **Stripe Products** (one per sellable item):

1. **KonnectedRoots Pro**

   * `product.name`: `KonnectedRoots Pro`

   * `product.metadata`:

     * `kr_item_type = plan`

     * `kr_plan = pro`

2. **KonnectedRoots Family**

   * `product.name`: `KonnectedRoots Family`

   * `product.metadata`:

     * `kr_item_type = plan`

     * `kr_plan = family`

     * `kr_seat_limit = 6`

3. **KonnectedRoots AI Pack**

   * `product.name`: `KonnectedRoots AI Pack`

   * `product.metadata`:

     * `kr_item_type = addon`

     * `kr_addon = ai_pack`

     * `kr_ai_actions = 1000`

### **Prices (5)**

Create these **Stripe Prices**:

**Pro**

* `price.nickname`: `Pro Monthly`

* `unit_amount`: `599` (USD cents)

* `recurring.interval`: `month`

* `metadata`: `kr_plan=pro`, `kr_interval=month`

* `price.nickname`: `Pro Yearly`

* `unit_amount`: `5999`

* `recurring.interval`: `year`

* `metadata`: `kr_plan=pro`, `kr_interval=year`

**Family**

* `price.nickname`: `Family Monthly`

* `unit_amount`: `999`

* `recurring.interval`: `month`

* `metadata`: `kr_plan=family`, `kr_interval=month`, `kr_seat_limit=6`

* `price.nickname`: `Family Yearly`

* `unit_amount`: `9999`

* `recurring.interval`: `year`

* `metadata`: `kr_plan=family`, `kr_interval=year`, `kr_seat_limit=6`

**AI Pack Add-on**

* `price.nickname`: `AI Pack Monthly`

* `unit_amount`: `399`

* `recurring.interval`: `month`

* `metadata`: `kr_addon=ai_pack`, `kr_ai_actions=1000`

### **Checkout rules**

* Pro / Family are **subscriptions** (mode \= `subscription`)

* AI Pack is also a **subscription item** added to the same subscription (so it renews together)

**Important implementation decision:**  
 Allow AI Pack to be purchased **only if** the user has Pro or Family. (Enforce in your “create checkout session” endpoint.)

---

## **2\) Firestore schema (billing \+ usage \+ family seats)**

### **`users/{uid}`**

`{`  
  `"displayName": "",`  
  `"photoURL": "",`  
  `"createdAt": "...",`

  `"billing": {`  
    `"plan": "free|pro|family",`  
    `"status": "none|active|trialing|past_due|canceled",`  
    `"stripeCustomerId": "",`  
    `"stripeSubscriptionId": "",`  
    `"currentPeriodEnd": 0,`  
    `"cancelAtPeriodEnd": false,`  
    `"priceId": "",`  
    `"interval": "month|year|null",`  
    `"addons": {`  
      `"aiPack": true`  
    `},`  
    `"updatedAt": 0`  
  `},`

  `"family": {`  
    `"familyId": null,`  
    `"role": "owner|member",`  
    `"joinedAt": 0`  
  `},`

  `"usage": {`  
    `"monthKey": "2026-01",`  
    `"exportsUsed": 0,`  
    `"aiActionsUsed": 0,`  
    `"aiActionsAllowance": 10,`  
    `"storageUsedBytes": 0`  
  `}`  
`}`

### **`families/{familyId}`**

`{`  
  `"ownerUid": "",`  
  `"createdAt": 0,`

  `"plan": {`  
    `"status": "active|trialing|past_due|canceled",`  
    `"stripeCustomerId": "",`  
    `"stripeSubscriptionId": "",`  
    `"currentPeriodEnd": 0,`  
    `"seatLimit": 6,`  
    `"addons": { "aiPack": true },`  
    `"updatedAt": 0`  
  `},`

  `"usage": {`  
    `"monthKey": "2026-01",`  
    `"exportsUsed": 0,`  
    `"aiActionsUsed": 0,`  
    `"aiActionsAllowance": 600,`  
    `"storageUsedBytes": 0`  
  `}`  
`}`

### **`families/{familyId}/seats/{uid}`**

`{`  
  `"uid": "",`  
  `"email": "",`  
  `"status": "active|invited",`  
  `"invitedAt": 0,`  
  `"joinedAt": 0`  
`}`

### **(Optional but recommended) `billing_events/{eventId}`**

Store webhook events to make billing auditable and idempotent:

`{`  
  `"eventId": "",`  
  `"type": "",`  
  `"receivedAt": 0,`  
  `"processed": true,`  
  `"stripeObjectId": "",`  
  `"uid": "",`  
  `"familyId": null`  
`}`

---

## **3\) Entitlements service (single source of truth)**

Your code should have one function:

`getEntitlements(ctx) => {`  
  `plan: "free|pro|family",`  
  `limits: {`  
    `maxTrees: number|null,`  
    `maxPeoplePerTree: number|null,`  
    `maxCollaboratorsPerTree: number,`  
    `exportLimitPerMonth: number|null,`  
    `watermarkExports: boolean,`  
    `allowGedcom: boolean,`  
    `storageQuotaBytes: number,`  
    `aiActionsAllowance: number`  
  `}`  
`}`

### **Entitlements table**

**Free**

* `maxTrees = 3`

* `maxPeoplePerTree = 500`

* `maxCollaboratorsPerTree = 2` (Viewer only)

* `exportLimitPerMonth = 2` (PNG/PDF only, watermark)

* `allowGedcom = false`

* `storageQuotaBytes = 1GB`

* `aiActionsAllowance = 10`

**Pro**

* unlimited trees/people

* collaborators: 10 (Viewer/Editor/Manager)

* exports unlimited, no watermark

* GEDCOM import/export allowed

* storage 50GB

* AI allowance 200

**Family**

* unlimited trees/people

* collaborators: 20

* exports unlimited, no watermark

* GEDCOM allowed

* shared storage 100GB

* AI allowance 600 (pooled)

* add AI Pack \=\> \+1000 pooled

---

## **4\) Monthly usage reset (lazy reset)**

Do NOT build a scheduler first. Do a **lazy reset** anytime you read/charge usage:

* Compute `monthKey = YYYY-MM` in server time

* If stored `usage.monthKey !== monthKey`:

  * set `exportsUsed=0`

  * set `aiActionsUsed=0`

  * set `aiActionsAllowance = baseAllowance(plan) + addonAllowance`

  * set `usage.monthKey = monthKey`

This is simple and reliable.

---

## **5\) Stripe ↔ Firebase mapping rules (important)**

You need a deterministic way to know which Firebase user the Stripe customer belongs to.

### **Always include `client_reference_id = uid` in Checkout sessions**

Also store UID in Stripe customer metadata:

* On first checkout:

  * Create Stripe customer with `metadata.kr_uid = <uid>`

* For Family plan:

  * Also add `metadata.kr_family_id = <familyId>` (create family doc first in Firestore, then checkout)

### **Mapping precedence for webhook processing**

1. If `customer.metadata.kr_uid` exists → use that

2. Else if `client_reference_id` exists on session → use that

3. Else fallback: lookup by `users.where(billing.stripeCustomerId == customerId)` (slower)

---

## **6\) Cloud Function: Stripe webhook handler (Gen 2, Node 20\) — pseudocode**

`// functions/src/stripeWebhook.ts`  
`import * as functions from "firebase-functions/v2/https";`  
`import Stripe from "stripe";`  
`import { initializeApp } from "firebase-admin/app";`  
`import { getFirestore } from "firebase-admin/firestore";`

`initializeApp();`  
`const db = getFirestore();`

`const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {`  
  `apiVersion: "2024-06-20",`  
`});`

`export const stripeWebhook = functions.onRequest(`  
  `{ region: "us-central1", secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },`  
  `async (req, res) => {`  
    `let event: Stripe.Event;`

    `// 1) Verify signature (must use raw body)`  
    `const sig = req.headers["stripe-signature"] as string;`  
    `try {`  
      `event = stripe.webhooks.constructEvent(`  
        `(req as any).rawBody,`  
        `sig,`  
        `process.env.STRIPE_WEBHOOK_SECRET!`  
      `);`  
    `} catch (err) {`  
      ``res.status(400).send(`Webhook Error: ${(err as Error).message}`);``  
      `return;`  
    `}`

    `// 2) Idempotency guard`  
    `const eventRef = db.collection("billing_events").doc(event.id);`  
    `const existing = await eventRef.get();`  
    `if (existing.exists) {`  
      `res.status(200).send("Already processed");`  
      `return;`  
    `}`

    `// 3) Store event stub immediately`  
    `await eventRef.set({`  
      `eventId: event.id,`  
      `type: event.type,`  
      `receivedAt: Date.now(),`  
      `processed: false,`  
    `});`

    `try {`  
      `// 4) Handle events that can change entitlements`  
      `switch (event.type) {`  
        `case "checkout.session.completed": {`  
          `const session = event.data.object as Stripe.Checkout.Session;`  
          `// Useful for one-time mapping, but subscription events are the main source of truth`  
          `// Optional: ensure customer metadata set here if missing`  
          `break;`  
        `}`

        `case "customer.subscription.created":`  
        `case "customer.subscription.updated":`  
        `case "customer.subscription.deleted": {`  
          `const sub = event.data.object as Stripe.Subscription;`

          `// Fetch customer to get kr_uid / kr_family_id`  
          `const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;`  
          `const uid = (customer.metadata?.kr_uid || "").trim();`  
          `const familyId = (customer.metadata?.kr_family_id || "").trim() || null;`

          `// Determine plan + addons from subscription items (price metadata or known price IDs)`  
          `const { plan, interval, addons } = mapSubscriptionToPlan(sub);`

          `const status = sub.status; // active, trialing, past_due, canceled, etc.`  
          `const currentPeriodEnd = sub.current_period_end * 1000;`

          `if (familyId) {`  
            `await upsertFamilyBilling(familyId, {`  
              `status, plan, interval, addons,`  
              `stripeCustomerId: customer.id,`  
              `stripeSubscriptionId: sub.id,`  
              `currentPeriodEnd,`  
              `cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,`  
            `});`  
            `// Ensure owner user billing reflects family membership if needed`  
          `} else {`  
            `if (!uid) throw new Error("Missing kr_uid for non-family subscription");`  
            `await upsertUserBilling(uid, {`  
              `status, plan, interval, addons,`  
              `stripeCustomerId: customer.id,`  
              `stripeSubscriptionId: sub.id,`  
              `currentPeriodEnd,`  
              `cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,`  
            `});`  
          `}`

          `break;`  
        `}`

        `case "invoice.payment_failed": {`  
          `// Optionally mark status past_due (subscription.updated usually covers this)`  
          `break;`  
        `}`

        `case "invoice.paid": {`  
          `// Optional: ensure status active if needed`  
          `break;`  
        `}`

        `default:`  
          `// ignore`  
          `break;`  
      `}`

      `await eventRef.update({ processed: true, processedAt: Date.now() });`  
      `res.status(200).send("OK");`  
    `} catch (err) {`  
      `await eventRef.update({ processed: false, error: String(err), processedAt: Date.now() });`  
      `res.status(500).send("Webhook handler error");`  
    `}`  
  `}`  
`);`

`// Helper: map subscription items -> plan/addons`  
`function mapSubscriptionToPlan(sub: Stripe.Subscription): {`  
  `plan: "free"|"pro"|"family";`  
  `interval: "month"|"year"|null;`  
  `addons: { aiPack: boolean };`  
`} {`  
  `let plan: "free"|"pro"|"family" = "free";`  
  `let interval: "month"|"year"|null = null;`  
  `let aiPack = false;`

  `for (const item of sub.items.data) {`  
    `const price = item.price;`  
    `const md = price.metadata || {};`

    `if (md.kr_plan === "pro") { plan = "pro"; interval = price.recurring?.interval as any; }`  
    `if (md.kr_plan === "family") { plan = "family"; interval = price.recurring?.interval as any; }`  
    `if (md.kr_addon === "ai_pack") { aiPack = true; }`  
  `}`

  `return { plan, interval, addons: { aiPack } };`  
`}`

`async function upsertUserBilling(uid: string, b: any) {`  
  `const userRef = db.collection("users").doc(uid);`  
  `await userRef.set({`  
    `billing: {`  
      `plan: b.plan,`  
      `status: normalizeStripeStatus(b.status),`  
      `stripeCustomerId: b.stripeCustomerId,`  
      `stripeSubscriptionId: b.stripeSubscriptionId,`  
      `currentPeriodEnd: b.currentPeriodEnd,`  
      `cancelAtPeriodEnd: b.cancelAtPeriodEnd,`  
      `interval: b.interval,`  
      `addons: b.addons,`  
      `updatedAt: Date.now(),`  
    `}`  
  `}, { merge: true });`  
`}`

`async function upsertFamilyBilling(familyId: string, b: any) {`  
  `const famRef = db.collection("families").doc(familyId);`  
  `await famRef.set({`  
    `plan: {`  
      `status: normalizeStripeStatus(b.status),`  
      `stripeCustomerId: b.stripeCustomerId,`  
      `stripeSubscriptionId: b.stripeSubscriptionId,`  
      `currentPeriodEnd: b.currentPeriodEnd,`  
      `seatLimit: 6,`  
      `addons: b.addons,`  
      `updatedAt: Date.now(),`  
    `}`  
  `}, { merge: true });`  
`}`

`function normalizeStripeStatus(status: Stripe.Subscription.Status): string {`  
  `if (status === "active") return "active";`  
  `if (status === "trialing") return "trialing";`  
  `if (status === "past_due" || status === "unpaid") return "past_due";`  
  `if (status === "canceled") return "canceled";`  
  `return "none";`  
`}`

**Critical note:** Stripe signature verification requires the **raw body**. In Firebase Gen2 you need to ensure your express/json middleware doesn’t consume it before verification.

---

## **7\) Required server endpoints (Next.js route handlers or callable functions)**

### **A) Create Checkout Session**

Inputs:

* `uid`

* `plan: pro|family`

* `interval: month|year`

* `familyId` (required if plan=family)

* `addons: { aiPack: boolean }`

Rules:

* if `aiPack=true`, user must be buying Pro/Family or already subscribed to Pro/Family

* set `client_reference_id=uid`

* set `metadata.kr_uid=uid`

* if family: set `metadata.kr_family_id=familyId`

### **B) Billing Portal Session**

Create Stripe portal session for the customer.

### **C) Seat Management (Family)**

* invite seat (email)

* accept seat invite

* remove seat  
   Rules:

* seats \<= 6

---

## **8\) AI Actions charging logic (safe \+ enforceable)**

When user calls an AI feature:

1. Determine billing context:

   * if user in family → charge family pool

   * else charge user pool

2. Lazy reset monthKey

3. Compute actions needed:

   * start with `actions=1`

   * if token usage metadata indicates \> budget → `actions = ceil(max(input/1000, output/500))`, cap at 5

4. If remaining \< actions → block \+ upsell (AI Pack or Pro/Family)

