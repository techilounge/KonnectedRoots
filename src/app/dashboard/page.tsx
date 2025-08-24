
"use client";
import { useState, useEffect, useCallback } from 'react';
import TreeList from '@/components/dashboard/TreeList';
import CreateTreeDialog from '@/components/dashboard/CreateTreeDialog';
import EditTreeDialog from '@/components/dashboard/EditTreeDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'; 
import { Button } from '@/components/ui/button';
import type { FamilyTree } from '@/types';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast'; 
import { db } from '@/lib/firebase/clients';
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';


export default function DashboardPage() {
  const { user, userProfile } = useAuth(); // Also get userProfile
  const { toast } = useToast();
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTree, setEditingTree] = useState<FamilyTree | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Firestore collection reference for trees
  const treesColRef = collection(db, 'trees');

  const fetchTrees = useCallback(async () => {
    // Guard against running before user and profile are fully loaded
    if (!user?.uid || !userProfile) return;

    setIsLoadingTrees(true);
    try {
      const q = query(treesColRef, where("ownerId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const trees: FamilyTree[] = [];
      querySnapshot.forEach((doc) => {
        trees.push({ id: doc.id, ...doc.data() } as FamilyTree);
      });
      setFamilyTrees(trees);
    } catch (error) {
      console.error("Error fetching trees:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your family trees." });
    } finally {
      setIsLoadingTrees(false);
    }
  }, [user, userProfile, toast]); // Depend on both user and userProfile

  useEffect(() => {
    // This effect now correctly waits for both user and userProfile
    fetchTrees();
  }, [fetchTrees]);

  const handleCreateTree = async (name: string) => {
    if (!user?.uid) return;

    try {
      const newTreeDoc = {
        ownerId: user.uid,
        title: name,
        visibility: "private",
        collaborators: {},
        memberCount: 0,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };
      await addDoc(treesColRef, newTreeDoc);
      toast({ title: "Tree Created!", description: `"${name}" has been successfully created.` });
      await fetchTrees(); // Refetch to get the new tree
    } catch (error) {
      console.error("Error creating tree:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create new tree." });
    }
  };
  
  const handleOpenEditDialog = (tree: FamilyTree) => {
    setEditingTree(tree);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditingTree(null);
    setIsEditDialogOpen(false);
  };

  const handleSaveTreeEdit = async (newName: string) => {
    if (!editingTree) return;
    try {
      const treeDocRef = doc(db, 'trees', editingTree.id);
      const updatedData = { title: newName, lastUpdated: serverTimestamp() };
      await updateDoc(treeDocRef, updatedData);
      toast({ title: "Tree Updated!", description: `Tree renamed to "${newName}".` });
      await fetchTrees(); // Refetch to update list
    } catch (error) {
       console.error("Error updating tree:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to update tree name." });
    } finally {
      handleCloseEditDialog();
    }
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
    
    const treeToDelete = familyTrees.find(t => t.id === deletingTreeId);
    
    try {
      // The onTreeDelete Cloud Function will handle deleting the subcollections (people, invites).
      // We only need to delete the main tree document from the client.
      const treeDocRef = doc(db, 'trees', deletingTreeId);
      await deleteDoc(treeDocRef);
      
      toast({ variant: "destructive", title: "Tree Deleted!", description: `"${treeToDelete?.title}" and all its members have been deleted.` });
      await fetchTrees(); // Refetch to update the list
    } catch (error) {
       console.error("Error deleting tree:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to delete the tree." });
    } finally {
      setIsDeleting(false);
      handleCloseDeleteDialog();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-bold text-foreground">
          Welcome, <span className="text-primary">{user.displayName || 'User'}</span>!
        </h1>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Tree
        </Button>
      </div>
      
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-headline text-foreground mb-4">Your Family Trees</h2>
        {isLoadingTrees ? (
           <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
        ) : familyTrees.length > 0 ? (
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
              family tree and all its associated data from the database.
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
