
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
import { TreeDeciduous, Loader2, Save } from 'lucide-react';

interface EditTreeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTreeEdit: (newName: string) => void;
  tree: FamilyTree | null;
}

export default function EditTreeDialog({ isOpen, onClose, onSaveTreeEdit, tree }: EditTreeDialogProps) {
  const [treeName, setTreeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tree && isOpen) {
      setTreeName(tree.name);
      setError(''); // Clear error when dialog opens or tree changes
    }
  }, [tree, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treeName.trim()) {
      setError('Tree name cannot be empty.');
      return;
    }
    setError('');
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    onSaveTreeEdit(treeName);
    setIsLoading(false);
    // Do not reset treeName here, onClose will handle dialog state
    onClose(); 
  };

  if (!tree) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose(); // Ensure onClose is called when dialog is dismissed
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <Edit className="mr-2 h-6 w-6 text-primary" />
            Edit Tree Name
          </DialogTitle>
          <DialogDescription>
            Update the name for &quot;{tree.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="treeName" className="text-right">
                New Name
              </Label>
              <Input
                id="treeName"
                value={treeName}
                onChange={(e) => setTreeName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., The Miller Family Saga"
                disabled={isLoading}
              />
            </div>
            {error && <p className="col-span-4 text-sm text-destructive text-center">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoading || !treeName.trim() || treeName.trim() === tree.name}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
