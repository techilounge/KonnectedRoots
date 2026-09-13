// Shared by request dispatch and intent acceptance. Distinct marks also order
// reads started in the same millisecond; no billing state is inferred here.
let lastMark = 0;
export function markBillingReadBoundary() {
  lastMark = Math.max(Date.now(), lastMark + 1);
  return lastMark;
}
