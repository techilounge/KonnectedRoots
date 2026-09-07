"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getAdminTrees } from '@/app/admin/actions';
import type { AdminTreeItem } from '@/types';
import {
  TreeDeciduous,
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
  Users,
  Lock,
  Globe,
  Link2,
  Calendar,
  Download,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import AdminPagination from '@/components/admin/AdminPagination';

export default function AdminTreesPage() {
  const { user } = useAuth();
  const [trees, setTrees] = useState<AdminTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTree, setSelectedTree] = useState<AdminTreeItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchTrees = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const idToken = await user.getIdToken();
      const list = await getAdminTrees(idToken, { search: search.trim() || undefined });
      setTrees(list);
    } catch (e) {
      console.error('Error fetching admin trees:', e);
    } finally {
      setLoading(false);
    }
  };

  const searchParams = useSearchParams();

  // Load ?q= from URL param if present
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Live Search with 280ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTrees();
    }, 280);
    return () => clearTimeout(timer);
  }, [search, user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTrees();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <TreeDeciduous className="h-6 w-6 text-emerald-600" />
            Global Trees & Content Management
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Monitor and inspect all family trees created across the KonnectedRoots platform.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTrees} disabled={loading} className="text-xs gap-1.5 h-9">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Directory
        </Button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Live search by title, slug, or owner UID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10 text-xs bg-card"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Trees Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Tree Title</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4">Collaborators</th>
                <th className="py-3 px-4">Owner UID</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-3 px-4">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : trees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No family trees found.
                  </td>
                </tr>
              ) : (
                trees
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <TreeDeciduous className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">{t.slug || t.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {t.memberCount} members
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span className="capitalize inline-flex items-center gap-1 font-medium text-muted-foreground">
                        {t.visibility === 'public' ? (
                          <Globe className="h-3 w-3 text-blue-500" />
                        ) : t.visibility === 'link' ? (
                          <Link2 className="h-3 w-3 text-amber-500" />
                        ) : (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        {t.visibility}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-muted-foreground">{t.collaboratorCount} collaborators</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {t.ownerId}
                    </td>

                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTree(t)}
                          className="h-7 text-xs px-2"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 text-xs px-2 text-primary"
                        >
                          <Link href={`/tree/${t.id}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {trees.length > 0 && (
          <div className="p-4 border-t border-border/40">
            <AdminPagination
              currentPage={currentPage}
              totalItems={trees.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="trees"
            />
          </div>
        )}
      </Card>

      {/* Tree Inspect Modal */}
      {selectedTree && (
        <Dialog open={!!selectedTree} onOpenChange={(open) => !open && setSelectedTree(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TreeDeciduous className="h-5 w-5 text-emerald-600" />
                {selectedTree.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Administrative diagnostics and member summary
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tree Document ID:</span>
                  <span className="font-mono text-[11px]">{selectedTree.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SEO URL Slug:</span>
                  <span className="font-mono text-[11px]">{selectedTree.slug || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner UID:</span>
                  <span className="font-mono text-[11px]">{selectedTree.ownerId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg">
                  <span className="text-muted-foreground text-[11px]">Total Members</span>
                  <p className="text-lg font-bold">{selectedTree.memberCount}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <span className="text-muted-foreground text-[11px]">Visibility</span>
                  <p className="text-lg font-bold capitalize">{selectedTree.visibility}</p>
                </div>
              </div>

              <div className="p-3 border rounded-lg space-y-1">
                <span className="text-muted-foreground text-[11px] font-semibold">Collaborators</span>
                {Object.keys(selectedTree.collaborators || {}).length === 0 ? (
                  <p className="text-muted-foreground text-xs">No collaborators assigned.</p>
                ) : (
                  <div className="space-y-1 pt-1">
                    {Object.entries(selectedTree.collaborators || {}).map(([uid, role]) => (
                      <div key={uid} className="flex justify-between text-[11px]">
                        <span className="font-mono text-muted-foreground truncate max-w-[200px]">{uid}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" asChild size="sm">
                <Link href={`/tree/${selectedTree.id}`} target="_blank">
                  Open in Tree Canvas <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button onClick={() => setSelectedTree(null)} size="sm">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
