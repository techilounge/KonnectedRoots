import { clientEnv } from '@/lib/config/env.client';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = clientEnv.appUrl;

export const metadata: Metadata = {
  title: 'Plans & Pricing | Free, Pro & Family Tree Subscriptions',
  description: 'Choose the ideal family tree subscription plan. Start free with 3 trees, or unlock unlimited possibilities, advanced AI credits, and family collaboration seats with Pro and Family tiers.',
  keywords: [
    'family tree pricing',
    'genealogy software subscription',
    'ancestry tree pricing',
    'free family tree builder',
    'GEDCOM import software cost',
    'family tree plans',
  ],
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    title: 'Plans & Pricing | KonnectedRoots',
    description: 'Simple, transparent pricing for preserving your family history. Start free or upgrade for powerful AI tools and family collaboration.',
    url: `${siteUrl}/pricing`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plans & Pricing | KonnectedRoots',
    description: 'Simple, transparent pricing for preserving your family history. Start free or upgrade for powerful AI tools.',
  },
};

const pricingSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'KonnectedRoots Family Tree Platform',
  description: 'Collaborative family tree builder with AI enhancements and GEDCOM support.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Plan',
      price: '0.00',
      priceCurrency: 'USD',
      description: '3 family trees, up to 100 members per tree, 10 monthly AI credits, GEDCOM import/export.',
    },
    {
      '@type': 'Offer',
      name: 'Pro Plan',
      price: '9.99',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: '10 family trees, up to 1,000 members per tree, 100 monthly AI credits, full GEDCOM import/export, photo restoration.',
    },
    {
      '@type': 'Offer',
      name: 'Family Plan',
      price: '19.99',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: '50 family trees, up to 5,000 members per tree, 300 monthly AI credits, 5 family collaboration seats.',
    },
  ],
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={pricingSchema} />
      {children}
    </>
  );
}
