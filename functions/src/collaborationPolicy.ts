export type CollaboratorRole = 'viewer' | 'editor' | 'manager';

export interface CollaborationPolicy {
  maxCollaborators: number;
  maxEditors: number | null;
  allowedRoles: CollaboratorRole[];
}

function hasActivePaidAccess(billing: any, now: number): boolean {
  const status = billing?.status;
  const periodEnd = Number(billing?.currentPeriodEnd || 0);
  return (status === 'active' || status === 'trialing') && periodEnd > now;
}

export function collaborationPolicy(ownerData: any, now = Date.now()): CollaborationPolicy {
  const billing = ownerData?.billing || {};
  const plan = hasActivePaidAccess(billing, now) && (billing.plan === 'pro' || billing.plan === 'family')
    ? billing.plan
    : 'free';

  if (plan === 'family') return { maxCollaborators: 20, maxEditors: null, allowedRoles: ['viewer', 'editor', 'manager'] };
  if (plan === 'pro') return { maxCollaborators: 10, maxEditors: null, allowedRoles: ['viewer', 'editor', 'manager'] };
  return { maxCollaborators: 2, maxEditors: 1, allowedRoles: ['viewer', 'editor'] };
}

export function canEditRole(role: unknown): boolean {
  return role === 'editor' || role === 'manager';
}

export function validateCollaboratorAdd(
  treeData: any,
  role: CollaboratorRole,
  ownerData: any,
  inviteeUid?: string,
  now = Date.now(),
): { allowed: true } | { allowed: false; reason: string } {
  const policy = collaborationPolicy(ownerData, now);
  if (!policy.allowedRoles.includes(role)) {
    return { allowed: false, reason: `The current plan does not allow the ${role} role.` };
  }

  if (inviteeUid && inviteeUid === treeData?.ownerId) {
    return { allowed: false, reason: 'The tree owner is not counted as a collaborator.' };
  }

  const collaborators = treeData?.collaborators || {};
  const entries = Object.entries(collaborators).filter(([uid]) => uid !== treeData?.ownerId);
  if (inviteeUid && collaborators[inviteeUid]) {
    return { allowed: false, reason: 'This user is already a collaborator.' };
  }
  if (entries.length >= policy.maxCollaborators) {
    return { allowed: false, reason: `This plan allows up to ${policy.maxCollaborators} collaborators per tree.` };
  }
  if (role === 'editor' && policy.maxEditors !== null) {
    const editorCount = entries.filter(([, currentRole]) => currentRole === 'editor').length;
    if (editorCount >= policy.maxEditors) {
      return { allowed: false, reason: `This plan allows up to ${policy.maxEditors} Editor per tree.` };
    }
  }

  return { allowed: true };
}
