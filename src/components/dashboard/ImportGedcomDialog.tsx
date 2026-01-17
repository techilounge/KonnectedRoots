"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Loader2, AlertTriangle, CheckCircle, Crown } from 'lucide-react';
import { parseGedcom, convertToPeople, type GedcomParseResult } from '@/lib/gedcom-parser';
import { useEntitlements } from '@/hooks/useEntitlements';
import Link from 'next/link';

interface ImportGedcomDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (treeName: string, people: ReturnType<typeof convertToPeople>) => Promise<void>;
}

export default function ImportGedcomDialog({ isOpen, onClose, onImport }: ImportGedcomDialogProps) {
    const { isPro, isFamily, isFree, loading: entitlementLoading } = useEntitlements();
    const [treeName, setTreeName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<GedcomParseResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const canImport = isPro || isFamily;

    const handleFileChange = useCallback(async (selectedFile: File | null) => {
        setError('');
        setParseResult(null);

        if (!selectedFile) {
            setFile(null);
            return;
        }

        if (!selectedFile.name.toLowerCase().endsWith('.ged')) {
            setError('Please select a valid GEDCOM file (.ged)');
            return;
        }

        setFile(selectedFile);
        setIsParsing(true);

        try {
            const content = await selectedFile.text();
            const result = parseGedcom(content);
            setParseResult(result);

            // Auto-set tree name from filename if empty
            if (!treeName) {
                const baseName = selectedFile.name.replace(/\.ged$/i, '').replace(/[_-]/g, ' ');
                setTreeName(baseName);
            }

            if (result.errors.length > 0) {
                console.warn('GEDCOM parse warnings:', result.errors);
            }
        } catch (err) {
            setError('Failed to parse GEDCOM file. Please check the file format.');
            console.error('Parse error:', err);
        } finally {
            setIsParsing(false);
        }
    }, [treeName]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileChange(droppedFile);
        }
    }, [handleFileChange]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!treeName.trim()) {
            setError('Please enter a tree name.');
            return;
        }
        if (!parseResult || parseResult.individuals.length === 0) {
            setError('No individuals found in the GEDCOM file.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Convert to people - ownerId and treeId will be filled in by parent component
            const people = convertToPeople(parseResult, '', '');
            await onImport(treeName, people);
            handleClose();
        } catch (err) {
            setError('Failed to import. Please try again.');
            console.error('Import error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setTreeName('');
        setFile(null);
        setParseResult(null);
        setError('');
        onClose();
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl flex items-center">
                        <Upload className="mr-2 h-6 w-6 text-primary" />
                        Import GEDCOM File
                    </DialogTitle>
                    <DialogDescription>
                        Import a family tree from another platform using GEDCOM format.
                    </DialogDescription>
                </DialogHeader>

                {entitlementLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : !canImport ? (
                    /* Upgrade prompt for free users */
                    <div className="py-6">
                        <Alert className="border-amber-200 bg-amber-50">
                            <Crown className="h-5 w-5 text-amber-600" />
                            <AlertDescription className="ml-2">
                                <span className="font-semibold">GEDCOM import is a Pro/Family feature.</span>
                                <p className="text-sm mt-1 text-muted-foreground">
                                    Upgrade to import family trees from Ancestry, MyHeritage, FamilySearch, and more.
                                </p>
                                <Button asChild size="sm" className="mt-3">
                                    <Link href="/pricing">View Plans</Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            {/* File Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`
                  border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                  ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                  ${file ? 'bg-green-50 border-green-300' : ''}
                `}
                                onClick={() => document.getElementById('gedcom-file-input')?.click()}
                            >
                                <input
                                    id="gedcom-file-input"
                                    type="file"
                                    accept=".ged"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                    disabled={isLoading}
                                />

                                {isParsing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Parsing file...</p>
                                    </div>
                                ) : file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileText className="h-8 w-8 text-green-600" />
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Click or drag to replace
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                        <p className="font-medium">Drop GEDCOM file here</p>
                                        <p className="text-sm text-muted-foreground">
                                            or click to browse (.ged files)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Parse Results Preview */}
                            {parseResult && (
                                <div className="bg-secondary/50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-medium">File parsed successfully</span>
                                    </div>
                                    <div className="flex gap-4 text-sm">
                                        <Badge variant="secondary">
                                            {parseResult.individuals.length} individuals
                                        </Badge>
                                        <Badge variant="secondary">
                                            {parseResult.families.length} families
                                        </Badge>
                                    </div>
                                    {parseResult.errors.length > 0 && (
                                        <p className="text-xs text-amber-600 mt-2">
                                            {parseResult.errors.length} warnings (some data may be incomplete)
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Tree Name */}
                            <div className="space-y-2">
                                <Label htmlFor="treeName">Tree Name</Label>
                                <Input
                                    id="treeName"
                                    value={treeName}
                                    onChange={(e) => setTreeName(e.target.value)}
                                    placeholder="e.g., Imported Family Tree"
                                    disabled={isLoading}
                                    maxLength={100}
                                />
                            </div>

                            {/* Error Display */}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-primary hover:bg-primary/90"
                                disabled={isLoading || isParsing || !file || !parseResult || !treeName.trim()}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        Import {parseResult?.individuals.length || 0} People
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
