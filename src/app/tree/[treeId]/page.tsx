
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
import { Users, Share2, ZoomIn, ZoomOut, UserPlus, ChevronLeft, Loader2, Undo2, Redo2, ShieldCheck, Copy, Grid3x3, RefreshCcw, History } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NameSuggestor from '@/components/tree/NameSuggestor';
import ExportDialog from '@/components/tree/ExportDialog';
import { getOrphanedReferenceFixes } from '@/lib/gedcom-generator';
import { validateTree, type ValidationResult } from '@/lib/tree-validator';
import { detectDuplicates, type DuplicateDetectionResult } from '@/lib/duplicate-detector';
import ValidationPanel from '@/components/tree/ValidationPanel';
import DuplicateDetectionDialog from '@/components/tree/DuplicateDetectionDialog';
import LayoutHistoryDialog from '@/components/tree/LayoutHistoryDialog';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase/clients';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, getDoc, updateDoc, query, where, onSnapshot, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { handleFindRelationship } from '@/app/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { saveLayoutSnapshot } from '@/lib/layout-history';
import { Download } from 'lucide-react';


export default function TreeEditorPage() {
  const params = useParams();
  const routeParam = params.treeId as string; // Could be slug or ID
  const { toast } = useToast();
  const { user } = useAuth();
  const [resolvedTreeId, setResolvedTreeId] = useState<string | null>(null);
  const { pushCommand, undo, redo, canUndo, canRedo, isProcessing: isUndoProcessing } = useUndoRedo(resolvedTreeId || '');
  const photoUploadInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);


  const [treeData, setTreeData] = useState<FamilyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Derived permissions state
  const userRole = treeData && user ?
    (treeData.ownerId === user.uid ? 'owner' : (treeData.collaborators?.[user.uid] as string) || 'viewer')
    : 'viewer';

  // Default to viewer (read-only) if loading or not authenticated
  const isOwner = userRole === 'owner';
  const isManager = userRole === 'manager';
  const isEditor = userRole === 'editor';
  const canEdit = isOwner || isManager || isEditor;
  const readOnly = !canEdit;

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
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateDetectionResult | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isLayoutHistoryOpen, setIsLayoutHistoryOpen] = useState(false);
  const [isResetPositionsDialogOpen, setIsResetPositionsDialogOpen] = useState(false);

  // Grid/Snap state
  const [showGridLines, setShowGridLines] = useState(false);

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

  // Resolve slug to tree ID (or use direct ID for backwards compatibility)
  useEffect(() => {
    if (!routeParam || !user) return;

    const resolveTreeId = async () => {
      // Try to find by slug, but only for trees owned by current user (to comply with security rules)
      // Shared trees will still use the document ID directly
      const treesRef = collection(db, 'trees');
      const slugQuery = query(
        treesRef,
        where('ownerId', '==', user.uid),
        where('slug', '==', routeParam)
      );

      try {
        const slugSnapshot = await getDocs(slugQuery);

        if (!slugSnapshot.empty) {
          // Found by slug
          setResolvedTreeId(slugSnapshot.docs[0].id);
        } else {
          // Fallback: assume it's a direct document ID (for shared trees or old trees)
          setResolvedTreeId(routeParam);
        }
      } catch (error) {
        // Query failed (could be missing index), fall back to treating as ID
        console.warn('Slug lookup failed, using as ID:', error);
        setResolvedTreeId(routeParam);
      }
    };

    resolveTreeId();
  }, [routeParam, user]);

  // Derived treeId for use in the component
  const treeId = resolvedTreeId || '';

  // Firestore collection references for use in handlers (outside useEffect)
  const getTreeDocRef = () => doc(db, 'trees', treeId);
  const getPeopleColRef = () => collection(db, 'trees', treeId, 'people');

  useEffect(() => {
    if (!user || !treeId) {
      if (!treeId && resolvedTreeId === null) {
        // Still resolving
        return;
      }
      setIsLoading(false);
      return;
    };

    setIsLoading(true);

    // Create refs inside useEffect to avoid dependency issues
    const treeDocRef = doc(db, 'trees', treeId);
    const peopleColRef = collection(db, 'trees', treeId, 'people');

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
  }, [treeId, user, toast, resolvedTreeId]);

  const handleAddPerson = async (newPersonDetails: Partial<Person>) => {
    if (!user) return;
    if (readOnly) {
      toast({ variant: "destructive", title: "View Only", description: "You don't have permission to edit." });
      return;
    }
    const peopleCol = getPeopleColRef();
    const newPersonId = doc(peopleCol).id; // Generate a new ID from the collection ref
    const personWithDefaults: Person = {
      id: newPersonId,
      ownerId: user.uid,
      treeId: treeId,
      firstName: 'New Person',
      gender: null, // Default to null to force user selection
      living: true,
      x: Math.random() * 500 + 50,
      y: Math.random() * 300 + 50,
      ...newPersonDetails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const personDocRef = doc(peopleCol, newPersonId);
      // The real-time listener will handle updating the local state (setPeople)
      await setDoc(personDocRef, personWithDefaults);

      // Push undo command
      pushCommand({
        type: 'ADD_PERSON',
        treeId,
        personId: newPersonId,
        data: personWithDefaults
      });

      // Note: Don't auto-open editor - user can double-click to edit
      // This prevents duplicate undo commands (add + save)
      toast({ title: "Person Added", description: "Double-click to edit details." });
      // Also update the parent tree's lastUpdated timestamp to trigger UI refreshes elsewhere if needed
      await updateDoc(getTreeDocRef(), { lastUpdated: serverTimestamp(), memberCount: increment(1) });

      // Save layout snapshot to capture initial position
      if (resolvedTreeId && user) {
        // Use updated list including new person to ensure they are in the snapshot
        await saveLayoutSnapshot(
          resolvedTreeId,
          [...people, personWithDefaults],
          user.uid,
          'auto',
          { x: 0, y: 0 },
          1,
          'Added New Person'
        );
      }
    } catch (error) {
      console.error("Error adding person to Firestore:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save new person." });
    }
  };

  const handleEditPerson = (person: Person) => {
    // Delay opening the dialog to allow ContextMenu to fully close first
    // This prevents Radix UI components from conflicting over body styles
    setTimeout(() => {
      setSelectedPerson(person);
      setIsEditorOpen(true);
    }, 150);
  };

  const handleSavePerson = async (updatedPerson: Person) => {
    if (readOnly) {
      toast({ variant: "destructive", title: "View Only", description: "You don't have permission to edit." });
      return;
    }
    // Find current state before update (for undo)
    const beforePerson = people.find(p => p.id === updatedPerson.id);

    try {
      const personDocRef = doc(getPeopleColRef(), updatedPerson.id);

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
      batch.update(getTreeDocRef(), { lastUpdated: serverTimestamp() });
      await batch.commit();

      // Push undo command with before/after state
      if (beforePerson) {
        pushCommand({
          type: 'UPDATE_PERSON',
          treeId,
          personId: updatedPerson.id,
          before: beforePerson,
          after: updatedPerson
        });
      }

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
    if (readOnly) {
      toast({ variant: "destructive", title: "View Only", description: "You don't have permission to delete." });
      return;
    }

    // Capture full person data for undo before deleting
    const personDataForUndo = { ...personToDelete };
    const deletedPersonId = personToDelete.id;

    // Save layout snapshot before deletion
    if (resolvedTreeId && user) {
      await saveLayoutSnapshot(resolvedTreeId, people, user.uid, 'pre_delete', { x: 0, y: 0 }, 1, `Before deleting ${personToDelete.firstName}`);
    }

    try {
      // Clear selectedPerson if it's the person being deleted
      if (selectedPerson?.id === deletedPersonId) {
        setSelectedPerson(null);
      }

      const batch = writeBatch(db);

      // Delete the person document
      batch.delete(doc(getPeopleColRef(), deletedPersonId));

      // Clean up orphaned references in related people
      // 1. Remove from spouses' spouseIds
      const spouseIds = personDataForUndo.spouseIds || [];
      for (const spouseId of spouseIds) {
        const spouse = people.find(p => p.id === spouseId);
        if (spouse) {
          const updatedSpouseIds = (spouse.spouseIds || []).filter(id => id !== deletedPersonId);
          batch.update(doc(getPeopleColRef(), spouseId), {
            spouseIds: updatedSpouseIds,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 2. Remove from parents' childrenIds
      const parentId1 = personDataForUndo.parentId1;
      const parentId2 = personDataForUndo.parentId2;
      if (parentId1) {
        const parent1 = people.find(p => p.id === parentId1);
        if (parent1) {
          const updatedChildrenIds = (parent1.childrenIds || []).filter(id => id !== deletedPersonId);
          batch.update(doc(getPeopleColRef(), parentId1), {
            childrenIds: updatedChildrenIds,
            updatedAt: serverTimestamp()
          });
        }
      }
      if (parentId2) {
        const parent2 = people.find(p => p.id === parentId2);
        if (parent2) {
          const updatedChildrenIds = (parent2.childrenIds || []).filter(id => id !== deletedPersonId);
          batch.update(doc(getPeopleColRef(), parentId2), {
            childrenIds: updatedChildrenIds,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 3. Clear parentId references in children
      const childrenIds = personDataForUndo.childrenIds || [];
      for (const childId of childrenIds) {
        const child = people.find(p => p.id === childId);
        if (child) {
          const updates: Partial<Person> & { updatedAt: ReturnType<typeof serverTimestamp> } = { updatedAt: serverTimestamp() };
          if (child.parentId1 === deletedPersonId) {
            updates.parentId1 = undefined;
          }
          if (child.parentId2 === deletedPersonId) {
            updates.parentId2 = undefined;
          }
          if (Object.keys(updates).length > 1) { // More than just updatedAt
            batch.update(doc(getPeopleColRef(), childId), updates);
          }
        }
      }

      // Update tree metadata
      batch.update(getTreeDocRef(), { lastUpdated: serverTimestamp(), memberCount: increment(-1) });

      // Close dialog BEFORE commit to prevent state conflicts
      handleCloseDeleteDialog();

      await batch.commit();

      // Push undo command
      pushCommand({
        type: 'DELETE_PERSON',
        treeId,
        personId: personDataForUndo.id,
        data: personDataForUndo
      });

      toast({ variant: "destructive", title: "Person Deleted", description: `"${personDataForUndo.firstName}" and all relationship references have been cleaned up.` });
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

  // Validate the entire tree
  const handleValidateTree = useCallback(() => {
    const result = validateTree(people);
    setValidationResult(result);
    setShowValidationPanel(true);

    if (!result.hasErrors && !result.hasWarnings) {
      toast({
        title: "Tree Validated",
        description: "No issues found in your family tree!",
        duration: 5000,
      });
    } else {
      const errorCount = result.issues.filter(i => i.severity === 'error').length;
      const warningCount = result.issues.filter(i => i.severity === 'warning').length;
      toast({
        variant: errorCount > 0 ? "destructive" : "default",
        title: "Validation Complete",
        description: `Found ${errorCount} errors and ${warningCount} warnings.`,
      });
    }
  }, [people, toast]);

  // Detect duplicates in the tree
  const handleDetectDuplicates = useCallback(() => {
    const result = detectDuplicates(people);
    setDuplicateResult(result);
    setIsDuplicateDialogOpen(true);

    if (!result.hasDuplicates) {
      toast({
        title: "No Duplicates Found",
        description: "Your family tree looks clean!",
      });
    } else {
      toast({
        title: "Duplicates Detected",
        description: `Found ${result.matches.length} potential duplicate${result.matches.length > 1 ? 's' : ''}.`,
      });
    }
  }, [people, toast]);

  // Handle merge duplicates
  const handleMergeDuplicates = async (keepId: string, removeId: string) => {
    if (readOnly) return;

    const keepPerson = people.find(p => p.id === keepId);
    const removePerson = people.find(p => p.id === removeId);

    if (!keepPerson || !removePerson) return;

    try {
      // Save layout snapshot before merge
      if (resolvedTreeId && user) {
        await saveLayoutSnapshot(resolvedTreeId, people, user.uid, 'pre_merge', { x: 0, y: 0 }, 1, `Before merging into ${keepPerson.firstName}`);
      }

      const batch = writeBatch(db);

      // Transfer relationships from removed person to kept person
      const updatedSpouseIds = [...new Set([...(keepPerson.spouseIds || []), ...(removePerson.spouseIds || [])])];
      const updatedChildrenIds = [...new Set([...(keepPerson.childrenIds || []), ...(removePerson.childrenIds || [])])];

      // Update kept person with merged data
      const keepRef = doc(getPeopleColRef(), keepId);
      batch.update(keepRef, {
        spouseIds: updatedSpouseIds.filter(id => id !== keepId && id !== removeId),
        childrenIds: updatedChildrenIds.filter(id => id !== keepId && id !== removeId),
        updatedAt: serverTimestamp()
      });

      // Update all people who reference the removed person
      for (const person of people) {
        if (person.id === keepId || person.id === removeId) continue;

        const updates: Record<string, unknown> = {};
        let needsUpdate = false;

        if (person.parentId1 === removeId) {
          updates.parentId1 = keepId;
          needsUpdate = true;
        }
        if (person.parentId2 === removeId) {
          updates.parentId2 = keepId;
          needsUpdate = true;
        }
        if (person.spouseIds?.includes(removeId)) {
          updates.spouseIds = person.spouseIds.map(id => id === removeId ? keepId : id);
          needsUpdate = true;
        }
        if (person.childrenIds?.includes(removeId)) {
          updates.childrenIds = person.childrenIds.map(id => id === removeId ? keepId : id);
          needsUpdate = true;
        }

        if (needsUpdate) {
          const personRef = doc(getPeopleColRef(), person.id);
          batch.update(personRef, { ...updates, updatedAt: serverTimestamp() });
        }
      }

      // Delete the removed person
      const removeRef = doc(getPeopleColRef(), removeId);
      batch.delete(removeRef);

      // Update member count
      batch.update(getTreeDocRef(), {
        memberCount: increment(-1),
        lastUpdated: serverTimestamp()
      });

      await batch.commit();

      toast({
        title: "Merged Successfully",
        description: `"${removePerson.firstName} ${removePerson.lastName}" merged into "${keepPerson.firstName} ${keepPerson.lastName}".`,
      });

      // Refresh duplicate detection
      const newResult = detectDuplicates(people.filter(p => p.id !== removeId));
      setDuplicateResult(newResult);

    } catch (error) {
      console.error("Error merging duplicates:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to merge duplicates.",
      });
    }
  };

  // Handle dismiss duplicate (mark as not duplicate - for future: persist this)
  const handleDismissDuplicate = (person1Id: string, person2Id: string) => {
    // For now, just remove from the current result
    // Future: Store dismissed pairs in Firestore to persist across sessions
    toast({
      title: "Dismissed",
      description: "These entries won't be flagged as duplicates in this session.",
    });
  };

  // Edit person from validation panel
  const handleEditPersonFromValidation = (personId: string) => {
    const person = people.find(p => p.id === personId);
    if (person) {
      setSelectedPerson(person);
      setIsEditorOpen(true);
    }
  };

  const handleNodeMove = async (personId: string, newX: number, newY: number) => {
    if (readOnly) return;
    // Optimistically update local state for smooth UX
    setPeople(prevPeople =>
      prevPeople.map(p =>
        p.id === personId ? { ...p, x: newX, y: newY } : p
      )
    );
    try {
      const personDocRef = doc(getPeopleColRef(), personId);
      await updateDoc(personDocRef, { x: newX, y: newY, updatedAt: serverTimestamp() });
      // Note: Not adding undo for move because it fires per-pixel during drag
      // Would need onNodeMoveEnd callback to properly support undo
    } catch (error) {
      console.error("Error saving node position:", error);
    }
  };

  // Debounced auto-save for layout history
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragEnd = useCallback(() => {
    if (readOnly || !resolvedTreeId || !user) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer (2 seconds debounce)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveLayoutSnapshot(
          resolvedTreeId,
          people,
          user.uid,
          'auto',
          // Note: using default viewOffset/zoom for auto-saves as we don't track them in state efficiently yet
          { x: 0, y: 0 },
          1
        );
        // Silent success - don't toast for auto-saves
      } catch (error) {
        console.error("Error auto-saving layout:", error);
      }
    }, 2000);
  }, [readOnly, resolvedTreeId, user, people]);

  // Reset all people positions to a visible grid layout
  const handleResetPositions = async () => {
    if (readOnly) {
      toast({ variant: "destructive", title: "View Only", description: "You don't have permission to edit." });
      return;
    }
    if (people.length === 0) return;

    const batch = writeBatch(db);
    const COLS = 5; // Cards per row
    const SPACING_X = 220; // Horizontal spacing
    const SPACING_Y = 120; // Vertical spacing
    const START_X = 100;
    const START_Y = 100;

    people.forEach((person, index) => {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const newX = START_X + col * SPACING_X;
      const newY = START_Y + row * SPACING_Y;

      const personRef = doc(getPeopleColRef(), person.id);
      batch.update(personRef, { x: newX, y: newY, updatedAt: serverTimestamp() });
    });

    try {
      await batch.commit();
      // Reset view offset and zoom
      setZoomLevel(1);
      toast({ title: "Positions Reset", description: `${people.length} people arranged in a grid.` });
    } catch (error) {
      console.error("Error resetting positions:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to reset positions." });
    }
  };

  const handleCreateRelationship = async (fromId: string, toId: string, type: RelationshipType) => {
    const fromPerson = people.find(p => p.id === fromId);
    const toPerson = people.find(p => p.id === toId);

    if (!fromPerson || !toPerson) {
      toast({ variant: "destructive", title: "Error", description: "Could not find persons to link." });
      return;
    }

    if (readOnly) {
      toast({ variant: "destructive", title: "View Only", description: "You don't have permission to edit." });
      return;
    }

    // Capture before state for undo
    const beforeP1 = {
      spouseIds: fromPerson.spouseIds || [],
      parentId1: fromPerson.parentId1,
      parentId2: fromPerson.parentId2,
      childrenIds: fromPerson.childrenIds || []
    };
    const beforeP2 = {
      spouseIds: toPerson.spouseIds || [],
      parentId1: toPerson.parentId1,
      parentId2: toPerson.parentId2,
      childrenIds: toPerson.childrenIds || []
    };

    // Prepare after state based on relationship type
    let afterP1 = { ...beforeP1 };
    let afterP2 = { ...beforeP2 };

    const batch = writeBatch(db);

    try {
      if (type === 'spouse') {
        const fromRef = doc(getPeopleColRef(), fromId);
        const toRef = doc(getPeopleColRef(), toId);
        const fromSpouses = fromPerson.spouseIds || [];
        const toSpouses = toPerson.spouseIds || [];

        batch.update(fromRef, { spouseIds: [...fromSpouses, toId], updatedAt: serverTimestamp() });
        batch.update(toRef, { spouseIds: [...toSpouses, fromId], updatedAt: serverTimestamp() });

        // Update after state
        afterP1 = { ...afterP1, spouseIds: [...fromSpouses, toId] };
        afterP2 = { ...afterP2, spouseIds: [...toSpouses, fromId] };
      } else if (type === 'parent' || type === 'child') {
        const parent = type === 'parent' ? toPerson : fromPerson;
        const child = type === 'parent' ? fromPerson : toPerson;

        const childRef = doc(getPeopleColRef(), child.id);
        const parentRef = doc(getPeopleColRef(), parent.id);

        const parentChildren = parent.childrenIds || [];
        if (!child.parentId1) {
          batch.update(childRef, { parentId1: parent.id, updatedAt: serverTimestamp() });
          // Update after state
          if (type === 'parent') {
            afterP1 = { ...afterP1, parentId1: parent.id };
          } else {
            afterP2 = { ...afterP2, parentId1: parent.id };
          }
        } else if (!child.parentId2) {
          batch.update(childRef, { parentId2: parent.id, updatedAt: serverTimestamp() });
          // Update after state
          if (type === 'parent') {
            afterP1 = { ...afterP1, parentId2: parent.id };
          } else {
            afterP2 = { ...afterP2, parentId2: parent.id };
          }
        } else {
          toast({
            variant: "destructive",
            title: "Cannot Add Parent",
            description: `${child.firstName} already has two parents assigned.`,
          });
          return; // Stop execution to prevent further updates
        }
        batch.update(parentRef, { childrenIds: [...parentChildren, child.id], updatedAt: serverTimestamp() });
        // Update after state for parent
        if (type === 'parent') {
          afterP2 = { ...afterP2, childrenIds: [...parentChildren, child.id] };
        } else {
          afterP1 = { ...afterP1, childrenIds: [...parentChildren, child.id] };
        }
      }

      await batch.commit();

      // Push undo command with before and after states
      pushCommand({
        type: 'CREATE_RELATIONSHIP',
        treeId,
        relationshipType: type,
        person1Id: fromId,
        person2Id: toId,
        before: { p1: beforeP1, p2: beforeP2 },
        after: { p1: afterP1, p2: afterP2 }
      });

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
    const personRef = doc(getPeopleColRef(), personId);
    const relatedRef = doc(getPeopleColRef(), relatedPersonId);
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

      // Undo/Redo keyboard shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          // Ctrl+Shift+Z = Redo
          redo();
        } else {
          // Ctrl+Z = Undo
          undo();
        }
      }
      // Also support Ctrl+Y for redo (common on Windows)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

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
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => handleAddPerson({})}>
              <UserPlus className="mr-2 h-4 w-4" /> Add Person
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canUndo || isUndoProcessing}
                  onClick={undo}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canRedo || isUndoProcessing}
                  onClick={redo}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={() => handleZoom('in')}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleZoom('out')}><ZoomOut className="h-4 w-4" /></Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showGridLines ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowGridLines(!showGridLines)}
                  aria-pressed={showGridLines}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle Grid Lines</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIsResetPositionsDialogOpen(true)}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Reset Positions</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleValidateTree}>
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Validate Tree</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleDetectDuplicates}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Find Duplicates</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIsLayoutHistoryOpen(true)}>
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Layout History</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        {!readOnly && (
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
        )}
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
              onNodeDoubleClick={(person) => {
                if (!readOnly) handleEditPerson(person);
              }}
              onNodeDeleteRequest={handleOpenDeleteDialog}
              onNodeMove={handleNodeMove}
              onCreateRelationship={handleCreateRelationship}
              zoomLevel={zoomLevel}
              selectedPersonId={selectedPerson?.id || null}
              isLinkingMode={isLinkingMode}
              onViewRelationships={handleOpenRelationships}
              readOnly={readOnly}
              showGridLines={showGridLines}

              onDragEnd={handleDragEnd}
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

      {isEditorOpen && selectedPerson && (treeData?.id || treeId) && (
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
          treeId={treeData?.id || treeId}
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
        onEditPerson={(personId: string) => {
          const person = people.find(p => p.id === personId);
          if (person) {
            handleEditPerson(person);
          }
        }}
        onFixOrphanedReferences={async () => {
          const fixes = getOrphanedReferenceFixes(people);
          if (fixes.length === 0) return;

          try {
            const batch = writeBatch(db);
            for (const fix of fixes) {
              const personRef = doc(getPeopleColRef(), fix.personId);
              batch.update(personRef, {
                ...fix.updates,
                updatedAt: serverTimestamp()
              });
            }
            await batch.commit();
            toast({
              title: "Orphaned References Fixed",
              description: `Cleaned up references for ${fixes.length} people.`
            });
          } catch (error) {
            console.error('Error fixing orphaned references:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to fix orphaned references."
            });
          }
        }}
      />

      {/* Validation Panel */}
      {showValidationPanel && (
        <ValidationPanel
          validationResult={validationResult}
          onEditPerson={handleEditPersonFromValidation}
          onClose={() => setShowValidationPanel(false)}
        />
      )}

      {/* Duplicate Detection Dialog */}
      {isDuplicateDialogOpen && (
        <DuplicateDetectionDialog
          isOpen={isDuplicateDialogOpen}
          onClose={() => setIsDuplicateDialogOpen(false)}
          result={duplicateResult}
          onMerge={handleMergeDuplicates}
          onDismiss={handleDismissDuplicate}
        />
      )}

      {/* Layout History Dialog */}
      <LayoutHistoryDialog
        isOpen={isLayoutHistoryOpen}
        onClose={() => setIsLayoutHistoryOpen(false)}
        treeId={resolvedTreeId || ''}
        people={people}
        onRestore={() => {
          // Optional: Force refresh or reset view state if needed
          toast({ title: "Layout Restored", description: "Tree positions have been updated." });
        }}
      />

      {/* Reset Positions Confirmation Dialog */}
      <AlertDialog open={isResetPositionsDialogOpen} onOpenChange={setIsResetPositionsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Positions?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will rearrange all {people.length} people into a simple grid layout,
                  <strong className="text-foreground"> overwriting their current positions</strong>.
                </p>
                <p className="bg-muted p-2 rounded border">
                  💡 <strong>Tip:</strong> You can use the <strong>Layout History</strong> (clock icon) to restore
                  a previous layout if you change your mind.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsResetPositionsDialogOpen(false);
                handleResetPositions();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Positions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
