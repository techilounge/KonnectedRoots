import 'server-only';
import { createHash } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { AIError, type BillingContext, type Control, type Feature, type Invocation, type Target } from './types';
import { budgetState, enforceBudget } from './cost-engine';
import { compatible, modelKey } from './registry';
import { nextCircuit } from './router';
export const monthKey = () => new Date().toISOString().slice(0, 7);
export const circuitId = (target: Target) => createHash('sha256').update(modelKey(target)).digest('hex');
export type Usage = { spent: number; reserved: number; count: number; successes: number; latencyMs: number;
  inputTokens: number; outputTokens: number; features: Record<string, { spent: number; reserved: number; count: number }>;
  models: Record<string, { name: string; count: number; spent: number }> };
export const emptyUsage = (): Usage => ({ spent: 0, reserved: 0, count: 0, successes: 0, latencyMs: 0, inputTokens: 0, outputTokens: 0, features: {}, models: {} });
export async function readUsage(): Promise<Usage> {
  const snap = await adminDb.collection('ai_usage_months').doc(monthKey()).get();
  return snap.exists ? snap.data() as Usage : emptyUsage();
}
export async function audit(action: string, uid: string, targetId: string, details: string) {
  await adminDb.collection('audit_logs').add({ timestamp: FieldValue.serverTimestamp(), adminUid: uid, adminEmail: '', action, category: 'configuration', targetId, details });
}
export async function reserve(control: Control, feature: Feature, target: Target, estimate?: number, billing?: BillingContext) {
  const month = monthKey();
  const usageRef = adminDb.collection('ai_usage_months').doc(month);
  const ref = adminDb.collection('ai_invocations').doc();
  const amount = estimate ?? control.routes[feature].maxRequestCost;
  await adminDb.runTransaction(async tx => {
    const [usageDoc, healthDoc, configDoc, providerDoc] = await Promise.all([
      tx.get(usageRef), tx.get(adminDb.collection('ai_model_health').doc(circuitId(target))),
      tx.get(adminDb.collection('ai_configuration').doc('control')), tx.get(adminDb.collection('ai_providers').doc(target.providerId)),
    ]);
    const current = configDoc.exists ? configDoc.data() as Control : control;
    const route = current.routes[feature];
    const model = current.models.find(m => modelKey(m) === modelKey(target));
    if (!route.enabled || !model?.enabled || !compatible(feature, model) ||
        (route.privacy === 'direct_providers_only' && ['openrouter', 'custom'].includes(target.providerId)) ||
        (providerDoc.exists && (!providerDoc.data()?.enabled || !providerDoc.data()?.credentialConfigured))) throw new AIError('configuration_changed');
    if (amount > route.maxRequestCost) throw new AIError('request_cost_exceeded');
    if ((healthDoc.data()?.unavailableUntil || 0) > Date.now()) throw new AIError('circuit_open');
    const u = usageDoc.exists ? usageDoc.data() as Usage : emptyUsage();
    const f = u.features[feature] || { spent: 0, reserved: 0, count: 0 };
    enforceBudget(current.budgets, route, u.spent + u.reserved, f.spent + f.reserved, amount);
    u.reserved += amount;
    u.features[feature] = { ...f, reserved: f.reserved + amount };
    tx.set(usageRef, u);
    tx.create(ref, { state: 'reserved', month, feature, amount, timestamp: new Date().toISOString(), providerId: target.providerId, modelId: target.modelId, ...(billing || {}) });
  });
  return { id: ref.id, month, amount };
}
export async function settle(reservation: { id: string; month: string; amount: number }, invocation: Invocation, control: Control) {
  const ref = adminDb.collection('ai_invocations').doc(reservation.id);
  const usageRef = adminDb.collection('ai_usage_months').doc(reservation.month);
  const healthRef = adminDb.collection('ai_model_health').doc(circuitId(invocation));
  await adminDb.runTransaction(async tx => {
    const [event, usageDoc, healthDoc] = await Promise.all([tx.get(ref), tx.get(usageRef), tx.get(healthRef)]);
    if (event.data()?.state !== 'reserved') return;
    const u = usageDoc.data() as Usage;
    const before = budgetState(control.budgets, u.spent);
    u.reserved = Math.max(0, u.reserved - reservation.amount); u.spent += invocation.estimatedCostUsd;
    u.count++; u.successes += invocation.success ? 1 : 0; u.latencyMs += invocation.latencyMs;
    u.inputTokens += invocation.inputTokens || 0; u.outputTokens += invocation.outputTokens || 0;
    const f = u.features[invocation.feature];
    f.reserved = Math.max(0, f.reserved - reservation.amount); f.spent += invocation.estimatedCostUsd; f.count++;
    const key = circuitId(invocation); const m = u.models[key] || { name: modelKey(invocation), count: 0, spent: 0 };
    m.count++; m.spent += invocation.estimatedCostUsd; u.models[key] = m;
    const previous = healthDoc.data() || {};
    const health = nextCircuit(previous, invocation.errorCode, control.budgets.failureThreshold, control.budgets.cooldownSeconds);
    tx.set(usageRef, u); tx.set(ref, { ...invocation, state: 'complete', month: reservation.month });
    tx.set(healthRef, { ...health, ...{ providerId: invocation.providerId, modelId: invocation.modelId }, updatedAt: invocation.timestamp });
    if ((health.unavailableUntil || 0) > Date.now() && (previous.unavailableUntil || 0) <= Date.now()) {
      tx.create(adminDb.collection('audit_logs').doc(), { action: 'AI_CIRCUIT_OPEN', category: 'configuration', timestamp: FieldValue.serverTimestamp(), adminUid: 'AI_GATEWAY', details: modelKey(invocation) });
    }
    const after = budgetState(control.budgets, u.spent);
    if (before !== after) tx.create(adminDb.collection('audit_logs').doc(), { action: 'AI_BUDGET_THRESHOLD', category: 'configuration', timestamp: FieldValue.serverTimestamp(), adminUid: 'AI_GATEWAY', details: after });
  });
}
