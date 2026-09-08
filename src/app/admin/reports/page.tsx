"use client";

import { useEffect, useState, useTransition } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getAdminReportData } from '@/app/admin/actions';
import type { ReportDataset } from '@/app/admin/actions';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  Search,
  ArrowUpRight,
  TrendingUp,
  Users,
  CreditCard,
  TreeDeciduous,
  Sparkles,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import AdminPagination from '@/components/admin/AdminPagination';

export default function AdminReportsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<ReportDataset | null>(null);
  const [category, setCategory] = useState<'users' | 'revenue' | 'trees' | 'ai'>('users');
  const [daysBack, setDaysBack] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, startTransition] = useTransition();

  const loadReport = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await getAdminReportData(token, category, daysBack);
      setReport(res);
      if (refreshing) toast({ title: 'Report refreshed' });
    } catch (err) {
      console.error('Failed to load report data:', err);
      toast({ variant: 'destructive', title: 'Could not load data', description: 'Please refresh and try again.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadReport();
  }, [user, category, daysBack]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, daysBack, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    startTransition(() => {
      loadReport();
    });
  };

  const handleExportCSV = () => {
    if (!report || !report.tableRows.length) return;

    const headers = report.tableHeaders.map(h => `"${h.label}"`).join(',');
    const rows = report.tableRows.map(row =>
      report.tableHeaders
        .map(h => {
          const val = row[h.key] !== undefined ? String(row[h.key]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `konnectedroots-${category}-report-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'CSV download started' });
  };

  const handleExportJSON = () => {
    if (!report) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(report, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `konnectedroots-${category}-report-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast({ title: 'JSON download started' });
  };

  const filteredRows = (report?.tableRows || []).filter(row => {
    if (!searchQuery) return true;
    return Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getCategoryIcon = () => {
    switch (category) {
      case 'users':
        return <Users className="w-6 h-6 text-primary" />;
      case 'revenue':
        return <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case 'trees':
        return <TreeDeciduous className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case 'ai':
        return <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Analytics & Reporting Center</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Multi-dimensional platform analytics, cohort telemetry, and instant CSV/JSON exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !report?.tableRows.length}
            className="gap-1.5 text-xs h-9"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            disabled={loading || !report}
            className="gap-1.5 text-xs h-9"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            Export JSON
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-2.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Control Filters Bar */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="space-y-1 w-full sm:w-56">
                <label className="text-xs font-semibold text-muted-foreground">Report Domain</label>
                <Select
                  value={category}
                  onValueChange={(val: any) => setCategory(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="users">User Acquisition & Growth</SelectItem>
                    <SelectItem value="revenue">Financial & Subscriptions</SelectItem>
                    <SelectItem value="trees">Tree & Genealogical Depth</SelectItem>
                    <SelectItem value="ai">GenAI Compute & Unit Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 w-full sm:w-44">
                <label className="text-xs font-semibold text-muted-foreground">Date Range</label>
                <Select
                  value={String(daysBack)}
                  onValueChange={(val: string) => setDaysBack(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="365">Last 365 Days / YTD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Badge variant="outline" className="text-xs font-mono px-2.5 py-1">
                {report?.dateRange || `Last ${daysBack} Days`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {(report?.summaryMetrics || []).map((metric, idx) => (
          <Card key={idx} className="border-border/50 bg-gradient-to-br from-card to-background shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24 mb-2" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {metric.value}
                </div>
              )}
              {metric.change && (
                <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{metric.change} period velocity</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dynamic Visualizations Chart */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{report?.title || 'Telemetry Trend'}</CardTitle>
              <CardDescription className="text-xs">
                Time-series cadence across the requested {report?.dateRange}
              </CardDescription>
            </div>
            {getCategoryIcon()}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {category === 'users' ? (
                  <AreaChart data={report?.chartData || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3E7D3B" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3E7D3B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C8A265" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#C8A265" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="primary" name="New Signups" stroke="#3E7D3B" fillOpacity={1} fill="url(#colorSignups)" />
                    <Area type="monotone" dataKey="secondary" name="Paid Conversions" stroke="#C8A265" fillOpacity={1} fill="url(#colorPaid)" />
                  </AreaChart>
                ) : (
                  <BarChart data={report?.chartData || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="primary"
                      name={category === 'revenue' ? 'MRR ($)' : category === 'trees' ? 'Trees Created' : 'Invocations'}
                      fill={category === 'revenue' ? '#10B981' : category === 'trees' ? '#C8A265' : '#8B5CF6'}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table & Search */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Granular Report Dataset</CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredRows.length} records ready for export
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Live search report dataset..."
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No dataset records matching current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    {(report?.tableHeaders || []).map(header => (
                      <TableHead key={header.key} className="text-xs font-semibold">
                        {header.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                      {(report?.tableHeaders || []).map(header => (
                        <TableCell key={header.key} className="text-xs">
                          {header.key === 'plan' ? (
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {row[header.key]}
                            </Badge>
                          ) : (
                            String(row[header.key] !== undefined ? row[header.key] : '—')
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredRows.length > 0 && (
            <AdminPagination
              currentPage={currentPage}
              totalItems={filteredRows.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="records"
              className="border-t border-border/40 mt-3 pt-3"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
