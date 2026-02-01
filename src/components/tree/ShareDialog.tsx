"use client";
import { useState, useEffect } from 'react';
import type { FamilyTree } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Users, Check, Loader2, X, Clock, UserPlus, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/clients';
import { collection, addDoc, query, where, getDocs, getDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface Invitation {
  id: string;
  treeId: string;
  treeName: string;
  inviterUid: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeUid?: string | null;
  role: 'viewer' | 'editor' | 'manager';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree;
}

type CollaboratorRole = 'viewer' | 'editor' | 'manager';

export default function ShareDialog({ isOpen, onClose, tree }: ShareDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('viewer');

  const treeUrl = typeof window !== 'undefined' ? `${window.location.origin}/tree/${tree.id}` : '';

  // Fetch collaborators and pending invitations
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !tree || !isOpen) return;

      // Build collaborators list with owner
      const collabList: any[] = [];

      if (tree.ownerId === user.uid) {
        collabList.push({
          uid: user.uid,
          displayName: user.displayName || 'Owner',
          email: user.email,
          photoURL: user.photoURL,
          role: 'Owner'
        });
      }

      // Add other collaborators from tree.collaborators map
      if (tree.collaborators) {
        for (const [uid, role] of Object.entries(tree.collaborators)) {
          if (uid !== user.uid) {
            // Fetch actual user profile from Firestore
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                collabList.push({
                  uid,
                  displayName: userData.displayName || userData.email || 'Collaborator',
                  email: userData.email || 'Unknown',
                  photoURL: userData.photoURL || '',
                  role: (role as string).charAt(0).toUpperCase() + (role as string).slice(1)
                });
              } else {
                // User doc doesn't exist, use placeholder
                collabList.push({
                  uid,
                  displayName: 'Unknown User',
                  email: 'User not found',
                  photoURL: '',
                  role: (role as string).charAt(0).toUpperCase() + (role as string).slice(1)
                });
              }
            } catch (err) {
              console.error('Error fetching collaborator:', err);
              collabList.push({
                uid,
                displayName: 'Collaborator',
                email: 'Error loading',
                photoURL: '',
                role: (role as string).charAt(0).toUpperCase() + (role as string).slice(1)
              });
            }
          }
        }
      }
      setCollaborators(collabList);

      // Fetch pending invitations for this tree (created by this user)
      try {
        const invitationsRef = collection(db, 'invitations');
        // Query must include inviterUid to satisfy security rules
        const q = query(
          invitationsRef,
          where('inviterUid', '==', user.uid),
          where('treeId', '==', tree.id),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        const invites = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Invitation[];
        setPendingInvitations(invites);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        // Silently fail - don't block the dialog
        setPendingInvitations([]);
      }
    };

    fetchData();
  }, [tree, user, isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(treeUrl).then(() => {
      setIsCopied(true);
      toast({ title: 'Link Copied!', description: 'You can now share the link to your tree.' });
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not copy the link.' });
    });
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteEmail.trim()) return;

    // Check if already invited
    const alreadyInvited = pendingInvitations.some(
      inv => inv.inviteeEmail.toLowerCase() === inviteEmail.toLowerCase()
    );
    if (alreadyInvited) {
      toast({ variant: 'destructive', title: 'Already Invited', description: 'This email already has a pending invitation.' });
      return;
    }

    // Check if already a collaborator
    const alreadyCollaborator = collaborators.some(
      c => c.email?.toLowerCase() === inviteEmail.toLowerCase()
    );
    if (alreadyCollaborator) {
      toast({ variant: 'destructive', title: 'Already a Collaborator', description: 'This person already has access to the tree.' });
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists in the system
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('email', '==', inviteEmail.toLowerCase()));
      const userSnapshot = await getDocs(userQuery);

      const inviteeUid = userSnapshot.empty ? null : userSnapshot.docs[0].id;

      // Create invitation
      const invitation: Omit<Invitation, 'id'> = {
        treeId: tree.id,
        treeName: tree.title,
        inviterUid: user.uid,
        inviterName: user.displayName || 'Someone',
        inviteeEmail: inviteEmail.toLowerCase(),
        inviteeUid,
        role: inviteRole,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'invitations'), invitation);

      // Add to local state
      setPendingInvitations(prev => [...prev, { ...invitation, id: docRef.id }]);

      // If user exists, create in-app notification
      if (inviteeUid) {
        await addDoc(collection(db, 'notifications'), {
          userId: inviteeUid,
          type: 'tree_invite',
          title: 'Tree Invitation',
          message: `${user.displayName || 'Someone'} invited you to collaborate on "${tree.title}" as ${inviteRole}`,
          data: { treeId: tree.id, invitationId: docRef.id },
          read: false,
          createdAt: serverTimestamp()
        });
      }

      toast({
        title: 'Invitation Sent!',
        description: inviteeUid
          ? `${inviteEmail} will be notified.`
          : `An invitation email will be sent to ${inviteEmail}.`
      });

      setInviteEmail('');
      setInviteRole('viewer');
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send invitation.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await updateDoc(doc(db, 'invitations', invitationId), {
        resendTrigger: serverTimestamp()
      });
      toast({ title: 'Invitation Resent', description: 'A new email has been sent.' });
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to resend invitation.' });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', invitationId));
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      toast({ title: 'Invitation Cancelled', description: 'The invitation has been removed.' });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel invitation.' });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner': return 'default';
      case 'manager': return 'secondary';
      case 'editor': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <Share2 className="mr-2 h-6 w-6 text-primary" />
            Share &quot;{tree.title}&quot;
          </DialogTitle>
          <DialogDescription>
            Invite others to view or collaborate on your family tree.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {/* Shareable Link */}
          <div className="space-y-2">
            <Label htmlFor="tree-link">Shareable Link</Label>
            <div className="flex space-x-2">
              <Input id="tree-link" value={treeUrl} readOnly />
              <Button onClick={handleCopyLink} variant="outline" size="icon" className="flex-shrink-0">
                {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
          </div>

          {/* Invite Form */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center">
              <UserPlus className="mr-2 h-5 w-5 text-primary" />
              Invite Collaborator
            </h3>
            <form onSubmit={handleAddCollaborator} className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email..."
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CollaboratorRole)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite
              </Button>
            </form>
          </div>

          {/* People with Access */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center">
              <Users className="mr-2 h-5 w-5 text-primary" />
              People with Access
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {collaborators.map(c => (
                <div key={c.uid} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={c.photoURL} alt={c.displayName} />
                      <AvatarFallback>{c.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{c.displayName}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                  <Badge variant={getRoleBadgeVariant(c.role)}>{c.role}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center text-muted-foreground">
                <Clock className="mr-2 h-5 w-5" />
                Pending Invitations
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-muted/50 rounded-md p-2">
                    <div>
                      <p className="text-sm">{inv.inviteeEmail}</p>
                      <p className="text-xs text-muted-foreground capitalize">{inv.role}</p>
                    </div>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResendInvitation(inv.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Resend Invitation"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelInvitation(inv.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

