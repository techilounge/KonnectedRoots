"use client";

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FileImage, FileText, FileCode, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { Person, FamilyTree } from '@/types';
import { downloadGedcom } from '@/lib/gedcom-generator';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    canvasRef: React.RefObject<HTMLDivElement>;
    people: Person[];
    tree: FamilyTree | null;
}

type ExportType = 'png' | 'pdf' | 'gedcom';
type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ExportDialog({
    isOpen,
    onClose,
    canvasRef,
    people,
    tree,
}: ExportDialogProps) {
    const [exportStatus, setExportStatus] = useState<Record<ExportType, ExportStatus>>({
        png: 'idle',
        pdf: 'idle',
        gedcom: 'idle',
    });

    const treeName = tree?.title || 'Family_Tree';

    // Convert cross-origin images to base64 data URLs to fix html2canvas CORS issues
    // Falls back to generating initials-based avatar if image loading fails
    const preloadImages = async (container: HTMLElement): Promise<() => void> => {
        const images = container.querySelectorAll('img');
        const originalSrcs: Map<HTMLImageElement, string> = new Map();

        // Generate a simple colored initials avatar as data URL
        const generateInitialsAvatar = (name: string): string => {
            const initials = (name || 'P')[0].toUpperCase();
            const colors = ['#4F46E5', '#059669', '#DC2626', '#7C3AED', '#EA580C', '#0891B2'];
            const color = colors[initials.charCodeAt(0) % colors.length];

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
                <rect width="80" height="80" fill="${color}" rx="40"/>
                <text x="40" y="52" font-size="36" fill="white" text-anchor="middle" font-family="Arial, sans-serif">${initials}</text>
            </svg>`;
            return `data:image/svg+xml;base64,${btoa(svg)}`;
        };

        const loadImage = (src: string): Promise<string> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';

                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || 80;
                        canvas.height = img.naturalHeight || 80;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (e) {
                        resolve('');
                    }
                };

                img.onerror = () => resolve('');

                // Add cache buster
                img.src = src.includes('?') ? `${src}&_cors=${Date.now()}` : `${src}?_cors=${Date.now()}`;

                // Timeout after 3 seconds
                setTimeout(() => resolve(''), 3000);
            });
        };

        await Promise.all(
            Array.from(images).map(async (img) => {
                if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return;
                if (img.src.includes('placehold.co')) return;

                try {
                    originalSrcs.set(img, img.src);
                    const dataUrl = await loadImage(img.src);
                    if (dataUrl) {
                        img.src = dataUrl;
                    } else {
                        // Fallback to initials avatar
                        const name = img.alt || 'Person';
                        img.src = generateInitialsAvatar(name);
                    }
                } catch (e) {
                    console.warn('Could not preload image:', img.src);
                    const name = img.alt || 'Person';
                    img.src = generateInitialsAvatar(name);
                }
            })
        );

        return () => {
            originalSrcs.forEach((src, img) => {
                img.src = src;
            });
        };
    };

    const handleExportPNG = async () => {
        if (!canvasRef.current) return;

        setExportStatus(prev => ({ ...prev, png: 'loading' }));

        try {
            // Preload images to convert them to base64
            const cleanup = await preloadImages(canvasRef.current);

            const canvas = await html2canvas(canvasRef.current, {
                backgroundColor: '#ffffff',
                scale: 2, // Higher quality
                logging: false,
                useCORS: true,
                allowTaint: false,
                onclone: (clonedDoc) => {
                    // Helper to inline ALL computed styles for an element
                    const inlineStyles = (el: Element) => {
                        const computed = getComputedStyle(el);
                        const htmlEl = el as HTMLElement;

                        // Core layout
                        htmlEl.style.display = computed.display;
                        htmlEl.style.position = computed.position;
                        htmlEl.style.width = computed.width;
                        htmlEl.style.height = computed.height;
                        htmlEl.style.padding = computed.padding;
                        htmlEl.style.margin = computed.margin;
                        htmlEl.style.overflow = computed.overflow;

                        // Flexbox
                        htmlEl.style.flexDirection = computed.flexDirection;
                        htmlEl.style.alignItems = computed.alignItems;
                        htmlEl.style.justifyContent = computed.justifyContent;
                        htmlEl.style.gap = computed.gap;
                        htmlEl.style.flexShrink = computed.flexShrink;

                        // Background & Borders
                        htmlEl.style.backgroundColor = computed.backgroundColor;
                        htmlEl.style.borderWidth = computed.borderWidth;
                        htmlEl.style.borderStyle = computed.borderStyle;
                        htmlEl.style.borderColor = computed.borderColor;
                        htmlEl.style.borderRadius = computed.borderRadius;
                        htmlEl.style.boxShadow = computed.boxShadow;

                        // Text
                        htmlEl.style.color = computed.color;
                        htmlEl.style.fontSize = computed.fontSize;
                        htmlEl.style.fontWeight = computed.fontWeight;
                        htmlEl.style.fontFamily = computed.fontFamily;
                        htmlEl.style.textOverflow = computed.textOverflow;
                        htmlEl.style.whiteSpace = computed.whiteSpace;
                        htmlEl.style.fontStyle = computed.fontStyle;

                        // Visibility
                        htmlEl.style.opacity = computed.opacity;
                        htmlEl.style.visibility = computed.visibility;
                    };

                    // Expand foreignObject elements to accommodate borders (they clip the 2px border)
                    const foreignObjects = clonedDoc.querySelectorAll('foreignObject');
                    foreignObjects.forEach((fo) => {
                        const width = fo.getAttribute('width');
                        const height = fo.getAttribute('height');
                        if (width) fo.setAttribute('width', String(parseInt(width) + 4));
                        if (height) fo.setAttribute('height', String(parseInt(height) + 4));
                    });

                    // Inline styles for all person cards and their children
                    const personCards = clonedDoc.querySelectorAll('[data-person-id]');
                    personCards.forEach((card) => {
                        // Make sure container doesn't clip borders
                        (card as HTMLElement).style.overflow = 'visible';

                        // Inline styles for every element inside the card
                        card.querySelectorAll('*').forEach(inlineStyles);
                        inlineStyles(card);

                        // Explicitly set all 4 border sides for the inner card div
                        const innerDiv = card.querySelector('div');
                        if (innerDiv) {
                            const computed = getComputedStyle(innerDiv);
                            const htmlEl = innerDiv as HTMLElement;
                            htmlEl.style.borderTopWidth = computed.borderTopWidth;
                            htmlEl.style.borderRightWidth = computed.borderRightWidth;
                            htmlEl.style.borderBottomWidth = computed.borderBottomWidth;
                            htmlEl.style.borderLeftWidth = computed.borderLeftWidth;
                            htmlEl.style.borderTopStyle = computed.borderTopStyle;
                            htmlEl.style.borderRightStyle = computed.borderRightStyle;
                            htmlEl.style.borderBottomStyle = computed.borderBottomStyle;
                            htmlEl.style.borderLeftStyle = computed.borderLeftStyle;
                            htmlEl.style.borderTopColor = computed.borderTopColor;
                            htmlEl.style.borderRightColor = computed.borderRightColor;
                            htmlEl.style.borderBottomColor = computed.borderBottomColor;
                            htmlEl.style.borderLeftColor = computed.borderLeftColor;
                            htmlEl.style.overflow = 'visible';
                            // Force box-sizing
                            htmlEl.style.boxSizing = 'border-box';
                        }

                        // Ensure images have rounded style
                        card.querySelectorAll('img').forEach((img) => {
                            const computed = getComputedStyle(img);
                            (img as HTMLElement).style.borderRadius = computed.borderRadius || '50%';
                            (img as HTMLElement).style.width = computed.width;
                            (img as HTMLElement).style.height = computed.height;
                            (img as HTMLElement).style.objectFit = 'cover';
                        });
                    });

                    // Inline styles for SVG elements
                    const svgElements = clonedDoc.querySelectorAll('svg, line, path, circle, rect');
                    svgElements.forEach((el) => {
                        const computed = getComputedStyle(el);
                        (el as HTMLElement).style.stroke = computed.stroke;
                        (el as HTMLElement).style.strokeWidth = computed.strokeWidth;
                        (el as HTMLElement).style.fill = computed.fill;
                    });
                },
            });

            // Restore original image srcs
            cleanup();

            const link = document.createElement('a');
            link.download = `${treeName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            setExportStatus(prev => ({ ...prev, png: 'success' }));
            setTimeout(() => setExportStatus(prev => ({ ...prev, png: 'idle' })), 2000);
        } catch (error) {
            console.error('PNG export failed:', error);
            setExportStatus(prev => ({ ...prev, png: 'error' }));
        }
    };

    const handleExportPDF = async () => {
        if (!canvasRef.current) return;

        setExportStatus(prev => ({ ...prev, pdf: 'loading' }));

        try {
            // Preload images to convert them to base64
            const cleanup = await preloadImages(canvasRef.current);

            const canvas = await html2canvas(canvasRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: false,
                onclone: (clonedDoc) => {
                    const inlineStyles = (el: Element) => {
                        const computed = getComputedStyle(el);
                        const htmlEl = el as HTMLElement;
                        htmlEl.style.display = computed.display;
                        htmlEl.style.position = computed.position;
                        htmlEl.style.width = computed.width;
                        htmlEl.style.height = computed.height;
                        htmlEl.style.padding = computed.padding;
                        htmlEl.style.margin = computed.margin;
                        htmlEl.style.overflow = computed.overflow;
                        htmlEl.style.flexDirection = computed.flexDirection;
                        htmlEl.style.alignItems = computed.alignItems;
                        htmlEl.style.justifyContent = computed.justifyContent;
                        htmlEl.style.gap = computed.gap;
                        htmlEl.style.flexShrink = computed.flexShrink;
                        htmlEl.style.backgroundColor = computed.backgroundColor;
                        htmlEl.style.borderWidth = computed.borderWidth;
                        htmlEl.style.borderStyle = computed.borderStyle;
                        htmlEl.style.borderColor = computed.borderColor;
                        htmlEl.style.borderRadius = computed.borderRadius;
                        htmlEl.style.boxShadow = computed.boxShadow;
                        htmlEl.style.color = computed.color;
                        htmlEl.style.fontSize = computed.fontSize;
                        htmlEl.style.fontWeight = computed.fontWeight;
                        htmlEl.style.fontFamily = computed.fontFamily;
                        htmlEl.style.textOverflow = computed.textOverflow;
                        htmlEl.style.whiteSpace = computed.whiteSpace;
                        htmlEl.style.fontStyle = computed.fontStyle;
                        htmlEl.style.opacity = computed.opacity;
                        htmlEl.style.visibility = computed.visibility;
                    };

                    // Expand foreignObject elements to accommodate borders
                    const foreignObjects = clonedDoc.querySelectorAll('foreignObject');
                    foreignObjects.forEach((fo) => {
                        const width = fo.getAttribute('width');
                        const height = fo.getAttribute('height');
                        if (width) fo.setAttribute('width', String(parseInt(width) + 4));
                        if (height) fo.setAttribute('height', String(parseInt(height) + 4));
                    });

                    const personCards = clonedDoc.querySelectorAll('[data-person-id]');
                    personCards.forEach((card) => {
                        (card as HTMLElement).style.overflow = 'visible';
                        card.querySelectorAll('*').forEach(inlineStyles);
                        inlineStyles(card);
                        const innerDiv = card.querySelector('div');
                        if (innerDiv) {
                            const computed = getComputedStyle(innerDiv);
                            const htmlEl = innerDiv as HTMLElement;
                            htmlEl.style.borderTopWidth = computed.borderTopWidth;
                            htmlEl.style.borderRightWidth = computed.borderRightWidth;
                            htmlEl.style.borderBottomWidth = computed.borderBottomWidth;
                            htmlEl.style.borderLeftWidth = computed.borderLeftWidth;
                            htmlEl.style.borderTopStyle = computed.borderTopStyle;
                            htmlEl.style.borderRightStyle = computed.borderRightStyle;
                            htmlEl.style.borderBottomStyle = computed.borderBottomStyle;
                            htmlEl.style.borderLeftStyle = computed.borderLeftStyle;
                            htmlEl.style.borderTopColor = computed.borderTopColor;
                            htmlEl.style.borderRightColor = computed.borderRightColor;
                            htmlEl.style.borderBottomColor = computed.borderBottomColor;
                            htmlEl.style.borderLeftColor = computed.borderLeftColor;
                            htmlEl.style.overflow = 'visible';
                            htmlEl.style.boxSizing = 'border-box';
                        }
                        card.querySelectorAll('img').forEach((img) => {
                            const computed = getComputedStyle(img);
                            (img as HTMLElement).style.borderRadius = computed.borderRadius || '50%';
                            (img as HTMLElement).style.width = computed.width;
                            (img as HTMLElement).style.height = computed.height;
                            (img as HTMLElement).style.objectFit = 'cover';
                        });
                    });
                    const svgElements = clonedDoc.querySelectorAll('svg, line, path, circle, rect');
                    svgElements.forEach((el) => {
                        const computed = getComputedStyle(el);
                        (el as HTMLElement).style.stroke = computed.stroke;
                        (el as HTMLElement).style.strokeWidth = computed.strokeWidth;
                        (el as HTMLElement).style.fill = computed.fill;
                    });
                },
            });

            // Restore original image srcs
            cleanup();

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            // Calculate PDF dimensions (A4 landscape or portrait based on tree shape)
            const isLandscape = imgWidth > imgHeight;
            const pdf = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'px',
                format: [imgWidth / 2, imgHeight / 2],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth / 2, imgHeight / 2);
            pdf.save(`${treeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

            setExportStatus(prev => ({ ...prev, pdf: 'success' }));
            setTimeout(() => setExportStatus(prev => ({ ...prev, pdf: 'idle' })), 2000);
        } catch (error) {
            console.error('PDF export failed:', error);
            setExportStatus(prev => ({ ...prev, pdf: 'error' }));
        }
    };

    const handleExportGEDCOM = async () => {
        setExportStatus(prev => ({ ...prev, gedcom: 'loading' }));

        try {
            downloadGedcom(people, treeName);
            setExportStatus(prev => ({ ...prev, gedcom: 'success' }));
            setTimeout(() => setExportStatus(prev => ({ ...prev, gedcom: 'idle' })), 2000);
        } catch (error) {
            console.error('GEDCOM export failed:', error);
            setExportStatus(prev => ({ ...prev, gedcom: 'error' }));
        }
    };

    const getButtonIcon = (type: ExportType) => {
        const status = exportStatus[type];
        if (status === 'loading') return <Loader2 className="h-4 w-4 animate-spin" />;
        if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        return <Download className="h-4 w-4" />;
    };

    const exportOptions = [
        {
            type: 'png' as ExportType,
            icon: <FileImage className="h-8 w-8 text-blue-500" />,
            title: 'PNG Image',
            description: 'High-quality image, perfect for sharing on social media',
            handler: handleExportPNG,
        },
        {
            type: 'pdf' as ExportType,
            icon: <FileText className="h-8 w-8 text-red-500" />,
            title: 'PDF Document',
            description: 'Print-ready format for framing or archiving',
            handler: handleExportPDF,
        },
        {
            type: 'gedcom' as ExportType,
            icon: <FileCode className="h-8 w-8 text-green-500" />,
            title: 'GEDCOM File',
            description: 'Industry standard for importing into other genealogy software',
            handler: handleExportGEDCOM,
        },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <Download className="mr-2 h-5 w-5 text-primary" />
                        Export Your Family Tree
                    </DialogTitle>
                    <DialogDescription>
                        Choose a format to download your tree. ({people.length} family members)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    {exportOptions.map((option) => (
                        <div
                            key={option.type}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-muted rounded-lg">
                                    {option.icon}
                                </div>
                                <div>
                                    <h4 className="font-medium">{option.title}</h4>
                                    <p className="text-xs text-muted-foreground">{option.description}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={option.handler}
                                disabled={exportStatus[option.type] === 'loading'}
                            >
                                {getButtonIcon(option.type)}
                                <span className="ml-2">
                                    {exportStatus[option.type] === 'loading' ? 'Exporting...' :
                                        exportStatus[option.type] === 'success' ? 'Done!' : 'Export'}
                                </span>
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground text-center">
                    Tip: For large trees, PNG and PDF exports may take a few moments.
                </div>
            </DialogContent>
        </Dialog>
    );
}
