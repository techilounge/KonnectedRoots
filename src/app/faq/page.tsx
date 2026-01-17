"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Search,
    HelpCircle,
    CreditCard,
    Users,
    Download,
    Shield,
    Sparkles,
    ArrowRight,
} from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQCategory {
    id: string;
    name: string;
    icon: React.ReactNode;
    questions: FAQItem[];
}

const faqCategories: FAQCategory[] = [
    {
        id: 'getting-started',
        name: 'Getting Started',
        icon: <HelpCircle className="h-5 w-5" />,
        questions: [
            {
                question: 'How do I create my first family tree?',
                answer: 'After signing up, click "Create New Tree" from your dashboard. Give your tree a name, and you\'ll be taken to the tree editor where you can start adding family members. Begin with yourself or any ancestor, then use the "Add Person" buttons to add parents, children, or spouses.',
            },
            {
                question: 'Is KonnectedRoots free to use?',
                answer: 'Yes! Our free plan lets you create up to 3 family trees with 500 people per tree, invite 2 collaborators (as viewers), use 10 AI actions per month, and export with our watermark. Upgrade to Pro or Family for unlimited trees, more collaborators, and premium features.',
            },
            {
                question: 'Can I import my existing family tree from another platform?',
                answer: 'Yes! Pro and Family plan users can import GEDCOM files, which is the standard format used by most genealogy software. Go to your tree settings and click "Import GEDCOM" to upload your file.',
            },
            {
                question: 'What devices can I use KonnectedRoots on?',
                answer: 'KonnectedRoots works on any device with a modern web browser - desktops, laptops, tablets, and phones. Your trees are synced across all devices automatically.',
            },
        ],
    },
    {
        id: 'billing',
        name: 'Billing & Plans',
        icon: <CreditCard className="h-5 w-5" />,
        questions: [
            {
                question: 'What are the differences between Free, Pro, and Family plans?',
                answer: 'Free: 3 trees, 500 people/tree, 2 viewer collaborators, 10 AI actions/month, watermarked exports. Pro ($5.99/mo): Unlimited trees & people, 10 collaborators with all roles, 200 AI actions, GEDCOM import/export, no watermarks. Family ($9.99/mo): Everything in Pro plus 6 family member accounts, 20 collaborators, 600 pooled AI actions, and 100GB shared storage.',
            },
            {
                question: 'Can I cancel my subscription anytime?',
                answer: 'Yes, you can cancel anytime from your account settings. Your subscription will remain active until the end of your current billing period, and you won\'t be charged again.',
            },
            {
                question: 'What is the AI Pack add-on?',
                answer: 'The AI Pack adds 1,000 extra AI actions per month for $3.99/mo. It\'s available for Pro and Family subscribers who need more AI-powered features like name suggestions and smart hints.',
            },
            {
                question: 'Do you offer refunds?',
                answer: 'We offer a 7-day money-back guarantee for new subscriptions. If you\'re not satisfied, contact us within 7 days of your first payment for a full refund.',
            },
        ],
    },
    {
        id: 'collaboration',
        name: 'Collaboration',
        icon: <Users className="h-5 w-5" />,
        questions: [
            {
                question: 'How do I invite family members to collaborate?',
                answer: 'Open your tree and click the "Share" button. Enter their email address and select their role: Viewer (can only view), Editor (can add/edit people), or Manager (full access including inviting others). They\'ll receive an email invitation to join.',
            },
            {
                question: 'What\'s the difference between Viewer, Editor, and Manager roles?',
                answer: 'Viewer: Can view the tree but cannot make changes. Editor: Can add new people, edit existing profiles, and upload photos. Manager: Has full access including deleting people, managing collaborators, and tree settings.',
            },
            {
                question: 'Can collaborators see my other trees?',
                answer: 'No, collaborators can only see the specific tree(s) you\'ve shared with them. Each tree has its own permissions.',
            },
            {
                question: 'What is a Family Plan seat?',
                answer: 'The Family plan includes 6 seats - you plus 5 family members. Each seat gets their own account with full Pro features, and you all share a pooled AI action allowance and storage.',
            },
        ],
    },
    {
        id: 'data',
        name: 'Data & Exports',
        icon: <Download className="h-5 w-5" />,
        questions: [
            {
                question: 'How do I export my family tree?',
                answer: 'From your tree, click the "Export" button. Choose PDF for a printable document, PNG/JPG for images, or GEDCOM (Pro/Family only) for backup or transfer to other platforms.',
            },
            {
                question: 'What is GEDCOM and why should I care?',
                answer: 'GEDCOM is the universal file format for genealogy data. It lets you backup your tree, move between platforms, or share with researchers. Think of it as a "universal translator" for family tree software.',
            },
            {
                question: 'Are my exports watermarked?',
                answer: 'Free plan exports include a small KonnectedRoots watermark. Pro and Family plan exports are watermark-free.',
            },
            {
                question: 'How much storage do I get?',
                answer: 'Free: 1GB, Pro: 50GB, Family: 100GB shared across all seats. Storage is used for photos, documents, and other files you upload to profiles.',
            },
        ],
    },
    {
        id: 'privacy',
        name: 'Privacy & Security',
        icon: <Shield className="h-5 w-5" />,
        questions: [
            {
                question: 'Is my family data private?',
                answer: 'Yes! By default, your trees are completely private - only you and people you explicitly invite can see them. We never share or sell your data.',
            },
            {
                question: 'How is my data protected?',
                answer: 'We use industry-standard encryption for data in transit and at rest. Your account is protected by secure authentication, and we perform regular security audits.',
            },
            {
                question: 'Can I delete my account and all my data?',
                answer: 'Yes, you can permanently delete your account and all associated data from your account settings. This action is irreversible, so we recommend exporting your trees first.',
            },
            {
                question: 'Do you use my data to train AI?',
                answer: 'No. Your family data is never used to train AI models. Our AI features use general genealogical knowledge, not your personal data.',
            },
        ],
    },
    {
        id: 'ai',
        name: 'AI Features',
        icon: <Sparkles className="h-5 w-5" />,
        questions: [
            {
                question: 'What are AI actions?',
                answer: 'AI actions are uses of our AI-powered features like name suggestions based on cultural origins, relationship hints, and smart completions. Each plan includes a monthly allowance that resets every billing cycle.',
            },
            {
                question: 'How many AI actions do I get?',
                answer: 'Free: 10/month, Pro: 200/month, Family: 600/month (pooled). You can add 1,000 more with the AI Pack add-on ($3.99/mo).',
            },
            {
                question: 'What happens if I run out of AI actions?',
                answer: 'You can still use all other features - only AI-powered suggestions will be unavailable until your allowance resets next month or you upgrade/add the AI Pack.',
            },
        ],
    },
];

export default function FAQPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const filteredCategories = faqCategories.map(category => ({
        ...category,
        questions: category.questions.filter(
            q =>
                q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    })).filter(category => category.questions.length > 0);

    const totalQuestions = faqCategories.reduce((acc, cat) => acc + cat.questions.length, 0);

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <section className="py-16 md:py-24 bg-gradient-to-b from-secondary/50 to-background">
                <div className="container mx-auto px-4 text-center">
                    <Badge variant="outline" className="mb-4">FAQ</Badge>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        Find answers to the most common questions about KonnectedRoots.
                        Can&apos;t find what you&apos;re looking for? <Link href="/contact" className="text-primary hover:underline">Contact us</Link>.
                    </p>

                    {/* Search */}
                    <div className="max-w-md mx-auto relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search questions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Category Pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                        <Button
                            variant={activeCategory === null ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveCategory(null)}
                        >
                            All ({totalQuestions})
                        </Button>
                        {faqCategories.map((cat) => (
                            <Button
                                key={cat.id}
                                variant={activeCategory === cat.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveCategory(cat.id)}
                                className="gap-2"
                            >
                                {cat.icon}
                                {cat.name}
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Content */}
            <section className="py-12 md:py-16">
                <div className="container mx-auto px-4 max-w-4xl">
                    {(activeCategory ? filteredCategories.filter(c => c.id === activeCategory) : filteredCategories).map((category) => (
                        <div key={category.id} className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-primary/10 rounded-full text-primary">
                                    {category.icon}
                                </div>
                                <h2 className="text-2xl font-semibold">{category.name}</h2>
                            </div>

                            <Accordion type="single" collapsible className="space-y-2">
                                {category.questions.map((item, idx) => (
                                    <AccordionItem
                                        key={idx}
                                        value={`${category.id}-${idx}`}
                                        className="border rounded-lg px-4 bg-card shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <AccordionTrigger className="text-left font-medium py-4">
                                            {item.question}
                                        </AccordionTrigger>
                                        <AccordionContent className="text-muted-foreground pb-4">
                                            {item.answer}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    ))}

                    {filteredCategories.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">No questions match your search.</p>
                            <Button variant="outline" onClick={() => setSearchQuery('')}>
                                Clear Search
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* CTA */}
            <section className="py-12 bg-secondary/30">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
                    <p className="text-muted-foreground mb-6">
                        Our support team is here to help you get started.
                    </p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <Button asChild>
                            <Link href="/contact">
                                Contact Support
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/guide">View How-To Guide</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
