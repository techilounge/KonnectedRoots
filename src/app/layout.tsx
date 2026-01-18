import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import { AuthProvider } from '@/hooks/useAuth'; // Using mocked AuthProvider

export const metadata: Metadata = {
  title: 'KonnectedRoots - Build & Share Your Family Tree Online',
  description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools and AI-powered suggestions.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/KonnectedRoots_Favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  metadataBase: new URL('https://www.konnectedroots.app'),
  openGraph: {
    title: 'KonnectedRoots - Build & Share Your Family Tree Online',
    description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools and AI-powered suggestions.',
    url: 'https://www.konnectedroots.app',
    siteName: 'KonnectedRoots',
    images: [
      {
        url: 'https://www.konnectedroots.app/og-image.png',
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
    description: 'Build, explore, and share your family tree with KonnectedRoots. Discover your heritage with our intuitive tools and AI-powered suggestions.',
    images: ['https://www.konnectedroots.app/og-image.png'],
  },
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
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
