
"use client";
import { useState } from 'react';
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
import { TreeDeciduous, Loader2 } from 'lucide-react';

interface CreateTreeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTree: (name: string) => void;
}

export default function CreateTreeDialog({ isOpen, onClose, onCreateTree }: CreateTreeDialogProps) {
  const [treeName, setTreeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    onCreateTree(treeName);
    setIsLoading(false);
    setTreeName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center">
            <TreeDeciduous className="mr-2 h-6 w-6 text-primary" />
            Create a New Family Tree
          </DialogTitle>
          <DialogDescription>
            Give your new family tree a name to get started. You can always change it later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="treeName" className="text-right">
                Tree Name
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
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isLoading || !treeName.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Tree
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
