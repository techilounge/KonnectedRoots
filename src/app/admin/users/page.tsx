"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getAdminUsers,
  updateUserPlanByAdmin,
  grantBonusCreditsByAdmin,
  setPlatformAdminRole,
  toggleUserAccountStatus,
} from '@/app/admin/actions';
import type { AdminUserItem, PlatformRole } from '@/types';
import {
  Users,
  Search,
  Filter,
  MoreHorizontal,
  CreditCard,
  Sparkles,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  ExternalLink,
  Sliders,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import AdminPagination from '@/components/admin/AdminPagination';

export default function AdminUsersPage() {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected user for detail modal
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);

  // Modals state
  const [planChangeDialog, setPlanChangeDialog] = useState<{ user: AdminUserItem; targetPlan: string } | null>(null);
  const [creditDialog, setCreditDialog] = useState<{ user: AdminUserItem; amount: number; reason: string } | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ user: AdminUserItem; targetRole: PlatformRole } | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ user: AdminUserItem; disabled: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const idToken = await user.getIdToken();
      const list = await getAdminUsers(idToken, {
        search: search.trim() || undefined,
        plan: planFilter !== 'all' ? planFilter : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setUsers(list);
    } catch (e: any) {
      console.error('Failed to fetch users:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load user directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user, planFilter, roleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, planFilter, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  // 1. Confirm Plan Change
  const handleConfirmPlanChange = async () => {
    if (!user || !planChangeDialog) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      await updateUserPlanByAdmin(
        idToken,
        planChangeDialog.user.uid,
        planChangeDialog.targetPlan as any,
        'Changed via Admin Console'
      );
      toast({
        title: 'Plan Updated',
        description: `Successfully updated ${planChangeDialog.user.email} to ${planChangeDialog.targetPlan.toUpperCase()}.`,
      });
      setPlanChangeDialog(null);
      await fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update plan.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Confirm Grant Bonus Credits
  const handleConfirmGrantCredits = async () => {
    if (!user || !creditDialog) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      await grantBonusCreditsByAdmin(
        idToken,
        creditDialog.user.uid,
        creditDialog.amount,
        creditDialog.reason || 'Admin Courtesy Grant'
      );
      toast({
        title: 'Credits Granted',
        description: `Added +${creditDialog.amount} AI credits to ${creditDialog.user.email}.`,
      });
      setCreditDialog(null);
      await fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to grant credits.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Confirm Role Change
  const handleConfirmRoleChange = async () => {
    if (!user || !roleDialog) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      await setPlatformAdminRole(idToken, roleDialog.user.uid, roleDialog.targetRole);
      toast({
        title: 'Role Updated',
        description: `Updated platform role for ${roleDialog.user.email} to ${roleDialog.targetRole}.`,
      });
      setRoleDialog(null);
      await fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update role.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Confirm Suspend / Reactivate
  const handleConfirmToggleSuspend = async () => {
    if (!user || !suspendDialog) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      await toggleUserAccountStatus(idToken, suspendDialog.user.uid, suspendDialog.disabled);
      toast({
        title: suspendDialog.disabled ? 'Account Suspended' : 'Account Restored',
        description: `Account for ${suspendDialog.user.email} has been ${suspendDialog.disabled ? 'suspended' : 'reactivated'}.`,
      });
      setSuspendDialog(null);
      await fetchUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to change account status.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Users & Entitlements Management
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Search, inspect, and manage platform users, plans, role privileges, and AI allowances.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="text-xs gap-1.5 h-9">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Directory
        </Button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, or UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs bg-card"
          />
        </form>

        <div className="flex gap-2">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-32 h-10 text-xs bg-card">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="family">Family</SelectItem>
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32 h-10 text-xs bg-card">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">AI Credits Used</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Last Active</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((u) => {
                    const initial = (u.displayName?.[0] || u.email?.[0] || 'U').toUpperCase();
                    const isSuspended = u.disabled;

                    return (
                      <tr key={u.uid} className="hover:bg-muted/30 transition-colors">
                        {/* User Cell */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.photoURL} alt={u.displayName} />
                              <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-bold">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{u.displayName}</p>
                              <p className="text-muted-foreground text-[11px] truncate max-w-[180px]">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Plan Cell */}
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`capitalize text-[10px] font-semibold ${
                              u.plan === 'family'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                                : u.plan === 'pro'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            }`}
                          >
                            {u.plan}
                          </Badge>
                        </td>

                        {/* Role Cell */}
                        <td className="py-3 px-4">
                          {u.isPlatformAdmin ? (
                            <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground font-semibold">
                              Admin
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">User</span>
                          )}
                        </td>

                        {/* AI Usage */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 font-medium">
                            <span>{u.aiActionsUsed ?? 0}</span>
                            <span className="text-muted-foreground">/ {u.aiActionsAllowance ?? 10}</span>
                          </div>
                        </td>

                        {/* Created */}
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>

                        {/* Last Active */}
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString() : '—'}
                        </td>

                        {/* Action Menu */}
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setSelectedUser(u)} className="cursor-pointer">
                                View Full Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              {/* Change Plan Sub-items */}
                              <DropdownMenuItem
                                onClick={() => setPlanChangeDialog({ user: u, targetPlan: u.plan === 'pro' ? 'family' : 'pro' })}
                                className="cursor-pointer"
                              >
                                <CreditCard className="mr-2 h-3.5 w-3.5 text-amber-500" />
                                Modify Plan
                              </DropdownMenuItem>

                              {/* Grant Credits Sub-item */}
                              <DropdownMenuItem
                                onClick={() => setCreditDialog({ user: u, amount: 25, reason: '' })}
                                className="cursor-pointer"
                              >
                                <Sparkles className="mr-2 h-3.5 w-3.5 text-purple-500" />
                                Grant AI Credits
                              </DropdownMenuItem>

                              {/* Promote / Demote Role (Only Super Admin) */}
                              {isSuperAdmin && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRoleDialog({
                                      user: u,
                                      targetRole: u.role === 'admin' || u.role === 'super_admin' ? 'user' : 'admin',
                                    })
                                  }
                                  className="cursor-pointer"
                                >
                                  <Shield className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                  {u.role === 'admin' || u.role === 'super_admin' ? 'Demote to User' : 'Promote to Admin'}
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              {/* Suspend Account */}
                              <DropdownMenuItem
                                onClick={() => setSuspendDialog({ user: u, disabled: !isSuspended })}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                {isSuspended ? (
                                  <>
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                    Restore Account
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-2 h-3.5 w-3.5" />
                                    Suspend Account
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <div className="p-4 border-t border-border/40">
            <AdminPagination
              currentPage={currentPage}
              totalItems={users.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="users"
            />
          </div>
        )}
      </Card>

      {/* 1. Plan Change AlertDialog */}
      <AlertDialog open={!!planChangeDialog} onOpenChange={(open) => !open && setPlanChangeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Subscription Plan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  You are changing the subscription plan for <strong>{planChangeDialog?.user.email}</strong> from{' '}
                  <strong className="capitalize text-foreground">{planChangeDialog?.user.plan}</strong> to{' '}
                  <strong className="capitalize text-foreground">{planChangeDialog?.targetPlan}</strong>.
                </p>
                <p>This will update their tree limit, member count limits, and monthly AI credit allowances.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select
              value={planChangeDialog?.targetPlan}
              onValueChange={(val) => planChangeDialog && setPlanChangeDialog({ ...planChangeDialog, targetPlan: val })}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free Tier</SelectItem>
                <SelectItem value="pro">Pro ($9.99/mo)</SelectItem>
                <SelectItem value="family">Family ($19.99/mo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPlanChange} disabled={actionLoading}>
              Confirm Plan Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2. Grant AI Credits Dialog */}
      <Dialog open={!!creditDialog} onOpenChange={(open) => !open && setCreditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Grant Bonus AI Credits
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add bonus AI actions to <strong>{creditDialog?.user.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold">Bonus Credits Amount</label>
              <Select
                value={String(creditDialog?.amount || 25)}
                onValueChange={(val) => creditDialog && setCreditDialog({ ...creditDialog, amount: Number(val) })}
              >
                <SelectTrigger className="w-full text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">+10 Credits</SelectItem>
                  <SelectItem value="25">+25 Credits</SelectItem>
                  <SelectItem value="50">+50 Credits</SelectItem>
                  <SelectItem value="100">+100 Credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">Reason (Audit Trail)</label>
              <Input
                type="text"
                placeholder="e.g. Courtesy compensation, promotion"
                value={creditDialog?.reason || ''}
                onChange={(e) => creditDialog && setCreditDialog({ ...creditDialog, reason: e.target.value })}
                className="text-xs mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGrantCredits} disabled={actionLoading} className="bg-primary hover:bg-primary/90">
              Grant Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Role Change AlertDialog */}
      <AlertDialog open={!!roleDialog} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Platform Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set the platform role for <strong>{roleDialog?.user.email}</strong> to{' '}
              <strong className="uppercase text-foreground">{roleDialog?.targetRole}</strong>? Platform administrators have access to all user records, tree data, and system settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRoleChange} disabled={actionLoading}>
              Confirm Role Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 4. Suspend Account AlertDialog */}
      <AlertDialog open={!!suspendDialog} onOpenChange={(open) => !open && setSuspendDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={suspendDialog?.disabled ? 'text-destructive' : ''}>
              {suspendDialog?.disabled ? 'Suspend User Account?' : 'Reactivate User Account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendDialog?.disabled
                ? `Suspending ${suspendDialog?.user.email} will immediately revoke their active sessions and prevent them from logging in.`
                : `Reactivating ${suspendDialog?.user.email} will allow them to log in and manage their trees.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleSuspend}
              disabled={actionLoading}
              className={suspendDialog?.disabled ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}
            >
              {suspendDialog?.disabled ? 'Suspend Account' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5. User Detail Drawer Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Account Overview
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detailed profile metadata and subscription records
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedUser.photoURL} alt={selectedUser.displayName} />
                  <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">
                    {(selectedUser.displayName?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedUser.displayName}</p>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">UID: {selectedUser.uid}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg space-y-1">
                  <span className="text-muted-foreground text-[11px]">Subscription Plan</span>
                  <p className="text-sm font-bold capitalize">{selectedUser.plan}</p>
                </div>
                <div className="p-3 border rounded-lg space-y-1">
                  <span className="text-muted-foreground text-[11px]">Platform Role</span>
                  <p className="text-sm font-bold capitalize">{selectedUser.role || 'User'}</p>
                </div>
                <div className="p-3 border rounded-lg space-y-1">
                  <span className="text-muted-foreground text-[11px]">AI Credits Used</span>
                  <p className="text-sm font-bold">
                    {selectedUser.aiActionsUsed ?? 0} / {selectedUser.aiActionsAllowance ?? 10}
                  </p>
                </div>
                <div className="p-3 border rounded-lg space-y-1">
                  <span className="text-muted-foreground text-[11px]">Stripe Customer ID</span>
                  <p className="text-xs font-mono truncate">{selectedUser.stripeCustomerId || 'None (Free tier)'}</p>
                </div>
              </div>

              <div className="p-3 bg-muted/20 border rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined Platform:</span>
                  <span className="font-medium">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Activity:</span>
                  <span className="font-medium">{selectedUser.lastActivityAt ? new Date(selectedUser.lastActivityAt).toLocaleString() : 'Never'}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedUser(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
