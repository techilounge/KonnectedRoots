
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import type { Person, FamilyTree, Relationship } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

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


  useEffect(() => {
    let currentTreeName = `Family Tree ${treeId}`;
    let currentMemberCount = people.length;

    if (typeof window !== 'undefined') {
        const storedTreeData = localStorage.getItem(`selectedTree-${treeId}`);
        if (storedTreeData) {
            try {
                const parsedTree: FamilyTree = JSON.parse(storedTreeData);
                currentTreeName = parsedTree.name; 
                // We'll use people.length for memberCount as it's dynamic here
            } catch (e) {
                console.error("Failed to parse tree data from localStorage", e);
            }
        }
    }
    setTreeData({ id: treeId, name: currentTreeName, memberCount: currentMemberCount, lastUpdated: new Date().toISOString() });
  }, [treeId, people.length]);

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
    if (treeData) {
      setTreeData(prevTreeData => prevTreeData ? {...prevTreeData, memberCount: prevTreeData.memberCount + 1, lastUpdated: new Date().toISOString()} : null);
    }
  };

  const handleEditPerson = (person: Person) => {
    setSelectedPerson(person);
    setIsEditorOpen(true);
  };

  const handleSavePerson = (updatedPerson: Person) => {
    setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
    setIsEditorOpen(false);
    setSelectedPerson(null);
    if (treeData) {
       setTreeData(prevTreeData => prevTreeData ? {...prevTreeData, lastUpdated: new Date().toISOString()} : null);
    }
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
              onNodeMove={handleNodeMove} 
              onSetRelationship={handleSetRelationship}
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
    </div>
  );
}
