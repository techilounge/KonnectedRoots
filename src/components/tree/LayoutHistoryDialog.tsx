"use client";

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, RotateCcw, Trash2, Calendar, Clock, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
    getLayoutSnapshots,
    restoreLayoutSnapshot,
    deleteLayoutSnapshot,
    getReasonLabel
} from '@/lib/layout-history';
import type { LayoutSnapshot, Person } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface LayoutHistoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    treeId: string;
    people: Person[];
    onRestore: () => void; // Callback to refresh data after restore
}

export default function LayoutHistoryDialog({
    isOpen,
    onClose,
    treeId,
    people,
    onRestore
}: LayoutHistoryDialogProps) {
    const [snapshots, setSnapshots] = useState<LayoutSnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [snapshotToRestore, setSnapshotToRestore] = useState<LayoutSnapshot | null>(null);
    const [snapshotToDelete, setSnapshotToDelete] = useState<LayoutSnapshot | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && treeId) {
            loadSnapshots();
        }
    }, [isOpen, treeId]);

    const loadSnapshots = async () => {
        setLoading(true);
        try {
            const data = await getLayoutSnapshots(treeId);
            setSnapshots(data);
        } catch (error) {
            console.error('Error loading snapshots:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load layout history."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRestore = async () => {
        if (!snapshotToRestore) return;
        const snapshot = snapshotToRestore;

        setRestoringId(snapshot.id);
        try {
            await restoreLayoutSnapshot(treeId, snapshot.id, people);
            toast({
                title: "Layout Restored",
                description: `Restored snapshot from ${snapshot.createdAt?.toDate ? new Date(snapshot.createdAt.toDate()).toLocaleTimeString() : 'Unknown time'}`
            });
            onRestore();
            onClose();
            setSnapshotToRestore(null);
        } catch (error) {
            console.error('Error restoring snapshot:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to restore layout."
            });
        } finally {
            setRestoringId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!snapshotToDelete) return;
        const snapshotId = snapshotToDelete.id;

        setDeletingId(snapshotId);
        try {
            await deleteLayoutSnapshot(treeId, snapshotId);
            setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
            toast({
                title: "Snapshot Deleted",
                description: "Layout snapshot removed from history."
            });
            setSnapshotToDelete(null);
        } catch (error) {
            console.error('Error deleting snapshot:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete snapshot."
            });
        } finally {
            setDeletingId(null);
        }
    };

    const getReasonBadgeVariant = (reason: LayoutSnapshot['reason']) => {
        switch (reason) {
            case 'auto': return 'secondary';
            case 'manual': return 'default';
            case 'pre_delete': return 'destructive';
            case 'pre_merge': return 'destructive';
            case 'pre_import': return 'outline';
            default: return 'outline';
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Layout History
                        </DialogTitle>
                        <DialogDescription>
                            Restore previous card positions. Snapshots are created automatically and manually.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 mt-2">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : snapshots.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No layout history found.</p>
                                <p className="text-xs mt-1">Snapshots are created when you move cards.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[300px] pr-4">
                                <div className="flex flex-col gap-3">
                                    {snapshots.map((snapshot) => (
                                        <div
                                            key={snapshot.id}
                                            className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={getReasonBadgeVariant(snapshot.reason)} className="text-[10px] px-1 py-0 h-5">
                                                            {getReasonLabel(snapshot.reason)}
                                                        </Badge>
                                                        <span className="text-sm font-medium">
                                                            {snapshot.createdAt?.toDate ? formatDistanceToNow(snapshot.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                                        </span>
                                                    </div>
                                                    {snapshot.label && (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                            <Tag className="h-3 w-3" />
                                                            <span>{snapshot.label}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-muted-foreground pl-1">
                                                        {Object.keys(snapshot.positions).length} positions saved
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setSnapshotToDelete(snapshot)}
                                                        disabled={deletingId === snapshot.id || restoringId === snapshot.id}
                                                    >
                                                        {deletingId === snapshot.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-1.5"
                                                        onClick={() => setSnapshotToRestore(snapshot)}
                                                        disabled={restoringId === snapshot.id || deletingId === snapshot.id}
                                                    >
                                                        {restoringId === snapshot.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        )}
                                                        Restore
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!snapshotToRestore} onOpenChange={(open) => !open && setSnapshotToRestore(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore Layout?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to restore this layout? Current positions will be overwritten.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRestore}>Restore</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!snapshotToDelete} onOpenChange={(open) => !open && setSnapshotToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Snapshot?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this snapshot? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
