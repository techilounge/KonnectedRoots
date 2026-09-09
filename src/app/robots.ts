import { clientEnv } from '@/lib/config/env.client';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = clientEnv.appUrl;

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
