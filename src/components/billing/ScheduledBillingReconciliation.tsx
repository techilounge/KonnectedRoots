'use client';

import { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/clients';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { billingError } from '@/lib/billing/notifications';
import { markBillingReadBoundary } from '@/lib/billing/notificationFreshness';

export interface ScheduledBillingReconciliationProps {
  needed: boolean;
  released: boolean;
  loading: boolean;
  viewUid: string | null;
  readStartedAt: number;
  plan: string;
  status: string;
  paid: boolean;
  paymentAttention: boolean;
  disabled?: boolean;
  refresh: () => void;
}

/** Only this explicit click may invoke cleanup. Mount, timers and signals read. */
export default function ScheduledBillingReconciliation(props: ScheduledBillingReconciliationProps) {
  const { user } = useAuth();
  const busy = useRef(false);
  const accepted = useRef<number | null>(null);
  const actionUid = useRef<string | null>(null);
  const deadline = useRef(0);
  const [phase, setPhase] = useState<'processing' | 'confirming' | 'delayed' | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const eligible = Boolean(user && props.viewUid === user.uid && !props.loading && !props.paymentAttention &&
    props.paid && props.plan === 'pro' && props.status === 'active');
  const { refresh } = props;
  const reconcile = async () => {
    if (!eligible || !props.needed || props.disabled || busy.current) return;
    busy.current = true; accepted.current = null; actionUid.current = user!.uid; deadline.current = Date.now() + 45_000;
    setRefreshed(false); setPhase('processing');
    try {
      await httpsCallable(functions, 'reconcileScheduledBilling')({});
      accepted.current = markBillingReadBoundary(); setPhase(Date.now() >= deadline.current ? 'delayed' : 'confirming');
    } catch {
      // A lost response can follow a successful release. Never assert no change
      // or repeat Stripe automatically; a fresh view may still confirm cleanup.
      accepted.current = markBillingReadBoundary(); setPhase('delayed'); billingError();
    } finally { refresh(); }
  };
  useEffect(() => {
    if (!phase || !eligible || actionUid.current !== user?.uid || accepted.current === null || props.readStartedAt <= accepted.current ||
      props.needed || !props.released) return;
    const confirmation = window.setTimeout(() => {
      busy.current = false; accepted.current = null; setPhase(null); setRefreshed(true);
    }, 0);
    return () => window.clearTimeout(confirmation);
  }, [phase, eligible, user?.uid, props.readStartedAt, props.needed, props.released]);
  useEffect(() => {
    if (!phase || phase === 'delayed') return;
    const timeout = window.setTimeout(() => setPhase('delayed'), Math.max(0, deadline.current - Date.now()));
    const poll = phase === 'confirming' ? window.setInterval(refresh, 5_000) : null;
    return () => { window.clearTimeout(timeout); if (poll !== null) window.clearInterval(poll); };
  }, [phase, refresh]);
  if (!user || (!props.needed && !phase && !refreshed)) return null;
  return <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
    <div className="min-w-0 flex-1" role="status" aria-live="polite">
      <p className="font-medium">{refreshed ? 'Billing status refreshed' : phase === 'processing' ? 'Updating billing status…' : phase === 'confirming' ? 'Confirming…' : phase === 'delayed' ? 'Still confirming your billing status' : 'A billing status update is needed'}</p>
      {!refreshed && <p className="text-muted-foreground">{props.paymentAttention ? 'Resolve the outstanding payment before refreshing this update.' : phase === 'delayed' ? 'Refresh your status to check whether the update completed.' : 'Your current plan remains authoritative while the update is confirmed.'}</p>}
    </div>
    {!refreshed && (phase === 'delayed' ? <Button variant="outline" disabled={props.loading} onClick={refresh}>Refresh status</Button> :
      <Button variant="outline" disabled={!eligible || Boolean(phase) || props.disabled} onClick={reconcile}>
        {phase ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
        Refresh billing status
      </Button>)}
  </div>;
}
