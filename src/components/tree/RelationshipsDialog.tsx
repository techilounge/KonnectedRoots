"use client";

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Heart, Users, ArrowDown } from 'lucide-react';
import type { Person } from '@/types';

interface RelationshipsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person | null;
    people: Person[];
    onDeleteRelationship: (personId: string, relatedPersonId: string, type: 'spouse' | 'parent' | 'child') => void;
}

export default function RelationshipsDialog({
    isOpen,
    onClose,
    person,
    people,
    onDeleteRelationship,
}: RelationshipsDialogProps) {
    // Compute relationships only when person exists
    const peopleMap = person ? new Map(people.map(p => [p.id, p])) : new Map();

    const spouses = person
        ? (person.spouseIds || []).map(id => peopleMap.get(id)).filter((p): p is Person => !!p)
        : [];

    const parents = person
        ? [person.parentId1, person.parentId2].filter(Boolean).map(id => peopleMap.get(id!)).filter((p): p is Person => !!p)
        : [];

    const children = person
        ? (person.childrenIds || []).map(id => peopleMap.get(id)).filter((p): p is Person => !!p)
        : [];

    const hasRelationships = spouses.length > 0 || parents.length > 0 || children.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5 text-primary" />
                        Relationships for {person?.firstName || 'Person'}
                    </DialogTitle>
                    <DialogDescription>
                        Manage this person's family connections.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[50vh]">
                    {!person ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No person selected.</p>
                        </div>
                    ) : !hasRelationships ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No relationships found.</p>
                            <p className="text-xs mt-1">Use the connector dots to link people.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {/* Spouses */}
                            {spouses.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center mb-2">
                                        <Heart className="mr-2 h-4 w-4 text-pink-500" />
                                        Spouses
                                    </h4>
                                    <div className="space-y-1">
                                        {spouses.map(spouse => (
                                            <div key={spouse.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{spouse.firstName} {spouse.lastName || ''}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => onDeleteRelationship(person.id, spouse.id, 'spouse')}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Parents */}
                            {parents.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center mb-2">
                                        <ArrowDown className="mr-2 h-4 w-4 text-blue-500 rotate-180" />
                                        Parents
                                    </h4>
                                    <div className="space-y-1">
                                        {parents.map(parent => (
                                            <div key={parent.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{parent.firstName} {parent.lastName || ''}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => onDeleteRelationship(person.id, parent.id, 'parent')}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Children */}
                            {children.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold flex items-center mb-2">
                                        <ArrowDown className="mr-2 h-4 w-4 text-green-500" />
                                        Children
                                    </h4>
                                    <div className="space-y-1">
                                        {children.map(child => (
                                            <div key={child.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{child.firstName} {child.lastName || ''}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => onDeleteRelationship(person.id, child.id, 'child')}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
