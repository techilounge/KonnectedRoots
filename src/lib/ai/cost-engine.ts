import { AIError, type AIRequest, type Budgets, type Model, type Route } from './types';
export function cost(model: Model, inputTokens: number, outputTokens: number, images = 0): number {
  if (model.inputCostPerMillion === null || model.outputCostPerMillion === null || (images && model.imageCost === null)) throw new AIError('pricing_missing');
  if (![inputTokens, outputTokens, images].every(n => Number.isFinite(n) && n >= 0)) throw new AIError('usage_invalid');
  return (inputTokens * model.inputCostPerMillion + outputTokens * model.outputCostPerMillion) / 1000000 + images * (model.imageCost || 0);
}
export function estimate(model: Model, request: AIRequest) {
  const input = Buffer.byteLength(request.prompt, 'utf8') + (request.image ? 16384 : 0) + 256;
  if (input + request.maxOutputTokens > model.contextWindow) throw new AIError('context_limit');
  return cost(model, input, request.maxOutputTokens, request.imageOutput ? 1 : 0);
}
export function budgetState(b: Budgets, spent: number) {
  return spent >= b.monthlyBudget * b.emergencyThreshold ? 'emergency' : spent >= b.monthlyBudget * b.warningThreshold ? 'warning' : 'normal';
}
export function enforceBudget(b: Budgets, route: Route, total: number, featureTotal: number, reserve: number) {
  if (total + reserve > b.hardBudget || (route.monthlyBudget !== null && featureTotal + reserve > route.monthlyBudget)) throw new AIError('budget_exceeded');
  if (budgetState(b, total) === 'emergency' && b.policy === 'disable_nonessential_ai' && !route.essential) throw new AIError('budget_nonessential_disabled');
}
