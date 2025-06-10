
"use client";
import { useState } from 'react';
import TreeList from '@/components/dashboard/TreeList';
import CreateTreeDialog from '@/components/dashboard/CreateTreeDialog';
import { Button } from '@/components/ui/button';
import type { FamilyTree } from '@/types';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([
    // Mock data
    { id: '1', name: 'Johnson Family History', memberCount: 15, lastUpdated: new Date('2023-10-15').toISOString() },
    { id: '2', name: 'My Maternal Lineage', memberCount: 28, lastUpdated: new Date('2023-11-01').toISOString() },
  ]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateTree = (name: string) => {
    const newTree: FamilyTree = {
      id: String(Date.now()),
      name,
      memberCount: 1, // Starts with the creator
      lastUpdated: new Date().toISOString(),
    };
    setFamilyTrees(prevTrees => [...prevTrees, newTree]);
  };

  if (!user) {
    return null; // Layout handles redirect
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-bold text-foreground">
          Welcome, <span className="text-primary">{user.name}</span>!
        </h1>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Tree
        </Button>
      </div>
      
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-headline text-foreground mb-4">Your Family Trees</h2>
        {familyTrees.length > 0 ? (
          <TreeList trees={familyTrees} />
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">You haven&apos;t created any family trees yet.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline">
              Start Your First Tree
            </Button>
          </div>
        )}
      </div>

      <CreateTreeDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateTree={handleCreateTree}
      />
    </div>
  );
}
