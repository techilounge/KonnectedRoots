/**
 * Layout History - Save and restore tree layouts
 * 
 * Stores timestamped snapshots of all card positions that users can restore.
 * Firestore Path: trees/{treeId}/layoutHistory/{snapshotId}
 */

import { db } from '@/lib/firebase/clients';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    writeBatch,
    query,
    orderBy,
    limit,
    serverTimestamp
} from 'firebase/firestore';
import type { Person, LayoutSnapshot } from '@/types';

const MAX_SNAPSHOTS = 20;

/**
 * Get the layoutHistory collection reference for a tree
 */
function getLayoutHistoryRef(treeId: string) {
    return collection(db, 'trees', treeId, 'layoutHistory');
}

/**
 * Save a layout snapshot
 */
export async function saveLayoutSnapshot(
    treeId: string,
    people: Person[],
    userId: string,
    reason: LayoutSnapshot['reason'],
    viewOffset: { x: number; y: number } = { x: 0, y: 0 },
    zoomLevel: number = 1,
    label?: string
): Promise<string> {
    // Build positions map
    const positions: { [personId: string]: { x: number; y: number } } = {};
    people.forEach(person => {
        positions[person.id] = {
            x: person.x ?? 0,
            y: person.y ?? 0
        };
    });

    // Create snapshot document
    const snapshotRef = doc(getLayoutHistoryRef(treeId));
    const snapshot: Omit<LayoutSnapshot, 'id'> & { id: string } = {
        id: snapshotRef.id,
        treeId,
        createdAt: serverTimestamp(),
        createdBy: userId,
        reason,
        viewOffset,
        zoomLevel,
        positions,
        ...(label && { label })
    };

    await setDoc(snapshotRef, snapshot);
    console.log(`[LayoutHistory] Snapshot saved: ${snapshotRef.id}`);

    // Cleanup old snapshots
    await cleanupOldSnapshots(treeId, MAX_SNAPSHOTS);

    return snapshotRef.id;
}

/**
 * Get all layout snapshots for a tree, ordered by most recent first
 */
export async function getLayoutSnapshots(
    treeId: string,
    maxResults: number = MAX_SNAPSHOTS
): Promise<LayoutSnapshot[]> {
    const q = query(
        getLayoutHistoryRef(treeId),
        orderBy('createdAt', 'desc'),
        limit(maxResults)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as LayoutSnapshot);
}

/**
 * Restore a layout snapshot - applies all positions to people
 */
export async function restoreLayoutSnapshot(
    treeId: string,
    snapshotId: string,
    people: Person[]
): Promise<{ viewOffset: { x: number; y: number }; zoomLevel: number }> {
    // Get the snapshot
    const snapshots = await getLayoutSnapshots(treeId, 100);
    const snapshot = snapshots.find(s => s.id === snapshotId);

    if (!snapshot) {
        throw new Error('Snapshot not found');
    }

    // Apply positions to all people using batch write
    const batch = writeBatch(db);
    const peopleCol = collection(db, 'trees', treeId, 'people');

    let restoredCount = 0;
    for (const person of people) {
        const savedPosition = snapshot.positions[person.id];
        if (savedPosition) {
            const personRef = doc(peopleCol, person.id);
            batch.update(personRef, {
                x: savedPosition.x,
                y: savedPosition.y,
                updatedAt: serverTimestamp()
            });
            restoredCount++;
        }
    }

    await batch.commit();

    return {
        viewOffset: snapshot.viewOffset,
        zoomLevel: snapshot.zoomLevel
    };
}

/**
 * Delete a specific layout snapshot
 */
export async function deleteLayoutSnapshot(
    treeId: string,
    snapshotId: string
): Promise<void> {
    const snapshotRef = doc(getLayoutHistoryRef(treeId), snapshotId);
    await deleteDoc(snapshotRef);
}

/**
 * Cleanup old snapshots, keeping only the most recent ones
 */
export async function cleanupOldSnapshots(
    treeId: string,
    maxSnapshots: number
): Promise<void> {
    const snapshots = await getLayoutSnapshots(treeId, 100);

    if (snapshots.length <= maxSnapshots) {
        return;
    }

    // Delete oldest snapshots (they're ordered desc, so oldest are at the end)
    const snapshotsToDelete = snapshots.slice(maxSnapshots);

    for (const snapshot of snapshotsToDelete) {
        await deleteLayoutSnapshot(treeId, snapshot.id);
    }
}

/**
 * Get the reason display text
 */
export function getReasonLabel(reason: LayoutSnapshot['reason']): string {
    switch (reason) {
        case 'auto': return 'Auto-save';
        case 'manual': return 'Manual Save';
        case 'pre_delete': return 'Before Delete';
        case 'pre_merge': return 'Before Merge';
        case 'pre_import': return 'Before Import';
        default: return reason;
    }
}
