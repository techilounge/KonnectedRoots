"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Languages, Loader2, Copy, Check, Wand2 } from 'lucide-react';
import { handleTranslateDocument } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface TranslationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialText?: string;
    onUseTranslation?: (translatedText: string) => void;
}

const LANGUAGES = [
    { code: 'English', label: 'English' },
    { code: 'Spanish', label: 'Spanish' },
    { code: 'French', label: 'French' },
    { code: 'German', label: 'German' },
    { code: 'Italian', label: 'Italian' },
    { code: 'Portuguese', label: 'Portuguese' },
    { code: 'Dutch', label: 'Dutch' },
    { code: 'Polish', label: 'Polish' },
    { code: 'Russian', label: 'Russian' },
    { code: 'Ukrainian', label: 'Ukrainian' },
    { code: 'Swedish', label: 'Swedish' },
    { code: 'Norwegian', label: 'Norwegian' },
    { code: 'Danish', label: 'Danish' },
    { code: 'Hebrew', label: 'Hebrew' },
    { code: 'Yiddish', label: 'Yiddish' },
    { code: 'Chinese', label: 'Chinese' },
    { code: 'Japanese', label: 'Japanese' },
];

export default function TranslationDialog({
    isOpen,
    onClose,
    initialText = '',
    onUseTranslation
}: TranslationDialogProps) {
    const [inputText, setInputText] = useState(initialText);
    const [targetLanguage, setTargetLanguage] = useState('English');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        translatedText: string;
        detectedLanguage: string;
        genealogyTerms?: { original: string; translation: string; context?: string }[];
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const handleTranslate = async () => {
        if (!inputText.trim()) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Please enter text to translate.",
            });
            return;
        }

        setIsLoading(true);
        setResult(null);

        const response = await handleTranslateDocument({
            text: inputText,
            targetLanguage,
        });

        setIsLoading(false);

        if ('error' in response) {
            toast({
                variant: "destructive",
                title: "Translation Failed",
                description: response.error,
            });
        } else {
            setResult(response);
            toast({
                title: "Translation Complete",
                description: `Translated from ${response.detectedLanguage}`,
            });
        }
    };

    const handleCopy = async () => {
        if (result?.translatedText) {
            await navigator.clipboard.writeText(result.translatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "Copied to clipboard" });
        }
    };

    const handleUse = () => {
        if (result?.translatedText && onUseTranslation) {
            onUseTranslation(result.translatedText);
            onClose();
        }
    };

    const handleClose = () => {
        setInputText('');
        setResult(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Languages className="h-5 w-5 text-primary" />
                        Document Translation
                    </DialogTitle>
                    <DialogDescription>
                        Translate foreign-language documents for genealogy research.
                        Genealogy terms like birth, death, and marriage will be highlighted.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* Input Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Original Text</Label>
                            <Badge variant="outline" className="text-xs">Auto-detect language</Badge>
                        </div>
                        <Textarea
                            placeholder="Paste or type the text you want to translate..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="min-h-[200px] resize-none"
                        />
                    </div>

                    {/* Output Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Translation</Label>
                            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                <SelectTrigger className="w-32 h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map(lang => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            {lang.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">Translating...</span>
                                </div>
                            ) : result ? (
                                <div className="space-y-2">
                                    <p className="text-sm whitespace-pre-wrap">{result.translatedText}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    Translation will appear here...
                                </p>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                {/* Detected Language & Genealogy Terms */}
                {result && (
                    <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Detected language:</span>
                            <Badge variant="secondary">{result.detectedLanguage}</Badge>
                        </div>

                        {result.genealogyTerms && result.genealogyTerms.length > 0 && (
                            <div>
                                <span className="text-sm font-medium">Genealogy Terms Found:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {result.genealogyTerms.map((term, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                            {term.original} → {term.translation}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
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
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                            {onUseTranslation && (
                                <Button onClick={handleUse}>
                                    Use Translation
                                </Button>
                            )}
                        </>
                    )}
                    {!result && (
                        <Button onClick={handleTranslate} disabled={isLoading || !inputText.trim()}>
                            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            <Wand2 className="h-4 w-4 mr-1" />
                            Translate
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
