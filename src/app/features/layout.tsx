import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Features | KonnectedRoots - Build Your Family Tree Online',
    description: 'Discover powerful features to build your family tree: interactive tree builder, real-time collaboration, AI-powered insights, GEDCOM import/export, and more. Start free today.',
    keywords: ['family tree builder', 'genealogy software', 'ancestry', 'collaboration', 'GEDCOM', 'AI genealogy'],
    openGraph: {
        title: 'Features | KonnectedRoots',
        description: 'Powerful tools to build and share your family tree.',
        type: 'website',
    },
};

export default function FeaturesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
