import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase/admin';

interface TreeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ treeId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ treeId: string }>;
}): Promise<Metadata> {
  const { treeId } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app';

  try {
    const docSnap = await adminDb.collection('trees').doc(treeId).get();
    if (!docSnap.exists) {
      return {
        title: 'Tree Not Found | KonnectedRoots',
        robots: { index: false, follow: false },
      };
    }

    const tree = docSnap.data();
    if (!tree || tree.visibility !== 'public') {
      // Private or unlisted tree - do not index
      return {
        title: 'Family Tree | KonnectedRoots',
        robots: { index: false, follow: false },
      };
    }

    const title = `${tree.title || 'Untitled'} - Family Tree | KonnectedRoots`;
    const memberCount = tree.memberCount || 0;
    const description = `Explore the ${tree.title || 'Family'} lineage featuring ${memberCount} family members on KonnectedRoots. Discover ancestral roots and family connections.`;

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/tree/${treeId}`,
      },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/tree/${treeId}`,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch (err) {
    return {
      title: 'Family Tree | KonnectedRoots',
      robots: { index: false, follow: false },
    };
  }
}

export default function TreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
