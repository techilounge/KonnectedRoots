import { clientEnv } from '@/lib/config/env.client';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = clientEnv.appUrl;

export const metadata: Metadata = {
  title: 'How-To Guide & Tutorials | Build Your Family Tree Step-by-Step',
  description: 'Comprehensive step-by-step guides for KonnectedRoots. Learn how to create your first tree, invite relatives to collaborate, import GEDCOM records, and utilize AI genealogy tools.',
  keywords: [
    'family tree tutorial',
    'genealogy beginner guide',
    'how to build family tree',
    'GEDCOM import tutorial',
    'family tree tips',
  ],
  alternates: {
    canonical: `${siteUrl}/guide`,
  },
  openGraph: {
    title: 'How-To Guide & Tutorials | KonnectedRoots',
    description: 'Learn how to build and preserve your family heritage with our comprehensive walkthroughs.',
    url: `${siteUrl}/guide`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How-To Guide & Tutorials | KonnectedRoots',
    description: 'Learn how to build and preserve your family heritage with our comprehensive walkthroughs.',
  },
};

const guideSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Build Your Online Family Tree with KonnectedRoots',
  description: 'Step-by-step instructions for creating, expanding, and collaborating on your family tree.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Create Your Account and Tree',
      text: 'Sign up for free and click Create New Tree from your dashboard.',
      position: 1,
    },
    {
      '@type': 'HowToStep',
      name: 'Add Ancestors and Relatives',
      text: 'Start with yourself or an ancestor, then add parents, siblings, spouses, and children using the intuitive visual node editor.',
      position: 2,
    },
    {
      '@type': 'HowToStep',
      name: 'Enrich with Biographies and Photos',
      text: 'Upload family portraits, attach historical dates, and use AI to generate rich historical narratives.',
      position: 3,
    },
    {
      '@type': 'HowToStep',
      name: 'Invite Family Collaborators or Export',
      text: 'Share private invite links with relatives to co-author your lineage, or export your tree as GEDCOM or PDF.',
      position: 4,
    },
  ],
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={guideSchema} />
      {children}
    </>
  );
}
