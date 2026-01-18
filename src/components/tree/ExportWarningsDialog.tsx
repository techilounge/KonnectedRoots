"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, XCircle, Download, Edit, Wrench, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ExportIssue, ExportValidationResult } from '@/lib/gedcom-generator';

interface ExportWarningsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    validationResult: ExportValidationResult;
    onExportAnyway: () => void;
    onEditPerson: (personId: string) => void;
    onFixOrphanedReferences?: () => Promise<void>;
    treeName: string;
    hasOrphanedReferences?: boolean;
}

export default function ExportWarningsDialog({
    isOpen,
    onClose,
    validationResult,
    onExportAnyway,
    onEditPerson,
    onFixOrphanedReferences,
    treeName,
    hasOrphanedReferences = false
}: ExportWarningsDialogProps) {
    const [isFixing, setIsFixing] = useState(false);
    const { hasErrors, hasWarnings, issues } = validationResult;
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    // Count orphaned reference warnings
    const orphanedWarnings = warnings.filter(w =>
        w.issue.includes('no longer exists') ||
        w.issue.includes('References a')
    );

    if (!hasErrors && !hasWarnings) {
        return null;
    }

    const handleFixAll = async () => {
        if (!onFixOrphanedReferences) return;
        setIsFixing(true);
        try {
            await onFixOrphanedReferences();
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Pre-Export Check Results
                    </DialogTitle>
                    <DialogDescription>
                        We found {issues.length} {issues.length === 1 ? 'issue' : 'issues'} that may affect how "{treeName}" appears when imported into other genealogy software.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[400px] pr-4">
                    <div className="space-y-4 py-2">
                        {/* Fix All Orphaned References Banner */}
                        {orphanedWarnings.length > 0 && onFixOrphanedReferences && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium text-blue-800">
                                            {orphanedWarnings.length} orphaned reference{orphanedWarnings.length > 1 ? 's' : ''} detected
                                        </p>
                                        <p className="text-xs text-blue-600">
                                            These are relationships pointing to deleted people. Click to auto-fix.
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleFixAll}
                                        disabled={isFixing}
                                        className="shrink-0"
                                    >
                                        {isFixing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                Fixing...
                                            </>
                                        ) : (
                                            <>
                                                <Wrench className="h-4 w-4 mr-1" />
                                                Fix All
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Errors Section */}
                        {errors.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2">
                                    <XCircle className="h-4 w-4" />
                                    Errors ({errors.length})
                                </h3>
                                <div className="space-y-2">
                                    {errors.map((issue, idx) => (
                                        <IssueCard key={`error-${idx}`} issue={issue} onEdit={onEditPerson} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warnings Section */}
                        {warnings.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-600 mb-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Warnings ({warnings.length})
                                </h3>
                                <div className="space-y-2">
                                    {warnings.map((issue, idx) => (
                                        <IssueCard key={`warning-${idx}`} issue={issue} onEdit={onEditPerson} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button
                        onClick={onExportAnyway}
                        variant={hasErrors ? "destructive" : "default"}
                        className="w-full sm:w-auto"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {hasErrors ? 'Export Anyway (Not Recommended)' : 'Export with Warnings'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function IssueCard({ issue, onEdit }: { issue: ExportIssue; onEdit: (personId: string) => void }) {
    return (
        <div className={`border rounded-lg p-3 ${issue.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {issue.personName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {issue.issue}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Fix:</span> {issue.howToFix}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(issue.personId)}
                    className="shrink-0"
                >
                    <Edit className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
