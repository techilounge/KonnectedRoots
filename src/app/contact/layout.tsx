import { clientEnv } from '@/lib/config/env.client';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = clientEnv.appUrl;

export const metadata: Metadata = {
  title: 'Contact Support & Inquiries | KonnectedRoots',
  description: 'Reach out to the KonnectedRoots customer support team. Have questions about your family tree, GEDCOM imports, or subscriptions? We are here to help.',
  keywords: [
    'contact KonnectedRoots',
    'family tree customer support',
    'genealogy software help',
    'KonnectedRoots support team',
  ],
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    title: 'Contact Us | KonnectedRoots',
    description: 'We are here to assist with your family tree builder questions, technical support, and partnership inquiries.',
    url: `${siteUrl}/contact`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | KonnectedRoots',
    description: 'We are here to assist with your family tree builder questions, technical support, and partnership inquiries.',
  },
};

const contactPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact KonnectedRoots',
  url: `${siteUrl}/contact`,
  description: 'Support and contact inquiry page for KonnectedRoots users.',
  mainEntity: {
    '@type': 'Organization',
    name: 'KonnectedRoots',
    url: siteUrl,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@konnectedroots.app',
      availableLanguage: 'English',
    },
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={contactPageSchema} />
      {children}
    </>
  );
}
