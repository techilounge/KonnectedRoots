import { clientEnv } from '@/lib/config/env.client';
import type { Metadata } from 'next';

const siteUrl = clientEnv.appUrl;

export const metadata: Metadata = {
  title: 'Terms of Service | KonnectedRoots',
  description: 'Read the Terms of Service for the KonnectedRoots platform. Understand user rights, content ownership, acceptable use, and subscription terms.',
  alternates: {
    canonical: `${siteUrl}/terms`,
  },
  openGraph: {
    title: 'Terms of Service | KonnectedRoots',
    description: 'Understand your rights and terms when using the KonnectedRoots family tree platform.',
    url: `${siteUrl}/terms`,
    type: 'website',
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
