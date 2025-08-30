
"use client";
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import ShareDialog from '@/components/tree/ShareDialog';
import type { Person, FamilyTree, RelationshipType } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft, Loader2 } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase/clients';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, getDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';


export default function TreeEditorPage() {
  const params = useParams();
  const treeId = params.treeId as string;
  const { toast } = useToast();
  const { user } = useAuth();

  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNameSuggestorOpen, setIsNameSuggestorOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore collection references
  const treeDocRef = doc(db, 'trees', treeId);
  const peopleColRef = collection(db, 'trees', treeId, 'people');

  useEffect(() => {
    if (!user || !treeId) {
        setIsLoading(false);
        return;
    };

    setIsLoading(true);

    // Subscribe to tree document changes
    const treeUnsubscribe = onSnapshot(treeDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setTreeData({ id: docSnap.id, ...docSnap.data() } as FamilyTree);
        } else {
            toast({ variant: "destructive", title: "Error", description: "This tree does not exist or you don't have permission to view it." });
            setIsLoading(false);
        }
    }, (error) => {
        console.error("Error fetching tree details:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load tree details." });
        setIsLoading(false);
    });

    // Subscribe to people subcollection changes
    const peopleUnsubscribe = onSnapshot(peopleColRef, (querySnapshot) => {
        const fetchedPeople: Person[] = [];
        querySnapshot.forEach((doc) => {
            fetchedPeople.push({ id: doc.id, ...doc.data() } as Person);
        });
        setPeople(fetchedPeople);
        setIsLoading(false); // Only set loading to false after both snapshots are ready
    }, (error) => {
        console.error("Error fetching people from Firestore:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load family tree data." });
        setIsLoading(false);
    });

    return () => {
        treeUnsubscribe();
        peopleUnsubscribe();
    };
  }, [treeId, user, toast]);

  const handleAddPerson = async (newPersonDetails: Partial<Person>) => {
    if (!user) return;
    const newPersonId = doc(peopleColRef).id; // Generate a new ID from the collection ref
    const personWithDefaults: Person = {
      id: newPersonId,
      ownerId: user.uid,
      treeId: treeId,
      firstName: 'New Person',
      gender: 'unknown',
      living: true,
      x: Math.random() * 500 + 50,
      y: Math.random() * 300 + 50,
      ...newPersonDetails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const personDocRef = doc(peopleColRef, newPersonId);
      // The real-time listener will handle updating the local state (setPeople)
      await setDoc(personDocRef, personWithDefaults);
      
      setSelectedPerson(personWithDefaults);
      setIsEditorOpen(true);
      toast({ title: "Person Added", description: "New person saved to the tree." });
      // Also update the parent tree's lastUpdated timestamp to trigger UI refreshes elsewhere if needed
      await updateDoc(treeDocRef, { lastUpdated: serverTimestamp() });
    } catch (error) {
        console.error("Error adding person to Firestore:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save new person." });
    }
  };

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setIsEditorOpen(true);
  };

  const handleSavePerson = async (updatedPerson: Person) => {
    try {
        const personDocRef = doc(peopleColRef, updatedPerson.id);
        
        const dataToSave: Partial<Person> & { updatedAt: any } = { 
            ...updatedPerson,
            firstName: updatedPerson.firstName || 'Unnamed',
            x: updatedPerson.x ?? Math.random() * 500 + 50,
            y: updatedPerson.y ?? Math.random() * 300 + 50,
            updatedAt: serverTimestamp() 
        };
        
        // Remove id because we don't save it inside the document itself
        delete dataToSave.id;

        const batch = writeBatch(db);
        batch.set(personDocRef, dataToSave, { merge: true });
        batch.update(treeDocRef, { lastUpdated: serverTimestamp() });
        await batch.commit();
        
        toast({ title: "Person Updated", description: `${updatedPerson.firstName} has been saved.` });
    } catch (error) {
        console.error("Error updating person in Firestore:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
    } finally {
        setIsEditorOpen(false);
        setSelectedPerson(null);
    }
  };

  const handleOpenDeleteDialog = (person: Person) => {
    setPersonToDelete(person);
    setIsDeleteDialogOpen(true);
    if (isEditorOpen && selectedPerson?.id === person.id) {
      setIsEditorOpen(false);
      setSelectedPerson(null);
    }
  };

  const handleCloseDeleteDialog = () => {
    setPersonToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;
    
    try {
        const batch = writeBatch(db);
        batch.delete(doc(peopleColRef, personToDelete.id));
        batch.update(treeDocRef, { lastUpdated: serverTimestamp() });
        await batch.commit();
        toast({ variant: "destructive", title: "Person Deleted", description: `"${personToDelete.firstName}" has been removed.` });
    } catch (error) {
        console.error("Error deleting person:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete person." });
    }

    handleCloseDeleteDialog();
  };

  const handleOpenNameSuggestor = (personDetails?: Partial<Person>) => {
    const genderForSuggestor = personDetails?.gender === 'female' ? 'female' : 'male';
    setPersonForSuggestion({ ...personDetails, gender: genderForSuggestor });
    setIsNameSuggestorOpen(true);
  };

  const handleNodeMove = async (personId: string, newX: number, newY: number) => {
    // Optimistically update local state for smooth UX
     setPeople(prevPeople =>
      prevPeople.map(p =>
        p.id === personId ? { ...p, x: newX, y: newY } : p
      )
    );
    try {
        const personDocRef = doc(peopleColRef, personId);
        // This is a background update, no need to wait for it.
        await updateDoc(personDocRef, { x: newX, y: newY, updatedAt: serverTimestamp() });
    } catch (error) {
        console.error("Error saving node position:", error);
        // Optional: revert local state or show toast on error
    }
  };

  const handleCreateRelationship = async (fromId: string, toId: string, type: RelationshipType) => {
    const fromPerson = people.find(p => p.id === fromId);
    const toPerson = people.find(p => p.id === toId);

    if (!fromPerson || !toPerson) {
        toast({ variant: "destructive", title: "Error", description: "Could not find persons to link." });
        return;
    }
    
    const batch = writeBatch(db);

    try {
        if (type === 'spouse') {
            const fromRef = doc(peopleColRef, fromId);
            const toRef = doc(peopleColRef, toId);
            const fromSpouses = fromPerson.spouseIds || [];
            const toSpouses = toPerson.spouseIds || [];
            
            batch.update(fromRef, { spouseIds: [...fromSpouses, toId], updatedAt: serverTimestamp() });
            batch.update(toRef, { spouseIds: [...toSpouses, fromId], updatedAt: serverTimestamp() });
        } else if (type === 'parent' || type === 'child') {
            const parent = type === 'parent' ? toPerson : fromPerson;
            const child = type === 'parent' ? fromPerson : toPerson;

            const childRef = doc(peopleColRef, child.id);
            const parentRef = doc(peopleColRef, parent.id);

            const parentChildren = parent.childrenIds || [];
            if (!child.parentId1) {
                batch.update(childRef, { parentId1: parent.id, updatedAt: serverTimestamp() });
            } else if (!child.parentId2) {
                batch.update(childRef, { parentId2: parent.id, updatedAt: serverTimestamp() });
            } else {
                toast({
                  variant: "destructive",
                  title: "Cannot Add Parent",
                  description: `${child.firstName} already has two parents assigned.`,
                });
                return; // Stop execution to prevent further updates
            }
             batch.update(parentRef, { childrenIds: [...parentChildren, child.id], updatedAt: serverTimestamp() });
        }
        
        await batch.commit();

        toast({ title: "Relationship Created!", description: "The connection has been saved." });

    } catch (error) {
        console.error("Error creating relationship:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Error", description: `Could not create relationship: ${errorMessage}` });
    }
  };
  
  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      setZoomLevel(prev => Math.min(prev * 1.2, 2));
    } else {
      setZoomLevel(prev => Math.max(prev / 1.2, 0.5));
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full w-full bg-secondary">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Loading tree data...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-secondary">
      <header className="bg-card p-3 shadow-sm flex justify-between items-center border-b z-20 shrink-0">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link href="/dashboard">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-headline text-foreground">{treeData?.title}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleAddPerson({})}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Person
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom('in')}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom('out')}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)}><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" /> {treeData?.memberCount ?? people.length} Members
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AddPersonToolbox onAddPerson={(details) => handleOpenNameSuggestor(details)} />
        <main className="flex-1 relative overflow-auto p-4 bg-background">
          {people.length > 0 ? (
            <FamilyTreeCanvasPlaceholder
              people={people}
              onNodeClick={handleEditPerson}
              onNodeDeleteRequest={handleOpenDeleteDialog}
              onNodeMove={handleNodeMove}
              onCreateRelationship={handleCreateRelationship}
              zoomLevel={zoomLevel}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-4">This family tree is empty.</p>
              <Button onClick={() => handleAddPerson({})} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" /> Add the first person
              </Button>
            </div>
          )}
        </main>
      </div>

      {isEditorOpen && selectedPerson && (
        <NodeEditorDialog
          isOpen={isEditorOpen}
          onClose={() => { setIsEditorOpen(false); setSelectedPerson(null); }}
          person={selectedPerson}
          onSave={handleSavePerson}
          onDeleteRequest={handleOpenDeleteDialog}
          onOpenNameSuggestor={(details) => {
            setIsEditorOpen(false);
            handleOpenNameSuggestor(details);
          }}
        />
      )}

      {isShareDialogOpen && treeData && (
        <ShareDialog
            isOpen={isShareDialogOpen}
            onClose={() => setIsShareDialogOpen(false)}
            tree={treeData}
        />
      )}

      <NameSuggestor
        isOpen={isNameSuggestorOpen}
        onClose={() => setIsNameSuggestorOpen(false)}
        personDetails={personForSuggestion}
        onNameSuggested={(name, reason) => {
          const updatedDetails = {
            ...personForSuggestion,
            firstName: name,
            biography: `${personForSuggestion?.biography || ''}\nAI Name Suggestion: ${name} (Reason: ${reason})`.trim()
          };

          if (personForSuggestion && !personForSuggestion.id) {
            handleAddPerson(updatedDetails);
          }
          else if (personForSuggestion && personForSuggestion.id) {
            const personToUpdate = people.find(p => p.id === personForSuggestion!.id);
            if (personToUpdate) {
              const fullyUpdatedPerson = { ...personToUpdate, ...updatedDetails };
              handleSavePerson(fullyUpdatedPerson);
              setSelectedPerson(fullyUpdatedPerson);
              setIsEditorOpen(true);
            }
          }
          setIsNameSuggestorOpen(false);
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {personToDelete?.firstName} {personToDelete?.lastName || ''} and all associated connections from the tree.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDeleteDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
