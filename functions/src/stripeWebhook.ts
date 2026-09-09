import { functionsEnv } from './config';
import { isSupportedWebhookType } from './billingCatalog';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { sendEmail } from './sendEmail';
import { paymentSuccessEmail, paymentFailedEmail } from './emailTemplates';

if (!admin.apps.length) admin.initializeApp();
function getDb() { return admin.firestore(); }
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(functionsEnv.stripeSecretKey);
  return stripe;
}

export function normalizeStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    case 'incomplete': return 'incomplete';
    case 'paused': return 'paused';
    default: return 'none';
  }
}

export function shouldApplyBillingEvent(latestProcessed: number, incomingCreated: number): boolean {
  return incomingCreated >= latestProcessed;
}

export function mapSubscriptionToPlan(sub: Stripe.Subscription) {
  let plan: 'free' | 'pro' | 'family' = 'free';
  let interval: 'month' | 'year' | null = null;
  let priceId: string | null = null;
  let aiPack = false;
  const subscriptionMetadata = (sub.metadata || {}) as Record<string, string>;
  if (subscriptionMetadata.kr_plan === 'pro' || subscriptionMetadata.kr_plan === 'family') plan = subscriptionMetadata.kr_plan;
  if (subscriptionMetadata.kr_interval === 'month' || subscriptionMetadata.kr_interval === 'year') interval = subscriptionMetadata.kr_interval;
  for (const item of sub.items.data) {
    const price = item.price;
    const md = (price.metadata || {}) as Record<string, string>;
    if (md.kr_plan === 'pro' || md.kr_plan === 'family') {
      plan = md.kr_plan;
      interval = interval || (price.recurring?.interval as 'month' | 'year') || null;
      priceId = price.id;
    }
    if (md.kr_addon === 'ai_pack') aiPack = true;
  }
  return { plan, interval, priceId, addons: { aiPack } };
}

async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const ref = getDb().collection('billing_events').doc(event.id);
  const ledger = { eventId: event.id, eventType: event.type, stripeCreated: event.created * 1000, receivedAt: Date.now(), status: 'processing' };
  const database = getDb() as any;
  if (typeof database.runTransaction === 'function') {
    let claimed = false;
    await database.runTransaction(async (tx: any) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.status === 'failed') {
          tx.update(ref, ledger);
          claimed = true;
        }
        return;
      }
      tx.create(ref, ledger);
      claimed = true;
    });
    return claimed;
  }
  const existing = await ref.get();
  if (existing.exists) {
    if (existing.data?.()?.status !== 'failed') return false;
    await ref.set(ledger, { merge: true });
    return true;
  }
  await ref.set(ledger);
  return true;
}

async function completeEvent(event: Stripe.Event, fields: Record<string, unknown> = {}) {
  await getDb().collection('billing_events').doc(event.id).update({ ...fields, status: 'processed', processedAt: Date.now() });
}

function periodEnd(subscription: Stripe.Subscription): number {
  const value = (subscription as any).current_period_end ?? (subscription as any).currentPeriodEnd ?? 0;
  return Number(value) * 1000;
}

async function updateBillingIfNewer(uid: string, eventCreated: number, billing: Record<string, unknown>) {
  const ref = getDb().collection('users').doc(uid);
  const snap = await ref.get();
  const previous = snap.data()?.billing || {};
  if (!shouldApplyBillingEvent(Number(previous.latestStripeEventCreated || 0), eventCreated)) return false;
  await ref.set({ billing: { ...billing, latestStripeEventCreated: eventCreated, updatedAt: Date.now() } }, { merge: true });
  return true;
}

async function updateFamilyIfNewer(familyId: string, eventCreated: number, plan: Record<string, unknown>) {
  const ref = getDb().collection('families').doc(familyId);
  const snap = await ref.get();
  const previous = snap.data()?.plan || {};
  if (!shouldApplyBillingEvent(Number(previous.latestStripeEventCreated || 0), eventCreated)) return false;
  await ref.set({ plan: { ...plan, latestStripeEventCreated: eventCreated, updatedAt: Date.now() } }, { merge: true });
  return true;
}

async function handleSubscription(event: Stripe.Event, subscription: Stripe.Subscription) {
  const customer = await getStripe().customers.retrieve(subscription.customer as string) as Stripe.Customer;
  const uid = (customer.metadata?.kr_uid || '').trim();
  const familyId = (customer.metadata?.kr_family_id || '').trim() || null;
  if (!uid && !familyId) throw new Error('Stripe customer is not mapped to a KonnectedRoots account.');
  const mapped = mapSubscriptionToPlan(subscription);
  const deleted = event.type === 'customer.subscription.deleted';
  const status = deleted ? 'canceled' : normalizeStripeStatus(subscription.status);
  const common = {
    status,
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEnd(subscription),
    cancelAtPeriodEnd: Boolean((subscription as any).cancel_at_period_end ?? (subscription as any).cancelAtPeriodEnd),
    interval: deleted ? null : mapped.interval,
    priceId: deleted ? null : mapped.priceId,
    addons: deleted ? { aiPack: false } : mapped.addons,
    plan: deleted ? 'free' : mapped.plan,
  };
  const eventCreated = event.created * 1000;
  const updated = uid ? await updateBillingIfNewer(uid, eventCreated, common) : false;
  if (familyId) await updateFamilyIfNewer(familyId, eventCreated, { ...common, seatLimit: 6 });
  return updated;
}

async function recordAIPackGrant(event: Stripe.Event, invoice: Stripe.Invoice, customerId: string) {
  const lines = (invoice as any).lines?.data || [];
  const hasPack = lines.some((line: any) => line.price?.metadata?.kr_addon === 'ai_pack');
  if (!hasPack) return;
  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const uid = customer.metadata?.kr_uid;
  if (!uid) return;
  const ref = getDb().collection('ai_pack_grants').doc(event.id);
  const existing = await ref.get();
  if (!existing.exists) {
    // The active recurring add-on derives +1,000 allowance. This ledger makes the
    // qualifying invoice grant auditable and prevents duplicate delivery effects.
    await ref.set({ eventId: event.id, uid, invoiceId: invoice.id, actions: 1000, createdAt: Date.now() });
    await getDb().collection('users').doc(uid).set({ billing: { aiPackLastGrantedEventId: event.id } }, { merge: true });
  }
}

export const stripeWebhook = onRequest({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  const signature = req.headers['stripe-signature'] as string | undefined;
  let event: Stripe.Event;
  try {
    if (!signature || !(req as any).rawBody) throw new Error('Missing Stripe signature or raw body');
    event = getStripe().webhooks.constructEvent((req as any).rawBody, signature, functionsEnv.stripeWebhookSecret);
  } catch (error) {
    logger.error('Webhook signature verification failed');
    res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    return;
  }
  let claimed: boolean;
  try { claimed = await claimEvent(event); } catch (error) { logger.error('Could not claim billing event'); res.status(500).send('Webhook ledger unavailable'); return; }
  if (!claimed) { res.status(200).send('Already processed'); return; }
  try {
    if (isSupportedWebhookType(event.type)) {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscription(event, event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          await recordAIPackGrant(event, invoice, invoice.customer as string);
          const customer = await getStripe().customers.retrieve(invoice.customer as string) as Stripe.Customer;
          const uid = customer.metadata?.kr_uid;
          if (uid) {
            const user = await getDb().collection('users').doc(uid).get();
            const data = user.data();
            if (data?.email) {
              const plan = data.billing?.plan === 'family' ? 'Family' : 'Pro';
              const interval = data.billing?.interval === 'year' ? 'Annual' : 'Monthly';
              const amount = (invoice as any).amount_paid ? `$${((invoice as any).amount_paid / 100).toFixed(2)}` : 'Paid';
              const email = paymentSuccessEmail(data.displayName || data.email, `${plan} (${interval})`, amount, 'Next billing cycle', (invoice as any).hosted_invoice_url || undefined);
              await sendEmail({ to: data.email, subject: email.subject, html: email.html });
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customer = await getStripe().customers.retrieve(invoice.customer as string) as Stripe.Customer;
          const uid = customer.metadata?.kr_uid;
          if (uid) {
            const user = await getDb().collection('users').doc(uid).get();
            const data = user.data();
            if (data?.email) {
              const amount = (invoice as any).amount_due ? `$${((invoice as any).amount_due / 100).toFixed(2)}` : 'your subscription';
              const email = paymentFailedEmail(data.displayName || data.email, amount, new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US'), `${functionsEnv.appUrl}/settings/billing`);
              await sendEmail({ to: data.email, subject: email.subject, html: email.html });
            }
          }
          break;
        }
        case 'checkout.session.completed':
          logger.info(`Checkout completed for session ${(event.data.object as Stripe.Checkout.Session).id}`);
          break;
      }
    }
    await completeEvent(event, { supported: isSupportedWebhookType(event.type) });
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook handler error');
    await getDb().collection('billing_events').doc(event.id).update({ status: 'failed', errorCode: 'processing_error', processedAt: Date.now() });
    res.status(500).send('Webhook handler error');
  }
});
