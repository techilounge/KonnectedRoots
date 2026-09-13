"use client";

import { useEffect, useState, useTransition } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getSystemConfiguration, saveSystemConfiguration } from '@/app/admin/actions';
import type { SystemConfiguration } from '@/types';
import {
  Sliders,
  Save,
  RefreshCw,
  AlertTriangle,
  Bell,
  Sparkles,
  Camera,
  FileText,
  Upload,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export default function AdminConfigurationPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const loadConfig = async () => {
    try {
      const res = await getSystemConfiguration();
      setConfig(res);
    } catch (err) {
      console.error('Failed to load system configuration:', err);
      toast({ variant: 'destructive', title: 'Could not load configuration' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!user || !config) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const token = await user.getIdToken();
      await saveSystemConfiguration(token, config);
      toast({ title: 'Configuration saved' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save system configuration:', err);
      toast({ variant: 'destructive', title: 'Action failed', description: 'The change could not be saved. Please try again.' });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[450px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sliders className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight">System Configuration & Feature Flags</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Platform-wide killswitches, quota defaults, maintenance mode, and global broadcast announcements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 py-1.5 px-3 gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Settings Saved Live
            </Badge>
          )}

          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={saving}
            className="gap-2 bg-primary text-primary-foreground shadow-sm"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-2xl bg-muted/60 p-1">
          <TabsTrigger value="features" className="text-xs font-semibold gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="text-xs font-semibold gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Broadcast Banner
          </TabsTrigger>
          <TabsTrigger value="limits" className="text-xs font-semibold gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Plan Limits
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs font-semibold gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Maintenance
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Feature Flags */}
        <TabsContent value="features" className="space-y-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Platform Feature Killswitches</CardTitle>
              <CardDescription className="text-xs">
                Toggle platform capabilities in real time without code redeployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GenAI Features */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Generative AI Intelligence Engine</h3>
                    <p className="text-xs text-muted-foreground">
                      Master toggle for Gemini-powered biographies, relationship finders, and name recommendations.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.featureFlags.aiFeatures}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      featureFlags: { ...config.featureFlags, aiFeatures: val },
                    })
                  }
                />
              </div>

              {/* Document OCR */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Document OCR Text Extraction</h3>
                    <p className="text-xs text-muted-foreground">
                      Allows users to upload historical certificates and transcribe handwriting automatically.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.featureFlags.documentOcr}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      featureFlags: { ...config.featureFlags, documentOcr: val },
                    })
                  }
                />
              </div>

              {/* Photo Enhancement */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Historical Photo Restoration & Enhancer</h3>
                    <p className="text-xs text-muted-foreground">
                      Enables high-resolution face restoration, scratch removal, and ancestor photo clarity enhancements.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.featureFlags.photoEnhancement}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      featureFlags: { ...config.featureFlags, photoEnhancement: val },
                    })
                  }
                />
              </div>

              {/* GEDCOM Imports */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">GEDCOM File Imports & Exports</h3>
                    <p className="text-xs text-muted-foreground">
                      Permits users to import massive genealogy trees from Ancestry, MyHeritage, or FamilySearch files.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config.featureFlags.gedcomImports}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      featureFlags: { ...config.featureFlags, gedcomImports: val },
                    })
                  }
                />
              </div>

              {/* New User Registrations */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border/40 bg-background/50 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Public Account Signups Policy</h3>
                    <p className="text-xs text-muted-foreground">
                      Controls access gates for new visitors registering on the platform.
                    </p>
                  </div>
                </div>
                <Select
                  value={config.featureFlags.newRegistrations}
                  onValueChange={(val: any) =>
                    setConfig({
                      ...config,
                      featureFlags: { ...config.featureFlags, newRegistrations: val },
                    })
                  }
                >
                  <SelectTrigger className="w-48 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open (Public Signups)</SelectItem>
                    <SelectItem value="invite-only">Invite-Only / Waitlist</SelectItem>
                    <SelectItem value="paused">Paused (Lock Signups)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: System Broadcast Banner */}
        <TabsContent value="broadcast" className="space-y-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">System Broadcast Announcement</CardTitle>
              <CardDescription className="text-xs">
                Display a persistent global banner at the top of every page for all active visitors and users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Live Preview */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Live Preview (As users will see it)
                </label>
                {config.broadcastBanner?.enabled ? (
                  <div
                    className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
                      config.broadcastBanner?.type === 'warning'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200'
                        : config.broadcastBanner?.type === 'success'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        : config.broadcastBanner?.type === 'promo'
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-900 dark:text-purple-200'
                        : 'bg-primary/10 border-primary/20 text-primary-900 dark:text-primary-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 shrink-0" />
                      <span>{config.broadcastBanner?.message || 'Your announcement message will appear here...'}</span>
                      {config.broadcastBanner?.linkUrl && (
                        <span className="underline ml-1 cursor-pointer font-semibold flex items-center gap-0.5">
                          {config.broadcastBanner?.linkText || 'Learn more'} <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {config.broadcastBanner?.dismissible && (
                      <span className="text-xs opacity-60">✕</span>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground text-center">
                    Banner is currently disabled. Toggle &quot;Publish Announcement Banner&quot; below to preview.
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50">
                <div>
                  <h3 className="font-semibold text-sm">Publish Announcement Banner</h3>
                  <p className="text-xs text-muted-foreground">Make announcement visible across the platform</p>
                </div>
                <Switch
                  checked={Boolean(config.broadcastBanner?.enabled)}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      broadcastBanner: {
                        enabled: val,
                        type: config.broadcastBanner?.type || 'info',
                        message: config.broadcastBanner?.message || '',
                        linkUrl: config.broadcastBanner?.linkUrl || '',
                        linkText: config.broadcastBanner?.linkText || '',
                        dismissible: config.broadcastBanner?.dismissible ?? true,
                      },
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Banner Style Type</label>
                  <Select
                    value={config.broadcastBanner?.type || 'info'}
                    onValueChange={(val: any) =>
                      setConfig({
                        ...config,
                        broadcastBanner: { ...config.broadcastBanner, type: val } as any,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info (Blue / Primary)</SelectItem>
                      <SelectItem value="warning">Warning (Amber)</SelectItem>
                      <SelectItem value="success">Success (Emerald)</SelectItem>
                      <SelectItem value="promo">Promotional / Special (Purple)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Dismissible</label>
                  <div className="flex items-center justify-between h-9 px-3 border border-border/50 rounded-md bg-background/50">
                    <span className="text-xs text-muted-foreground">Allow visitors to close banner</span>
                    <Switch
                      checked={Boolean(config.broadcastBanner?.dismissible)}
                      onCheckedChange={val =>
                        setConfig({
                          ...config,
                          broadcastBanner: { ...config.broadcastBanner, dismissible: val } as any,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Announcement Message</label>
                <Textarea
                  placeholder="e.g. Scheduled maintenance this Sunday from 2 AM to 4 AM UTC. All features will remain operational..."
                  value={config.broadcastBanner?.message || ''}
                  onChange={e =>
                    setConfig({
                      ...config,
                      broadcastBanner: { ...config.broadcastBanner, message: e.target.value } as any,
                    })
                  }
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Optional Link URL</label>
                  <Input
                    placeholder="https://... or /pricing"
                    value={config.broadcastBanner?.linkUrl || ''}
                    onChange={e =>
                      setConfig({
                        ...config,
                        broadcastBanner: { ...config.broadcastBanner, linkUrl: e.target.value } as any,
                      })
                    }
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Optional Link Label</label>
                  <Input
                    placeholder="e.g. Read Release Notes"
                    value={config.broadcastBanner?.linkText || ''}
                    onChange={e =>
                      setConfig({
                        ...config,
                        broadcastBanner: { ...config.broadcastBanner, linkText: e.target.value } as any,
                      })
                    }
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Plan Limits */}
        <TabsContent value="limits" className="space-y-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Default Tier Entitlements</CardTitle>
              <CardDescription className="text-xs">
                Base limits assigned to newly created user accounts by subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Free Tier */}
              <div className="p-4 rounded-xl border border-border/40 bg-background/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Free Tier Defaults</span>
                  <Badge variant="outline" className="text-xs">Free</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Max Trees</label>
                    <Input
                      type="number"
                      value={config.planLimits.free.maxTrees}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            free: { ...config.planLimits.free, maxTrees: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">People / Tree</label>
                    <Input
                      type="number"
                      value={config.planLimits.free.maxPeoplePerTree}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            free: { ...config.planLimits.free, maxPeoplePerTree: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">AI Credits / Mo</label>
                    <Input
                      type="number"
                      value={config.planLimits.free.aiCreditsMonthly}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            free: { ...config.planLimits.free, aiCreditsMonthly: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Exports / Mo</label>
                    <Input
                      type="number"
                      value={config.planLimits.free.maxExportsPerMonth}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            free: { ...config.planLimits.free, maxExportsPerMonth: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Pro Tier */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-primary">Pro Tier Defaults ($5.99/mo)</span>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Pro</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Max Trees</label>
                    <Input
                      type="number"
                      value={config.planLimits.pro.maxTrees}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            pro: { ...config.planLimits.pro, maxTrees: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">People / Tree</label>
                    <Input
                      type="number"
                      value={config.planLimits.pro.maxPeoplePerTree}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            pro: { ...config.planLimits.pro, maxPeoplePerTree: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">AI Credits / Mo</label>
                    <Input
                      type="number"
                      value={config.planLimits.pro.aiCreditsMonthly}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            pro: { ...config.planLimits.pro, aiCreditsMonthly: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Exports / Mo</label>
                    <Input
                      type="number"
                      value={config.planLimits.pro.maxExportsPerMonth}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            pro: { ...config.planLimits.pro, maxExportsPerMonth: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Family Tier */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">Family Tier Defaults ($9.99/mo)</span>
                  <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">Family</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Max Trees</label>
                    <Input
                      type="number"
                      value={config.planLimits.family.maxTrees}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            family: { ...config.planLimits.family, maxTrees: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">People / Tree</label>
                    <Input
                      type="number"
                      value={config.planLimits.family.maxPeoplePerTree}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            family: { ...config.planLimits.family, maxPeoplePerTree: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">AI Credits / Mo</label>
                    <Input
                      type="number"
                      value={config.planLimits.family.aiCreditsMonthly}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            family: { ...config.planLimits.family, aiCreditsMonthly: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Shared Family Seats</label>
                    <Input
                      type="number"
                      value={config.planLimits.family.maxSeats}
                      onChange={e =>
                        setConfig({
                          ...config,
                          planLimits: {
                            ...config.planLimits,
                            family: { ...config.planLimits.family, maxSeats: Number(e.target.value) },
                          },
                        })
                      }
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Maintenance Mode */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card className="border-red-500/30 bg-red-500/5 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Platform Maintenance Mode Control
              </CardTitle>
              <CardDescription className="text-xs">
                When enabled, non-admin visitors will see a full-screen maintenance lockdown modal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/30 bg-background/80">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Lockdown Platform for Maintenance</h3>
                  <p className="text-xs text-muted-foreground">
                    Only authorized Platform Admins will be able to access the application.
                  </p>
                </div>
                <Switch
                  checked={config.maintenanceMode.enabled}
                  onCheckedChange={val =>
                    setConfig({
                      ...config,
                      maintenanceMode: { ...config.maintenanceMode, enabled: val },
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Maintenance Notice Message</label>
                <Textarea
                  value={config.maintenanceMode.message}
                  onChange={e =>
                    setConfig({
                      ...config,
                      maintenanceMode: { ...config.maintenanceMode, message: e.target.value },
                    })
                  }
                  rows={3}
                  className="text-xs bg-background resize-none"
                />
              </div>

              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Notice:</strong> Platform Admins authenticated with custom claims bypass maintenance locks automatically so you can safely test migrations before unlocking the platform.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Confirm System Configuration Update
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This action modifies platform-wide behavior for all active users immediately. An immutable audit log of these changes will be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              Confirm & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
