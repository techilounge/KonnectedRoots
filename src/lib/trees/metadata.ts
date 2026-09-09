import type { Metadata } from 'next';

export interface MetadataTree {
  id: string;
  title?: string;
  visibility?: string;
  memberCount?: number;
}

export function treeMetadata(tree: MetadataTree | null, siteUrl: string): Metadata {
  if (!tree || tree.visibility !== 'public') {
    // Anonymous SSR cannot distinguish authorization from absence safely.
    return { title: 'Family Tree | KonnectedRoots', robots: { index: false, follow: false } };
  }
  const title = `${tree.title || 'Untitled'} - Family Tree | KonnectedRoots`;
  const description = `Explore the ${tree.title || 'Family'} lineage featuring ${tree.memberCount || 0} family members on KonnectedRoots. Discover ancestral roots and family connections.`;
  const url = `${siteUrl}/tree/${encodeURIComponent(tree.id)}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export function authenticatedTreeTitle(tree: { title: string } | null) {
  return tree ? `${tree.title || 'Untitled'} - Family Tree | KonnectedRoots` : 'Family Tree | KonnectedRoots';
}
