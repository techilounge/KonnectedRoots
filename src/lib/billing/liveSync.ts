export type BillingSignalTarget = {
  collection: 'users' | 'families';
  id: string;
};

export type BillingSignalSubscriber = (
  target: BillingSignalTarget,
  onChange: () => void,
) => () => void;

/**
 * Subscribe only to document-change signals. Callers must re-resolve billing
 * through the authoritative server action instead of consuming snapshot data.
 */
export function subscribeToBillingSignals(
  subscribe: BillingSignalSubscriber,
  uid: string,
  familyId: string | null,
  onChange: () => void,
): () => void {
  const unsubscribe = [subscribe({ collection: 'users', id: uid }, onChange)];
  if (familyId) unsubscribe.push(subscribe({ collection: 'families', id: familyId }, onChange));

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const stop of unsubscribe) stop();
  };
}
