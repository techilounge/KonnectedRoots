import type { AIPackStatus } from './types';

export type AIPackPricingState = {
  label: string;
  disabled: boolean;
  showSpinner: boolean;
  showDelayedMessage: boolean;
};

export function resolveAIPackPricingState(
  status: AIPackStatus,
  callableLoading: boolean,
  processingDelayed: boolean,
): AIPackPricingState {
  if (status === 'active') {
    return { label: 'AI Pack Active', disabled: true, showSpinner: false, showDelayedMessage: false };
  }
  if (status === 'pending') {
    return {
      label: processingDelayed ? 'AI Pack Payment Still Processing' : 'AI Pack Payment Processing',
      disabled: true,
      showSpinner: !processingDelayed,
      showDelayedMessage: processingDelayed,
    };
  }
  if (callableLoading) {
    return { label: 'Adding...', disabled: true, showSpinner: true, showDelayedMessage: false };
  }
  return { label: 'Add to Your Plan', disabled: false, showSpinner: false, showDelayedMessage: false };
}
