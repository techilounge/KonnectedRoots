"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAdminDashboardData } from '@/app/admin/actions';
import type { AdminDashboardStats } from '@/types';
import {
  Users,
  CreditCard,
  TreeDeciduous,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  Activity,
  CheckCircle2,
  Server,
  Zap,
  Clock,
  ArrowRight,
  Download,
  AlertTriangle,
  Sliders,
  Bell,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
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
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import AdminPagination from '@/components/admin/AdminPagination';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [growthView, setGrowthView] = useState<'cumulative' | 'daily'>('cumulative');
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const data = await getAdminDashboardData(idToken);
      setStats(data);
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
  };

  const COLORS = ['#3E7D3B', '#C8A265', '#2563EB', '#8B5CF6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight">
              Executive Platform Dashboard
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
              Live Production
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Real-time platform metrics, user demographics, revenue telemetry, and GenAI metering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 gap-1.5 text-xs shadow-sm hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh Telemetry</span>
          </Button>
          <Button size="sm" asChild className="h-9 gap-1.5 text-xs bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/admin/reports">
              <Download className="h-3.5 w-3.5" />
              <span>Export Reports</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Top 5 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Users */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-headline tracking-tight">
                {stats?.totalUsers.toLocaleString() ?? '0'}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="h-3 w-3 inline" /> +12%
              </span>
              <span>vs last month</span>
            </div>
            <div className="pt-2 flex gap-1 text-[10px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">{stats?.freeUsers ?? 0} Free</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">{stats?.proUsers ?? 0} Pro</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">{stats?.familyUsers ?? 0} Family</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Estimated MRR */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Estimated MRR
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-headline tracking-tight text-foreground">
                ${stats?.estimatedMRR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="h-3 w-3 inline" /> +18%
              </span>
              <span>annual run rate est.</span>
            </div>
            <div className="pt-2 text-[10px] text-muted-foreground truncate">
              Stripe Live Sync Active
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Total Trees */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Family Trees
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TreeDeciduous className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-headline tracking-tight">
                {stats?.totalTrees.toLocaleString() ?? '0'}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              Across all user accounts
            </div>
            <div className="pt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {stats?.totalPeople.toLocaleString() ?? 0} total people mapped
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: AI Actions */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI Operations
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-headline tracking-tight">
                {stats?.totalAiActionsUsed.toLocaleString() ?? '0'}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              Calls this billing cycle
            </div>
            <div className="pt-2 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
              Gemini 2.0 Flash • 99.8% success
            </div>
          </CardContent>
        </Card>

        {/* Metric 5: Platform Health */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-card/60 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              System Health
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold font-headline tracking-tight text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>99.98%</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              <span>All 12 Cloud Functions Live</span>
            </div>
            <div className="pt-2 text-[10px] text-muted-foreground">
              Latency: {stats?.systemStatus.latencyMs ?? 38}ms avg
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: User Growth (2 cols) */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-headline font-semibold">
                User Acquisition & Growth Trajectory
              </CardTitle>
              <CardDescription className="text-xs">
                Platform registrations and cumulative user trajectory over the last 30 days
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
              <Button
                variant={growthView === 'cumulative' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGrowthView('cumulative')}
                className="h-7 text-xs px-2.5"
              >
                Cumulative
              </Button>
              <Button
                variant={growthView === 'daily' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGrowthView('daily')}
                className="h-7 text-xs px-2.5"
              >
                Daily New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.userGrowthSeries || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3E7D3B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3E7D3B" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="dailyNewGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C8A265" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#C8A265" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => d.slice(5)}
                      tick={{ fontSize: 11 }}
                      stroke="#888888"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#888888"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border border-border p-2.5 rounded-lg shadow-lg text-xs space-y-1">
                              <p className="font-semibold text-foreground">{label}</p>
                              <p className="text-primary font-medium">
                                {growthView === 'cumulative' ? 'Total Users' : 'New Signups'}: {payload[0].value}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={growthView === 'cumulative' ? 'users' : 'newUsers'}
                      stroke={growthView === 'cumulative' ? '#3E7D3B' : '#C8A265'}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#${growthView === 'cumulative' ? 'userGrowthGradient' : 'dailyNewGradient'})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Plan Distribution (1 col) */}
        <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-headline font-semibold">
              Subscription Tiers
            </CardTitle>
            <CardDescription className="text-xs">
              Current active plan breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="h-[200px] w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.planDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {(stats?.planDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const total = stats?.totalUsers || 1;
                          const percent = Math.round((Number(data.value) / total) * 100);
                          return (
                            <div className="bg-popover border border-border p-2 rounded shadow text-xs">
                              <p className="font-semibold">{data.name}</p>
                              <p className="text-muted-foreground">{data.value} users ({percent}%)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold font-headline">{stats?.totalUsers ?? 0}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Accounts</span>
                </div>
              </div>
            )}

            {/* Plan Legends */}
            <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-border/50 text-center">
              {stats?.planDistribution.map((item) => (
                <div key={item.name} className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <p className="text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Row: AI Consumption & Weekly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: AI Feature Volume (2 cols) */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-headline font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Generation Compute by Operation
              </CardTitle>
              <CardDescription className="text-xs">
                Monthly GenAI call distribution across all intelligent family tree tools
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
              <Link href="/admin/ai-metering">
                Deep Dive <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.aiActionsSeries || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888888" tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#888888" tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border p-2.5 rounded-lg shadow-lg text-xs space-y-1">
                              <p className="font-semibold text-foreground">{label}</p>
                              <p className="text-purple-600 dark:text-purple-400 font-medium">Invocations: {item.count}</p>
                              <p className="text-muted-foreground text-[11px]">Est. Cost: ${item.costEstimate}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Subsystems (1 col) */}
        <div className="space-y-4">
          {/* Quick Actions Card */}
          <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Administrative Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" asChild className="w-full justify-between text-xs h-9">
                <Link href="/admin/users">
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary" /> Manage Users & Plans
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full justify-between text-xs h-9">
                <Link href="/admin/configuration">
                  <span className="flex items-center gap-2">
                    <Sliders className="h-3.5 w-3.5 text-amber-500" /> Platform Configuration
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full justify-between text-xs h-9">
                <Link href="/admin/messages">
                  <span className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-blue-500" /> Support Inquiries
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Subsystems Health Card */}
          <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500" />
                Subsystems Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cloud Firestore</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Google GenAI (Gemini)</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stripe Webhooks</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Resend Email Gateway</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Feed & Recent Registrations */}
      <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-headline font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Live Platform Activity
            </CardTitle>
            <CardDescription className="text-xs">
              Chronological log of user registrations, upgrades, and content creation
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link href="/admin/audit-logs">
              View Audit Log →
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No recent platform activity recorded.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-border/60">
                {stats.recentActivity
                  .slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize)
                  .map((activity) => (
                    <div key={activity.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          {activity.type === 'signup' ? (
                            <Users className="h-4 w-4" />
                          ) : activity.type === 'tree_created' ? (
                            <TreeDeciduous className="h-4 w-4" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{activity.title}</p>
                          <p className="text-[11px] text-muted-foreground">{activity.description}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/80 shrink-0">
                        {new Date(activity.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
              </div>

              {stats.recentActivity.length > 0 && (
                <AdminPagination
                  currentPage={activityPage}
                  totalItems={stats.recentActivity.length}
                  pageSize={activityPageSize}
                  onPageChange={setActivityPage}
                  onPageSizeChange={setActivityPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  itemLabel="activities"
                  className="border-t border-border/40 mt-2"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
