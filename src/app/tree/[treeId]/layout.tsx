import type { Metadata } from 'next';
import { cache } from 'react';
import { clientEnv } from '@/lib/config/env.client';
import { treeMetadata, type MetadataTree } from '@/lib/trees/metadata';

// Per-request memoization; never cache private tree contents across users.
const publicMetadataTree = cache(async (routeValue: string): Promise<MetadataTree | null> => {
  const { adminDb } = await import('@/lib/firebase/admin');
  const trees = adminDb.collection('trees');
  const direct = await trees.doc(routeValue).get();
  if (direct.exists) {
    const data = direct.data();
    return data?.visibility === 'public' ? { ...data, id: direct.id } : null;
  }
  // The browser accepts slugs as well as document IDs. Only public slugs may
  // contribute anonymous metadata; private names never leave the server.
  const matches = await trees.where('slug', '==', routeValue).where('visibility', '==', 'public').limit(2).get();
  if (matches.size !== 1) return null;
  return { ...matches.docs[0].data(), id: matches.docs[0].id };
});

export async function generateMetadata({ params }: { params: Promise<{ treeId: string }> }): Promise<Metadata> {
  try {
    return treeMetadata(await publicMetadataTree((await params).treeId), clientEnv.appUrl);
  } catch {
    console.warn('[tree_metadata] Public metadata lookup unavailable');
    return treeMetadata(null, clientEnv.appUrl);
  }
}

export default function TreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
