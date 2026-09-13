'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/clients';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { ScheduledPlanChange } from '@/lib/billing/types';
import { useAuth } from '@/hooks/useAuth';
import { useBillingProgress } from './BillingActionFeedback';
import { billingNotifications, billingRequestRejected } from '@/lib/billing/notifications';

export interface FamilyDowngradeControlsProps {
  scheduled: ScheduledPlanChange | null;
  periodEnd: number | null;
  interval: 'month' | 'year' | null;
  hasAIPack: boolean;
  disabled: boolean;
  refresh: () => void;
}

export default function FamilyDowngradeControls({ scheduled, periodEnd, interval, hasAIPack, disabled, refresh }: FamilyDowngradeControlsProps) {
  const { user } = useAuth();
  const progress = useBillingProgress();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveAt = scheduled?.scheduledChangeAt || periodEnd;
  const date = effectiveAt ? new Date(effectiveAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const blocked = disabled || pending || Boolean(progress) || !date || !interval;
  const mutate = async () => {
    if (blocked || !user) return;
    const notifications = billingNotifications();
    const operation = notifications.begin(user.uid, scheduled ? 'keep_family' : 'schedule_downgrade');
    if (!operation) return;
    setPending(true); setError(null);
    try {
      const result = await httpsCallable(functions, scheduled ? 'cancelScheduledDowngrade' : 'scheduleDowngradeToPro')(scheduled ? {} : { plan: 'pro' });
      if (!(result.data as { success?: boolean }).success) throw new Error('Change not confirmed');
      notifications.accepted(operation);
    } catch (cause) {
      notifications.failed(operation, billingRequestRejected(cause));
      setError('The change could not be confirmed. Refresh billing status and retry safely, or contact support.');
    } finally {
      refresh(); setPending(false);
    }
  };
  return <div className="space-y-3 w-full">
    {scheduled && <p role="status" className="text-sm"><strong>Scheduled:</strong> Downgrades to Pro on {date}. Your Family plan remains active until then.</p>}
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" className="w-full" disabled={blocked}>
        {pending ? (scheduled ? 'Canceling…' : 'Scheduling…') : scheduled ? 'Keep Family Plan' : 'Downgrade to Pro'}
      </Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{scheduled ? 'Keep your Family plan?' : 'Schedule a downgrade to Pro?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {scheduled ? 'Your Family plan will continue renewing normally. Canceling this scheduled downgrade creates no immediate charge, invoice or refund. Your AI Pack is unchanged.' :
              `Family remains fully active until ${date}. Pro begins on ${date} on the same ${interval === 'year' ? 'yearly' : 'monthly'} billing interval. There is no immediate refund, proration credit or charge. Your Family workspace, membership and genealogy data are preserved. Family member paid-seat access ends when Pro takes effect. ${hasAIPack ? 'Your valid AI Pack access is preserved; any stopped-renewal Pack still ends on its existing paid-through date.' : 'Pending or failed AI Pack purchases do not grant access.'}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Go Back</AlertDialogCancel>
          <AlertDialogAction disabled={blocked} onClick={mutate}>{scheduled ? 'Keep Family Plan' : 'Schedule Downgrade'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {scheduled && <p className="text-xs text-muted-foreground">To change AI Pack renewal before this date, choose Keep Family Plan first.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
