"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    TreeDeciduous,
    UserPlus,
    Share2,
    Download,
    Upload,
    ImageIcon,
    Settings,
    CheckCircle,
    ArrowRight,
    Play,
    ChevronRight,
} from 'lucide-react';

interface GuideStep {
    title: string;
    description: string;
    tip?: string;
}

interface GuideSection {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    timeEstimate: string;
    steps: GuideStep[];
}

const guides: GuideSection[] = [
    {
        id: 'create-tree',
        title: 'Create Your First Family Tree',
        description: 'Start your genealogy journey by creating a new family tree from scratch.',
        icon: <TreeDeciduous className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '5 min',
        steps: [
            {
                title: 'Sign up or log in',
                description: 'Create a free account or log in to your existing account. You can sign up with email or use Google/Microsoft sign-in.',
            },
            {
                title: 'Go to your Dashboard',
                description: 'After logging in, you\'ll see your dashboard with all your trees. Click the "Create New Tree" button.',
            },
            {
                title: 'Name your tree',
                description: 'Give your tree a meaningful name like "Smith Family Tree" or "Mom\'s Side". You can always rename it later.',
                tip: 'Use a descriptive name so you can easily find it if you create multiple trees.',
            },
            {
                title: 'Add yourself as the starting person',
                description: 'Click anywhere on the canvas to add your first person. Most people start with themselves, but you can start with any ancestor.',
            },
            {
                title: 'Start building!',
                description: 'Use the + buttons that appear around a person to add parents, children, spouses, or siblings. Keep adding family members to grow your tree.',
                tip: 'Save frequently! Your tree auto-saves, but it\'s good practice to check.',
            },
        ],
    },
    {
        id: 'add-members',
        title: 'Add Family Members',
        description: 'Learn how to add parents, children, spouses, and other relatives to your tree.',
        icon: <UserPlus className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '3 min',
        steps: [
            {
                title: 'Select a person',
                description: 'Click on any person in your tree to select them. You\'ll see action buttons appear around their card.',
            },
            {
                title: 'Choose the relationship',
                description: 'Click the appropriate + button: above for parents, below for children, left/right for spouses or siblings.',
            },
            {
                title: 'Fill in their details',
                description: 'Enter their name, birth date, and any other information you know. All fields except name are optional.',
                tip: 'Don\'t worry if you don\'t know all the details — you can always update them later.',
            },
            {
                title: 'Add a profile photo',
                description: 'Click the photo placeholder to upload an image. We support JPG, PNG, and WebP formats up to 10MB.',
            },
            {
                title: 'Save and continue',
                description: 'Click Save to add the person. Then select them to add their relatives, and keep building your tree!',
            },
        ],
    },
    {
        id: 'collaborate',
        title: 'Invite Family to Collaborate',
        description: 'Share your tree with relatives and work together on your family history.',
        icon: <Share2 className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '2 min',
        steps: [
            {
                title: 'Open your tree',
                description: 'Go to the tree you want to share from your dashboard.',
            },
            {
                title: 'Click the Share button',
                description: 'Find the Share button in the top toolbar. This opens the collaboration panel.',
            },
            {
                title: 'Enter their email',
                description: 'Type the email address of the family member you want to invite.',
            },
            {
                title: 'Choose their role',
                description: 'Select Viewer (can only view), Editor (can add/edit), or Manager (full access). Choose based on how much access you want to give.',
                tip: 'Start with Viewer for distant relatives, Editor for close family members actively helping with research.',
            },
            {
                title: 'Send the invitation',
                description: 'Click Invite. They\'ll receive an email with a link to join your tree.',
            },
        ],
    },
    {
        id: 'import-gedcom',
        title: 'Import a GEDCOM File',
        description: 'Bring in your existing family tree from Ancestry, MyHeritage, or other platforms.',
        icon: <Upload className="h-6 w-6" />,
        difficulty: 'Intermediate',
        timeEstimate: '5 min',
        steps: [
            {
                title: 'Export from your current platform',
                description: 'In your current genealogy software (Ancestry, MyHeritage, etc.), look for an Export or Download option. Choose GEDCOM format (.ged file).',
                tip: 'GEDCOM is the universal format that works across all genealogy software.',
            },
            {
                title: 'Create a new tree in KonnectedRoots',
                description: 'From your dashboard, click Create New Tree. Give it a name related to the imported data.',
            },
            {
                title: 'Go to Tree Settings',
                description: 'Once in the tree editor, click the Settings or Menu icon in the toolbar.',
            },
            {
                title: 'Click Import GEDCOM',
                description: 'Select the Import GEDCOM option and choose your downloaded .ged file.',
            },
            {
                title: 'Review and confirm',
                description: 'Preview the imported data to make sure it looks correct. Click Confirm to complete the import. Large files may take a minute to process.',
                tip: 'After importing, review the tree carefully. Some data like photos may need to be re-uploaded.',
            },
        ],
    },
    {
        id: 'export-tree',
        title: 'Export Your Family Tree',
        description: 'Download your tree as PDF, image, or GEDCOM for sharing or backup.',
        icon: <Download className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '2 min',
        steps: [
            {
                title: 'Open your tree',
                description: 'Navigate to the tree you want to export.',
            },
            {
                title: 'Click the Export button',
                description: 'Find the Export option in the toolbar or menu.',
            },
            {
                title: 'Choose your format',
                description: 'Select PDF (for printing), PNG/JPG (for images), or GEDCOM (for backup/transfer). GEDCOM requires Pro or Family plan.',
            },
            {
                title: 'Customize options',
                description: 'Choose which generations to include, paper size (for PDF), or image quality.',
                tip: 'For large trees, focus on specific branches rather than exporting everything at once.',
            },
            {
                title: 'Download',
                description: 'Click Download and your file will be saved. Free plan exports include a small watermark; paid plans are watermark-free.',
            },
        ],
    },
    {
        id: 'add-photos',
        title: 'Add Photos & Documents',
        description: 'Enrich your tree with photos, certificates, and other family documents.',
        icon: <ImageIcon className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '3 min',
        steps: [
            {
                title: 'Select a person',
                description: 'Click on the person you want to add photos or documents to.',
            },
            {
                title: 'Open their profile',
                description: 'Click "View Details" or the edit icon to open their full profile.',
            },
            {
                title: 'Go to the Media tab',
                description: 'Find the Photos or Media section in their profile.',
            },
            {
                title: 'Upload files',
                description: 'Click Upload and select photos, scanned documents, or other files. We support JPG, PNG, WebP (images) and PDF (documents).',
                tip: 'Supported formats: JPG, PNG, WebP up to 10MB each. Store high-resolution scans of important documents.',
            },
            {
                title: 'Add captions',
                description: 'For each photo, add a caption with date, location, or description. This helps you and collaborators understand the context.',
            },
        ],
    },
    {
        id: 'manage-account',
        title: 'Manage Your Account & Subscription',
        description: 'Update your profile, change plans, or manage billing.',
        icon: <Settings className="h-6 w-6" />,
        difficulty: 'Beginner',
        timeEstimate: '2 min',
        steps: [
            {
                title: 'Go to Settings',
                description: 'Click your profile avatar in the top right, then select Settings.',
            },
            {
                title: 'Update profile info',
                description: 'Change your name, email, or password in the Profile section.',
            },
            {
                title: 'View subscription',
                description: 'The Billing section shows your current plan, usage, and renewal date.',
            },
            {
                title: 'Upgrade or manage plan',
                description: 'Click "Manage Subscription" to upgrade, downgrade, or add the AI Pack. You can also update payment methods here.',
                tip: 'Plans renew automatically. Cancel anytime before renewal to avoid charges.',
            },
            {
                title: 'Download your data',
                description: 'In Privacy & Data, you can request a full export of all your data or delete your account.',
            },
        ],
    },
];

const difficultyColors = {
    Beginner: 'bg-green-100 text-green-800',
    Intermediate: 'bg-yellow-100 text-yellow-800',
    Advanced: 'bg-red-100 text-red-800',
};

export default function GuidePage() {
    const [selectedGuide, setSelectedGuide] = useState<GuideSection | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    const handleStartGuide = (guide: GuideSection) => {
        setSelectedGuide(guide);
        setCurrentStep(0);
    };

    const handleNextStep = () => {
        if (selectedGuide && currentStep < selectedGuide.steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleCloseGuide = () => {
        setSelectedGuide(null);
        setCurrentStep(0);
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <section className="py-16 md:py-24 bg-gradient-to-b from-secondary/50 to-background">
                <div className="container mx-auto px-4 text-center">
                    <Badge variant="outline" className="mb-4">How-To Guide</Badge>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                        Learn How to Use KonnectedRoots
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        Step-by-step tutorials to help you build, share, and preserve your family history.
                    </p>
                </div>
            </section>

            {/* Guides Grid or Active Guide */}
            <section className="py-12 md:py-16">
                <div className="container mx-auto px-4">
                    {!selectedGuide ? (
                        <>
                            {/* Difficulty Filter Tabs */}
                            <Tabs defaultValue="all" className="mb-8">
                                <TabsList className="mx-auto flex w-fit">
                                    <TabsTrigger value="all">All Guides</TabsTrigger>
                                    <TabsTrigger value="beginner">Beginner</TabsTrigger>
                                    <TabsTrigger value="intermediate">Intermediate</TabsTrigger>
                                </TabsList>

                                <TabsContent value="all">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                                        {guides.map((guide) => (
                                            <GuideCard key={guide.id} guide={guide} onStart={() => handleStartGuide(guide)} />
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="beginner">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                                        {guides.filter(g => g.difficulty === 'Beginner').map((guide) => (
                                            <GuideCard key={guide.id} guide={guide} onStart={() => handleStartGuide(guide)} />
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="intermediate">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                                        {guides.filter(g => g.difficulty === 'Intermediate').map((guide) => (
                                            <GuideCard key={guide.id} guide={guide} onStart={() => handleStartGuide(guide)} />
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : (
                        /* Active Guide Viewer */
                        <div className="max-w-3xl mx-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <Button variant="ghost" onClick={handleCloseGuide}>
                                    ← Back to All Guides
                                </Button>
                                <Badge className={difficultyColors[selectedGuide.difficulty]}>
                                    {selectedGuide.difficulty}
                                </Badge>
                            </div>

                            <div className="text-center mb-8">
                                <div className="inline-flex p-4 bg-primary/10 rounded-full text-primary mb-4">
                                    {selectedGuide.icon}
                                </div>
                                <h2 className="text-3xl font-bold mb-2">{selectedGuide.title}</h2>
                                <p className="text-muted-foreground">{selectedGuide.description}</p>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                                    <span>Step {currentStep + 1} of {selectedGuide.steps.length}</span>
                                    <span>{Math.round(((currentStep + 1) / selectedGuide.steps.length) * 100)}% complete</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${((currentStep + 1) / selectedGuide.steps.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Step Content */}
                            <Card className="mb-8 animate-[fadeSlideIn_0.3s_ease-out]">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                                            {currentStep + 1}
                                        </div>
                                        <CardTitle>{selectedGuide.steps[currentStep].title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground mb-4">
                                        {selectedGuide.steps[currentStep].description}
                                    </p>
                                    {selectedGuide.steps[currentStep].tip && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                            <p className="text-sm">
                                                <span className="font-semibold text-primary">💡 Tip:</span>{' '}
                                                {selectedGuide.steps[currentStep].tip}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Navigation */}
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="outline"
                                    onClick={handlePrevStep}
                                    disabled={currentStep === 0}
                                >
                                    ← Previous
                                </Button>

                                {currentStep < selectedGuide.steps.length - 1 ? (
                                    <Button onClick={handleNextStep}>
                                        Next Step
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button onClick={handleCloseGuide} className="bg-green-600 hover:bg-green-700">
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Complete!
                                    </Button>
                                )}
                            </div>

                            {/* Step Indicators */}
                            <div className="flex justify-center gap-2 mt-8">
                                {selectedGuide.steps.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentStep(idx)}
                                        className={`h-2 w-2 rounded-full transition-all ${idx === currentStep
                                                ? 'bg-primary w-6'
                                                : idx < currentStep
                                                    ? 'bg-primary/50'
                                                    : 'bg-secondary'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* CTA */}
            {!selectedGuide && (
                <section className="py-12 bg-secondary/30">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
                        <p className="text-muted-foreground mb-6">
                            Create your free account and start building your family tree today.
                        </p>
                        <div className="flex justify-center gap-4 flex-wrap">
                            <Button asChild>
                                <Link href="/signup">
                                    Create Free Account
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/faq">View FAQ</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function GuideCard({ guide, onStart }: { guide: GuideSection; onStart: () => void }) {
    return (
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-transparent hover:border-primary">
            <CardHeader>
                <div className="flex items-center justify-between mb-2">
                    <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                        {guide.icon}
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={difficultyColors[guide.difficulty]}>
                            {guide.difficulty}
                        </Badge>
                        <Badge variant="secondary">{guide.timeEstimate}</Badge>
                    </div>
                </div>
                <CardTitle className="text-lg">{guide.title}</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {guide.steps.length} steps
                    </span>
                    <Button size="sm" onClick={onStart} className="gap-2">
                        <Play className="h-4 w-4" />
                        Start Guide
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
