import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | KonnectedRoots',
    description: 'Learn how KonnectedRoots collects, uses, and protects your personal and family data. Read our complete privacy policy.',
};

export default function PrivacyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
