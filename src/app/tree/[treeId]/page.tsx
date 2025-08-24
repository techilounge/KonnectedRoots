
"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import ShareDialog from '@/components/tree/ShareDialog'; // Import the new dialog
import type { Person, FamilyTree, RelationshipType } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase/clients';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
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
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false); // State for share dialog
  const [zoomLevel, setZoomLevel] = useState(1); // State for zoom
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore collection reference
  const peopleColRef = collection(db, `trees/${treeId}/people`);

  useEffect(() => {
    if (!user || !treeId) return;
    
    const fetchPeople = async () => {
      setIsLoading(true);
      try {
        const treeDocSnap = await getDoc(doc(db, 'trees', treeId));
        if (treeDocSnap.exists()) {
            setTreeData({ id: treeDocSnap.id, ...treeDocSnap.data() } as FamilyTree);
        }

        const querySnapshot = await getDocs(peopleColRef);
        const fetchedPeople: Person[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPeople.push({ id: doc.id, ...doc.data() } as Person);
        });
        setPeople(fetchedPeople);
      } catch (error) {
        console.error("Error fetching people from Firestore:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load family tree data." });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPeople();
  }, [treeId, user, toast]);

  const handleAddPerson = async (newPersonDetails: Partial<Person>) => {
    const newPersonId = String(Date.now()); // Using timestamp is simple but not collision-proof. Consider uuid.
    const personWithDefaults: Person = {
      id: newPersonId,
      firstName: 'New Person',
      gender: 'unknown',
      living: true,
      x: Math.random() * 500 + 50, // Default X required by rules
      y: Math.random() * 300 + 50, // Default Y required by rules
      ...newPersonDetails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const personDocRef = doc(peopleColRef, newPersonId);
      await setDoc(personDocRef, personWithDefaults);
      // Manually add to local state to avoid refetch, createdAt will be null until server roundtrip
      setPeople(prev => [...prev, { ...personWithDefaults, createdAt: new Date(), updatedAt: new Date() }]);
      setSelectedPerson(personWithDefaults);
      setIsEditorOpen(true);
      toast({ title: "Person Added", description: "New person saved to the tree." });
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
        const snap = await getDoc(personDocRef);
        
        const dataToSave: Partial<Person> & { updatedAt: any, createdAt?: any } = { 
            ...updatedPerson,
            firstName: updatedPerson.firstName || 'Unnamed', // Ensure firstName is not empty
            x: updatedPerson.x ?? Math.random() * 500 + 50, // Ensure x is set
            y: updatedPerson.y ?? Math.random() * 300 + 50, // Ensure y is set
            updatedAt: serverTimestamp() 
        };

        if (snap.exists()) {
            dataToSave.createdAt = snap.data().createdAt;
        } else {
            dataToSave.createdAt = serverTimestamp();
        }

        await setDoc(personDocRef, dataToSave, { merge: true });
        
        setPeople(prev => prev.map(p => p.id === updatedPerson.id ? { ...p, ...dataToSave, updatedAt: new Date() } : p));
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
    const personIdToDelete = personToDelete.id;
    
    try {
        // Just delete the person doc. The onPersonWrite cloud function will update memberCount.
        await deleteDoc(doc(peopleColRef, personIdToDelete));
        setPeople(prevPeople => prevPeople.filter(p => p.id !== personIdToDelete));
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
     setPeople(prevPeople =>
      prevPeople.map(p =>
        p.id === personId ? { ...p, x: newX, y: newY } : p
      )
    );
    try {
        const personDocRef = doc(peopleColRef, personId);
        await setDoc(personDocRef, { x: newX, y: newY, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error("Error saving node position:", error);
        // This can be noisy, so maybe remove toast for just node moves
        // toast({ variant: "destructive", title: "Sync Error", description: "Failed to save new position." });
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
                throw new Error(`${child.firstName} already has two parents.`);
            }
             batch.update(parentRef, { childrenIds: [...parentChildren, child.id], updatedAt: serverTimestamp() });
        }
        
        await batch.commit();

        // Refetch data to show the new relationships
        const querySnapshot = await getDocs(peopleColRef);
        const fetchedPeople: Person[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPeople.push({ id: doc.id, ...doc.data() } as Person);
        });
        setPeople(fetchedPeople);

        toast({ title: "Relationship Created!", description: "The connection has been saved." });

    } catch (error) {
        console.error("Error creating relationship:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Error", description: `Could not create relationship: ${errorMessage}` });
    }
  };
  
  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      setZoomLevel(prev => Math.min(prev * 1.2, 2)); // Zoom in by 20%, max 200%
    } else {
      setZoomLevel(prev => Math.max(prev / 1.2, 0.5)); // Zoom out by 20%, min 50%
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p>Loading tree data...</p></div>;
  }

  return (
    <div className="flex flex-col h-full bg-secondary">
      <header className="bg-card p-3 shadow-sm flex justify-between items-center border-b">
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
          <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)}><Users className="mr-2 h-4 w-4" /> {people.length} Members</Button>
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
