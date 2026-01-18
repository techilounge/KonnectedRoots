"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react';
import type { ValidationResult, ValidationIssue } from '@/lib/tree-validator';

interface ValidationPanelProps {
    validationResult: ValidationResult | null;
    onEditPerson: (personId: string) => void;
    onClose: () => void;
}

export default function ValidationPanel({
    validationResult,
    onEditPerson,
    onClose
}: ValidationPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!validationResult) return null;

    const { hasErrors, hasWarnings, issues } = validationResult;
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    // If no issues, show success message
    if (!hasErrors && !hasWarnings) {
        return (
            <div className="fixed bottom-4 right-4 w-80 bg-green-50 border border-green-200 rounded-lg shadow-lg z-50">
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">No issues found!</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 bg-card border rounded-lg shadow-lg z-50 max-h-[60vh] flex flex-col">
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between bg-muted/50 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="font-semibold">
                        Tree Validation
                    </span>
                    <span className="text-sm text-muted-foreground">
                        ({errors.length} errors, {warnings.length} warnings)
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <ScrollArea className="flex-1 max-h-[400px]">
                    <div className="p-3 space-y-3">
                        {/* Errors */}
                        {errors.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                                    <XCircle className="h-4 w-4" />
                                    Errors ({errors.length})
                                </h4>
                                <div className="space-y-2">
                                    {errors.map((issue, idx) => (
                                        <IssueCard
                                            key={`error-${idx}`}
                                            issue={issue}
                                            onEdit={() => onEditPerson(issue.personId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warnings */}
                        {warnings.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    Warnings ({warnings.length})
                                </h4>
                                <div className="space-y-2">
                                    {warnings.map((issue, idx) => (
                                        <IssueCard
                                            key={`warning-${idx}`}
                                            issue={issue}
                                            onEdit={() => onEditPerson(issue.personId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}

function IssueCard({ issue, onEdit }: { issue: ValidationIssue; onEdit: () => void }) {
    const bgColor = issue.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';

    return (
        <div className={`border rounded-md p-2 ${bgColor}`}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {issue.personName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {issue.message}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 text-xs"
                    onClick={onEdit}
                >
                    Fix
                </Button>
            </div>
        </div>
    );
}
