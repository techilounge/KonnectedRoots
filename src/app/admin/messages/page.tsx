"use client";

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getContactMessages, updateContactMessageStatus } from '@/app/admin/actions';
import type { ContactMessageItem } from '@/types';
import {
  Mail,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  MailQuestion,
  ExternalLink,
  Send,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);
  const [editStatus, setEditStatus] = useState<ContactMessageItem['status']>('new');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [, startTransition] = useTransition();

  const loadMessages = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await getContactMessages(token, statusFilter);
      setMessages(res);
    } catch (err) {
      console.error('Failed to load contact messages:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [user, statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    startTransition(() => {
      loadMessages();
    });
  };

  const handleSelectMessage = (msg: ContactMessageItem) => {
    setSelectedMessage(msg);
    setEditStatus(msg.status);
    setEditNotes(msg.notes || '');
  };

  const handleUpdateStatus = async () => {
    if (!user || !selectedMessage) return;
    setUpdating(true);
    try {
      const token = await user.getIdToken();
      await updateContactMessageStatus(token, selectedMessage.id, editStatus, editNotes);
      setSelectedMessage(null);
      loadMessages();
    } catch (err: any) {
      console.error('Failed to update message status:', err);
      alert(err?.message || 'Failed to update message');
    } finally {
      setUpdating(false);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      msg.name.toLowerCase().includes(q) ||
      msg.email.toLowerCase().includes(q) ||
      msg.subject.toLowerCase().includes(q) ||
      msg.message.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: ContactMessageItem['status']) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px]">New</Badge>;
      case 'in_review':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px]">In Review</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px]">Resolved</Badge>;
      case 'spam':
        return <Badge variant="outline" className="text-muted-foreground text-[11px]">Spam</Badge>;
    }
  };

  const newCount = messages.filter(m => m.status === 'new').length;
  const inReviewCount = messages.filter(m => m.status === 'in_review').length;
  const resolvedCount = messages.filter(m => m.status === 'resolved').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Mail className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Support Inquiries & Inbound Messages</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Review, categorize, and respond to incoming user feedback and contact form submissions.
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

      {/* Quick Status KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-border/50 bg-gradient-to-br from-card to-background shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending / New
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <MailQuestion className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{newCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting review or initial reply</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-card to-background shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Review
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{inReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Under investigation or in dialogue</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-card to-background shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{resolvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed inquiries</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Live search sender, email, subject, text..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Inquiries</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Inbound Contact Messages</CardTitle>
          <CardDescription className="text-xs">
            Showing {filteredMessages.length} inquiries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No messages matching current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Sender</TableHead>
                    <TableHead className="text-xs font-semibold">Subject</TableHead>
                    <TableHead className="text-xs font-semibold">Message Preview</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map(msg => (
                    <TableRow key={msg.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{msg.name || 'Anonymous'}</span>
                          <span className="text-xs text-muted-foreground">{msg.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold max-w-[180px] truncate">
                        {msg.subject}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs text-muted-foreground truncate">
                        {msg.message}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(msg.status)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectMessage(msg)}
                          className="h-8 text-xs gap-1 text-primary hover:text-primary"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          View & Reply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Inspector & Reply Dialog */}
      <Dialog open={Boolean(selectedMessage)} onOpenChange={open => !open && setSelectedMessage(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center justify-between">
              <span>{selectedMessage?.subject}</span>
              {selectedMessage && getStatusBadge(selectedMessage.status)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              From: <strong>{selectedMessage?.name}</strong> ({selectedMessage?.email}) • {selectedMessage && new Date(selectedMessage.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4 py-2 text-xs">
              {/* Message Body */}
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground text-[11px]">Inquiry Message</label>
                <div className="p-3.5 rounded-lg border border-border/40 bg-muted/30 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Status Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground text-[11px]">Workflow Status</label>
                  <Select
                    value={editStatus}
                    onValueChange={(val: any) => setEditStatus(val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="spam">Spam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <a
                    href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: ${selectedMessage.subject}`)}`}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Reply via Email Client
                  </a>
                </div>
              </div>

              {/* Internal Notes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground text-[11px]">Internal Administrative Notes</label>
                <Textarea
                  placeholder="Record internal resolution notes, actions taken, or assignee..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMessage(null)}
              disabled={updating}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateStatus}
              disabled={updating}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              {updating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Status & Notes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
