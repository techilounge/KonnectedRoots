import { clientEnv } from '@/lib/config/env.client';
import type { MetadataRoute } from 'next';


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = clientEnv.appUrl;


  // Core public marketing & high-intent pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/features`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guide`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Public marketing routes are deterministic and require no database credentials.
  return staticPages;
}
