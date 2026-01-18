
"use client";
import { useState, useEffect } from 'react';
import TreeList from '@/components/dashboard/TreeList';
import CreateTreeDialog from '@/components/dashboard/CreateTreeDialog';
import EditTreeDialog from '@/components/dashboard/EditTreeDialog';
import ImportGedcomDialog from '@/components/dashboard/ImportGedcomDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { FamilyTree, Person } from '@/types';
import { PlusCircle, Loader2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase/clients';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import { generateUniqueSlug } from '@/lib/slug';


export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTree, setEditingTree] = useState<FamilyTree | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const treesColRef = collection(db, 'trees');


  useEffect(() => {
    if (!user) {
      setIsLoadingTrees(false);
      setFamilyTrees([]);
      return;
    }

    setIsLoadingTrees(true);

    const q = query(treesColRef, where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const treesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FamilyTree));
      setFamilyTrees(treesData);
      setIsLoadingTrees(false);
    }, (error) => {
      console.error("Error fetching trees with real-time listener:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load your family trees." });
      setIsLoadingTrees(false);
    });

    return () => unsubscribe();

  }, [user, toast]);

  const handleCreateTree = async (name: string) => {
    if (!user?.uid) return;

    try {
      // Generate SEO-friendly slug from tree name (pass ownerId for security rule compliance)
      const slug = await generateUniqueSlug(name, user.uid);

      const newTreeDoc = {
        ownerId: user.uid,
        title: name,
        slug,
        visibility: "private",
        collaborators: {},
        memberCount: 0,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };
      await addDoc(treesColRef, newTreeDoc);
      toast({ title: "Tree Created!", description: `"${name}" has been successfully created.` });

    } catch (error) {
      console.error("Error creating tree:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create new tree." });
    }
  };

  const handleImportGedcom = async (treeName: string, people: Omit<Person, 'createdAt' | 'updatedAt'>[]) => {
    if (!user?.uid) return;

    console.log('[GEDCOM Import] Received people array:', people.length, 'people');
    console.log('[GEDCOM Import] First few people IDs:', people.slice(0, 5).map(p => p.id));

    try {
      // Generate SEO-friendly slug from tree name (pass ownerId for security rule compliance)
      const slug = await generateUniqueSlug(treeName, user.uid);

      // Create the tree first
      const newTreeDoc = {
        ownerId: user.uid,
        title: treeName,
        slug,
        visibility: "private",
        collaborators: {},
        memberCount: people.length,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };
      const treeRef = await addDoc(treesColRef, newTreeDoc);
      const treeId = treeRef.id;

      console.log('[GEDCOM Import] Tree created with ID:', treeId);

      // First pass: create mapping from imported IDs to new Firestore doc IDs
      const peopleColRef = collection(db, 'trees', treeId, 'people');
      const idMapping = new Map<string, string>(); // oldId -> newFirestoreId

      for (const person of people) {
        const personRef = doc(peopleColRef);
        idMapping.set(person.id, personRef.id);
        console.log('[GEDCOM Import] ID mapping:', person.id, '->', personRef.id);
      }

      // Helper to remap an ID (or return original if not found)
      const remapId = (oldId: string | undefined): string | undefined => {
        if (!oldId) return undefined;
        return idMapping.get(oldId) || oldId;
      };

      // Second pass: remap relationship IDs and write to Firestore
      const batch = writeBatch(db);
      let batchCount = 0;

      for (const person of people) {
        const newId = idMapping.get(person.id)!;
        const personRef = doc(peopleColRef, newId);

        // Remap all relationship references
        const remappedPerson = {
          ...person,
          id: newId,
          ownerId: user.uid,
          treeId: treeId,
          parentId1: remapId(person.parentId1),
          parentId2: remapId(person.parentId2),
          spouseIds: (person.spouseIds || []).map(id => remapId(id)).filter(Boolean) as string[],
          childrenIds: (person.childrenIds || []).map(id => remapId(id)).filter(Boolean) as string[],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Remove undefined values (Firestore doesn't accept them)
        const cleanPerson: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(remappedPerson)) {
          if (value !== undefined) {
            cleanPerson[key] = value;
          }
        }

        console.log('[GEDCOM Import] Adding person:', person.firstName, person.lastName,
          'parentId1:', cleanPerson.parentId1, 'spouseIds:', cleanPerson.spouseIds);
        batch.set(personRef, cleanPerson);
        batchCount++;
      }

      console.log('[GEDCOM Import] Committing batch with', batchCount, 'operations');
      await batch.commit();
      console.log('[GEDCOM Import] Batch committed successfully');

      toast({
        title: "Import Successful!",
        description: `Imported ${people.length} people into "${treeName}".`
      });
    } catch (error) {
      console.error("Error importing GEDCOM:", error);
      toast({ variant: "destructive", title: "Import Failed", description: "Failed to import GEDCOM file." });
      throw error; // Re-throw so dialog can show error
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
      const batch = writeBatch(db);

      // First, delete all people in the tree's subcollection
      const peopleRef = collection(db, 'trees', deletingTreeId, 'people');
      const peopleSnapshot = await getDocs(peopleRef);

      console.log(`[Clean Delete] Deleting ${peopleSnapshot.docs.length} people from tree "${treeToDelete?.title}"`);

      peopleSnapshot.docs.forEach(personDoc => {
        batch.delete(personDoc.ref);
      });

      // Then delete the tree document itself
      const treeDocRef = doc(db, 'trees', deletingTreeId);
      batch.delete(treeDocRef);

      // Commit all deletions in a single batch
      await batch.commit();

      toast({
        variant: "destructive",
        title: "Tree Deleted!",
        description: `"${treeToDelete?.title}" and all ${peopleSnapshot.docs.length} members have been permanently deleted.`
      });
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
        <div className="flex space-x-2">
          <Button onClick={() => setIsImportDialogOpen(true)} variant="outline">
            <Upload className="mr-2 h-5 w-5" /> Import GEDCOM
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

      <ImportGedcomDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImportGedcom}
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
