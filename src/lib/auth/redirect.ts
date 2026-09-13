/** A navigation hint, never an authorization decision. */
export function sanitizeAuthRedirect(value?: string | null): string {
  if (!value || value.length > 2048) return '/dashboard';
  let decoded = value;
  for (let i = 0; i < 5; i++) {
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return '/dashboard';
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        const url = new URL(decoded, 'https://local.invalid');
        if (url.origin !== 'https://local.invalid' || url.pathname.startsWith('//')) return '/dashboard';
        return value;
      }
      decoded = next;
    } catch { return '/dashboard'; }
  }
  return '/dashboard';
}

export function authContinuation(route: '/login' | '/signup', redirect?: string | null): string {
  return `${route}?${new URLSearchParams({redirect: sanitizeAuthRedirect(redirect)})}`;
}
