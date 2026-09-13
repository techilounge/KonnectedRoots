import type Stripe from 'stripe';
import { functionsEnv } from './config';
import { resolvePlanPrice } from './billingCatalog';
import { createHash } from 'node:crypto';

export const NO_SCHEDULED_DOWNGRADE = {
  scheduledPlan: null,
  scheduledInterval: null,
  scheduledChangeAt: null,
  scheduledChangeType: null,
  scheduledChangeStatus: null,
  stripeScheduleId: null,
};

export function stripeId(value: any): string {
  return typeof value === 'string' ? value : value?.id || '';
}

export function ownsDowngradeSchedule(schedule: Stripe.SubscriptionSchedule, uid: string, subscriptionId: string, customerId: string): boolean {
  return stripeId(schedule.customer) === customerId &&
    stripeId(schedule.subscription || schedule.released_subscription) === subscriptionId &&
    schedule.metadata?.kr_uid === uid && schedule.metadata?.kr_subscription_id === subscriptionId &&
    schedule.metadata?.kr_change === 'family_to_pro';
}

/** Server-owned creation receipt ties applied cleanup to our exact operation. */
export function ownsAppliedScheduleReceipt(billing: any, schedule: Stripe.SubscriptionSchedule | null,
  subscription: Stripe.Subscription, uid: string, familyId: string, livemode: boolean): boolean {
  const receipt = billing?.basePlanScheduleRecovery;
  return Boolean(schedule && receipt && familyId && receipt.scheduleId === schedule.id &&
    receipt.uid === uid && receipt.customerId === stripeId(subscription.customer) && receipt.subscriptionId === subscription.id &&
    receipt.familyId === familyId && receipt.livemode === livemode &&
    typeof receipt.operationId === 'string' && receipt.operationId.length > 0 && receipt.operationId === schedule.metadata?.kr_operation_id);
}

/** Response snapshots, not request payloads. Detect edits to any schedule setting. */
export function scheduleFingerprint(schedule: Stripe.SubscriptionSchedule): string {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).filter(key => key !== 'lastResponse').sort().map(key => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(schedule))).digest('hex');
}

export function scheduleConfigurationFingerprint(schedule: Stripe.SubscriptionSchedule): string {
  // Only lifecycle fields may change when a known partial schedule is released.
  const { subscription: _subscription, released_subscription: _releasedSubscription, status: _status,
    current_phase: _currentPhase, released_at: _releasedAt, canceled_at: _canceledAt, completed_at: _completedAt, ...configuration } = schedule;
  return scheduleFingerprint(configuration as Stripe.SubscriptionSchedule);
}

/** Never replay a create POST to discover ownership: Stripe creation events are GET-only receipts. */
export async function verifyPartialScheduleOwnership(api: Stripe, schedule: Stripe.SubscriptionSchedule, subscription: Stripe.Subscription,
  uid: string, billing: any, familyId: string, livemode: boolean): Promise<boolean> {
  const terminal = ['released', 'canceled', 'completed'].includes(schedule.status);
  if (schedule.livemode !== livemode || subscription.livemode !== livemode ||
      stripeId(schedule.customer) !== stripeId(subscription.customer) || stripeId(schedule.subscription || schedule.released_subscription) !== subscription.id ||
      (!terminal && stripeId(subscription.schedule) !== schedule.id) || subscription.metadata.kr_uid !== uid ||
      subscription.metadata.kr_family_id !== familyId) return false;
  const receipt = billing.basePlanScheduleRecovery;
  if (receipt?.scheduleId === schedule.id && receipt.subscriptionId === subscription.id && receipt.customerId === stripeId(subscription.customer) &&
      receipt.familyId === familyId && receipt.livemode === livemode && receipt.uid === uid &&
      (terminal ? receipt.configurationFingerprint === scheduleConfigurationFingerprint(schedule) : receipt.fingerprint === scheduleFingerprint(schedule))) return true;
  const operationId = billing.basePlanChangeOperationId;
  if (!operationId || !['schedule', 'cancel'].includes(billing.basePlanChangeOperation)) return false;
  // Test Clock object.created is frozen time; event.created is wall time. Do not
  // filter the event stream by schedule.created. Exhaustion/missing evidence fails closed.
  const key = `kr-family-pro-create:${subscription.id}:${operationId}`;
  let starting_after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const events = await api.events.list({ type: 'subscription_schedule.created', limit: 100, ...(starting_after ? { starting_after } : {}) });
    const matches = events.data.filter(event => stripeId(event.data.object) === schedule.id);
    if (matches.length) return matches.length === 1 && matches[0].livemode === livemode &&
      matches[0].request?.idempotency_key === key &&
      (terminal ? scheduleConfigurationFingerprint(matches[0].data.object as Stripe.SubscriptionSchedule) === scheduleConfigurationFingerprint(schedule)
        : scheduleFingerprint(matches[0].data.object as Stripe.SubscriptionSchedule) === scheduleFingerprint(schedule));
    if (!events.has_more || !events.data.length) return false;
    starting_after = events.data[events.data.length - 1].id;
  }
  return false;
}

export function inspectDowngradeSchedule(subscription: Stripe.Subscription, schedule: Stripe.SubscriptionSchedule | null, uid: string,
  partialOwnershipVerified = false, prices = functionsEnv.prices, livemode = functionsEnv.stripeSecretKey.startsWith('sk_live_'), now = Date.now() / 1000) {
  const base = subscription.items.data.filter(item => ['pro', 'family'].includes(item.price.metadata?.kr_plan));
  const interval = base[0]?.price.recurring?.interval;
  const plan = base[0]?.price.metadata?.kr_plan;
  const familyPrice = resolvePlanPrice(prices, 'family', interval), proPrice = resolvePlanPrice(prices, 'pro', interval);
  const end = base[0]?.current_period_end || 0;
  const current = schedule?.phases.find(phase => phase.start_date === schedule.current_phase?.start_date);
  const graph = (items: any[]) => JSON.stringify(items.map(item => `${stripeId(item.price)}:${item.quantity || 1}`).sort());
  const liveGraph = graph(subscription.items.data);
  const mirror = Boolean(current && graph(current.items) === liveGraph);
  const expectedFuture = subscription.items.data.map(item => ({ price: item.price.id === familyPrice ? proPrice : item.price.id, quantity: item.quantity || 1 }));
  const scope = Boolean(schedule && base.length === 1 && familyPrice && proPrice &&
    subscription.livemode === livemode && schedule.livemode === livemode &&
    stripeId(schedule.customer) === stripeId(subscription.customer) && stripeId(schedule.subscription || schedule.released_subscription) === subscription.id &&
    (schedule.status !== 'active' || stripeId(subscription.schedule) === schedule.id));
  const tagged = Boolean(scope && schedule && ownsDowngradeSchedule(schedule, uid, subscription.id, stripeId(subscription.customer)) &&
    schedule.metadata?.kr_family_id === subscription.metadata.kr_family_id);
  const future = schedule?.phases.filter(phase => current ? phase.start_date > current.start_date : phase.start_date >= end) || [];
  const eligible = subscription.status === 'active' && !subscription.pending_update && !subscription.cancel_at && !subscription.cancel_at_period_end &&
    end > now && base.length === 1 && (base[0]?.quantity || 1) === 1 && base[0]?.price.id === familyPrice &&
    subscription.items.data.length <= 2 && subscription.items.data.every(item => item === base[0] ||
      item.price.id === prices.ai_pack_monthly && item.price.metadata?.kr_addon === 'ai_pack' && (item.quantity || 1) === 1);
  const partialDetected = Boolean(scope && schedule?.status === 'active' && plan === 'family' && schedule.phases.length === 1 && mirror && future.length === 0);
  const currentSafe = Boolean(current && current.start_date < end && current.end_date === end && !current.trial_end && !current.add_invoice_items?.length &&
    (current.billing_cycle_anchor == null || current.billing_cycle_anchor === 'automatic') &&
    !['custom_fields', 'description', 'footer'].some(key => (current.invoice_settings as any)?.[key] != null));
  const partialRepairable = partialDetected && partialOwnershipVerified && eligible && currentSafe && schedule?.end_behavior === 'release';
  const scheduledVerified = Boolean(tagged && schedule?.status === 'active' && plan === 'family' && eligible && mirror && currentSafe &&
    schedule.end_behavior === 'release' && schedule.phases.length === 2 && future.length === 1 && future[0].start_date === end &&
    future[0].end_date > end && future[0].proration_behavior === 'none' && !future[0].trial_end && !future[0].add_invoice_items?.length &&
    future[0].metadata?.kr_plan === 'pro' && future[0].metadata?.kr_interval === interval && graph(future[0].items) === graph(expectedFuture));
  const appliedPro = Boolean(tagged && schedule?.status === 'active' && plan === 'pro' && base[0]?.price.id === proPrice && mirror &&
    schedule.phases.length === 2 && current === schedule.phases[1] && current.metadata?.kr_plan === 'pro' && current.metadata?.kr_interval === interval &&
    schedule.phases[0].end_date === current.start_date && schedule.phases[0].metadata?.kr_plan === 'family' && schedule.phases[0].metadata?.kr_interval === interval &&
    graph(schedule.phases[0].items) === graph(subscription.items.data.map(item => ({price:item.price.id === proPrice ? familyPrice : item.price.id,quantity:item.quantity || 1}))) &&
    schedule.phases.every(phase => phase.proration_behavior === 'none' && !phase.trial_end && !phase.add_invoice_items?.length) && schedule.end_behavior === 'release');
  const appliedReleaseEligible = Boolean(appliedPro && schedule && subscription.status === 'active' &&
    !subscription.pending_update && !subscription.cancel_at && !subscription.cancel_at_period_end &&
    subscription.metadata.kr_uid === uid && Boolean(subscription.metadata.kr_family_id) &&
    typeof schedule.metadata?.kr_operation_id === 'string' && schedule.metadata.kr_operation_id.length > 0 &&
    (base[0]?.quantity ?? 1) === 1 && future.length === 0 && subscription.items.data.length <= 2 &&
    subscription.items.data.every(item => item.price.livemode === livemode && (item === base[0] || item.price.id === prices.ai_pack_monthly &&
      item.price.metadata?.kr_addon === 'ai_pack' && (item.quantity ?? 1) === 1)) &&
    schedule.phases.every(phase => phase.start_date < phase.end_date && phase.items.every(item => (item.quantity ?? 1) === 1)));
  const terminal = scope && (tagged || partialOwnershipVerified) && ['released', 'canceled', 'completed'].includes(String(schedule?.status));
  return {
    appliedDowngradeDetected: appliedPro,
    appliedScheduleReleaseEligible: appliedReleaseEligible,
    scheduleReleaseNeeded: appliedPro && stripeId(subscription.schedule) === schedule?.id,
    safeToReconcileAppliedSchedule: appliedReleaseEligible ? 'YES' : 'NO',
    scheduleReconciliationStatus: !schedule ? 'none' : scheduledVerified ? 'scheduled' : partialRepairable ? 'partial_owned' : appliedPro ? 'applied_pro' : terminal ? schedule.status : 'unknown',
    scheduleId: schedule?.id || null, scheduleStatus: schedule?.status || null,
    scheduleOwnershipVerified: tagged || Boolean(scope && partialOwnershipVerified),
    currentPhasePlan: mirror ? plan || null : null, currentPhaseInterval: mirror ? interval || null : null,
    futurePhaseCount: future.length,
    futurePhasePlan: future.length === 1 ? future[0].items.some(item => stripeId(item.price) === proPrice) ? 'pro' : 'unknown' : null,
    futurePhaseInterval: future.length === 1 && graph(future[0].items) === graph(expectedFuture) ? interval || null : null,
    futurePhaseStart: future.length === 1 ? future[0].start_date : null,
    partialScheduleDetected: partialDetected, partialScheduleRepairable: Boolean(partialRepairable),
    scheduledDowngradeVerified: scheduledVerified, safeToRetryScheduling: partialRepairable || scheduledVerified ? 'YES' : 'NO',
  };
}

/** Display projection only: the actual current base item always determines entitlement. */
export function scheduledDowngradeState(subscription: Stripe.Subscription, schedule: Stripe.SubscriptionSchedule | null, uid: string) {
  if (!inspectDowngradeSchedule(subscription, schedule, uid).scheduledDowngradeVerified) return { ...NO_SCHEDULED_DOWNGRADE };
  const base = subscription.items.data.filter(item => ['pro', 'family'].includes(item.price.metadata?.kr_plan));
  if (base.length !== 1 || base[0].price.metadata.kr_plan !== 'family' || !schedule || schedule.status !== 'active' ||
      !ownsDowngradeSchedule(schedule, uid, subscription.id, stripeId(subscription.customer))) return { ...NO_SCHEDULED_DOWNGRADE };
  const interval = base[0].price.recurring?.interval;
  const familyPrice = resolvePlanPrice(functionsEnv.prices, 'family', interval);
  const proPrice = resolvePlanPrice(functionsEnv.prices, 'pro', interval);
  const end = base[0].current_period_end;
  const future = schedule.phases.filter(phase => phase.start_date === end);
  const expectedItems = subscription.items.data.map(item => `${item.price.id === familyPrice ? proPrice : item.price.id}:${item.quantity || 1}`).sort();
  if (!familyPrice || !proPrice || base[0].price.id !== familyPrice || future.length !== 1 ||
      future[0].items.filter(item => stripeId(item.price) === proPrice).length !== 1 ||
      future[0].items.some(item => stripeId(item.price) === familyPrice) ||
      JSON.stringify(future[0].items.map(item => `${stripeId(item.price)}:${item.quantity || 1}`).sort()) !== JSON.stringify(expectedItems)) return { ...NO_SCHEDULED_DOWNGRADE };
  return {
    scheduledPlan: 'pro' as const,
    scheduledInterval: interval as 'month' | 'year',
    scheduledChangeAt: end * 1000,
    scheduledChangeType: 'downgrade' as const,
    scheduledChangeStatus: 'scheduled' as const,
    stripeScheduleId: schedule.id,
  };
}

/** Preserve the migrated phase's billing settings; never replay one-off invoice items. */
export function downgradePhases(schedule: Stripe.SubscriptionSchedule, subscription: Stripe.Subscription, proPrice: string, interval: 'month' | 'year'): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  const current = schedule.phases.find(phase => phase.start_date === schedule.current_phase?.start_date);
  const base = subscription.items.data.find(item => item.price.metadata?.kr_plan === 'family');
  if (!current || !base || !base.current_period_end || current.start_date >= base.current_period_end ||
      current.trial_end || current.add_invoice_items?.length) throw new Error('The current schedule phase requires billing reconciliation.');
  const invoice = current.invoice_settings as any;
  if (invoice && ['custom_fields', 'description', 'footer'].some(key => invoice[key] != null)) {
    throw new Error('Unsupported phase invoice settings require billing reconciliation.');
  }
  const discounts = (values: any[]) => values.map(value => {
    if (value.discount) return { discount: stripeId(value.discount) };
    if (value.promotion_code) return { promotion_code: stripeId(value.promotion_code) };
    return { coupon: stripeId(value.coupon) };
  });
  const settings: Stripe.SubscriptionScheduleUpdateParams.Phase = { items: [] };
  if (current.application_fee_percent != null) settings.application_fee_percent = current.application_fee_percent;
  if (current.collection_method != null) settings.collection_method = current.collection_method;
  if (current.currency != null) settings.currency = current.currency;
  if (current.description != null) settings.description = current.description;
  // GET response shapes are not POST parameter shapes (notably disabled_reason).
  if (current.automatic_tax) settings.automatic_tax = { enabled: current.automatic_tax.enabled,
    ...(current.automatic_tax.liability ? { liability: { type: current.automatic_tax.liability.type,
      ...(current.automatic_tax.liability.account ? { account: stripeId(current.automatic_tax.liability.account) } : {}) } } : {}) };
  if (current.billing_thresholds) settings.billing_thresholds = { ...(current.billing_thresholds.amount_gte != null ? { amount_gte: current.billing_thresholds.amount_gte } : {}),
    ...(current.billing_thresholds.reset_billing_cycle_anchor != null ? { reset_billing_cycle_anchor: current.billing_thresholds.reset_billing_cycle_anchor } : {}) };
  if (current.invoice_settings) settings.invoice_settings = {
    ...(current.invoice_settings.account_tax_ids ? { account_tax_ids: current.invoice_settings.account_tax_ids.map(stripeId) } : {}),
    ...(current.invoice_settings.days_until_due != null ? { days_until_due: current.invoice_settings.days_until_due } : {}),
    ...(current.invoice_settings.issuer ? { issuer: { type: current.invoice_settings.issuer.type,
      ...(current.invoice_settings.issuer.account ? { account: stripeId(current.invoice_settings.issuer.account) } : {}) } } : {}),
  };
  if (current.default_payment_method) settings.default_payment_method = stripeId(current.default_payment_method);
  if (current.on_behalf_of) settings.on_behalf_of = stripeId(current.on_behalf_of);
  if (current.transfer_data) settings.transfer_data = { destination: stripeId(current.transfer_data.destination),
    ...(current.transfer_data.amount_percent != null ? { amount_percent: current.transfer_data.amount_percent } : {}) };
  if (current.default_tax_rates) settings.default_tax_rates = current.default_tax_rates.map(stripeId);
  if (current.discounts?.length) settings.discounts = discounts(current.discounts);
  const items = current.items.map(item => ({
    price: stripeId(item.price), quantity: item.quantity || 1,
    ...(item.tax_rates ? { tax_rates: item.tax_rates.map(stripeId) } : {}),
    ...(item.discounts?.length ? { discounts: discounts(item.discounts) } : {}),
    ...(item.billing_thresholds?.usage_gte != null ? { billing_thresholds: { usage_gte: item.billing_thresholds.usage_gte } } : {}),
    ...(item.metadata ? { metadata: item.metadata } : {}),
  }));
  const liveItems = subscription.items.data.map(item => `${item.price.id}:${item.quantity || 1}`).sort();
  if (JSON.stringify(items.map(item => `${item.price}:${item.quantity}`).sort()) !== JSON.stringify(liveItems)) {
    throw new Error('Schedule items differ from the current subscription.');
  }
  const metadata = { ...subscription.metadata, ...current.metadata };
  return [
    { ...settings, start_date: current.start_date, end_date: base.current_period_end, items,
      metadata: { ...metadata, kr_plan: 'family', kr_interval: interval }, proration_behavior: 'none' },
    { ...settings, start_date: base.current_period_end, duration: { interval, interval_count: 1 },
      items: items.map(item => item.price === base.price.id ? { ...item, price: proPrice } : item),
      metadata: { ...metadata, kr_plan: 'pro', kr_interval: interval }, proration_behavior: 'none' },
  ];
}
