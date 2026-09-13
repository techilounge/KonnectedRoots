import type { PlanLimits, UserUsage } from './types';

type AIUsageDisplay = {
  allowance: number;
  used: number;
  remaining: number;
  percentUsed: number;
};

export function resolveAIUsageDisplay(
  limits: Pick<PlanLimits, 'aiActionsAllowance'>,
  usage?: Pick<UserUsage, 'aiActionsUsed' | 'aiActionsAllowance'>,
): AIUsageDisplay {
  const allowance = limits.aiActionsAllowance;
  const used = Math.max(0, usage?.aiActionsUsed || 0);
  const remaining = Math.max(0, allowance - used);
  const percentUsed = allowance > 0
    ? Math.min(100, Math.round((used / allowance) * 100))
    : 0;
  return { allowance, used, remaining, percentUsed };
}
