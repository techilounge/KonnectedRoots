
"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import type { Person, FamilyTree, Relationship } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase/clients';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
        const querySnapshot = await getDocs(peopleColRef);
        const fetchedPeople: Person[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPeople.push({ id: doc.id, ...doc.data() } as Person);
        });
        setPeople(fetchedPeople);
        // Initial tree data can be simple, we update member count below
        setTreeData({ id: treeId, name: `Family Tree ${treeId}`, memberCount: fetchedPeople.length, lastUpdated: new Date().toISOString() });
      } catch (error) {
        console.error("Error fetching people from Firestore:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load family tree data." });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPeople();
  }, [treeId, user]); // Refetch if user or treeId changes

  useEffect(() => {
    // Update tree data based on people count
    if (people) {
        setTreeData(prev => ({
            ...prev,
            id: treeId,
            name: prev?.name || `Family Tree ${treeId}`,
            memberCount: people.length,
            lastUpdated: new Date().toISOString()
        }));
    }
  }, [people, treeId]);


  const handleAddPerson = async (newPersonDetails: Partial<Person>) => {
    const newPersonId = String(Date.now());
    const personWithDefaults: Person = {
      id: newPersonId,
      firstName: 'New Person',
      gender: 'male',
      livingStatus: 'unknown',
      privacySetting: 'private',
      spouseIds: [],
      childrenIds: [],
      ...newPersonDetails,
      x: Math.random() * 500 + 50,
      y: Math.random() * 300 + 50,
    };

    try {
      const personDocRef = doc(peopleColRef, newPersonId);
      await setDoc(personDocRef, personWithDefaults);
      setPeople(prev => [...prev, personWithDefaults]);
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
        await setDoc(personDocRef, updatedPerson, { merge: true }); // Use merge to avoid overwriting fields
        setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
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

    const batch = writeBatch(db);

    // 1. Delete the person's document
    const personDocRef = doc(peopleColRef, personIdToDelete);
    batch.delete(personDocRef);

    // 2. Update other people's documents to remove relationships
    const peopleToUpdate = people.filter(p => 
        p.id !== personIdToDelete &&
        (p.parentId1 === personIdToDelete || p.parentId2 === personIdToDelete || p.spouseIds?.includes(personIdToDelete) || p.childrenIds?.includes(personIdToDelete))
    );

    peopleToUpdate.forEach(p => {
        const updatedP = { ...p };
        if (updatedP.parentId1 === personIdToDelete) updatedP.parentId1 = undefined;
        if (updatedP.parentId2 === personIdToDelete) updatedP.parentId2 = undefined;
        if (updatedP.spouseIds) {
            updatedP.spouseIds = updatedP.spouseIds.filter(id => id !== personIdToDelete);
        }
        if (updatedP.childrenIds) {
            updatedP.childrenIds = updatedP.childrenIds.filter(id => id !== personIdToDelete);
        }
        const docRef = doc(peopleColRef, p.id);
        batch.set(docRef, updatedP, { merge: true });
    });
    
    try {
        await batch.commit();
        setPeople(prevPeople => prevPeople.filter(p => p.id !== personIdToDelete).map(p => {
            const newP = { ...p };
             if (newP.parentId1 === personIdToDelete) newP.parentId1 = undefined;
            if (newP.parentId2 === personIdToDelete) newP.parentId2 = undefined;
            if (newP.spouseIds) {
                newP.spouseIds = newP.spouseIds.filter(id => id !== personIdToDelete);
            }
            if (newP.childrenIds) {
                newP.childrenIds = newP.childrenIds.filter(id => id !== personIdToDelete);
            }
            return newP;
        }));
        toast({ variant: "destructive", title: "Person Deleted", description: `"${personToDelete.firstName}" has been removed.` });
    } catch (error) {
        console.error("Error deleting person and updating relationships:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete person." });
    }

    handleCloseDeleteDialog();
  };

  const handleOpenNameSuggestor = (personDetails?: Partial<Person>) => {
    const genderForSuggestor = personDetails?.gender || 'male';
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
        await setDoc(personDocRef, { x: newX, y: newY }, { merge: true });
    } catch (error) {
        console.error("Error saving node position:", error);
        toast({ variant: "destructive", title: "Sync Error", description: "Failed to save new position." });
    }
  };

  const handleSetRelationship = async (fromId: string, toId: string, relationship: Relationship) => {
    const fromPersonOriginal = people.find(p => p.id === fromId);
    const toPersonOriginal = people.find(p => p.id === toId);

    if (!fromPersonOriginal || !toPersonOriginal) return;

    if ((relationship === 'parent' || relationship === 'child') && (fromPersonOriginal.parentId1 && fromPersonOriginal.parentId2)) {
      toast({ variant: "destructive", title: "Cannot Add Parent", description: `${fromPersonOriginal.firstName} already has two parents.` });
      return;
    }
    
    const batch = writeBatch(db);
    const peopleCopy = people.map(p => ({ ...p, spouseIds: [...(p.spouseIds || [])], childrenIds: [...(p.childrenIds || [])] }));
    const fromPerson = peopleCopy.find(p => p.id === fromId)!;
    const toPerson = peopleCopy.find(p => p.id === toId)!;

    switch (relationship) {
      case 'parent':
        if (fromPerson.parentId1 === toId || fromPerson.parentId2 === toId) return;
        if (!fromPerson.parentId1) fromPerson.parentId1 = toId;
        else if (!fromPerson.parentId2) fromPerson.parentId2 = toId;
        if (!toPerson.childrenIds!.includes(fromId)) toPerson.childrenIds!.push(fromId);
        break;
      case 'child':
        if (toPerson.parentId1 === fromId || toPerson.parentId2 === fromId) return;
        if (!toPerson.parentId1) toPerson.parentId1 = fromId;
        else if (!toPerson.parentId2) toPerson.parentId2 = fromId;
        if (!fromPerson.childrenIds!.includes(toId)) fromPerson.childrenIds!.push(toId);
        break;
      case 'spouse':
        if (!fromPerson.spouseIds!.includes(toId)) fromPerson.spouseIds!.push(toId);
        if (!toPerson.spouseIds!.includes(fromId)) toPerson.spouseIds!.push(fromId);
        break;
    }

    try {
        batch.set(doc(peopleColRef, fromPerson.id), fromPerson, { merge: true });
        batch.set(doc(peopleColRef, toPerson.id), toPerson, { merge: true });
        await batch.commit();
        setPeople(peopleCopy);
        toast({ title: "Relationship Updated!", description: `Set ${toPersonOriginal.firstName} as ${fromPersonOriginal.firstName}'s ${relationship}.` });
    } catch (error) {
        console.error("Error setting relationship:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save relationship." });
    }
  };

  const handleSetChildOfCouple = async (childId: string, p1Id: string, p2Id: string) => {
    const childPersonOriginal = people.find(p => p.id === childId);
    if (!childPersonOriginal) return;
    if (childPersonOriginal.parentId1 || childPersonOriginal.parentId2) {
      toast({ variant: "destructive", title: "Cannot Add Parents", description: `${childPersonOriginal.firstName} already has one or more parents.` });
      return;
    }
    
    const batch = writeBatch(db);
    const peopleCopy = people.map(p => ({ ...p, spouseIds: [...(p.spouseIds || [])], childrenIds: [...(p.childrenIds || [])] }));
    const child = peopleCopy.find(p => p.id === childId)!;
    const parent1 = peopleCopy.find(p => p.id === p1Id)!;
    const parent2 = peopleCopy.find(p => p.id === p2Id)!;

    if (!child || !parent1 || !parent2) return;

    child.parentId1 = parent1.id;
    child.parentId2 = parent2.id;
    if (!parent1.childrenIds!.includes(childId)) parent1.childrenIds!.push(childId);
    if (!parent2.childrenIds!.includes(childId)) parent2.childrenIds!.push(childId);

    try {
        batch.set(doc(peopleColRef, child.id), child, { merge: true });
        batch.set(doc(peopleColRef, parent1.id), parent1, { merge: true });
        batch.set(doc(peopleColRef, parent2.id), parent2, { merge: true });
        await batch.commit();
        setPeople(peopleCopy);
        toast({ title: "Relationship Updated!", description: `${child.firstName} is now a child of ${parent1.firstName} and ${parent2.firstName}.` });
    } catch (error) {
        console.error("Error setting child of couple:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save relationship." });
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
          <h1 className="text-xl font-headline text-foreground">{treeData?.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleAddPerson({})}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Person
          </Button>
          <Button variant="outline" size="sm"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" /> {treeData?.memberCount} Members</Button>
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
              onSetRelationship={handleSetRelationship}
              onSetChildOfCouple={handleSetChildOfCouple}
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

    