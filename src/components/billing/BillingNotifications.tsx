'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { billingNotifications } from '@/lib/billing/notifications';
import type { BillingNoticeView } from '@/lib/billing/notificationTracker';
import { useBillingProgress } from './BillingActionFeedback';

/** One observer across routes. Firestore signals only request fresh server reads. */
export default function BillingNotifications() {
  const { user, loading: authLoading } = useAuth();
  const view = useEntitlements();
  const progress = useBillingProgress();
  const pathname = usePathname();
  const { refresh } = view;
  useEffect(() => {
    // A cancel return merely ends the local checkout feedback. It never proves
    // payment success or changes the authoritative subscription.
    if (!authLoading && user && pathname === '/pricing' && new URLSearchParams(window.location.search).get('checkout') === 'canceled') {
      billingNotifications().abandonCheckout();
    }
  }, [pathname, authLoading, user]);
  useEffect(() => {
    if (!authLoading && !user) billingNotifications().reset();
    if (!user || view.billingViewUid !== user.uid || view.loading || view.error || !view.entitlements) return;
    const snapshot: BillingNoticeView = {
      plan: view.plan, canonicalStatus: view.canonicalStatus,
      effectivePaidEntitlement: view.effectivePaidEntitlement, paymentAttentionRequired: view.paymentAttentionRequired,
      aiPackEntitlementValid: view.aiPackEntitlementValid, aiPackItemExists: view.aiPackItemExists,
      aiPackCancelAtPeriodEnd: view.aiPackCancelAtPeriodEnd, aiPackPaidThrough: view.aiPackPaidThrough,
      aiPackRemovalPending: view.aiPackRemovalPending, aiPackResumePending: view.aiPackResumePending,
      planChangeStatus: view.planChangeStatus, scheduledDowngrade: view.scheduledDowngrade,
      billingScheduleCleanupRequired: view.billingScheduleCleanupRequired,
      billingScheduleReleaseConfirmed: view.billingScheduleReleaseConfirmed,
    };
    billingNotifications().observe(user.uid, snapshot, view.billingReadStartedAt);
  }, [authLoading, user, view]);
  useEffect(() => {
    if (!progress || progress.uid !== user?.uid) return;
    const timer = window.setTimeout(() => billingNotifications().delay(), Math.max(0, 45_000 - (Date.now() - progress.startedAt)));
    // Request acceptance is not confirmation. Start a NEW authoritative read,
    // then follow the existing live signals, with bounded polling as a fallback.
    if (progress.acceptedAt !== null) refresh();
    const poll = progress.acceptedAt !== null && progress.phase !== 'delayed' ? window.setInterval(refresh, 5_000) : null;
    return () => { window.clearTimeout(timer); if (poll !== null) window.clearInterval(poll); };
  }, [progress, user?.uid, refresh]);
  return null;
}
