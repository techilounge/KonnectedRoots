import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/features',
          '/pricing',
          '/guide',
          '/faq',
          '/contact',
          '/terms',
          '/privacy',
          '/tree/',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/dashboard',
          '/dashboard/*',
          '/settings',
          '/settings/*',
          '/profile',
          '/profile/*',
          '/login',
          '/signup',
          '/forgot-password',
          '/invite/*',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
