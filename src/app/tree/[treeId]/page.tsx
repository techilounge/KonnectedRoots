
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import FamilyTreeCanvasPlaceholder from '@/components/tree/FamilyTreeCanvasPlaceholder';
import AddPersonToolbox from '@/components/tree/AddPersonToolbox';
import NodeEditorDialog from '@/components/tree/NodeEditorDialog';
import ShareDialog from '@/components/tree/ShareDialog';
import RelationshipsDialog from '@/components/tree/RelationshipsDialog';
import type { Person, FamilyTree, RelationshipType } from '@/types';
import { Button } from '@/components/ui/button';
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft, Loader2, Undo2, Redo2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NameSuggestor from '@/components/tree/NameSuggestor';
import ExportDialog from '@/components/tree/ExportDialog';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase/clients';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, getDoc, updateDoc, query, where, onSnapshot, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { handleFindRelationship } from '@/app/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download } from 'lucide-react';


export default function TreeEditorPage() {
  const params = useParams();
  const treeId = params.treeId as string;
  const { toast } = useToast();
  const { user } = useAuth();
  const photoUploadInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);


  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [isNameSuggestorOpen, setIsNameSuggestorOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [personForSuggestion, setPersonForSuggestion] = useState<Partial<Person> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRelationshipsDialogOpen, setIsRelationshipsDialogOpen] = useState(false);
  const [personForRelationships, setPersonForRelationships] = useState<Person | null>(null);
  const [isRelationshipFinderMode, setIsRelationshipFinderMode] = useState(false);
  const [relationshipFinderPerson1, setRelationshipFinderPerson1] = useState<Person | null>(null);
  const [relationshipResult, setRelationshipResult] = useState<{ relationship: string; explanation: string } | null>(null);
  const [isRelationshipResultOpen, setIsRelationshipResultOpen] = useState(false);
  const [isCalculatingRelationship, setIsCalculatingRelationship] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const isLinkingModeRef = useRef(isLinkingMode);

  useEffect(() => {
    isLinkingModeRef.current = isLinkingMode;
  }, [isLinkingMode]);

  // Force reset body pointer-events when delete dialog closes
  // This is a workaround for Radix UI not properly cleaning up its body lock
  useEffect(() => {
    if (!isDeleteDialogOpen && typeof document !== 'undefined') {
      // Small delay to ensure Radix has finished its animations
      const timeoutId = setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isDeleteDialogOpen]);

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
      setIsLoading(false);
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
      // Save current state for undo - DISABLED
      // pushToHistory(people);

      const personDocRef = doc(peopleColRef, newPersonId);
      // The real-time listener will handle updating the local state (setPeople)
      await setDoc(personDocRef, personWithDefaults);

      setSelectedPerson(personWithDefaults);
      setIsEditorOpen(true);
      toast({ title: "Person Added", description: "New person saved to the tree." });
      // Also update the parent tree's lastUpdated timestamp to trigger UI refreshes elsewhere if needed
      await updateDoc(treeDocRef, { lastUpdated: serverTimestamp(), memberCount: increment(1) });
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
    // Save current state for undo - DISABLED
    // pushToHistory(people);

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
    // Delay opening the AlertDialog to allow ContextMenu to fully close first
    // This prevents Radix UI components from conflicting over body styles
    setTimeout(() => {
      setPersonToDelete(person);
      setIsDeleteDialogOpen(true);
      if (isEditorOpen && selectedPerson?.id === person.id) {
        setIsEditorOpen(false);
        setSelectedPerson(null);
      }
    }, 150);
  };

  const handleCloseDeleteDialog = () => {
    setPersonToDelete(null);
    setIsDeleteDialogOpen(false);
    // Force reset body pointer-events in case Radix UI doesn't clean up properly
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;

    try {
      // Save current state for undo - DISABLED
      // pushToHistory(people);

      // Clear selectedPerson if it's the person being deleted
      if (selectedPerson?.id === personToDelete.id) {
        setSelectedPerson(null);
      }

      const batch = writeBatch(db);
      batch.delete(doc(peopleColRef, personToDelete.id));
      batch.update(treeDocRef, { lastUpdated: serverTimestamp(), memberCount: increment(-1) });

      // Close dialog BEFORE commit to prevent state conflicts
      handleCloseDeleteDialog();

      await batch.commit();
      toast({ variant: "destructive", title: "Person Deleted", description: `"${personToDelete.firstName}" has been removed.` });
    } catch (error) {
      console.error("Error deleting person:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete person." });
    }
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

  const handleOpenRelationships = (person: Person) => {
    // Delay to let context menu close first and prevent focus conflict
    setTimeout(() => {
      setPersonForRelationships(person);
      setIsRelationshipsDialogOpen(true);
    }, 100);
  };

  const handleDeleteRelationship = async (personId: string, relatedPersonId: string, type: 'spouse' | 'parent' | 'child') => {
    const batch = writeBatch(db);
    const personRef = doc(peopleColRef, personId);
    const relatedRef = doc(peopleColRef, relatedPersonId);
    const person = people.find(p => p.id === personId);
    const related = people.find(p => p.id === relatedPersonId);

    if (!person || !related) return;

    try {
      if (type === 'spouse') {
        const personSpouses = (person.spouseIds || []).filter(id => id !== relatedPersonId);
        const relatedSpouses = (related.spouseIds || []).filter(id => id !== personId);
        batch.update(personRef, { spouseIds: personSpouses, updatedAt: serverTimestamp() });
        batch.update(relatedRef, { spouseIds: relatedSpouses, updatedAt: serverTimestamp() });
      } else if (type === 'parent') {
        // Remove parent from child
        const updateData: any = { updatedAt: serverTimestamp() };
        if (person.parentId1 === relatedPersonId) updateData.parentId1 = null;
        if (person.parentId2 === relatedPersonId) updateData.parentId2 = null;
        batch.update(personRef, updateData);
        // Remove child from parent's childrenIds
        const parentChildren = (related.childrenIds || []).filter(id => id !== personId);
        batch.update(relatedRef, { childrenIds: parentChildren, updatedAt: serverTimestamp() });
      } else if (type === 'child') {
        // Remove child from parent
        const parentChildren = (person.childrenIds || []).filter(id => id !== relatedPersonId);
        batch.update(personRef, { childrenIds: parentChildren, updatedAt: serverTimestamp() });
        // Remove parent from child
        const childUpdateData: any = { updatedAt: serverTimestamp() };
        if (related.parentId1 === personId) childUpdateData.parentId1 = null;
        if (related.parentId2 === personId) childUpdateData.parentId2 = null;
        batch.update(relatedRef, childUpdateData);
      }

      await batch.commit();
      toast({ title: "Relationship Deleted", description: "The connection has been removed." });
      // Close the dialog to prevent stale data display
      setIsRelationshipsDialogOpen(false);
      setPersonForRelationships(null);
    } catch (error) {
      console.error("Error deleting relationship:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not delete relationship." });
    }
  };

  const handleToggleRelationshipMode = () => {
    if (!selectedPerson) return;
    setIsLinkingMode(prev => !prev);
  };

  const handleToggleRelationshipFinderMode = () => {
    if (isRelationshipFinderMode) {
      // Cancel mode
      setIsRelationshipFinderMode(false);
      setRelationshipFinderPerson1(null);
    } else if (selectedPerson) {
      // Start mode with selected person as person 1
      setIsRelationshipFinderMode(true);
      setRelationshipFinderPerson1(selectedPerson);
    }
  };

  const handleRelationshipFinderClick = async (person2: Person) => {
    if (!relationshipFinderPerson1 || relationshipFinderPerson1.id === person2.id) return;

    setIsCalculatingRelationship(true);

    const input = {
      person1: {
        id: relationshipFinderPerson1.id,
        firstName: relationshipFinderPerson1.firstName,
        lastName: relationshipFinderPerson1.lastName,
        gender: relationshipFinderPerson1.gender,
        parentId1: relationshipFinderPerson1.parentId1,
        parentId2: relationshipFinderPerson1.parentId2,
        spouseIds: relationshipFinderPerson1.spouseIds,
        childrenIds: relationshipFinderPerson1.childrenIds,
      },
      person2: {
        id: person2.id,
        firstName: person2.firstName,
        lastName: person2.lastName,
        gender: person2.gender,
        parentId1: person2.parentId1,
        parentId2: person2.parentId2,
        spouseIds: person2.spouseIds,
        childrenIds: person2.childrenIds,
      },
      allPeople: people.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        parentId1: p.parentId1,
        parentId2: p.parentId2,
        spouseIds: p.spouseIds,
        childrenIds: p.childrenIds,
      })),
    };

    try {
      const result = await handleFindRelationship(input);
      if ('error' in result) {
        toast({ variant: "destructive", title: "AI Error", description: result.error });
      } else {
        setRelationshipResult({ relationship: result.relationship, explanation: result.explanation });
        setIsRelationshipResultOpen(true);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to find relationship." });
    } finally {
      setIsCalculatingRelationship(false);
      setIsRelationshipFinderMode(false);
      setRelationshipFinderPerson1(null);
    }
  };

  // Effect to show toast messages when linking mode changes
  useEffect(() => {
    // We don't want to show a toast on the initial render
    if (!isLinkingModeRef.current && !isLinkingMode) return;

    if (isLinkingMode) {
      toast({
        title: "Linking Mode Active",
        description: `Click another person to form a relationship with ${selectedPerson?.firstName}. Press Esc or Cancel to exit.`,
      });
    } else {
      toast({ title: "Linking Canceled" });
    }
  }, [isLinkingMode, selectedPerson?.firstName, toast]);

  const handleInitiatePhotoUpload = () => {
    if (!selectedPerson) return;
    handleEditPerson(selectedPerson);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isLinkingModeRef.current) {
        setIsLinkingMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Coming Soon)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Coming Soon)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={() => handleZoom('in')}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom('out')}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => setIsShareDialogOpen(true)}><Share2 className="mr-2 h-4 w-4" /> Share</Button>
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" /> {treeData?.memberCount ?? people.length} Members
          </Button>
          <span className="hidden lg:inline-block text-xs text-muted-foreground ml-2 px-2 py-1 bg-muted/50 rounded">
            {isLinkingMode
              ? "Linking Mode: Click a person to connect."
              : "Click to select, Double-click to edit. Drag connectors to link people."
            }
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AddPersonToolbox
          onAddPerson={(details) => handleAddPerson(details || {})}
          selectedPerson={selectedPerson}
          onInitiateRelationship={handleToggleRelationshipMode}
          onInitiatePhotoUpload={handleInitiatePhotoUpload}
          isLinkingMode={isLinkingMode}
          onInitiateRelationshipFinder={handleToggleRelationshipFinderMode}
          isRelationshipFinderMode={isRelationshipFinderMode}
          relationshipFinderPerson1={relationshipFinderPerson1}
        />
        <main className="flex-1 relative overflow-auto p-4 bg-background" ref={canvasContainerRef}>
          {people.length > 0 ? (
            <FamilyTreeCanvasPlaceholder
              people={people}
              onNodeClick={(person) => {
                if (isRelationshipFinderMode && relationshipFinderPerson1 && relationshipFinderPerson1.id !== person.id) {
                  handleRelationshipFinderClick(person);
                } else if (isLinkingMode && selectedPerson && selectedPerson.id !== person.id) {
                  handleCreateRelationship(selectedPerson.id, person.id, 'spouse');
                  setIsLinkingMode(false);
                } else {
                  setSelectedPerson(person);
                }
              }}
              onNodeDoubleClick={handleEditPerson}
              onNodeDeleteRequest={handleOpenDeleteDialog}
              onNodeMove={handleNodeMove}
              onCreateRelationship={handleCreateRelationship}
              zoomLevel={zoomLevel}
              selectedPersonId={selectedPerson?.id || null}
              isLinkingMode={isLinkingMode}
              onViewRelationships={handleOpenRelationships}
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

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setPersonToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {personToDelete?.firstName} {personToDelete?.lastName || ''} and all associated connections from the tree.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RelationshipsDialog
        isOpen={isRelationshipsDialogOpen}
        onClose={() => setIsRelationshipsDialogOpen(false)}
        person={personForRelationships}
        people={people}
        onDeleteRelationship={handleDeleteRelationship}
      />

      {/* Relationship Result Dialog */}
      <Dialog open={isRelationshipResultOpen} onOpenChange={setIsRelationshipResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5 text-primary" />
              Relationship Found
            </DialogTitle>
            <DialogDescription>
              AI has analyzed the family tree structure.
            </DialogDescription>
          </DialogHeader>
          {relationshipResult && (
            <div className="py-4 space-y-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-headline text-primary">{relationshipResult.relationship}</p>
              </div>
              <p className="text-sm text-muted-foreground">{relationshipResult.explanation}</p>
            </div>
          )}
          <Button onClick={() => setIsRelationshipResultOpen(false)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        canvasRef={canvasContainerRef}
        people={people}
        tree={treeData}
      />
    </div>
  );
}
