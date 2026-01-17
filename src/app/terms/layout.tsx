import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service | KonnectedRoots',
    description: 'Read the Terms of Service for KonnectedRoots family tree builder. Understand your rights and responsibilities when using our platform.',
};

export default function TermsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
