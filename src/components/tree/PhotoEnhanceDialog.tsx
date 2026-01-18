"use client";

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Wand2, Loader2, Sparkles, Image as ImageIcon, ScanEye, ArrowRight, Save } from 'lucide-react';
import { handleEnhancePhoto } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface PhotoEnhanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentPhotoUrl?: string | null;
    onPhotoEnhanced?: (newPhotoUrl: string) => void;
}

export default function PhotoEnhanceDialog({
    isOpen,
    onClose,
    currentPhotoUrl,
    onPhotoEnhanced
}: PhotoEnhanceDialogProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(currentPhotoUrl || null);

    // Enhancement options
    const [options, setOptions] = useState({
        upscale: false,
        restoreFaces: true,
        colorize: false,
        removeNoise: true,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        enhancedImageBase64: string;
        enhancementsApplied: string[];
        description: string;
    } | null>(null);

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when dialog opens with a new URL
    useEffect(() => {
        if (isOpen) {
            setImagePreview(currentPhotoUrl || null);
            setResult(null);
            setImageFile(null);
        }
    }, [isOpen, currentPhotoUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({
                    variant: "destructive",
                    title: "Invalid File",
                    description: "Please upload an image file.",
                });
                return;
            }

            setImageFile(file);
            setResult(null);

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEnhance = async () => {
        if (!imagePreview) return;

        setIsLoading(true);
        setResult(null);

        try {
            // Get base64 data
            let base64Data = '';
            let mimeType = 'image/jpeg';

            if (imagePreview.startsWith('data:')) {
                base64Data = imagePreview.split(',')[1];
                mimeType = imagePreview.split(';')[0].split(':')[1];
            } else {
                // Fetch remote image and convert to base64
                const response = await fetch(imagePreview);
                const blob = await response.blob();
                mimeType = blob.type;
                base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(blob);
                });
            }

            const response = await handleEnhancePhoto({
                imageBase64: base64Data,
                mimeType,
                options,
            });

            if ('error' in response) {
                toast({
                    variant: "destructive",
                    title: "Enhancement Failed",
                    description: response.error,
                });
            } else {
                setResult(response);
                toast({
                    title: "Photo Analyzed",
                    description: "AI analysis complete.",
                });
            }
        } catch (error) {
            console.error("Enhancement error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to process the photo.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (result && onPhotoEnhanced) {
            // In a real implementation with valid base64 output, we'd pass that
            // For this demo, we'll just pass the original or a placeholder if available
            // Since our mock implementation basically echoes the input, we use that
            const dataUrl = `data:${imageFile?.type || 'image/jpeg'};base64,${result.enhancedImageBase64}`;
            onPhotoEnhanced(dataUrl);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Photo Enhancer
                    </DialogTitle>
                    <DialogDescription>
                        Restore, colorize, and enhance old family photos using AI.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 py-4 overflow-hidden">
                    {/* Left Column: Image & Controls */}
                    <div className="md:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2">
                        {/* Image Preview Area */}
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center">
                            {imagePreview ? (
                                <Image
                                    src={imagePreview}
                                    alt="Preview"
                                    fill
                                    className="object-contain"
                                />
                            ) : (
                                <div
                                    className="text-center p-4 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                    <p className="font-medium text-muted-foreground">Select a photo</p>
                                </div>
                            )}

                            {/* Comparison Badge if Result Exists */}
                            {result && (
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <Badge variant="secondary" className="bg-background/80 backdrop-blur">Original</Badge>
                                </div>
                            )}
                        </div>

                        {/* File Input (Hidden) */}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="hidden"
                        />

                        {/* Control Bar */}
                        <div className="flex justify-between items-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {imagePreview ? 'Change Photo' : 'Upload Photo'}
                            </Button>
                        </div>
                    </div>

                    {/* Right Column: Options & Results */}
                    <div className="flex flex-col gap-5 overflow-y-auto pr-2">
                        {/* Options Panel */}
                        <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                            <h4 className="font-medium text-sm flex items-center">
                                <ScanEye className="h-4 w-4 mr-2" />
                                Enhancement Options
                            </h4>

                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="restore"
                                        checked={options.restoreFaces}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, restoreFaces: !!c }))}
                                    />
                                    <Label htmlFor="restore">Restore Faces</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="colorize"
                                        checked={options.colorize}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, colorize: !!c }))}
                                    />
                                    <Label htmlFor="colorize">Colorize B&W</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="upscale"
                                        checked={options.upscale}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, upscale: !!c }))}
                                    />
                                    <Label htmlFor="upscale">Upscale (2x)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="noise"
                                        checked={options.removeNoise}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, removeNoise: !!c }))}
                                    />
                                    <Label htmlFor="noise">Remove Noise</Label>
                                </div>
                            </div>

                            <Button
                                onClick={handleEnhance}
                                disabled={!imagePreview || isLoading}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Enhancing...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        Analyze & Enhance
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Analysis Results */}
                        {result && (
                            <div className="space-y-3 border p-4 rounded-lg bg-primary/5">
                                <h4 className="font-medium text-sm text-primary flex items-center">
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    AI Analysis
                                </h4>
                                <ScrollArea className="h-[150px] pr-2">
                                    <div className="space-y-2 text-sm">
                                        <p className="text-muted-foreground whitespace-pre-wrap">
                                            {result.description}
                                        </p>
                                        <div className="pt-2">
                                            <span className="font-medium text-xs uppercase text-muted-foreground">Applied:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {result.enhancementsApplied.map((tag, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs bg-background">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                                <div className="pt-2 text-xs text-muted-foreground italic">
                                    * Actual image processing requires enabling external APIs.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleApply} disabled={!result} variant="default">
                        <Save className="h-4 w-4 mr-2" />
                        Save Enhancement
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Missing import fix
import { Upload } from 'lucide-react';
