
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import type { Person, FamilyTree, Relationship } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft, Loader2 } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function TreeEditorPage() {
  const params = useParams();
  const treeId = params.treeId as string;
  const router = useRouter(); // Initialize router
  const { toast } = useToast();

  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNameSuggestorOpen, setIsNameSuggestorOpen] = useState(false);
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);
  
  // State for Delete Confirmation Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);


  // Effect to load people from localStorage on initial mount or treeId change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPeople = localStorage.getItem(`konnectedroots-tree-people-${treeId}`);
      if (savedPeople) {
        try {
          const parsedPeople: Person[] = JSON.parse(savedPeople);
          setPeople(parsedPeople);
        } catch (e) {
          console.error("Failed to parse people from localStorage", e);
          setPeople([]);
        }
      } else {
        setPeople([]); // Ensure it's empty if nothing is saved
      }
    }
  }, [treeId]);

  // Effect to update tree metadata and save people to localStorage whenever 'people' state changes
  useEffect(() => {
    let currentTreeName = `Family Tree ${treeId}`;
    const currentMemberCount = people.length;

    if (typeof window !== 'undefined') {
      // Save the current state of people to localStorage
      localStorage.setItem(`konnectedroots-tree-people-${treeId}`, JSON.stringify(people));

      const storedTreeData = localStorage.getItem(`selectedTree-${treeId}`);
      if (storedTreeData) {
        try {
          const parsedTree: FamilyTree = JSON.parse(storedTreeData);
          currentTreeName = parsedTree.name;
        } catch (e) {
          console.error("Failed to parse tree data from localStorage", e);
        }
      }
    }
    setTreeData({ id: treeId, name: currentTreeName, memberCount: currentMemberCount, lastUpdated: new Date().toISOString() });
  }, [treeId, people]);


  const handleAddPerson = (newPersonDetails: Partial<Person>) => {
    const personWithDefaults: Person = { 
      id: String(Date.now()), 
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
    setPeople(prev => [...prev, personWithDefaults]);
    setSelectedPerson(personWithDefaults); 
    setIsEditorOpen(true);
  };

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setIsEditorOpen(true);
  };

  const handleSavePerson = (updatedPerson: Person) => {
    setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
    setIsEditorOpen(false);
    setSelectedPerson(null);
  };
  
  const handleOpenDeleteDialog = (person: Person) => {
    setPersonToDelete(person);
    setIsDeleteDialogOpen(true);
    // If editor is open for this person, close it
    if(isEditorOpen && selectedPerson?.id === person.id) {
        setIsEditorOpen(false);
        setSelectedPerson(null);
    }
  };

  const handleCloseDeleteDialog = () => {
    setPersonToDelete(null);
    setIsDeleteDialogOpen(false);
  };


  const handleConfirmDelete = () => {
    if (!personToDelete) return;

    const personIdToDelete = personToDelete.id;

    setPeople(prevPeople =>
      prevPeople
        .filter(p => p.id !== personIdToDelete) // Remove the person
        .map(p => {
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
        })
    );

    toast({
      variant: "destructive",
      title: "Person Deleted",
      description: `"${personToDelete.firstName}" has been removed from the tree.`,
    });
    
    handleCloseDeleteDialog();
  };
  
  const handleOpenNameSuggestor = (personDetails?: Partial<Person>) => {
    const genderForSuggestor = personDetails?.gender || 'male';
    setPersonForSuggestion({...personDetails, gender: genderForSuggestor });
    setIsNameSuggestorOpen(true);
  };

  const handleNodeMove = (personId: string, newX: number, newY: number) => {
    setPeople(prevPeople =>
      prevPeople.map(p =>
        p.id === personId ? { ...p, x: newX, y: newY } : p
      )
    );
  };
  
  const handleSetRelationship = (fromId: string, toId: string, relationship: Relationship) => {
    const fromPersonOriginal = people.find(p => p.id === fromId);
    const toPersonOriginal = people.find(p => p.id === toId);
    
    if (!fromPersonOriginal || !toPersonOriginal) return;

    if (relationship === 'parent') {
        if (fromPersonOriginal.parentId1 && fromPersonOriginal.parentId2) {
            toast({ variant: "destructive", title: "Cannot Add Parent", description: `${fromPersonOriginal.firstName} already has two parents.` });
            return;
        }
    }
    
    if (relationship === 'child') {
        if (toPersonOriginal.parentId1 && toPersonOriginal.parentId2) {
            toast({ variant: "destructive", title: "Cannot Add Parent", description: `${toPersonOriginal.firstName} already has two parents.` });
            return;
        }
    }

    setPeople(prevPeople => {
      const peopleCopy = prevPeople.map(p => ({ ...p, spouseIds: [...(p.spouseIds || [])], childrenIds: [...(p.childrenIds || [])] }));
      const fromPerson = peopleCopy.find(p => p.id === fromId)!;
      const toPerson = peopleCopy.find(p => p.id === toId)!;

      switch (relationship) {
        case 'parent':
          if (fromPerson.parentId1 === toId || fromPerson.parentId2 === toId) return prevPeople; // Already a parent
          if (!fromPerson.parentId1) fromPerson.parentId1 = toId;
          else if (!fromPerson.parentId2) fromPerson.parentId2 = toId;
          
          if (!toPerson.childrenIds!.includes(fromId)) toPerson.childrenIds!.push(fromId);
          break;
        case 'child':
          if (toPerson.parentId1 === fromId || toPerson.parentId2 === fromId) return prevPeople; // Already a parent
          if (!toPerson.parentId1) toPerson.parentId1 = fromId;
          else if (!toPerson.parentId2) toPerson.parentId2 = fromId;
          
          if (!fromPerson.childrenIds!.includes(toId)) fromPerson.childrenIds!.push(toId);
          break;
        case 'spouse':
          if (!fromPerson.spouseIds!.includes(toId)) fromPerson.spouseIds!.push(toId);
          if (!toPerson.spouseIds!.includes(fromId)) toPerson.spouseIds!.push(fromId);
          break;
      }

      return peopleCopy;
    });

    toast({ title: "Relationship Updated!", description: `Set ${toPersonOriginal.firstName} as ${fromPersonOriginal.firstName}'s ${relationship}.` });
  };

  const handleSetChildOfCouple = (childId: string, p1Id: string, p2Id: string) => {
    const childPersonOriginal = people.find(p => p.id === childId);
    if (!childPersonOriginal) return;

    if (childPersonOriginal.parentId1 || childPersonOriginal.parentId2) {
      toast({ variant: "destructive", title: "Cannot Add Parents", description: `${childPersonOriginal.firstName} already has one or more parents.` });
      return;
    }
    
    setPeople(prevPeople => {
      const peopleCopy = prevPeople.map(p => ({ 
        ...p, 
        spouseIds: [...(p.spouseIds || [])], 
        childrenIds: [...(p.childrenIds || [])] 
      }));

      const child = peopleCopy.find(p => p.id === childId)!;
      const parent1 = peopleCopy.find(p => p.id === p1Id)!;
      const parent2 = peopleCopy.find(p => p.id === p2Id)!;

      if (!child || !parent1 || !parent2) return prevPeople; // a safety check

      child.parentId1 = parent1.id;
      child.parentId2 = parent2.id;

      if (!parent1.childrenIds!.includes(childId)) {
        parent1.childrenIds!.push(childId);
      }
      if (!parent2.childrenIds!.includes(childId)) {
        parent2.childrenIds!.push(childId);
      }

      return peopleCopy;
    });

    const parent1Original = people.find(p => p.id === p1Id);
    const parent2Original = people.find(p => p.id === p2Id);
    toast({ title: "Relationship Updated!", description: `${childPersonOriginal.firstName} is now a child of ${parent1Original?.firstName} and ${parent2Original?.firstName}.` });
  };


  if (!treeData) {
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
            <h1 className="text-xl font-headline text-foreground">{treeData.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleAddPerson({})}>
             <UserPlus className="mr-2 h-4 w-4" /> Add Person
          </Button>
          <Button variant="outline" size="sm"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" /> {treeData.memberCount} Members</Button>
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
