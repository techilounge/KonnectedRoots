
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
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Users, Check, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tree: FamilyTree;
}

export default function ShareDialog({ isOpen, onClose, tree }: ShareDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]); // Simplified for now
  const [isLoading, setIsLoading] = useState(false);

  const treeUrl = typeof window !== 'undefined' ? `${window.location.origin}/tree/${tree.id}` : '';

  useEffect(() => {
    // In a real app, you would fetch collaborator profiles here.
    // We'll simulate it for now.
    if (user && tree.ownerId === user.uid) {
        const owner = {
            uid: user.uid,
            displayName: user.displayName || 'Owner',
            email: user.email,
            photoURL: user.photoURL,
            role: 'Owner'
        };
        const otherCollaborators = Object.entries(tree.collaborators || {}).map(([uid, role]) => ({
             uid,
             displayName: 'Collaborator', // Placeholder
             email: 'user@example.com', // Placeholder
             photoURL: '',
             role: role.charAt(0).toUpperCase() + role.slice(1)
        }));
        setCollaborators([owner, ...otherCollaborators]);
    }

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
    // Placeholder for adding a collaborator
    toast({ title: 'Feature Coming Soon', description: 'Adding collaborators by email will be implemented soon.' });
  }

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
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> People with Access</h3>
             <form onSubmit={handleAddCollaborator} className="flex space-x-2">
              <Input type="email" placeholder="Enter email to invite..." required />
              <Button type="submit" disabled={isLoading}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Invite
              </Button>
            </form>
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
                   <div className="text-sm text-muted-foreground">{c.role}</div>
                </div>
              ))}
            </div>
          </div>
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
