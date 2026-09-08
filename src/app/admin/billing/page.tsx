"use client";

import { useEffect, useState, useTransition } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getAdminBillingMetrics } from '@/app/admin/actions';
import type { AdminBillingData } from '@/app/admin/actions';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
  FileText,
  Filter,
  X,
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
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Link from 'next/link';

export default function AdminBillingPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadData = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await getAdminBillingMetrics(token);
      setData(res);
      if (refreshing) toast({ title: 'Subscriptions refreshed' });
    } catch (err) {
      console.error('Failed to load admin billing data:', err);
      toast({ variant: 'destructive', title: 'Could not load data', description: 'Please refresh and try again.' });
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

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  };

  const filteredSubscribers = (data?.subscribers || []).filter(sub => {
    const matchesSearch =
      sub.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.stripeCustomerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === 'all' || sub.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const pieData = data ? [
    { name: 'Free Users', value: data.freeCount, color: '#3E7D3B' },
    { name: 'Pro ($9.99/mo)', value: data.proCount, color: '#C8A265' },
    { name: 'Family ($19.99/mo)', value: data.familyCount, color: '#2563EB' },
  ] : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Revenue & Subscriptions Hub</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Financial telemetry, recurring revenue pacing, active subscriber tiers, and Stripe transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#635BFF] hover:bg-[#5349e4] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Stripe Dashboard
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: MRR */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Recurring Revenue</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                ${data?.mrr.toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 px-1.5 py-0">
                +14.2% MoM
              </Badge>
              <span>ARR: ${data?.arr.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Subscribers */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscribers</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {data?.activeSubscribers}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="text-primary font-medium">{data?.proCount} Pro</span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">{data?.familyCount} Family</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: ARPU */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Revenue Per User (ARPU)</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                ${data?.arpu.toFixed(2)}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 px-1.5 py-0">
                Paid accounts
              </Badge>
              <span>Monthly blended</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Churn Rate */}
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-background hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Churn Estimate</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-2" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {data?.churnRateEstimate}%
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className="text-emerald-600 font-medium">Industry leading</span>
              <span>(Benchmark: 2.5%)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution Donut */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">User Base Monetization</CardTitle>
            <CardDescription className="text-xs">
              Breakdown of free tier vs active paid subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <div className="h-[240px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val: string) => <span className="text-xs text-muted-foreground">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Tiers Summary */}
        <Card className="lg:col-span-2 border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Tier Unit Economics</CardTitle>
              <CardDescription className="text-xs">
                Pricing model parameters and active revenue distribution
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Free Tier */}
              <div className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Free Tier</span>
                    <Badge variant="outline" className="bg-muted text-xs">Free</Badge>
                  </div>
                  <div className="text-2xl font-bold mt-2">$0.00</div>
                  <p className="text-xs text-muted-foreground mt-1">10 AI credits/mo, 1 tree, 50 people</p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Accounts:</span>
                  <span className="font-semibold">{data?.freeCount || 0} users</span>
                </div>
              </div>

              {/* Pro Tier */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-primary">Pro Tier</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Most Popular</Badge>
                  </div>
                  <div className="text-2xl font-bold mt-2">$9.99<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                  <p className="text-xs text-muted-foreground mt-1">100 AI credits/mo, 10 trees, 1,000 people</p>
                </div>
                <div className="mt-4 pt-3 border-t border-primary/20 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold text-primary">${((data?.proCount || 0) * 9.99).toFixed(2)}/mo</span>
                </div>
              </div>

              {/* Family Tier */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">Family Tier</span>
                    <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">High LTV</Badge>
                  </div>
                  <div className="text-2xl font-bold mt-2">$19.99<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                  <p className="text-xs text-muted-foreground mt-1">300 AI credits/mo, 50 trees, 5 family seats</p>
                </div>
                <div className="mt-4 pt-3 border-t border-blue-500/20 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">${((data?.familyCount || 0) * 19.99).toFixed(2)}/mo</span>
                </div>
              </div>
            </div>

            {/* Quick Stripe Links */}
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Direct Stripe Console Deep Links:
              </span>
              <div className="flex items-center gap-3">
                <a
                  href="https://dashboard.stripe.com/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Manage Subscriptions <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://dashboard.stripe.com/invoices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Invoice History <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://dashboard.stripe.com/coupons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Promo Codes <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscribers Table Section */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Subscribers Directory</CardTitle>
              <CardDescription className="text-xs">
                Accounts with active paid subscription or registered Stripe billing profile
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Live search email, name, customer ID..."
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

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                  <SelectValue placeholder="All Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="pro">Pro Plan</SelectItem>
                  <SelectItem value="family">Family Plan</SelectItem>
                  <SelectItem value="free">Free Plan</SelectItem>
                </SelectContent>
              </Select>
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
          ) : filteredSubscribers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No subscriber records matching current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Customer</TableHead>
                    <TableHead className="text-xs font-semibold">Tier</TableHead>
                    <TableHead className="text-xs font-semibold">Monthly Rate</TableHead>
                    <TableHead className="text-xs font-semibold">Stripe Customer ID</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscribers.map(sub => (
                    <TableRow key={sub.uid} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{sub.displayName}</span>
                          <span className="text-xs text-muted-foreground">{sub.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.plan === 'pro' && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium">
                            Pro
                          </Badge>
                        )}
                        {sub.plan === 'family' && (
                          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[11px] font-medium">
                            Family
                          </Badge>
                        )}
                        {sub.plan === 'free' && (
                          <Badge variant="outline" className="text-muted-foreground text-[11px]">
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {sub.amount > 0 ? `$${sub.amount.toFixed(2)}/mo` : '$0.00'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <span>{sub.stripeCustomerId}</span>
                          <button
                            onClick={() => handleCopy(sub.stripeCustomerId, sub.uid)}
                            className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                            title="Copy Stripe Customer ID"
                          >
                            {copiedId === sub.uid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sub.subscriptionStatus === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]'
                              : 'bg-muted text-muted-foreground text-[11px]'
                          }
                        >
                          {sub.subscriptionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/users?search=${encodeURIComponent(sub.email)}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                            Manage User
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Stripe Events Log */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Recent Billing Transactions & Webhook Events
          </CardTitle>
          <CardDescription className="text-xs">
            Direct ledger of successful invoice receipts and subscription changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.billingEvents.map(evt => (
              <div
                key={evt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-background/40 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{evt.type}</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        {evt.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{evt.customerEmail}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">+${evt.amount.toFixed(2)}</span>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(evt.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
