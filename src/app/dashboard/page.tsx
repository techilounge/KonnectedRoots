
"use client";
import { useState } from 'react';
import TreeList from '@/components/dashboard/TreeList';
import CreateTreeDialog from '@/components/dashboard/CreateTreeDialog';
import EditTreeDialog from '@/components/dashboard/EditTreeDialog'; // New Import
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'; // New Import
import { Button } from '@/components/ui/button';
import type { FamilyTree } from '@/types';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast'; // New Import

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([
    { id: '1', name: 'Johnson Family History', memberCount: 15, lastUpdated: new Date('2023-10-15').toISOString() },
    { id: '2', name: 'My Maternal Lineage', memberCount: 28, lastUpdated: new Date('2023-11-01').toISOString() },
  ]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTree, setEditingTree] = useState<FamilyTree | null>(null);

  // State for Delete Confirmation Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const handleCreateTree = (name: string) => {
    const newTree: FamilyTree = {
      id: String(Date.now()),
      name,
      memberCount: 1, 
      lastUpdated: new Date().toISOString(),
    };
    setFamilyTrees(prevTrees => [...prevTrees, newTree]);
    toast({ title: "Tree Created!", description: `"${name}" has been successfully created.` });
  };

  const handleOpenEditDialog = (tree: FamilyTree) => {
    setEditingTree(tree);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditingTree(null);
    setIsEditDialogOpen(false);
  };

  const handleSaveTreeEdit = (newName: string) => {
    if (!editingTree) return;
    setFamilyTrees(prevTrees => 
      prevTrees.map(tree => 
        tree.id === editingTree.id ? { ...tree, name: newName, lastUpdated: new Date().toISOString() } : tree
      )
    );
    toast({ title: "Tree Updated!", description: `"${editingTree.name}" has been renamed to "${newName}".` });
    handleCloseEditDialog();
  };
  
  const handleOpenDeleteDialog = (treeId: string) => {
    setDeletingTreeId(treeId);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeletingTreeId(null);
    setIsDeleteDialogOpen(false);
  };

  const handleConfirmDeleteTree = async () => {
    if (!deletingTreeId) return;
    setIsDeleting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    const treeToDelete = familyTrees.find(t => t.id === deletingTreeId);
    setFamilyTrees(prevTrees => prevTrees.filter(tree => tree.id !== deletingTreeId));
    setIsDeleting(false);
    toast({ variant: "destructive", title: "Tree Deleted!", description: `"${treeToDelete?.name}" has been deleted.` });
    handleCloseDeleteDialog();
  };


  if (!user) {
    return null; 
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
          <TreeList 
            trees={familyTrees} 
            onEditTree={handleOpenEditDialog}
            onDeleteTree={handleOpenDeleteDialog}
          />
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

      {editingTree && (
        <EditTreeDialog
          isOpen={isEditDialogOpen}
          onClose={handleCloseEditDialog}
          onSaveTreeEdit={handleSaveTreeEdit}
          tree={editingTree}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              family tree and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDeleteDialog} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteTree} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
