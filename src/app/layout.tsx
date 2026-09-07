import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import CookieConsentBanner from '@/components/shared/CookieConsentBanner';
import SystemBroadcastBanner from '@/components/shared/SystemBroadcastBanner';
import { AuthProvider } from '@/hooks/useAuth';
import { Analytics } from "@vercel/analytics/next";
import JsonLd from '@/components/seo/JsonLd';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'KonnectedRoots - Build & Share Your Family Tree Online',
    template: '%s | KonnectedRoots',
  },
  description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools, GEDCOM support, and AI-powered suggestions.',
  keywords: [
    'family tree builder',
    'genealogy software',
    'ancestry tree',
    'family history',
    'GEDCOM import export',
    'AI genealogy',
    'family tree collaboration',
    'photo restoration genealogy',
    'family lineage map',
    'free family tree maker',
  ],
  authors: [{ name: 'KonnectedRoots', url: siteUrl }],
  creator: 'KonnectedRoots',
  publisher: 'KonnectedRoots',
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/KonnectedRoots_Favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'KonnectedRoots - Build & Share Your Family Tree Online',
    description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools, GEDCOM support, and AI-powered suggestions.',
    url: siteUrl,
    siteName: 'KonnectedRoots',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KonnectedRoots - Build Your Family Tree, Connect Your Roots',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KonnectedRoots - Build & Share Your Family Tree Online',
    description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools, GEDCOM support, and AI-powered suggestions.',
    images: ['/og-image.png'],
    creator: '@konnectedroots',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KonnectedRoots',
  url: siteUrl,
  logo: `${siteUrl}/favicon.png`,
  description: 'Next-generation family tree builder and collaborative genealogy platform powered by AI.',
  sameAs: [
    'https://twitter.com/konnectedroots',
    'https://facebook.com/konnectedroots',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@konnectedroots.app',
    contactType: 'customer support',
    availableLanguage: 'English',
  },
};

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'KonnectedRoots',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${siteUrl}/guide?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KonnectedRoots',
  operatingSystem: 'All (Web Browser)',
  applicationCategory: 'GenealogyApplication',
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'Free Plan',
    },
    {
      '@type': 'Offer',
      price: '9.99',
      priceCurrency: 'USD',
      name: 'Pro Plan',
      billingDuration: 'P1M',
    },
    {
      '@type': 'Offer',
      price: '19.99',
      priceCurrency: 'USD',
      name: 'Family Plan',
      billingDuration: 'P1M',
    },
  ],
  description: 'Build interactive family trees with real-time collaboration, GEDCOM import/export, document OCR, and AI-assisted biographies.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        {/* Global Structured Data */}
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
        <JsonLd data={softwareAppSchema} />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
          >
            Skip to main content
          </a>
          <SystemBroadcastBanner />
          <Header />
          <main id="main-content" className="flex-grow">
            {children}
          </main>
          <Footer />
          <Toaster />
          <CookieConsentBanner />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
