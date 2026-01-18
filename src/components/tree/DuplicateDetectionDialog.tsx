"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Users, Check, X, ChevronRight, AlertCircle } from 'lucide-react';
import type { DuplicateMatch, DuplicateDetectionResult } from '@/lib/duplicate-detector';
import { getConfidenceLabel, getConfidenceColor } from '@/lib/duplicate-detector';
import type { Person } from '@/types';

interface DuplicateDetectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    result: DuplicateDetectionResult | null;
    onMerge: (keepId: string, removeId: string) => void;
    onDismiss: (person1Id: string, person2Id: string) => void;
}

export default function DuplicateDetectionDialog({
    isOpen,
    onClose,
    result,
    onMerge,
    onDismiss
}: DuplicateDetectionDialogProps) {
    const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());

    if (!result) return null;

    const visibleMatches = result.matches.filter(match => {
        const pairKey = [match.person1.id, match.person2.id].sort().join('|');
        return !dismissedPairs.has(pairKey);
    });

    const handleDismiss = (match: DuplicateMatch) => {
        const pairKey = [match.person1.id, match.person2.id].sort().join('|');
        setDismissedPairs(prev => new Set([...prev, pairKey]));
        onDismiss(match.person1.id, match.person2.id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Duplicate Detection
                    </DialogTitle>
                    <DialogDescription>
                        {visibleMatches.length > 0
                            ? `Found ${visibleMatches.length} potential duplicate${visibleMatches.length > 1 ? 's' : ''} in your tree.`
                            : 'No duplicates found in your tree.'}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[500px] pr-4">
                    {visibleMatches.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            <Check className="h-12 w-12 mx-auto mb-3 text-green-500" />
                            <p className="font-medium">No duplicates detected!</p>
                            <p className="text-sm">Your family tree looks clean.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {visibleMatches.map((match, idx) => (
                                <DuplicateCard
                                    key={idx}
                                    match={match}
                                    onMerge={onMerge}
                                    onDismiss={() => handleDismiss(match)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DuplicateCard({
    match,
    onMerge,
    onDismiss
}: {
    match: DuplicateMatch;
    onMerge: (keepId: string, removeId: string) => void;
    onDismiss: () => void;
}) {
    const { person1, person2, confidence, reasons } = match;
    const confidenceLabel = getConfidenceLabel(confidence);
    const confidenceColor = getConfidenceColor(confidence);

    const getBadgeVariant = () => {
        if (confidence >= 80) return 'destructive';
        if (confidence >= 60) return 'default';
        return 'secondary';
    };

    return (
        <div className="border rounded-lg p-4 bg-card">
            {/* Header with confidence */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <AlertCircle className={`h-4 w-4 ${confidenceColor}`} />
                    <Badge variant={getBadgeVariant()}>
                        {confidence}% {confidenceLabel} confidence
                    </Badge>
                </div>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                <PersonCard person={person1} />
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                <PersonCard person={person2} />
            </div>

            {/* Reasons */}
            <div className="mt-3 text-xs text-muted-foreground">
                <strong>Match reasons:</strong> {reasons.join(' • ')}
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2 justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                >
                    <X className="h-4 w-4 mr-1" />
                    Not Duplicates
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMerge(person1.id, person2.id)}
                >
                    Keep Left
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMerge(person2.id, person1.id)}
                >
                    Keep Right
                </Button>
            </div>
        </div>
    );
}

function PersonCard({ person }: { person: Person }) {
    const fullName = `${person.firstName || 'Unknown'} ${person.lastName || ''}`.trim();

    return (
        <div className="p-3 bg-muted/50 rounded-md">
            <p className="font-medium text-sm truncate">{fullName}</p>
            {person.birthDate && (
                <p className="text-xs text-muted-foreground">Born: {person.birthDate}</p>
            )}
            {person.placeOfBirth && (
                <p className="text-xs text-muted-foreground truncate">{person.placeOfBirth}</p>
            )}
            {person.gender && (
                <p className="text-xs text-muted-foreground capitalize">{person.gender}</p>
            )}
        </div>
    );
}
