import type { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';
  const currentDate = new Date();

  // Core public marketing & high-intent pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Dynamically include public trees
  let dynamicPublicTrees: MetadataRoute.Sitemap = [];
  try {
    const publicTreesSnap = await adminDb
      .collection('trees')
      .where('visibility', '==', 'public')
      .limit(500)
      .get();

    dynamicPublicTrees = publicTreesSnap.docs.map((doc) => {
      const data = doc.data();
      const lastMod = data.lastUpdated?.toDate ? data.lastUpdated.toDate() : currentDate;
      return {
        url: `${baseUrl}/tree/${doc.id}`,
        lastModified: lastMod,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    });
  } catch (err) {
    console.warn('Could not query public trees for sitemap, continuing with static pages:', err);
  }

  return [...staticPages, ...dynamicPublicTrees];
}
