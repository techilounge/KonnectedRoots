export interface SubscriptionPeriodDisplay {
  isCancellationScheduled: boolean;
  label: 'Expires On' | 'Next Renewal';
  timestamp: number | null;
}

/** Keeps renewal and scheduled-cancellation labels tied to the same server-owned timestamp. */
export function resolveSubscriptionPeriodDisplay(
  currentPeriodEnd: number | null,
  cancelAtPeriodEnd: boolean,
  scheduledCancellationAt: number | null,
): SubscriptionPeriodDisplay {
  const cancellationAt = scheduledCancellationAt || (cancelAtPeriodEnd ? currentPeriodEnd : null);
  if (cancellationAt) {
    return {
      isCancellationScheduled: true,
      label: 'Expires On',
      timestamp: cancellationAt,
    };
  }
  return {
    isCancellationScheduled: false,
    label: 'Next Renewal',
    timestamp: currentPeriodEnd,
  };
}
