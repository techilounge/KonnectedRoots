import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';

export const metadata: Metadata = {
  title: 'Privacy Policy | KonnectedRoots',
  description: 'Learn how KonnectedRoots collects, encrypts, and protects your personal and family genealogy data. We respect your lineage privacy.',
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
  openGraph: {
    title: 'Privacy Policy | KonnectedRoots',
    description: 'Learn how we protect and safeguard your personal and family genealogical data.',
    url: `${siteUrl}/privacy`,
    type: 'website',
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
