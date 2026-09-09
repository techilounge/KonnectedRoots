import { clientEnv } from '@/lib/config/env.client';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = clientEnv.appUrl;

export const metadata: Metadata = {
  title: 'Platform Features | Interactive Tree Builder, Collaboration & AI Insights',
  description: 'Explore state-of-the-art genealogy features: dynamic family tree visualizer, real-time multi-user collaboration, AI biographies, photo enhancement, and full GEDCOM file interoperability.',
  keywords: [
    'family tree builder features',
    'genealogy software tools',
    'AI family history',
    'collaborative ancestry tree',
    'GEDCOM import export',
    'family tree chart visualizer',
    'ancestral document OCR',
  ],
  alternates: {
    canonical: `${siteUrl}/features`,
  },
  openGraph: {
    title: 'Platform Features | KonnectedRoots',
    description: 'Explore the full suite of interactive tools to build, share, and preserve your family heritage.',
    url: `${siteUrl}/features`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Platform Features | KonnectedRoots',
    description: 'Explore the full suite of interactive tools to build, share, and preserve your family heritage.',
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Features',
      item: `${siteUrl}/features`,
    },
  ],
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
