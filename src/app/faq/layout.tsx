import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'FAQ | KonnectedRoots - Frequently Asked Questions',
    description: 'Find answers to common questions about KonnectedRoots family tree builder, pricing, collaboration, GEDCOM import/export, and more.',
    keywords: ['KonnectedRoots FAQ', 'family tree help', 'genealogy questions', 'pricing questions'],
};

export default function FAQLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
