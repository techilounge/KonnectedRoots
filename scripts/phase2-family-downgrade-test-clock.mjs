// Explicit, separate manual stages. Importing this file never runs a stage.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {assertLocalEnvironment, assertTestSecret, parseEnvFile} from './phase2-pastdue-test-clock.mjs';

const require = createRequire(import.meta.url);
const Stripe = require('../functions/node_modules/stripe');
export const SCENARIO = 'phase2_family_downgrade';
export const ACTIONS = ['create-customer', 'create-family', 'status', 'advance-step', 'finalize-renewal'];
const objectId = value => typeof value === 'string' ? value : value?.id;

export function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!ACTIONS.includes(action)) throw new Error('Choose one explicit Family downgrade test stage.');
  const values = {action};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]?.slice(2), value = rest[i + 1];
    if (!rest[i]?.startsWith('--') || !['email', 'clock', 'customer', 'subscription', 'family', 'interval', 'confirm', 'invoice'].includes(name) || !value || value.startsWith('--') || values[name]) throw new Error('Invalid or duplicate stage arguments.');
    values[name] = value;
  }
  if (!/^phase2-family-downgrade([+.-][a-z0-9-]+)?@example\.test$/.test(values.email || '')) throw new Error('Use only a NEW disposable phase2-family-downgrade account under example.test.');
  const required = action === 'create-customer' ? [] : action === 'create-family' ? ['clock', 'customer'] : ['clock', 'customer', 'subscription', 'family'];
  for (const name of required) if (!values[name]) throw new Error(`--${name} is required.`);
  for (const [name, prefix] of [['clock', 'clock_'], ['customer', 'cus_'], ['subscription', 'sub_']]) if (values[name] && !values[name].startsWith(prefix)) throw new Error(`Invalid ${name} ID.`);
  if (values.interval && !['month', 'year'].includes(values.interval)) throw new Error('Use month or year.');
  if (action === 'advance-step' && values.confirm !== 'yes') throw new Error('advance-step requires --confirm yes.');
  if (action === 'finalize-renewal' && (values.confirm !== 'yes' || !values.invoice?.startsWith('in_'))) throw new Error('finalize-renewal requires the exact invoice and --confirm yes.');
  if (action !== 'finalize-renewal' && values.invoice) throw new Error('Invoice selection is only allowed for finalize-renewal.');
  if (action === 'create-customer' && ['clock', 'customer', 'subscription', 'family', 'interval', 'confirm'].some(k => values[k])) throw new Error('create-customer accepts only email.');
  return values;
}

export function validateScope({customer, subscription, clock, profile, uid, args, prices}) {
  if (customer.deleted || customer.livemode !== false || customer.id !== args.customer ||
      customer.email !== args.email || customer.metadata.kr_uid !== uid || customer.metadata.kr_test_scenario !== SCENARIO ||
      objectId(customer.test_clock) !== args.clock || clock.id !== args.clock || clock.livemode !== false ||
      profile.billing?.stripeCustomerId !== customer.id) throw new Error('Disposable customer/clock ownership mismatch.');
  if (!subscription) return;
  if (subscription.livemode !== false || objectId(subscription.customer) !== customer.id || subscription.id !== args.subscription ||
      subscription.metadata.kr_uid !== uid || subscription.metadata.kr_test_scenario !== SCENARIO ||
      profile.billing?.stripeSubscriptionId !== subscription.id || profile.family?.familyId !== args.family ||
      subscription.metadata.kr_family_id !== args.family) throw new Error('Subscription/workspace ownership mismatch.');
  const bases = subscription.items.data.filter(i => ['family', 'pro'].includes(i.price.metadata?.kr_plan));
  if (bases.length !== 1) throw new Error('Expected exactly one base item.');
  const base = bases[0], interval = base.price.recurring?.interval;
  if (!['month', 'year'].includes(interval) || base.price.id !== prices[`${base.price.metadata.kr_plan}_${interval}`] ||
      subscription.items.data.some(i => i !== base && (i.price.id !== prices.pack || i.price.metadata.kr_addon !== 'ai_pack')) ||
      subscription.items.data.length > 2) throw new Error('Unrecognized base/add-on graph.');
}

export function advanceTarget({subscription, schedule, clock, args, uid, prices}) {
  const base = subscription.items.data.find(i => i.price.metadata.kr_plan === 'family');
  const interval = base?.price.recurring?.interval;
  const end = base?.current_period_end;
  if (clock.status !== 'ready' || subscription.status !== 'active' || subscription.pending_update || subscription.cancel_at || subscription.cancel_at_period_end ||
      !base || !end || end <= clock.frozen_time || !schedule || objectId(subscription.schedule) !== schedule.id ||
      schedule.status !== 'active' || objectId(schedule.customer) !== args.customer || objectId(schedule.subscription) !== args.subscription ||
      schedule.metadata.kr_uid !== uid || schedule.metadata.kr_change !== 'family_to_pro' || schedule.metadata.kr_subscription_id !== args.subscription ||
      schedule.phases.length !== 2 || schedule.phases[1].start_date !== end || schedule.phases[1].proration_behavior !== 'none' ||
      schedule.phases[1].items.filter(i => objectId(i.price) === prices[`pro_${interval}`]).length !== 1) throw new Error('Not safe to advance this exact scheduled downgrade.');
  const expected = subscription.items.data.map(i => `${i === base ? prices[`pro_${interval}`] : i.price.id}:${i.quantity || 1}`).sort();
  const future = schedule.phases[1].items.map(i => `${objectId(i.price)}:${i.quantity || 1}`).sort();
  if (JSON.stringify(expected) !== JSON.stringify(future)) throw new Error('Future phase does not preserve the add-on graph.');
  // Mixed yearly Family + monthly Pack clocks cannot jump a year in one API
  // request. Each explicit invocation advances at most 28 days in that case.
  const hasMonthlyPack = subscription.items.data.some(i => i.price.id === prices.pack);
  return Math.min(end + 1, interval === 'year' && hasMonthlyPack ? clock.frozen_time + 28 * 86400 : end + 1);
}

function configuration(root) {
  const read = file => fs.existsSync(file) ? parseEnvFile(fs.readFileSync(file, 'utf8')) : {};
  const vars = {...read(path.join(root, 'functions/.env.local')), ...process.env};
  const secret = assertTestSecret(vars.STRIPE_API_KEY || vars.STRIPE_SECRET_KEY || read(path.join(root, 'functions/.secret.local')).STRIPE_SECRET_KEY);
  return {secret, prices:{family_month:vars.STRIPE_PRICE_FAMILY_MONTHLY, family_year:vars.STRIPE_PRICE_FAMILY_YEARLY,
    pro_month:vars.STRIPE_PRICE_PRO_MONTHLY, pro_year:vars.STRIPE_PRICE_PRO_YEARLY, pack:vars.STRIPE_PRICE_AI_PACK}};
}

/** Read-only inspection shares the server classifier and GET-only ownership receipts. */
export async function scheduleStatus({stripe,subscription,schedule,profile,uid,args,prices,clock,family,customer}) {
  const {verifyPartialScheduleOwnership,inspectDowngradeSchedule,ownsAppliedScheduleReceipt} = require('../functions/lib/billingSchedules.js');
  const proof = Boolean(schedule?.phases.length === 1 && await verifyPartialScheduleOwnership(stripe,schedule,subscription,
    uid,profile.billing,args.family,false));
  const catalog={family_monthly:prices.family_month,family_yearly:prices.family_year,pro_monthly:prices.pro_month,pro_yearly:prices.pro_year,ai_pack_monthly:prices.pack};
  const status=inspectDowngradeSchedule(subscription,schedule,uid,proof,catalog,false,Math.max(Date.now()/1000,clock.frozen_time));
  // Status never releases an object. Missing/changed scope, provenance or live
  // catalog evidence closes the manual gate, even if the structural graph is Pro.
  let appliedEligible = false;
  if (status.appliedScheduleReleaseEligible) {
    try {
      validateScope({customer,subscription,clock,profile,uid,args,prices});
      const interval=status.currentPhaseInterval;
      const approvedPrice = (value,plan) => value.livemode===false && value.active===true && value.currency==='usd' &&
        value.id===prices[`${plan}_${interval}`] && value.metadata?.kr_plan===plan &&
        value.recurring?.interval===interval && value.recurring.interval_count===1 &&
        value.unit_amount===(plan==='pro' ? interval==='month'?599:5999 : interval==='month'?999:9900);
      const [pro,familyPrice]=await Promise.all([stripe.prices.retrieve(prices[`pro_${interval}`]),stripe.prices.retrieve(prices[`family_${interval}`])]);
      appliedEligible = Boolean(approvedPrice(pro,'pro') && approvedPrice(familyPrice,'family') &&
        args.family===`${SCENARIO}_${uid}` &&
        (!args.interval || args.interval===interval) && clock.status==='ready' &&
        customer.metadata.kr_family_id===args.family && family.ownerUid===uid &&
        family.plan?.stripeCustomerId===args.customer && family.plan?.stripeSubscriptionId===args.subscription &&
        profile.billing.plan==='pro' && profile.billing.status==='active' && family.plan?.plan==='pro' && family.plan?.status==='active' &&
        family.plan?.paidSeatEntitlementActive===false &&
        !profile.billing.aiPackOperationId && !profile.billing.aiPackRemovalOperationId && !profile.billing.aiPackResumeOperationId &&
        profile.billing.planChangeStatus!=='pending' && !profile.billing.cancelAtPeriodEnd && !profile.billing.scheduledCancellationAt &&
        ownsAppliedScheduleReceipt(profile.billing,schedule,subscription,uid,args.family,false));
    } catch { appliedEligible=false; }
  }
  status.appliedScheduleReleaseEligible=appliedEligible;
  status.safeToReconcileAppliedSchedule=appliedEligible?'YES':'NO';
  if(status.safeToRetryScheduling==='YES') {
    const interval=subscription.items.data.find(i=>i.price.metadata.kr_plan==='family')?.price.recurring?.interval;
    const target=await stripe.prices.retrieve(prices[`pro_${interval}`]);
    const approved=target.livemode===false && target.active && target.currency==='usd' && target.metadata.kr_plan==='pro' &&
      target.recurring?.interval===interval && target.recurring?.interval_count===1 && target.unit_amount===(interval==='month'?599:5999);
    if(!approved || profile.billing.plan!=='family' || profile.billing.status!=='active' || clock.status!=='ready' ||
      profile.billing.aiPackOperationId || profile.billing.aiPackRemovalOperationId || profile.billing.aiPackResumeOperationId || profile.billing.planChangeStatus==='pending' ||
      profile.billing.basePlanChangeOperationId && profile.billing.basePlanChangeOperation!=='schedule' ||
      profile.billing.cancelAtPeriodEnd || profile.billing.scheduledCancellationAt || family.plan?.cancelAtPeriodEnd || family.plan?.scheduledCancellationAt ||
      family.ownerUid!==uid || family.plan?.stripeCustomerId!==args.customer || family.plan?.stripeSubscriptionId!==args.subscription ||
      family.plan?.plan!=='family' || family.plan?.status!=='active') {
      status.partialScheduleRepairable=false; status.safeToRetryScheduling='NO';
    }
  }
  return status;
}

export function renewalPaymentState({subscription,billing,invoices,now,packPrice}) {
  const recurring=subscription.items.data.some(i=>i.price.id===packPrice);
  const paidThrough=Number(billing.aiPackPaidThrough || 0);
  const prepaid=billing.aiPackCancelAtPeriodEnd===true && Number(billing.aiPackScheduledRemovalAt)===paidThrough;
  const currentPaid=paidThrough>now && billing.aiPackStatus==='active' && billing.addons?.aiPack===true && (recurring || prepaid);
  const packLines=i=>i.lines.data.filter(l=>objectId(l.pricing?.price_details?.price || l.price)===packPrice);
  const candidates=invoices.filter(i=>objectId(i.customer)===objectId(subscription.customer) && objectId(i.parent?.subscription_details?.subscription || i.subscription)===subscription.id && i.billing_reason==='subscription_cycle' && packLines(i).length);
  candidates.sort((a,b)=>Math.max(...packLines(b).map(l=>l.period.end))-Math.max(...packLines(a).map(l=>l.period.end)));
  const invoice=candidates[0];
  const pending=Boolean(recurring && !currentPaid && invoice && ['draft','open'].includes(invoice.status) && invoice.amount_remaining>0 && Math.max(...packLines(invoice).map(l=>l.period.end*1000))>paidThrough);
  const plan=subscription.items.data.find(i=>['pro','family'].includes(i.price.metadata?.kr_plan))?.price.metadata.kr_plan;
  const entitled=['active','trialing'].includes(subscription.status) && Number(subscription.items.data.find(i=>['pro','family'].includes(i.price.metadata?.kr_plan))?.current_period_end)*1000>now;
  return {billingEvaluationTime:now,aiPackRecurringItemExists:recurring,aiPackCurrentPaidThroughValid:currentPaid,
    aiPackRenewalPaymentPending:pending,aiPackEntitlementValid:entitled && currentPaid,
    aiPackDerivedState:currentPaid?(recurring?'paid_renewing':'prepaid_stopped'):pending?(invoice.attempt_count>0?'renewal_failed':'renewal_pending'):paidThrough?'expired':recurring?'unpaid_item':'none',
    effectiveAIAllowance:entitled?(plan==='family'?600:200)+(currentPaid?1000:0):10,
    renewalInvoice:invoice?{invoiceId:invoice.id,billingReason:invoice.billing_reason,status:invoice.status,attempted:invoice.attempted,attemptCount:invoice.attempt_count,amountDue:invoice.amount_due,amountPaid:invoice.amount_paid,amountRemaining:invoice.amount_remaining,aiPackLinePeriodEnd:Math.max(...packLines(invoice).map(l=>l.period.end))*1000}:null};
}

/** Explicit owner stage; no clock advance, payment call, release or DB write. */
export async function finalizeRenewal({stripe,args,subscription,customer,clock,profile,uid,prices,family,schedule}) {
  if (args.action!=='finalize-renewal' || args.confirm!=='yes') throw new Error('Explicit finalization confirmation required.');
  validateScope({customer,subscription,clock,profile,uid,args,prices});
  if (args.family!==`${SCENARIO}_${uid}` || customer.metadata.kr_family_id!==args.family || family?.plan?.stripeCustomerId!==args.customer || family?.plan?.stripeSubscriptionId!==args.subscription) throw new Error('Exact retained Family mapping required.');
  if (clock.status!=='ready' || subscription.status!=='active' || subscription.pending_update || subscription.cancel_at || subscription.cancel_at_period_end || family?.ownerUid!==uid || profile.billing.plan!=='pro' || profile.billing.status!=='active' || family.plan?.plan!=='pro' || family.plan?.status!=='active' || family.plan?.paidSeatEntitlementActive!==false || Number(profile.billing.aiPackPaidThrough)>clock.frozen_time*1000 ||
      profile.billing.aiPackOperationId || profile.billing.aiPackRemovalOperationId || profile.billing.aiPackResumeOperationId || profile.billing.basePlanChangeOperationId) throw new Error('Renewal scope is not ready.');
  if (schedule && (await scheduleStatus({stripe,subscription,schedule,profile,uid,args,prices,clock,family,customer})).safeToReconcileAppliedSchedule!=='YES') throw new Error('Attached schedule ownership is not proven.');
  const items=subscription.items.data;
  const base=items.find(i=>i.price.id===prices.pro_month),pack=items.find(i=>i.price.id===prices.pack);
  if (items.length!==2 || !base || !pack || base.quantity!==1 || pack.quantity!==1 || base.current_period_end!==pack.current_period_end) throw new Error('Expected monthly Pro plus one Pack only.');
  const invoice=await stripe.invoices.retrieve(args.invoice);
  const lines=invoice.lines.data;
  if (invoice.id!==args.invoice || invoice.livemode!==false || objectId(invoice.customer)!==customer.id || objectId(invoice.parent?.subscription_details?.subscription || invoice.subscription)!==subscription.id || invoice.billing_reason!=='subscription_cycle' || invoice.status!=='draft' || invoice.attempted || invoice.attempt_count!==0 || invoice.amount_paid!==0 || invoice.amount_due!==998 || invoice.amount_remaining!==998 || invoice.auto_advance!==true || invoice.collection_method!=='charge_automatically' || invoice.lines.has_more || lines.length!==2) throw new Error('Expected exact draft subscription renewal only.');
  for (const [price,amount] of [[prices.pro_month,599],[prices.pack,399]]) {
    const line=lines.find(l=>objectId(l.pricing?.price_details?.price || l.price)===price);
    if (!line || line.amount!==amount || (line.quantity ?? 1)!==1 || line.period.end!==base.current_period_end || line.period.start!==base.current_period_start || line.period.start*1000!==Number(profile.billing.aiPackPaidThrough) || line.period.start>clock.frozen_time || line.period.end<=clock.frozen_time) throw new Error('Renewal period or amount mismatch.');
    const catalog=await stripe.prices.retrieve(price);
    if (catalog.id!==price || catalog.livemode!==false || !catalog.active || catalog.currency!=='usd' || catalog.unit_amount!==amount || catalog.recurring?.interval!=='month' || catalog.recurring.interval_count!==1 || (price===prices.pack?catalog.metadata.kr_addon!=='ai_pack':catalog.metadata.kr_plan!=='pro')) throw new Error('Renewal catalog mismatch.');
  }
  const result=await stripe.invoices.finalizeInvoice(invoice.id,{auto_advance:true},{idempotencyKey:`kr-family-pro-finalize:${invoice.id}`});
  return {invoiceId:result.id,status:result.status,next:'Read-only status; wait for normal Stripe collection and signed payment webhooks. No clock was advanced and no explicit payment was attempted.'};
}

export async function run(args) {
  assertLocalEnvironment();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const config = configuration(root), stripe = new Stripe(config.secret);
  const app = getApps().find(a => a.name === SCENARIO) || initializeApp({projectId:'demo-konnectedroots-phase2'}, SCENARIO);
  const account = await getAuth(app).getUserByEmail(args.email);
  const db = getFirestore(app), userRef = db.collection('users').doc(account.uid);
  const profile = (await userRef.get()).data();
  if (!profile) throw new Error('First sign up this NEW synthetic account in the local app and wait for its profile.');
  const uid = account.uid, metadata = {kr_uid:uid, kr_test_scenario:SCENARIO};
  if (args.action === 'create-customer') {
    if (profile.billing?.stripeCustomerId || profile.billing?.stripeSubscriptionId || profile.family?.familyId || !['free', undefined].includes(profile.billing?.plan)) throw new Error('Refusing an existing billing lifecycle account. Use a NEW account.');
    const clock = await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:SCENARIO}, {idempotencyKey:`kr-family-downgrade-clock:${uid}`});
    const customer = await stripe.customers.create({email:args.email,test_clock:clock.id,metadata}, {idempotencyKey:`kr-family-downgrade-customer:${uid}`});
    // Mapping only. Never grant a plan, paid status, usage allowance or seat.
    await db.runTransaction(async tx => {const latest = (await tx.get(userRef)).data();
      if (latest?.billing?.stripeCustomerId || latest?.billing?.stripeSubscriptionId || latest?.family?.familyId) throw new Error('Billing mapping changed; stop and inspect.');
      tx.set(userRef,{billing:{stripeCustomerId:customer.id}},{merge:true});});
    return {clockId:clock.id,customerId:customer.id,uid,next:'Run create-family separately; no subscription has been purchased.'};
  }
  const [customer,clock] = await Promise.all([stripe.customers.retrieve(args.customer),stripe.testHelpers.testClocks.retrieve(args.clock)]);
  validateScope({customer,clock,profile,uid,args,prices:config.prices});
  if (args.action === 'create-family') {
    const existing = (await stripe.subscriptions.list({customer:customer.id,status:'all',limit:100})).data;
    if (existing.length || profile.billing?.stripeSubscriptionId || profile.family?.familyId) throw new Error('A subscription/workspace already exists. Use status; never recreate it.');
    const interval = args.interval || 'month', priceId = config.prices[`family_${interval}`];
    const price = await stripe.prices.retrieve(priceId);
    if (price.livemode !== false || !price.active || price.metadata.kr_plan !== 'family' || price.recurring?.interval !== interval ||
        price.currency !== 'usd' || price.unit_amount !== (interval === 'month' ? 999 : 9900)) throw new Error('Configured Family price is not the approved sandbox catalog.');
    const familyId = `phase2_family_downgrade_${uid}`, familyRef = db.collection('families').doc(familyId);
    await db.runTransaction(async tx => {const current = await tx.get(familyRef);
      if (current.exists && current.data()?.ownerUid !== uid) throw new Error('Workspace scope mismatch.');
      if (!current.exists) tx.create(familyRef,{ownerUid:uid,createdAt:Date.now(),plan:{plan:'family',status:'none',seatLimit:6},usage:{monthKey:new Date().toISOString().slice(0,7),aiActionsUsed:0,exportsUsed:0,storageUsedBytes:0}});});
    await stripe.customers.update(customer.id,{metadata:{...customer.metadata,kr_family_id:familyId}});
    const method = await stripe.paymentMethods.attach('pm_card_visa',{customer:customer.id},{idempotencyKey:`kr-family-downgrade-visa:${uid}`});
    await stripe.customers.update(customer.id,{invoice_settings:{default_payment_method:method.id}});
    const subscription = await stripe.subscriptions.create({customer:customer.id,items:[{price:priceId}],billing_mode:{type:'flexible'},default_payment_method:method.id,payment_behavior:'error_if_incomplete',metadata:{...metadata,kr_family_id:familyId,kr_plan:'family',kr_interval:interval}},
      {idempotencyKey:`kr-family-downgrade-subscription:${uid}:${interval}`});
    return {clockId:clock.id,customerId:customer.id,subscriptionId:subscription.id,familyId,uid,next:'Wait for forwarded webhooks. Verify Family/600. Use app controls to schedule/cancel or add a paid AI Pack.'};
  }
  const subscription = await stripe.subscriptions.retrieve(args.subscription);
  validateScope({customer,subscription,clock,profile,uid,args,prices:config.prices});
  const family = (await db.collection('families').doc(args.family).get()).data();
  if (!family || family.ownerUid !== uid) throw new Error('Retained workspace ownership mismatch.');
  const seats = await db.collection('families').doc(args.family).collection('seats').get();
  const schedule = subscription.schedule ? await stripe.subscriptionSchedules.retrieve(objectId(subscription.schedule)) : null;
  if (args.action==='finalize-renewal') return finalizeRenewal({stripe,args,subscription,customer,clock,profile,uid,prices:config.prices,family,schedule});
  if (args.action === 'advance-step') {
    if (profile.billing.plan !== 'family' || profile.billing.scheduledPlan !== 'pro' || profile.billing.scheduledChangeAt !== subscription.items.data.find(i=>i.price.metadata.kr_plan==='family')?.current_period_end*1000) throw new Error('Wait for authoritative scheduled state before advancing.');
    const target = advanceTarget({subscription,schedule,clock,args,uid,prices:config.prices});
    await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time:target});
    return {clockId:clock.id,requestedFrozenTime:target,next:'Wait for clock ready using status; wait for webhook reconciliation. Do not automatically advance again.'};
  }
  const invoices = await stripe.invoices.list({customer:customer.id,subscription:subscription.id,limit:100});
  const charges = await stripe.charges.list({customer:customer.id,limit:100});
  const grants = await db.collection('ai_pack_grants').where('uid','==',uid).get();
  if (invoices.has_more || charges.has_more) throw new Error('Too many billing objects for this disposable scenario; inspect manually.');
  return {uid,clockId:clock.id,clockStatus:clock.status,frozenTime:clock.frozen_time,customerId:customer.id,subscriptionId:subscription.id,
    ...renewalPaymentState({subscription,billing:profile.billing,invoices:invoices.data,now:clock.frozen_time*1000,packPrice:config.prices.pack}),
    aiPackPaidThrough:profile.billing.aiPackPaidThrough || null,aiPackGrantCount:grants.size,
    ...await scheduleStatus({stripe,subscription,schedule,profile,uid,args,prices:config.prices,clock,family,customer}),
    baseItems:subscription.items.data.map(i=>({id:i.id,price:i.price.id,plan:i.price.metadata.kr_plan || null,addon:i.price.metadata.kr_addon || null,periodEnd:i.current_period_end})),
    schedule:schedule?{id:schedule.id,status:schedule.status,phases:schedule.phases.map(p=>({start:p.start_date,end:p.end_date,items:p.items.map(i=>({price:objectId(i.price),quantity:i.quantity}))}))}:null,
    canonicalPlan:profile.billing.plan,canonicalStatus:profile.billing.status,scheduledPlan:profile.billing.scheduledPlan || null,scheduledChangeAt:profile.billing.scheduledChangeAt || null,
    familyId:args.family,seatCount:seats.size,paidSeatsActive:family.plan?.paidSeatEntitlementActive ?? family.plan?.plan==='family',
    invoiceIds:invoices.data.map(i=>i.id).sort(),refundTotal:charges.data.reduce((sum,c)=>sum+c.amount_refunded,0)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await run(parseArgs(process.argv.slice(2))),null,2)); }
  catch { console.error('Family downgrade test stage failed. Check local emulator guards, disposable scope and canonical state; no secrets are printed.'); process.exitCode=1; }
}
