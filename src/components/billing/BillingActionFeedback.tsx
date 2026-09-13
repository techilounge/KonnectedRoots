'use client';

import { useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Clock3, Loader2 } from 'lucide-react';
import { getBillingProgress, getServerBillingProgress, subscribeToBillingFeedback } from '@/lib/billing/notifications';

export function useBillingProgress() {
  return useSyncExternalStore(subscribeToBillingFeedback, getBillingProgress, getServerBillingProgress);
}
export default function BillingActionFeedback({ refresh }: { refresh: () => void }) {
  const { user } = useAuth();
  const progress = useBillingProgress();
  if (!progress || progress.uid !== user?.uid) return null;
  const delayed = progress.phase === 'delayed';
  return <div role="status" aria-live="polite" className="my-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-4 text-left text-sm text-foreground">
    {delayed ? <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" /> : <Loader2 className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    <div className="min-w-0 flex-1">
      <p className="font-medium">{delayed ? 'Still confirming your billing update' : progress.phase === 'processing' ? 'Processing your billing update…' : 'Confirming…'}</p>
      {delayed && <p className="text-muted-foreground">Your update may still be processing. Refresh your status before trying another billing change.</p>}
    </div>
    {delayed && <Button variant="outline" size="sm" onClick={refresh}>Refresh status</Button>}
  </div>;
}
