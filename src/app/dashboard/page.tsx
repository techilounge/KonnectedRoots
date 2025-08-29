
"use client";
import { useState, useEffect } from 'react';
import TreeList from '@/components/dashboard/TreeList';
import CreateTreeDialog from '@/components/dashboard/CreateTreeDialog';
import EditTreeDialog from '@/components/dashboard/EditTreeDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'; 
import { Button } from '@/components/ui/button';
import type { FamilyTree } from '@/types';
import { PlusCircle, Loader2, Wrench } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast'; 
import { db } from '@/lib/firebase/clients';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';


export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTree, setEditingTree] = useState<FamilyTree | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);


  const treesColRef = collection(db, 'trees');

  useEffect(() => {
    if (!user) {
        setIsLoadingTrees(false);
        setFamilyTrees([]);
        return;
    }

    setIsLoadingTrees(true);
    
    // Use onSnapshot for real-time updates
    const q = query(treesColRef, where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const trees: FamilyTree[] = [];
        querySnapshot.forEach((doc) => {
            trees.push({ id: doc.id, ...doc.data() } as FamilyTree);
        });
        setFamilyTrees(trees);
        setIsLoadingTrees(false);
    }, (error) => {
        console.error("Error fetching trees with real-time listener:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load your family trees." });
        setIsLoadingTrees(false);
    });

    // Clean up the listener when the component unmounts or user changes
    return () => unsubscribe();
    
  }, [user, toast]);

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
      
      // No need to manually add to state, onSnapshot will handle it.

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
      // No need to manually update state, onSnapshot will handle it.
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
      const treeDocRef = doc(db, 'trees', deletingTreeId);
      await deleteDoc(treeDocRef);
      
      toast({ variant: "destructive", title: "Tree Deleted!", description: `"${treeToDelete?.title}" and all its members have been deleted.` });
      // No need to manually update state, onSnapshot will handle it.
    } catch (error) {
       console.error("Error deleting tree:", error);
       toast({ variant: "destructive", title: "Error", description: "Failed to delete the tree." });
    } finally {
      setIsDeleting(false);
      handleCloseDeleteDialog();
    }
  };

  const handleFixMemberCounts = async () => {
    if (!user) return;
    setIsFixing(true);
    toast({ title: "Starting Data Fix...", description: "Please wait while we correct member data." });

    try {
        const oldPeopleColRef = collection(db, 'people');
        const q = query(oldPeopleColRef, where("ownerId", "==", user.uid));
        const oldPeopleSnapshot = await getDocs(q);

        if (oldPeopleSnapshot.empty) {
            toast({ title: "No Old Data Found", description: "Your data structure seems to be up to date already." });
            setIsFixing(false);
            return;
        }

        const batch = writeBatch(db);
        let movedCount = 0;

        oldPeopleSnapshot.forEach(oldDoc => {
            const personData = oldDoc.data();
            const treeId = personData.treeId;

            if (treeId && familyTrees.some(t => t.id === treeId)) {
                const newPersonRef = doc(db, 'trees', treeId, 'people', oldDoc.id);
                batch.set(newPersonRef, personData); // Move data to new location
                batch.delete(oldDoc.ref); // Delete from old location
                movedCount++;
            }
        });

        await batch.commit();

        toast({ title: "Data Fix Complete!", description: `Successfully moved ${movedCount} member records. Counts will now update automatically.` });

    } catch (error) {
        console.error("Error during data migration:", error);
        toast({ variant: "destructive", title: "Error", description: "An error occurred while fixing data." });
    } finally {
        setIsFixing(false);
    }
  };


  if (!user) {
    // This state is handled by the DashboardLayout which shows a loader or redirects.
    // Returning null prevents a flash of content before the layout handles it.
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-bold text-foreground">
          Welcome, <span className="text-primary">{user.displayName || 'User'}</span>!
        </h1>
        <div className="flex space-x-2">
            <Button onClick={handleFixMemberCounts} variant="outline" disabled={isFixing}>
              <Wrench className="mr-2 h-5 w-5" />
              {isFixing ? 'Fixing...' : 'Fix Member Counts'}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Tree
            </Button>
        </div>
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
            <p className="text-muted-foreground mb-4">You haven't created any family trees yet.</p>
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
