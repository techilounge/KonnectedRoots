
"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import type { Person, FamilyTree } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor';

export default function TreeEditorPage() {
  const params = useParams();
  const treeId = params.treeId as string;

  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNameSuggestorOpen, setIsNameSuggestorOpen] = useState(false);
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);


  useEffect(() => {
    setTreeData({ id: treeId, name: `Family Tree ${treeId}`, memberCount: people.length, lastUpdated: new Date().toISOString() });
  }, [treeId, people.length]);

  const handleAddPerson = (newPersonDetails: Partial<Person>) => {
    const personWithDefaults: Person = { 
      id: String(Date.now()), 
      firstName: 'New Person', 
      gender: 'male', 
      livingStatus: 'unknown',
      privacySetting: 'private',
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


  if (!treeData) {
    return <div className="flex items-center justify-center h-full"><p>Loading tree data...</p></div>;
  }

  return (
    <div className="flex flex-col h-full bg-secondary">
      <header className="bg-card p-3 shadow-sm flex justify-between items-center border-b">
        <h1 className="text-xl font-headline text-foreground">{treeData.name}</h1>
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
