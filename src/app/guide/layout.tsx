import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'How-To Guide | KonnectedRoots - Step-by-Step Tutorials',
    description: 'Learn how to build your family tree with KonnectedRoots. Step-by-step guides for creating trees, adding family members, collaboration, importing GEDCOM, and more.',
    keywords: ['family tree tutorial', 'genealogy guide', 'how to build family tree', 'GEDCOM import guide'],
};

export default function GuideLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
