"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    Share2,
    Brain,
    Lock,
    FileText,
    Download,
    Image as ImageIcon,
    Zap,
    Globe,
    Shield,
    Sparkles,
    CheckCircle,
    ArrowRight,
} from 'lucide-react';

const mainFeatures = [
    {
        icon: <Users className="h-10 w-10 text-primary" />,
        title: 'Visual Tree Builder',
        description: 'Create stunning, interactive family trees with our intuitive drag-and-drop canvas. See your ancestry come to life with beautiful visualizations that span generations.',
        benefits: ['Drag-and-drop interface', 'Multiple view layouts', 'Zoom and pan navigation', 'Auto-save as you work'],
    },
    {
        icon: <Share2 className="h-10 w-10 text-primary" />,
        title: 'Real-Time Collaboration',
        description: 'Work together with family members across the globe. Invite relatives as Viewers, Editors, or Managers and build your shared history together.',
        benefits: ['Role-based permissions', 'Email invitations', 'In-app notifications', 'Activity tracking'],
    },
    {
        icon: <Brain className="h-10 w-10 text-primary" />,
        title: 'AI-Powered Insights',
        description: 'Get intelligent name suggestions based on historical trends and cultural origins. Our AI helps you discover connections and fill in the gaps.',
        benefits: ['Smart name suggestions', 'Cultural origin analysis', 'Relationship hints', 'Pattern recognition'],
    },
    {
        icon: <Download className="h-10 w-10 text-primary" />,
        title: 'GEDCOM Import & Export',
        description: 'Industry-standard GEDCOM support means you can easily import existing trees from other platforms or backup your data anytime.',
        benefits: ['GEDCOM 5.5.1 support', 'One-click import', 'Full data export', 'Platform compatibility'],
    },
    {
        icon: <ImageIcon className="h-10 w-10 text-primary" />,
        title: 'Rich Media Profiles',
        description: 'Add photos, stories, documents, and important dates to each family member. Create living profiles that tell the full story.',
        benefits: ['Photo galleries', 'Document uploads', 'Life stories & notes', 'Important dates timeline'],
    },
    {
        icon: <Lock className="h-10 w-10 text-primary" />,
        title: 'Private & Secure',
        description: 'Your family data stays private. With enterprise-grade security and granular privacy controls, you decide who sees what.',
        benefits: ['Encrypted data storage', 'Privacy controls', 'Secure authentication', 'Regular backups'],
    },
];

const additionalFeatures = [
    { icon: <FileText className="h-5 w-5" />, title: 'PDF & Image Exports', description: 'Download beautiful printable versions of your tree' },
    { icon: <Globe className="h-5 w-5" />, title: 'Shareable Links', description: 'Share your tree with a simple link' },
    { icon: <Zap className="h-5 w-5" />, title: 'Fast Performance', description: 'Smooth experience even with large trees' },
    { icon: <Shield className="h-5 w-5" />, title: 'Data Ownership', description: 'Your data belongs to you, always' },
    { icon: <Sparkles className="h-5 w-5" />, title: 'Modern Design', description: 'Clean, intuitive interface that works on any device' },
    { icon: <CheckCircle className="h-5 w-5" />, title: 'Free Forever Plan', description: 'Get started without a credit card' },
];

export default function FeaturesPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <Badge variant="outline" className="mb-4">Features</Badge>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground mb-6 leading-tight">
                        Powerful Tools to Preserve Your Family Legacy
                    </h1>
                    <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
                        Everything you need to build, collaborate on, and share your family tree — all in one beautiful, easy-to-use platform.
                    </p>
                    <div className="flex justify-center space-x-4">
                        <Button size="lg" asChild className="shadow-lg">
                            <Link href="/signup">Get Started Free</Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild>
                            <Link href="/pricing">View Pricing</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Main Features Grid */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-headline font-bold text-foreground mb-4">
                            Core Features
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Built by genealogy enthusiasts for families who want to preserve their heritage.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {mainFeatures.map((feature, index) => (
                            <Card key={index} className="group shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-transparent hover:border-primary">
                                <CardHeader>
                                    <div className="p-4 bg-primary/10 rounded-full w-fit mb-4 transition-transform duration-300 group-hover:scale-110">
                                        {feature.icon}
                                    </div>
                                    <CardTitle className="font-headline text-xl text-foreground">{feature.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground text-sm mb-4">{feature.description}</p>
                                    <ul className="space-y-2">
                                        {feature.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-center text-sm text-muted-foreground">
                                                <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                                                {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Additional Features */}
            <section className="py-16 md:py-24 bg-secondary">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-headline font-bold text-foreground mb-4">
                            And Much More
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                            Every feature designed to make your genealogy journey easier.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {additionalFeatures.map((feature, index) => (
                            <div key={index} className="flex items-start space-x-3 p-4 rounded-lg bg-card hover:bg-card/80 transition-colors">
                                <div className="p-2 bg-primary/10 rounded-full">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-r from-primary to-accent p-8 md:p-12 rounded-lg shadow-xl text-center">
                        <h2 className="text-3xl sm:text-4xl font-headline font-bold text-primary-foreground mb-4">
                            Ready to Start Your Family Tree?
                        </h2>
                        <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                            Join thousands of families preserving their heritage. Start with our free plan — no credit card required.
                        </p>
                        <div className="flex justify-center space-x-4 flex-wrap gap-4">
                            <Button size="lg" variant="secondary" asChild className="shadow-md">
                                <Link href="/signup">
                                    Create Your Tree Free
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">
                                <Link href="/pricing">Compare Plans</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
