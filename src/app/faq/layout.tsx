import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ) | KonnectedRoots',
  description: 'Got questions about building your family tree, GEDCOM imports, collaboration, privacy, or subscription plans? Find comprehensive answers in our FAQ.',
  keywords: [
    'KonnectedRoots FAQ',
    'family tree builder help',
    'genealogy questions and answers',
    'GEDCOM import guide',
    'family tree pricing FAQ',
    'how to build a family tree online',
  ],
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
  openGraph: {
    title: 'Frequently Asked Questions | KonnectedRoots',
    description: 'Find answers to common questions about KonnectedRoots family tree builder, features, plans, and GEDCOM support.',
    url: `${siteUrl}/faq`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frequently Asked Questions | KonnectedRoots',
    description: 'Find answers to common questions about KonnectedRoots family tree builder, features, plans, and GEDCOM support.',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I create my first family tree?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'After signing up, click "Create New Tree" from your dashboard. Give your tree a name, and you will be taken to the tree editor where you can start adding family members. Begin with yourself or any ancestor, then use the "Add Person" buttons to add parents, children, or spouses.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is KonnectedRoots free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Our free plan lets you create family trees, invite collaborators, use monthly AI actions, and export your lineage. You can upgrade to Pro or Family for expanded limits, GEDCOM import/export, and premium features.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I import my existing family tree from another platform?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! KonnectedRoots supports GEDCOM file imports and exports, which is the universal standard format used by Ancestry, MyHeritage, FamilySearch, and desktop genealogy software.',
      },
    },
    {
      '@type': 'Question',
      name: 'What devices can I use KonnectedRoots on?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'KonnectedRoots works seamlessly on any device with a modern web browser - including desktops, laptops, tablets, and smartphones. Your family data syncs securely across all devices.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does AI help with my family tree?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our built-in AI tools help generate rich historical biographies, suggest names, extract text from ancestral documents (OCR), enhance and restore old family photos, and infer complex multi-generational relationships.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my family tree private and secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. By default, all family trees are strictly private and only accessible to you and collaborators you explicitly invite. You have full control over whether to share a tree via private link or make it public.',
      },
    },
  ],
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={faqSchema} />
      {children}
    </>
  );
}
