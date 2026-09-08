"use client";

import { useEffect, useState, useTransition } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getAdminAIMeteringData, grantBonusCreditsByAdmin } from '@/app/admin/actions';
import type { AdminAIMeteringData } from '@/app/admin/actions';
import {
  Sparkles,
  Zap,
  DollarSign,
  TrendingUp,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  FileText,
  Camera,
  BookOpen,
  Languages,
  Users2,
  Plus,
  BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import Link from 'next/link';

export default function AdminAIMeteringPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminAIMeteringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, startTransition] = useTransition();

  // Bonus Credits Dialog state
  const [selectedUser, setSelectedUser] = useState<AdminAIMeteringData['topUsers'][0] | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(50);
  const [creditReason, setCreditReason] = useState('');
  const [submittingCredits, setSubmittingCredits] = useState(false);
  const [creditSuccessMsg, setCreditSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await getAdminAIMeteringData(token);
      setData(res);
      if (refreshing) toast({ title: 'AI operations refreshed' });
    } catch (err) {
      console.error('Failed to load AI metering data:', err);
      toast({ variant: 'destructive', title: 'Could not load AI operations' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    startTransition(() => {
      loadData();
    });
  };

  const handleGrantCredits = async () => {
    if (!user || !selectedUser) return;
    setSubmittingCredits(true);
    setCreditSuccessMsg(null);
    try {
      const token = await user.getIdToken();
      await grantBonusCreditsByAdmin(
        token,
        selectedUser.uid,
        creditAmount,
        creditReason || 'Administrator bonus grant from AI Metering console'
      );
      setCreditSuccessMsg(`Successfully credited +${creditAmount} AI actions to ${selectedUser.email}`);
      toast({ title: 'Credits granted', description: `${creditAmount} AI credits added.` });
      setTimeout(() => {
        setSelectedUser(null);
        setCreditSuccessMsg(null);
        setCreditReason('');
        loadData();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to grant bonus credits:', err);
      toast({ variant: 'destructive', title: 'Action failed', description: 'Failed to grant credits' });
    } finally {
      setSubmittingCredits(false);
    }
  };

  const filteredTopUsers = (data?.topUsers || []).filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getToolIcon = (toolKey: string) => {
    switch (toolKey) {
      case 'generateBiography':
        return <BookOpen className="w-5 h-5 text-purple-500" />;
      case 'suggestName':
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'extractDocumentText':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'enhancePhoto':
        return <Camera className="w-5 h-5 text-emerald-500" />;
      case 'translateDocument':
        return <Languages className="w-5 h-5 text-pink-500" />;
      case 'findRelationship':
      default:
        return <Users2 className="w-5 h-5 text-primary" />;
    }
  };

  const chartColors = ['#8B5CF6', '#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#3E7D3B'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">AI Operations & Metering</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            UTC month telemetry, estimated provider costs and application credit quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            {data?.modelSummary || 'No telemetry yet'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total AI Consumed */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total AI Invocations</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Zap className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {data?.totalComputeUsed.toLocaleString()}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-purple-600 bg-purple-500/10 border-purple-500/20 px-1.5 py-0">
                Monthly credits
              </Badge>
              <span>Platform-wide calls</span>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Model Cost */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Compute Cost</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                ${data?.estimatedCostUsd.toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className="text-emerald-600 font-medium">Avg {data?.averageCost == null ? '—' : '$' + data.averageCost.toFixed(6)}</span>
              <span>per generation</span>
            </div>
          </CardContent>
        </Card>

        {/* Quota Utilization */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quota Utilization</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {data?.utilizationRate}%
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span>{data?.totalComputeUsed} of {data?.totalAllowanceAllUsers} credits</span>
            </div>
          </CardContent>
        </Card>

        {/* Average Model Latency */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Latency</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {data?.averageLatencyMs == null ? '—' : data.averageLatencyMs + 'ms'}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 px-1.5 py-0">
                Recorded
              </Badge>
              <span>{data?.successRate == null ? 'No completed invocations' : data.successRate.toFixed(1) + '% success'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">Reported tokens: {data?.inputTokens.toLocaleString() ?? '0'} input / {data?.outputTokens.toLocaleString() ?? '0'} output. Reserved spending: {data?.reservedCost.toFixed(4) ?? '0'} USD. Missing provider usage is conservatively estimated; figures are not invoices.</p>
      {/* Volume by Tool Chart */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            AI Generation Volume by Feature Tool
          </CardTitle>
          <CardDescription className="text-xs">
            Aggregated call count breakdown across genealogy workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.toolBreakdown || []} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                    formatter={(val: number) => [`${val} calls`, 'Volume']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {(data?.toolBreakdown || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Intelligence Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tool Intelligence & Unit Pricing</h2>
          <p className="text-xs text-muted-foreground">Individual tool unit economics and consumption parameters</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.toolBreakdown || []).map(tool => (
            <Card key={tool.toolKey} className="border-border/50 bg-background/50 hover:bg-card/70 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted/60">
                      {getToolIcon(tool.toolKey)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm leading-tight">{tool.name}</h3>
                      <span className="font-mono text-xs text-muted-foreground">${tool.costPerUnit} / call</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {tool.percentage}%
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mt-3 line-clamp-2 min-h-[32px]">
                  {tool.description}
                </p>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground">Volume: </span>
                    <span className="font-semibold text-foreground">{tool.count.toLocaleString()} calls</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Cost: </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">${tool.totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <Progress value={tool.percentage} className="h-1.5 mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Top AI Power Users Table */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Top AI Power Users</CardTitle>
              <CardDescription className="text-xs">
                Accounts utilizing the highest volume of platform intelligence features
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user email or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredTopUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No AI power users found matching filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">User</TableHead>
                    <TableHead className="text-xs font-semibold">Plan</TableHead>
                    <TableHead className="text-xs font-semibold">Actions Consumed</TableHead>
                    <TableHead className="text-xs font-semibold">Monthly Allowance</TableHead>
                    <TableHead className="text-xs font-semibold">Quota Usage</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopUsers.map(u => (
                    <TableRow key={u.uid} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{u.displayName}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            u.plan === 'pro'
                              ? 'border-primary/30 text-primary bg-primary/5 text-xs'
                              : u.plan === 'family'
                              ? 'border-blue-500/30 text-blue-600 bg-blue-500/5 text-xs'
                              : 'text-muted-foreground text-xs'
                          }
                        >
                          {u.plan.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {u.aiActionsUsed} calls
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.aiActionsAllowance} credits/mo
                      </TableCell>
                      <TableCell className="w-48">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-mono">{u.percentUsed}%</span>
                            <span className="text-[11px] text-muted-foreground">
                              {u.aiActionsAllowance - u.aiActionsUsed} left
                            </span>
                          </div>
                          <Progress
                            value={Math.min(100, u.percentUsed)}
                            className={`h-2 ${
                              u.percentUsed >= 90
                                ? '[&>div]:bg-red-500'
                                : u.percentUsed >= 75
                                ? '[&>div]:bg-amber-500'
                                : '[&>div]:bg-primary'
                            }`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(u)}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          Grant Credits
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

      {/* Live AI Execution Stream */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-500" />
            Live AI Generation Activity Stream
          </CardTitle>
          <CardDescription className="text-xs">
            Recent provider attempts recorded by the AI gateway
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.recentInvocations || []).map(inv => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/40 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{inv.tool}</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        {inv.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{inv.userEmail}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-medium text-foreground">{inv.durationMs}ms</span>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grant Bonus Credits Dialog */}
      <Dialog open={Boolean(selectedUser)} onOpenChange={open => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5" />
              Grant Bonus AI Credits
            </DialogTitle>
            <DialogDescription className="text-xs">
              Directly grant complimentary AI generation credits to <strong>{selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          {creditSuccessMsg ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{creditSuccessMsg}</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Credits to Add</label>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 100, 200].map(amt => (
                    <Button
                      key={amt}
                      type="button"
                      variant={creditAmount === amt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCreditAmount(amt)}
                      className="text-xs"
                    >
                      +{amt}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Custom Credit Amount</label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={creditAmount}
                  onChange={e => setCreditAmount(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Audit Reason</label>
                <Input
                  placeholder="e.g. Loyalty perk, support resolution, research grant..."
                  value={creditReason}
                  onChange={e => setCreditReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
                Current Allowance: <strong>{selectedUser?.aiActionsAllowance}</strong> → New Allowance: <strong>{(selectedUser?.aiActionsAllowance || 0) + creditAmount}</strong>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUser(null)}
              disabled={submittingCredits}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGrantCredits}
              disabled={submittingCredits || creditAmount <= 0}
              className="gap-2 bg-primary text-primary-foreground"
            >
              {submittingCredits ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Granting...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Confirm +{creditAmount} Credits
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
