
"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import type { Person, FamilyTree } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus } from 'lucide-react';
import NameSuggestor from '@/components/tree/NameSuggestor'; // Separate component for AI features

export default function TreeEditorPage() {
  const params = useParams();
  const treeId = params.treeId as string;

  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]); // Initialize with empty array
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNameSuggestorOpen, setIsNameSuggestorOpen] = useState(false);
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);


  useEffect(() => {
    // In a real app, fetch tree data and people based on treeId
    setTreeData({ id: treeId, name: `Family Tree ${treeId}`, memberCount: people.length, lastUpdated: new Date().toISOString() });
  }, [treeId, people.length]);

  const handleAddPerson = (newPerson: Partial<Person>) => {
    const personWithId: Person = { 
      id: String(Date.now()), 
      name: 'New Person',
      ...newPerson,
      x: Math.random() * 500 + 50, // Random position for placeholder
      y: Math.random() * 300 + 50,
    };
    setPeople(prev => [...prev, personWithId]);
    setSelectedPerson(personWithId); // Open editor for the new person
    setIsEditorOpen(true);
    // Update member count in treeData
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
    // Update lastUpdated in treeData
    if (treeData) {
       setTreeData(prevTreeData => prevTreeData ? {...prevTreeData, lastUpdated: new Date().toISOString()} : null);
    }
  };
  
  const handleOpenNameSuggestor = (personDetails?: Partial<Person>) => {
    setPersonForSuggestion(personDetails || {});
    setIsNameSuggestorOpen(true);
  };


  if (!treeData) {
    return <div className="flex items-center justify-center h-full"><p>Loading tree data...</p></div>;
  }

  return (
    <div className="flex flex-col h-full bg-secondary">
      <header className="bg-card p-3 shadow-sm flex justify-between items-center border-b">
        <h1 className="text-xl font-headline text-foreground">{treeData.name}</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenNameSuggestor()}>
             <UserPlus className="mr-2 h-4 w-4" /> Add Person
          </Button>
          <Button variant="outline" size="sm"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" /> {treeData.memberCount} Members</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AddPersonToolbox onAddPerson={handleOpenNameSuggestor} />
        <main className="flex-1 relative overflow-auto p-4 bg-background">
          {people.length > 0 ? (
            <FamilyTreeCanvasPlaceholder people={people} onNodeClick={handleEditPerson} />
          ) : (
             <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-4">This family tree is empty.</p>
              <Button onClick={() => handleOpenNameSuggestor()} variant="outline">
                <UserPlus className="mr-2 h-4 w-4" /> Add the first person
              </Button>
            </div>
          )}
        </main>
      </div>

      {selectedPerson && (
        <NodeEditorDialog
          isOpen={isEditorOpen}
          onClose={() => { setIsEditorOpen(false); setSelectedPerson(null); }}
          person={selectedPerson}
          onSave={handleSavePerson}
          onOpenNameSuggestor={() => {
            setIsEditorOpen(false); // Close node editor
            handleOpenNameSuggestor(selectedPerson);
          }}
        />
      )}
      
      <NameSuggestor
        isOpen={isNameSuggestorOpen}
        onClose={() => setIsNameSuggestorOpen(false)}
        personDetails={personForSuggestion}
        onNameSuggested={(name, reason) => {
          // If adding a new person, update and open editor
          if (personForSuggestion && !personForSuggestion.id) { 
            const newPersonData = { ...personForSuggestion, name, notes: `Suggested because: ${reason}` };
            handleAddPerson(newPersonData);
          } 
          // If editing an existing person, update them
          else if (personForSuggestion && personForSuggestion.id) {
            const personToUpdate = people.find(p => p.id === personForSuggestion!.id);
            if (personToUpdate) {
              const updatedP = { ...personToUpdate, name, notes: `${personToUpdate.notes || ''}\nSuggested name: ${name} because ${reason}`.trim() };
              handleSavePerson(updatedP);
              setSelectedPerson(updatedP); // Re-select to show updated info
              setIsEditorOpen(true); // Re-open editor
            }
          }
          setIsNameSuggestorOpen(false);
        }}
      />
    </div>
  );
}
