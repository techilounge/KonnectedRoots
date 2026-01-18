"use client";

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Wand2, Loader2, Sparkles, Image as ImageIcon, ScanEye, Save, Upload, ArrowLeftRight } from 'lucide-react';
import { handleEnhancePhoto } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { consumeAIActions } from '@/lib/billing/usage';
import { AI_ACTION_WEIGHTS } from '@/lib/billing/constants';
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
    const [showEnhanced, setShowEnhanced] = useState(false);

    // Enhancement options
    const [options, setOptions] = useState({
        upscale: false,
        restoreFaces: true,
        colorize: true,
        removeNoise: true,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        enhancedImageBase64: string;
        mimeType: string;
        enhancementsApplied: string[];
        description: string;
        originalSize?: { width: number; height: number };
        newSize?: { width: number; height: number };
    } | null>(null);

    const { toast } = useToast();
    const { user, refreshUserProfile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when dialog opens with a new URL
    useEffect(() => {
        if (isOpen) {
            setImagePreview(currentPhotoUrl || null);
            setResult(null);
            setImageFile(null);
            setShowEnhanced(false);
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
            setShowEnhanced(false);

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEnhance = async () => {
        if (!imagePreview || !user) return;

        setIsLoading(true);
        setResult(null);

        // 1. Consume Credits immediately
        const consumption = await consumeAIActions(user.uid, AI_ACTION_WEIGHTS.enhance_photo);
        if (!consumption.success) {
            toast({
                variant: "destructive",
                title: "Insufficient Credits",
                description: `You need ${AI_ACTION_WEIGHTS.enhance_photo} credits for this action. You have ${consumption.remaining} left.`,
            });
            setIsLoading(false);
            return;
        }

        // Refresh to show deduction
        await refreshUserProfile();

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
                // REFUND on error
                await consumeAIActions(user.uid, -AI_ACTION_WEIGHTS.enhance_photo);
                await refreshUserProfile();

                toast({
                    variant: "destructive",
                    title: "Enhancement Failed",
                    description: response.error,
                });
            } else {
                setResult(response);
                setShowEnhanced(true);

                // Refresh credit balance again just in case server logic changed
                await refreshUserProfile();

                toast({
                    title: "Photo Enhanced!",
                    description: `Applied: ${response.enhancementsApplied.join(', ')}`,
                });
            }
        } catch (error) {
            console.error("Enhancement error:", error);
            // REFUND on error
            await consumeAIActions(user.uid, -AI_ACTION_WEIGHTS.enhance_photo);
            await refreshUserProfile();

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
            const dataUrl = `data:${result.mimeType};base64,${result.enhancedImageBase64}`;
            onPhotoEnhanced(dataUrl);
            onClose();
        }
    };

    // Get the current display image URL
    const displayImageUrl = result && showEnhanced
        ? `data:${result.mimeType};base64,${result.enhancedImageBase64}`
        : imagePreview;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Photo Enhancer
                    </DialogTitle>
                    <DialogDescription>
                        Sharpen, enhance contrast, reduce noise, and upscale old family photos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 py-4 overflow-hidden">
                    {/* Left Column: Image Preview */}
                    <div className="md:col-span-2 flex flex-col gap-4 overflow-y-auto pr-2">
                        {/* Image Preview Area */}
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border flex items-center justify-center min-h-[300px]">
                            {displayImageUrl ? (
                                <Image
                                    src={displayImageUrl}
                                    alt={showEnhanced ? "Enhanced Preview" : "Original Preview"}
                                    fill
                                    className="object-contain"
                                />
                            ) : (
                                <div
                                    className="text-center p-4 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                    <p className="font-medium text-muted-foreground">Click to select a photo</p>
                                </div>
                            )}

                            {/* Before/After Toggle Badge */}
                            {result && (
                                <div className="absolute top-4 left-4">
                                    <Badge
                                        variant={showEnhanced ? "default" : "secondary"}
                                        className="cursor-pointer select-none"
                                        onClick={() => setShowEnhanced(!showEnhanced)}
                                    >
                                        {showEnhanced ? "✨ Enhanced" : "Original"}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Control Bar */}
                        <div className="flex justify-between items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {imagePreview ? 'Change Photo' : 'Upload Photo'}
                            </Button>

                            {/* Before/After Toggle Button */}
                            {result && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowEnhanced(!showEnhanced)}
                                >
                                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                                    {showEnhanced ? 'Show Original' : 'Show Enhanced'}
                                </Button>
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
                                    <Label htmlFor="restore">Sharpen & Clarify</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="colorize"
                                        checked={options.colorize}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, colorize: !!c }))}
                                    />
                                    <Label htmlFor="colorize">Normalize Colors</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="upscale"
                                        checked={options.upscale}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, upscale: !!c }))}
                                    />
                                    <Label htmlFor="upscale">Upscale (1.5x)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="noise"
                                        checked={options.removeNoise}
                                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, removeNoise: !!c }))}
                                    />
                                    <Label htmlFor="noise">Reduce Noise</Label>
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
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        Enhance Photo (15 credits)
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Enhancement Results */}
                        {result && (
                            <div className="space-y-3 border p-4 rounded-lg bg-green-500/10 border-green-500/30">
                                <h4 className="font-medium text-sm text-green-700 dark:text-green-400 flex items-center">
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Enhancement Complete
                                </h4>
                                <ScrollArea className="h-[120px] pr-2">
                                    <div className="space-y-2 text-sm">
                                        <p className="text-muted-foreground">
                                            {result.description}
                                        </p>
                                        {result.originalSize && result.newSize && (
                                            <p className="text-xs text-muted-foreground">
                                                Size: {result.originalSize.width}×{result.originalSize.height} → {result.newSize.width}×{result.newSize.height}
                                            </p>
                                        )}
                                        <div className="pt-2">
                                            <span className="font-medium text-xs uppercase text-muted-foreground">Applied:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {result.enhancementsApplied.map((tag, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleApply} disabled={!result} variant="default">
                        <Save className="h-4 w-4 mr-2" />
                        Use Enhanced Photo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
