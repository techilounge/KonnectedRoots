"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Person, RelationshipType } from '@/types';
import { db } from '@/lib/firebase/clients';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp, deleteField, getDoc } from 'firebase/firestore';

import { createPhotoHistory } from '@/lib/photos/history';

// Helper to replace undefined/null values with deleteField() for Firestore
function cleanForFirestore(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) {
            result[key] = deleteField();
        } else {
            result[key] = value;
        }
    }
    return result;
}

// Command types for undo/redo
export type UndoCommand =
    | { type: 'ADD_PERSON'; treeId: string; personId: string; data: Person }
    | { type: 'DELETE_PERSON'; treeId: string; personId: string; data: Person }
    | { type: 'UPDATE_PERSON'; treeId: string; personId: string; before: Partial<Person>; after: Partial<Person> }
    | {
        type: 'CREATE_RELATIONSHIP';
        treeId: string;
        relationshipType: RelationshipType;
        person1Id: string;
        person2Id: string;
        before: { p1: Partial<Person>; p2: Partial<Person> };
        after: { p1: Partial<Person>; p2: Partial<Person> };
    };

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(treeId: string) {
    const photoHistory = useRef(createPhotoHistory());
    useEffect(() => { photoHistory.current.clear(); }, [treeId]);
    const retainPhotoForUndo = useCallback((url: string, personId: string) => photoHistory.current.retain(url, {treeId, personId}), [treeId]);
    const [undoStack, setUndoStack] = useState<UndoCommand[]>([]);
    const [redoStack, setRedoStack] = useState<UndoCommand[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    useEffect(() => {
        const referenced = new Set<string>();
        for (const command of [...undoStack, ...redoStack]) {
            const states = command.type === 'UPDATE_PERSON' ? [command.before, command.after] :
                command.type === 'ADD_PERSON' || command.type === 'DELETE_PERSON' ? [command.data] : [];
            for (const state of states) if (state.profilePictureUrl) referenced.add(state.profilePictureUrl);
        }
        photoHistory.current.prune(referenced);
    }, [undoStack, redoStack]);

    // Use refs to avoid stale closures in async operations
    const undoStackRef = useRef(undoStack);
    const redoStackRef = useRef(redoStack);
    undoStackRef.current = undoStack;
    redoStackRef.current = redoStack;

    const canUndo = undoStack.length > 0 && !isProcessing;
    const canRedo = redoStack.length > 0 && !isProcessing;

    // Push a new command to the undo stack
    const pushCommand = useCallback((command: UndoCommand) => {
        setUndoStack(prev => {
            const newStack = [...prev, command];
            // Limit history size
            if (newStack.length > MAX_HISTORY_SIZE) {
                return newStack.slice(-MAX_HISTORY_SIZE);
            }
            return newStack;
        });
        // Clear redo stack when a new action is performed
        setRedoStack([]);
    }, []);

    // Execute the reverse of a command
    const reverseCommand = useCallback(async (command: UndoCommand): Promise<UndoCommand> => {
        const peopleColPath = `trees/${command.treeId}/people`;

        switch (command.type) {
            case 'ADD_PERSON': {
                // Reverse of ADD is DELETE
                await deleteDoc(doc(db, peopleColPath, command.personId));
                return {
                    type: 'DELETE_PERSON',
                    treeId: command.treeId,
                    personId: command.personId,
                    data: command.data
                };
            }

            case 'DELETE_PERSON': {
                // Reverse of DELETE is ADD (restore the person)
                const restored = await photoHistory.current.restore(command.data, command.treeId, command.personId, async data => {
                    await setDoc(doc(db, peopleColPath, command.personId), {
                        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
                        updatedAt: serverTimestamp()
                    });
                });
                return {
                    type: 'ADD_PERSON',
                    treeId: command.treeId,
                    personId: command.personId,
                    data: restored
                };
            }

            case 'UPDATE_PERSON': {
                // Reverse of UPDATE is UPDATE with swapped before/after
                const personRef = doc(db, peopleColPath, command.personId);
                const current = await getDoc(personRef);
                const changesPhoto = Object.prototype.hasOwnProperty.call(command.before, 'profilePictureUrl');
                const restored = await photoHistory.current.restore(command.before, command.treeId, command.personId, async data => {
                    await updateDoc(personRef, {
                        ...cleanForFirestore(data),
                        ...(changesPhoto ? {profilePictureUrl: data.profilePictureUrl || deleteField()} : {}),
                        updatedAt: serverTimestamp()
                    });
                }, changesPhoto ? current.data()?.profilePictureUrl : undefined);
                return {
                    type: 'UPDATE_PERSON',
                    treeId: command.treeId,
                    personId: command.personId,
                    before: command.after,
                    after: restored
                };
            }

            case 'CREATE_RELATIONSHIP': {
                // Reverse: restore the "before" state (undo the relationship creation)
                const person1Ref = doc(db, peopleColPath, command.person1Id);
                const person2Ref = doc(db, peopleColPath, command.person2Id);

                // Safety check for before state
                if (!command.before || !command.before.p1 || !command.before.p2) {
                    console.warn('CREATE_RELATIONSHIP command missing before state');
                    return command;
                }

                // Use cleanForFirestore to handle undefined/null values properly
                await updateDoc(person1Ref, {
                    ...cleanForFirestore(command.before.p1),
                    updatedAt: serverTimestamp()
                });
                await updateDoc(person2Ref, {
                    ...cleanForFirestore(command.before.p2),
                    updatedAt: serverTimestamp()
                });

                // Return reversed command for redo (swap before/after)
                // Fallback to using command.before if command.after doesn't exist (legacy)
                const afterState = command.after || command.before;
                return {
                    type: 'CREATE_RELATIONSHIP',
                    treeId: command.treeId,
                    relationshipType: command.relationshipType,
                    person1Id: command.person1Id,
                    person2Id: command.person2Id,
                    before: afterState,  // This becomes what to restore on next reverse
                    after: command.before
                };
            }

            default:
                throw new Error(`Unknown command type`);
        }
    }, []);

    // Undo the last action
    const undo = useCallback(async () => {
        if (undoStackRef.current.length === 0 || isProcessing) return;

        setIsProcessing(true);
        try {
            const command = undoStackRef.current[undoStackRef.current.length - 1];

            // Keep the command available if persistence fails.
            const reversedCommand = await reverseCommand(command);
            setUndoStack(prev => prev.slice(0, -1));
            setRedoStack(prev => [...prev, reversedCommand]);
        } catch (error) {
            console.error('Undo failed:', error);
            // Could show a toast here
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, reverseCommand]);

    // Redo the last undone action
    const redo = useCallback(async () => {
        if (redoStackRef.current.length === 0 || isProcessing) return;

        setIsProcessing(true);
        try {
            const command = redoStackRef.current[redoStackRef.current.length - 1];

            const reversedCommand = await reverseCommand(command);
            setRedoStack(prev => prev.slice(0, -1));
            setUndoStack(prev => [...prev, reversedCommand]);
        } catch (error) {
            console.error('Redo failed:', error);
            // Could show a toast here
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, reverseCommand]);

    // Clear all history (useful when switching trees)
    const clearHistory = useCallback(() => {
        setUndoStack([]);
        setRedoStack([]);
    }, []);

    return {
        pushCommand,
        retainPhotoForUndo,
        undo,
        redo,
        canUndo,
        canRedo,
        isProcessing,
        clearHistory,
        undoStackLength: undoStack.length,
        redoStackLength: redoStack.length
    };
}
