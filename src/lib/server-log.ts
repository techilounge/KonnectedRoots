import 'server-only';

/** Log only known classifications, never provider messages, payloads or tokens. */
export function logServerFailure(operation: string, error: unknown) {
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const allowedCodes = ['unauthenticated', 'permission-denied', 'not-found', 'unavailable', 'deadline-exceeded', 'resource-exhausted'];
  const code = typeof rawCode === 'string' && allowedCodes.includes(rawCode) ? rawCode : 'internal';
  console.error('[server_failure]', { operation, code });
}
