/** Firestore invitations/{id}; timestamps are SDK-specific at each boundary. */
export interface Invitation {
  id: string;
  treeId: string;
  treeName: string;
  inviterUid: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeUid?: string | null;
  role: 'viewer' | 'editor' | 'manager';
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
}
