import type { Invitation } from '@/types/invitations';
import { authContinuation } from './redirect';

export function invitationState(invitation: Invitation, user: {email: string | null} | null) {
  const redirect = `/invite/${encodeURIComponent(invitation.id)}`;
  const existingAccount = Boolean(invitation.inviteeUid);
  return {
    redirect,
    authHref: authContinuation(existingAccount ? '/login' : '/signup', redirect),
    kind: !user ? (existingAccount ? 'login' : 'signup') :
      user.email?.trim().toLowerCase() === invitation.inviteeEmail.trim().toLowerCase() ? 'accept' : 'mismatch',
  } as const;
}
