'use client';

import { toast } from '@/hooks/use-toast';
import { createBillingNotificationTracker, type BillingNotice } from './notificationTracker';
import { markBillingReadBoundary } from './notificationFreshness';

const storageKey = 'konnectedroots.billing-feedback.v1';
const listeners = new Set<() => void>();
let tracker: ReturnType<typeof createBillingNotificationTracker> | null = null;
export function billingError(notice?: BillingNotice) {
  toast({ ...(notice || { variant: 'destructive', title: 'Billing update could not be confirmed', description: 'Refresh your billing status or try again.' }), type: 'foreground', duration: 8_000 });
}
export function billingNotifications() {
  if (!tracker) {
    let restored: Parameters<typeof createBillingNotificationTracker>[0]['restored'] = null;
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
      if (parsed && typeof parsed.uid === 'string' && typeof parsed.savedAt === 'number' &&
          typeof parsed.deferredPro === 'boolean' && (parsed.last === null || typeof parsed.last === 'object') &&
          (!parsed.pending || Array.isArray(parsed.pending.remaining))) restored = parsed;
    } catch { /* Storage unavailable: feedback still works within this page. */ }
    tracker = createBillingNotificationTracker({
      mark: markBillingReadBoundary,
      restored,
      emit: notice => toast({ ...notice, type: notice.variant === 'success' ? 'background' : 'foreground', duration: notice.variant === 'success' ? 6_000 : 8_000 }),
      save: state => {
        try {
          if (state) window.sessionStorage.setItem(storageKey, JSON.stringify(state));
          else window.sessionStorage.removeItem(storageKey);
        } catch { /* Do not block billing when browser storage is unavailable. */ }
      },
      changed: () => listeners.forEach(listener => listener()),
    });
  }
  return tracker;
}
export const subscribeToBillingFeedback = (listener: () => void) => {
  listeners.add(listener); return () => { listeners.delete(listener); };
};
export const getBillingProgress = () => billingNotifications().getProgress();
export const getServerBillingProgress = () => null;

/** Only explicit validation/authorization rejections prove no mutation ran. */
export function billingRequestRejected(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  return ['functions/invalid-argument', 'functions/unauthenticated', 'functions/permission-denied'].includes(String(code));
}
