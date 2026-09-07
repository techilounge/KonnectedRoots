"use client";

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuditLogs } from '@/app/admin/actions';
import type { AuditLogItem } from '@/types';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  CreditCard,
  TreeDeciduous,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AdminPagination from '@/components/admin/AdminPagination';

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, startTransition] = useTransition();

  const loadLogs = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await getAuditLogs(token, {
        category: categoryFilter,
        limit: 100,
      });
      setLogs(res);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [user, categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    startTransition(() => {
      loadLogs();
    });
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.adminEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      (log.targetId && log.targetId.toLowerCase().includes(q))
    );
  });

  const getCategoryBadge = (category: AuditLogItem['category']) => {
    switch (category) {
      case 'security':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[11px]">Security</Badge>;
      case 'subscription':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px]">Billing</Badge>;
      case 'configuration':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[11px]">Config</Badge>;
      case 'tree_moderation':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px]">Tree</Badge>;
      case 'user_management':
      default:
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px]">User</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs & Security Trail</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Cryptographically logged record of all administrator actions, role modifications, and configuration updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search admin, action, target ID, details..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-full sm:w-48 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="user_management">User Management</SelectItem>
                  <SelectItem value="subscription">Subscriptions & Billing</SelectItem>
                  <SelectItem value="security">Security & Roles</SelectItem>
                  <SelectItem value="configuration">System Configuration</SelectItem>
                  <SelectItem value="tree_moderation">Tree Moderation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Immutable Administrative Ledger</CardTitle>
              <CardDescription className="text-xs">
                Displaying {filteredLogs.length} logged entries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
              <p className="text-sm">No audit logs matching current filter query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                    <TableHead className="text-xs font-semibold">Admin</TableHead>
                    <TableHead className="text-xs font-semibold">Action</TableHead>
                    <TableHead className="text-xs font-semibold">Category</TableHead>
                    <TableHead className="text-xs font-semibold">Target</TableHead>
                    <TableHead className="text-xs font-semibold">Details</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map(log => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <span className="truncate max-w-[140px]">{log.adminEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold tracking-wider">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(log.category)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                        {log.targetId || '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-sm">
                        <p className="line-clamp-2 text-foreground/90">{log.details}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-8 text-xs gap-1 text-primary hover:text-primary"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredLogs.length > 0 && (
            <AdminPagination
              currentPage={currentPage}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="logs"
              className="border-t border-border/40 mt-3 pt-3"
            />
          )}
        </CardContent>
      </Card>

      {/* Metadata Detail Dialog */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={open => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCode className="w-4 h-4 text-primary" />
              Audit Log Event Details
            </DialogTitle>
            <DialogDescription className="text-xs font-mono">
              Event ID: {selectedLog?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Administrator</span>
                  <span className="font-medium text-foreground">{selectedLog.adminEmail}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                  <span className="font-mono text-foreground">{new Date(selectedLog.timestamp).toISOString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Action</span>
                  <span className="font-mono font-semibold text-foreground">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Category</span>
                  <span className="font-medium text-foreground">{selectedLog.category}</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] mb-1 font-semibold">Summary Details</span>
                <p className="p-2.5 rounded-lg border border-border/40 bg-background text-foreground">
                  {selectedLog.details}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-1 font-semibold">Raw JSON Metadata Payload</span>
                  <pre className="p-3 rounded-lg border border-border/40 bg-muted/60 font-mono text-[11px] overflow-x-auto max-h-48 text-foreground/90">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
