"use client";

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Loader2, Copy, Check, X, Calendar, MapPin, Users } from 'lucide-react';
import { handleExtractDocumentText } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface DocumentOCRDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDataExtracted?: (data: {
        names?: string[];
        dates?: string[];
        places?: string[];
        text?: string;
    }) => void;
}

export default function DocumentOCRDialog({
    isOpen,
    onClose,
    onDataExtracted
}: DocumentOCRDialogProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [documentType, setDocumentType] = useState<'letter' | 'certificate' | 'record' | 'diary' | 'other'>('other');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        extractedText: string;
        confidence: 'high' | 'medium' | 'low';
        detectedLanguage: string;
        genealogyData?: {
            names?: string[];
            dates?: string[];
            places?: string[];
            relationships?: string[];
        };
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({
                    variant: "destructive",
                    title: "Invalid File",
                    description: "Please upload an image file (PNG, JPG, etc.)",
                });
                return;
            }

            setImageFile(file);
            setResult(null);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExtract = async () => {
        if (!imageFile || !imagePreview) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Please upload an image first.",
            });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            // Extract base64 data from preview (remove data:image/xxx;base64, prefix)
            const base64Data = imagePreview.split(',')[1];

            const response = await handleExtractDocumentText({
                imageBase64: base64Data,
                mimeType: imageFile.type,
                documentType,
            });

            if ('error' in response) {
                toast({
                    variant: "destructive",
                    title: "Extraction Failed",
                    description: response.error,
                });
            } else {
                setResult(response);
                toast({
                    title: "Text Extracted",
                    description: `Extracted ${response.extractedText.length} characters with ${response.confidence} confidence.`,
                });
            }
        } catch (error) {
            console.error("OCR error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to process the image.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (result?.extractedText) {
            await navigator.clipboard.writeText(result.extractedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "Copied to clipboard" });
        }
    };

    const handleUseData = () => {
        if (result && onDataExtracted) {
            onDataExtracted({
                names: result.genealogyData?.names,
                dates: result.genealogyData?.dates,
                places: result.genealogyData?.places,
                text: result.extractedText,
            });
            handleClose();
        }
    };

    const handleClose = () => {
        setImageFile(null);
        setImagePreview(null);
        setResult(null);
        onClose();
    };

    const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
        const variants = {
            high: 'default' as const,
            medium: 'secondary' as const,
            low: 'destructive' as const,
        };
        return <Badge variant={variants[confidence]}>{confidence} confidence</Badge>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Document Scanner (OCR)
                    </DialogTitle>
                    <DialogDescription>
                        Upload a photo of a handwritten document to extract text.
                        Works with letters, certificates, records, and more.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* Upload Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Document Image</Label>
                            <Select value={documentType} onValueChange={(v) => setDocumentType(v as typeof documentType)}>
                                <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="letter">Letter</SelectItem>
                                    <SelectItem value="certificate">Certificate</SelectItem>
                                    <SelectItem value="record">Record</SelectItem>
                                    <SelectItem value="diary">Diary</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="hidden"
                        />

                        {imagePreview ? (
                            <div className="relative aspect-[4/3] border rounded-md overflow-hidden bg-muted">
                                <Image
                                    src={imagePreview}
                                    alt="Document preview"
                                    fill
                                    className="object-contain"
                                />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-6 w-6"
                                    onClick={() => {
                                        setImageFile(null);
                                        setImagePreview(null);
                                        setResult(null);
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div
                                className="aspect-[4/3] border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/30"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">Click to upload</p>
                                <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                            </div>
                        )}

                        <Button
                            onClick={handleExtract}
                            disabled={!imageFile || isLoading}
                            className="w-full"
                        >
                            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            <FileText className="h-4 w-4 mr-1" />
                            Extract Text
                        </Button>
                    </div>

                    {/* Results Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Extracted Text</Label>
                            {result && getConfidenceBadge(result.confidence)}
                        </div>

                        <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">Extracting text...</span>
                                </div>
                            ) : result ? (
                                <p className="text-sm whitespace-pre-wrap">{result.extractedText}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground italic text-center mt-8">
                                    Upload an image and click &quot;Extract Text&quot;
                                </p>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                {/* Genealogy Data */}
                {result?.genealogyData && (
                    <div className="border-t pt-3 space-y-2">
                        <span className="text-sm font-medium">Genealogy Data Found:</span>
                        <div className="grid grid-cols-3 gap-2">
                            {result.genealogyData.names && result.genealogyData.names.length > 0 && (
                                <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                        <Users className="h-3 w-3" /> Names
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {result.genealogyData.names.map((name, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">{name}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {result.genealogyData.dates && result.genealogyData.dates.length > 0 && (
                                <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                        <Calendar className="h-3 w-3" /> Dates
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {result.genealogyData.dates.map((date, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">{date}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {result.genealogyData.places && result.genealogyData.places.length > 0 && (
                                <div className="p-2 rounded-md bg-muted/50">
                                    <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                        <MapPin className="h-3 w-3" /> Places
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {result.genealogyData.places.map((place, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">{place}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {result.detectedLanguage && (
                            <p className="text-xs text-muted-foreground">
                                Detected language: <strong>{result.detectedLanguage}</strong>
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    {result && (
                        <>
                            <Button variant="outline" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                                {copied ? 'Copied!' : 'Copy Text'}
                            </Button>
                            {onDataExtracted && (
                                <Button onClick={handleUseData}>
                                    Use Extracted Data
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
