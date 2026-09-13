/** Session feedback only. Inputs must be fresh server-resolved billing views. */
import type { Plan, ScheduledPlanChange } from './types';

export type BillingAction = 'pro_checkout' | 'family_checkout' | 'family_upgrade' | 'add_ai_pack' |
  'stop_ai_pack' | 'resume_ai_pack' | 'schedule_downgrade' | 'keep_family';
export interface BillingNoticeView {
  plan: Plan;
  canonicalStatus: string;
  effectivePaidEntitlement: boolean;
  paymentAttentionRequired: boolean;
  aiPackEntitlementValid: boolean;
  aiPackItemExists: boolean;
  aiPackCancelAtPeriodEnd: boolean;
  aiPackPaidThrough: number | null;
  aiPackRemovalPending: boolean;
  aiPackResumePending: boolean;
  planChangeStatus: string;
  scheduledDowngrade: ScheduledPlanChange | null;
  billingScheduleCleanupRequired: boolean;
  billingScheduleReleaseConfirmed: boolean;
}
export interface BillingNotice { variant: 'success' | 'destructive'; title: string; description: string }
export interface BillingProgress {
  id: string;
  uid: string;
  action: BillingAction;
  phase: 'processing' | 'confirming' | 'delayed';
  startedAt: number;
  acceptedAt: number | null;
  remaining: BillingAction[];
}
interface SessionState {
  uid: string | null;
  last: BillingNoticeView | null;
  pending: BillingProgress | null;
  deferredPro: boolean;
  savedAt: number;
}
const date = (value: number) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const paid = (view: BillingNoticeView) => view.effectivePaidEntitlement && !view.paymentAttentionRequired &&
  ['active', 'trialing'].includes(view.canonicalStatus);
const proNotice = { title: 'Welcome to Pro', description: 'Your Pro plan is now active.' };
const familyNotice = { title: 'Family plan activated', description: 'Your Family plan is now active.' };
const changedNotice = { title: 'Your plan changed to Pro', description: 'Your Pro plan is now active.' };
const recoveryNotice = { title: 'Payment received', description: 'Your paid plan and features have been restored.' };
export const unconfirmedBillingNotice: BillingNotice = {
  variant: 'destructive', title: 'Billing update could not be confirmed', description: 'Refresh your billing status or try again.',
};
export const unavailableBillingNotice: BillingNotice = {
  variant: 'destructive', title: 'Action unavailable', description: 'Resolve the outstanding payment before changing your plan.',
};

export function createBillingNotificationTracker(options: {
  emit: (notice: BillingNotice) => void;
  now?: () => number;
  mark?: () => number;
  restored?: SessionState | null;
  save?: (state: SessionState | null) => void;
  changed?: () => void;
}) {
  const now = options.now || Date.now;
  const mark = options.mark || now;
  const fresh = () => ({ uid: null, last: null, pending: null, deferredPro: false, savedAt: now() } as SessionState);
  let state = options.restored && now() - options.restored.savedAt < 2 * 60 * 60 * 1000 ? options.restored : fresh();
  let sequence = 0;
  const publish = () => { state.savedAt = now(); options.save?.(state); options.changed?.(); };
  const success = (notice: { title: string; description: string }) => options.emit({ ...notice, variant: 'success' });
  const reset = () => { state = fresh(); options.save?.(null); options.changed?.(); };
  const scope = (uid: string) => { if (state.uid !== uid) { state = { ...fresh(), uid }; publish(); } };
  const confirmed = (action: BillingAction, view: BillingNoticeView) => {
    if (!paid(view)) return null;
    switch (action) {
      case 'pro_checkout': return view.plan === 'pro' ? proNotice : null;
      case 'family_checkout': case 'family_upgrade': return view.plan === 'family' && view.planChangeStatus === 'none' ? familyNotice : null;
      case 'add_ai_pack': return view.aiPackEntitlementValid && !view.aiPackResumePending ? {
        title: 'AI Pack activated', description: '1,000 additional AI actions have been added to your plan.',
      } : null;
      case 'stop_ai_pack': return view.aiPackEntitlementValid && view.aiPackCancelAtPeriodEnd &&
        !view.aiPackItemExists && !view.aiPackRemovalPending && view.aiPackPaidThrough ? {
          title: 'AI Pack renewal stopped', description: `You can continue using your AI Pack through ${date(view.aiPackPaidThrough)}.`,
        } : null;
      case 'resume_ai_pack': return view.aiPackEntitlementValid && view.aiPackItemExists &&
        !view.aiPackCancelAtPeriodEnd && !view.aiPackResumePending ? {
          title: 'AI Pack renewal resumed', description: 'Your AI Pack will continue renewing normally.',
        } : null;
      case 'schedule_downgrade': return view.plan === 'family' && view.scheduledDowngrade?.scheduledChangeStatus === 'scheduled' &&
        view.scheduledDowngrade.scheduledPlan === 'pro' && view.scheduledDowngrade.scheduledChangeAt ? {
          title: 'Downgrade scheduled', description: `Your Family plan remains active until ${date(view.scheduledDowngrade.scheduledChangeAt)}. Pro begins on ${date(view.scheduledDowngrade.scheduledChangeAt)}.`,
        } : null;
      case 'keep_family': return view.plan === 'family' && !view.scheduledDowngrade && view.billingScheduleReleaseConfirmed ? {
        title: 'Family plan retained', description: 'Your scheduled downgrade was canceled. Family will continue renewing.',
      } : null;
    }
  };
  return {
    reset,
    getProgress: () => state.pending,
    abandonCheckout() {
      if (state.pending && ['pro_checkout', 'family_checkout'].includes(state.pending.action)) {
        state.pending = null; publish();
      }
    },
    begin(uid: string, action: BillingAction, withAIPack = false): string | null {
      scope(uid);
      if (state.pending) return null;
      if (state.last?.paymentAttentionRequired) { options.emit(unavailableBillingNotice); return null; }
      const id = `${now()}:${++sequence}`;
      state.pending = { id, uid, action, phase: 'processing', startedAt: now(), acceptedAt: null,
        remaining: withAIPack ? [action, 'add_ai_pack'] : [action] };
      publish(); return id;
    },
    accepted(id: string | null) {
      if (!id || state.pending?.id !== id) return;
      state.pending = { ...state.pending, phase: 'confirming', acceptedAt: mark() }; publish();
    },
    failed(id: string | null, definitivelyRejected = false) {
      if (!id || state.pending?.id !== id) return;
      options.emit(unconfirmedBillingNotice);
      // A transport failure can follow a successful Stripe mutation. Keep the
      // intent and permit fresh reconciliation to confirm it, without retrying it.
      state.pending = definitivelyRejected ? null : { ...state.pending, phase: 'delayed', acceptedAt: mark() };
      publish();
    },
    delay() {
      if (state.pending && state.pending.phase !== 'delayed' && now() - state.pending.startedAt >= 45_000) {
        state.pending = { ...state.pending, phase: 'delayed' }; publish();
      }
    },
    observe(uid: string, view: BillingNoticeView, readStartedAt = now()) {
      scope(uid);
      const previous = state.last;
      const pending = state.pending;
      const freshForAction = pending && pending.acceptedAt !== null && readStartedAt >= pending.acceptedAt;
      let planAnnounced = false;
      if (freshForAction) {
        if (pending.remaining.includes('family_upgrade') && view.planChangeStatus === 'failed') {
          options.emit({ variant: 'destructive', title: 'Payment could not be completed', description: 'Your current plan remains unchanged.' });
          state.pending = null;
        } else {
          const remaining = pending.remaining.filter(action => {
            const notice = confirmed(action, view);
            if (!notice) return true;
            success(notice);
            if (['pro_checkout', 'family_checkout', 'family_upgrade'].includes(action)) planAnnounced = true;
            return false;
          });
          if (remaining.length !== pending.remaining.length) state.pending = remaining.length ? { ...pending, remaining } : null;
        }
      }
      // Never interpret an initial load as a purchase or a recovery. Persisting
      // the last view makes redirects, route changes and reloads quiet as well.
      if (previous && !planAnnounced) {
        if (previous.plan === 'family' && view.plan === 'pro' && paid(view)) state.deferredPro = true;
        if (state.deferredPro && view.plan === 'pro' && paid(view) && view.billingScheduleReleaseConfirmed && !view.billingScheduleCleanupRequired) {
          success(changedNotice); state.deferredPro = false;
        } else if (!paid(previous) && previous.paymentAttentionRequired && paid(view)) success(recoveryNotice);
        else if (!state.pending && paid(view) && previous.plan !== view.plan && previous.plan !== 'family') {
          if (view.plan === 'family') success(familyNotice);
          else if (view.plan === 'pro') success(proNotice);
        }
      }
      if (view.plan !== 'pro') state.deferredPro = false;
      state.last = view; publish();
    },
  };
}
