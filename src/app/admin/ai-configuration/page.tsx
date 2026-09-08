'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AdminPagination from '@/components/admin/AdminPagination';
import { capabilities, features, providerIds, type Feature, type Model, type ProviderId, type Target } from '@/lib/ai/types';
import { adapterCapabilities, compatible, modelKey } from '@/lib/ai/registry';
import { modelUnavailableReason } from '@/lib/ai/availability';
import { getAIConfiguration, mutateCredential, saveAIControl, saveProvider, syncModels, testModel, testProvider } from './actions';

type Snapshot = Awaited<ReturnType<typeof getAIConfiguration>>;
const selectClass = 'w-full rounded-md border bg-background p-2 text-sm';
function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (n: number | null) => void }) {
  return <label className="grid gap-1 text-sm">{label}<Input type="number" min="0" step="any" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} /></label>;
}
export default function AIConfigurationPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [customUrl, setCustomUrl] = useState('');
  const [confirmation, setConfirmation] = useState<{ title: string; run: () => Promise<void> } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [capabilityFilter, setCapabilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filtersReady, setFiltersReady] = useState(false);
  const [tab, setTab] = useState('providers');
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get('q') || ''); setQuery(params.get('q') || '');
      setProviderFilter(providerIds.some(p => p === params.get('provider')) ? params.get('provider')! : 'all');
      setCapabilityFilter(capabilities.some(c => c === params.get('capability')) ? params.get('capability')! : 'all');
      setStatusFilter(['enabled', 'disabled'].includes(params.get('status') || '') ? params.get('status')! : 'all');
      if (params.get('tab') === 'models') setTab('models');
      setPage(1); setFiltersReady(true);
    };
    const timer = window.setTimeout(restore, 0);
    window.addEventListener('popstate', restore);
    return () => { window.clearTimeout(timer); window.removeEventListener('popstate', restore); };
  }, []);
  useEffect(() => {
    if (!filtersReady) return;
    const timer = window.setTimeout(() => {
      setQuery(search); setPage(1);
      const url = new URL(window.location.href);
      for (const [name, value] of Object.entries({ q: search, provider: providerFilter, capability: capabilityFilter, status: statusFilter })) {
        if (value && value !== 'all') url.searchParams.set(name, value); else url.searchParams.delete(name);
      }
      if (tab === 'models') url.searchParams.set('tab', 'models'); else url.searchParams.delete('tab');
      window.history.replaceState(window.history.state, '', url);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, providerFilter, capabilityFilter, statusFilter, filtersReady, tab]);
  const [newProvider, setNewProvider] = useState<ProviderId>('openai');
  const [newModel, setNewModel] = useState('');
  const [testFeature, setTestFeature] = useState<Feature>('suggestName');
  const [testTarget, setTestTarget] = useState('');
  const [testResult, setTestResult] = useState<Exclude<Awaited<ReturnType<typeof testModel>>, { error: string }> | null>(null);
  const reload = useCallback(async () => {
    if (!user) return;
    const result = await getAIConfiguration(await user.getIdToken());
    setData(result); setCustomUrl(result.providers.find(p => p.providerId === 'custom')?.baseUrl || '');
  }, [user]);
  useEffect(() => { reload().catch(() => setMessage('Could not load AI configuration. Administrator claims are required.')); }, [reload]);
  const perform = async (work: (token: string) => Promise<unknown>, refresh = true) => {
    if (!user) return;
    setBusy(true); setMessage('');
    try { const result = await work(await user.getIdToken()); if (refresh) await reload(); setMessage(result && typeof result === 'object' && 'cleanupRequired' in result && result.cleanupRequired ? 'Credential change completed. Remove the old environment key or clean up the previous vault version; see audit logs.' : 'Completed.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Operation failed.'); }
    finally { setBusy(false); }
  };
  const confirm = (title: string, work: (token: string) => Promise<unknown>) => setConfirmation({ title, run: () => perform(work) });
  if (!data) return <div role="status">{message || 'Loading AI configuration…'}</div>;
  const control = data.control;
  const filteredModels = control.models.map((model, index) => ({ model, index })).filter(({ model }) =>
    `${model.providerId} ${model.modelId} ${model.displayName}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (providerFilter === 'all' || model.providerId === providerFilter) &&
    (capabilityFilter === 'all' || model.capabilities.some(c => c === capabilityFilter)) &&
    (statusFilter === 'all' || model.enabled === (statusFilter === 'enabled')));
  const visiblePage = Math.min(page, Math.max(1, Math.ceil(filteredModels.length / 10)));
  const clearFilters = () => { setSearch(''); setQuery(''); setProviderFilter('all'); setCapabilityFilter('all'); setStatusFilter('all'); setPage(1); };
  const updateModel = (index: number, patch: Partial<Model>) => setData({ ...data, control: { ...control, models: control.models.map((m, i) => i === index ? { ...m, ...patch } : m) } });
  const routeOptions = (feature: Feature) => control.models.filter(m => m.enabled && compatible(feature, m) &&
    (control.routes[feature].privacy !== 'direct_providers_only' || !['openrouter', 'custom'].includes(m.providerId)));
  const targetFromKey = (key: string): Target => { const m = control.models.find(m => modelKey(m) === key)!; return { providerId: m.providerId, modelId: m.modelId }; };
  const testOptions = control.models.map(model => ({ model, reason: modelUnavailableReason(model, testFeature, control.routes[testFeature], data.providers.find(p => p.providerId === model.providerId)) }));
  const selectedTest = testOptions.find(o => modelKey(o.model) === testTarget);
  const targets = (feature: Feature, value: Target, change: (target: Target) => void, label: string) => <label className="grid gap-1 text-sm">{label}<select className={selectClass} value={modelKey(value)} onChange={e => change(targetFromKey(e.target.value))}>
    {!routeOptions(feature).some(m => modelKey(m) === modelKey(value)) && <option value={modelKey(value)}>Incompatible: {modelKey(value)}</option>}
    {routeOptions(feature).map(m => <option key={modelKey(m)} value={modelKey(m)}>{m.providerId} / {m.displayName}</option>)}
  </select></label>;
  return <div className="space-y-6 max-w-7xl">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">AI Configuration</h1><p className="text-muted-foreground">Provider access, feature routing and spending controls.</p></div>
      <Button disabled={busy} onClick={() => perform(async () => reload())}>Refresh</Button></div>
    <p role="status" className="text-sm whitespace-pre-wrap">{message}</p>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="flex flex-wrap h-auto justify-start">
      {['Providers', 'Models', 'Feature Routing', 'Cost & Budgets', 'Health & Testing'].map(tab => <TabsTrigger key={tab} value={tab.toLowerCase()}>{tab}</TabsTrigger>)}
    </TabsList>
    <TabsContent value="providers" className="space-y-4">
      <p className="text-sm text-muted-foreground">Credentials are stored in Google Secret Manager. Only Super Admin can add, rotate or remove them. Keys cannot be retrieved from this console.</p>
      <div className="grid lg:grid-cols-2 gap-4">{data.providers.map(provider => <Card key={provider.providerId}><CardHeader><CardTitle className="capitalize">{provider.providerId}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm">{provider.credentialConfigured ? `Configured · ${provider.credentialSource} · fingerprint ${provider.credentialFingerprint}` : 'No credential configured'}</p>
        <p className="text-sm">Status: {provider.status} · Last test: {provider.lastTestedAt || 'Never'} · Last successful test: {provider.lastSuccessfulTest || 'Never'}</p>
        <Button disabled={busy} variant="outline" onClick={() => confirm(`${provider.enabled ? 'Disable' : 'Enable'} ${provider.providerId}?`, token => saveProvider(token, { providerId: provider.providerId, enabled: !provider.enabled }))}>{provider.enabled ? 'Disable' : 'Enable'}</Button>
        {data.isSuperAdmin && <div className="space-y-2"><Input aria-label={`${provider.providerId} API key`} type="password" autoComplete="new-password" placeholder="New API key" value={keys[provider.providerId] || ''} onChange={e => setKeys({ ...keys, [provider.providerId]: e.target.value })} />
          <div className="flex gap-2 flex-wrap"><Button disabled={busy || !keys[provider.providerId]} onClick={() => confirm(`${provider.credentialConfigured ? 'Rotate' : 'Add'} ${provider.providerId} credential?`, async token => {
            const key = keys[provider.providerId]; setKeys(current => ({ ...current, [provider.providerId]: '' }));
            const result = await mutateCredential(token, { providerId: provider.providerId, operation: 'save', key });
            return result;
          })}>{provider.credentialConfigured ? 'Rotate API key' : 'Add API key'}</Button>
          <Button variant="destructive" disabled={busy || !provider.credentialConfigured} onClick={() => confirm(`Remove ${provider.providerId} credential?`, async token => {
            const result = await mutateCredential(token, { providerId: provider.providerId, operation: 'remove' });
            return result;
          })}>Remove API key</Button></div>
          {provider.providerId === 'custom' && <><Input aria-label="Custom provider base URL" placeholder="https://provider.example/v1" value={customUrl} onChange={e => setCustomUrl(e.target.value)} /><Button disabled={busy} variant="outline" onClick={() => confirm('Save custom provider endpoint?', token => saveProvider(token, { providerId: 'custom', enabled: provider.enabled, baseUrl: customUrl }))}>Save endpoint</Button><p className="text-xs">The endpoint origin must be allowed by the server configuration.</p></>}
        </div>}
        <div className="flex gap-2"><Button variant="outline" disabled={busy || !provider.credentialConfigured} onClick={() => perform(async token => { const result = await testProvider(token, provider.providerId); if (result.status !== 'connected') throw new Error(result.status); })}>Test connection</Button>
          <Button variant="outline" disabled={busy || !provider.credentialConfigured} onClick={() => perform(token => syncModels(token, provider.providerId))}>Sync models</Button></div>
      </CardContent></Card>)}</div>
    </TabsContent>
    <TabsContent value="models" className="space-y-4"><p className="text-sm">Newly discovered models stay disabled until capabilities and pricing are reviewed. Blank prices are unknown, never free. Prices are estimates in USD.</p>
      <div className="rounded-lg border bg-background p-4 space-y-3">
        <div className="relative"><Input aria-label="Search models" placeholder="Search model names, IDs or providers…" className="pr-12" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />{search && <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-8" aria-label="Clear model search" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>×</Button>}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">Provider<select className={selectClass} value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setPage(1); }}><option value="all">All providers</option>{providerIds.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Capability<select className={selectClass} value={capabilityFilter} onChange={e => { setCapabilityFilter(e.target.value); setPage(1); }}><option value="all">All capabilities</option>{capabilities.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Status<select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">All statuses</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        </div>
        <div className="flex items-center justify-between gap-2"><p role="status" className="text-sm text-muted-foreground">{filteredModels.length} of {control.models.length} models match</p><Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button></div>
      </div>
      <p className="text-sm font-medium">Add a model manually</p>
      <div className="flex gap-2"><select aria-label="New model provider" className={selectClass} value={newProvider} onChange={e => setNewProvider(e.target.value as ProviderId)}>{providerIds.map(p => <option key={p}>{p}</option>)}</select><Input aria-label="New model ID" placeholder="Model ID" value={newModel} onChange={e => setNewModel(e.target.value)} /><Button disabled={!newModel || control.models.some(m => m.providerId === newProvider && m.modelId === newModel)} onClick={() => {
        setData({ ...data, control: { ...control, models: [...control.models, { providerId: newProvider, modelId: newModel, displayName: newModel, capabilities: [], contextWindow: 32768, inputCostPerMillion: null, outputCostPerMillion: null, imageCost: null, quality: 50, enabled: false }] } }); clearFilters(); setSearch(newModel); setQuery(newModel); setProviderFilter(newProvider); setNewModel('');
      }}>Add model</Button></div>
      {filteredModels.length === 0 && <p className="rounded-lg border p-6 text-center text-muted-foreground">No models match. Try a different search or clear the filters.</p>}
      {filteredModels.slice((visiblePage - 1) * 10, visiblePage * 10).map(({ model, index }) => { return <Card key={modelKey(model)}><CardHeader><CardTitle className="text-base">{modelKey(model)}</CardTitle></CardHeader><CardContent className="space-y-3">
        <label className="flex gap-2"><input type="checkbox" checked={model.enabled} onChange={e => updateModel(index, { enabled: e.target.checked })} />Enabled</label>
        <Input aria-label="Display name" value={model.displayName} onChange={e => updateModel(index, { displayName: e.target.value })} />
        <div className="flex flex-wrap gap-4">{capabilities.map(cap => <label key={cap} className="flex gap-1 text-sm"><input type="checkbox" disabled={!adapterCapabilities[model.providerId].includes(cap) && !model.capabilities.includes(cap)} checked={model.capabilities.includes(cap)} onChange={e => updateModel(index, { capabilities: e.target.checked ? [...model.capabilities, cap] : model.capabilities.filter(c => c !== cap) })} />{cap}{!adapterCapabilities[model.providerId].includes(cap) && ' (unsupported)'}</label>)}</div>
        <p className="text-xs text-muted-foreground">Select only capabilities documented for this model. For image requests, Per image is a conservative estimate including image/reference charges; token rates are separate. Enter 0 only when verified free or included.</p>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <NumberField label="Context tokens" value={model.contextWindow} onChange={n => updateModel(index, { contextWindow: n || 1024 })} />
          <NumberField label="Input / million tokens" value={model.inputCostPerMillion} onChange={n => updateModel(index, { inputCostPerMillion: n })} />
          <NumberField label="Output / million tokens" value={model.outputCostPerMillion} onChange={n => updateModel(index, { outputCostPerMillion: n })} />
          <NumberField label="Per image" value={model.imageCost} onChange={n => updateModel(index, { imageCost: n })} />
          <NumberField label="Quality priority (0–100)" value={model.quality} onChange={n => updateModel(index, { quality: n || 0 })} />
        </div></CardContent></Card>; })}
      <AdminPagination currentPage={visiblePage} totalItems={filteredModels.length} pageSize={10} onPageChange={setPage} itemLabel="models" />
    </TabsContent>
    <TabsContent value="feature routing" className="space-y-4"><p>Relationship Finder uses the local deterministic algorithm: unlimited, zero AI credits.</p>
      {features.map(feature => { const route = control.routes[feature]; const update = (patch: Partial<typeof route>) => setData({ ...data, control: { ...control, routes: { ...control.routes, [feature]: { ...route, ...patch } } } }); return <Card key={feature}><CardHeader><CardTitle>{feature}</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex gap-4"><label><input type="checkbox" checked={route.enabled} onChange={e => update({ enabled: e.target.checked })} /> Enabled</label><label><input type="checkbox" checked={route.essential} onChange={e => update({ essential: e.target.checked })} /> Essential at budget thresholds</label></div>
        <div className="grid md:grid-cols-2 gap-3">{targets(feature, route.primary, target => update({ primary: target }), 'Primary model')}
          <label className="grid gap-1 text-sm">Routing mode<select className={selectClass} value={route.mode} onChange={e => update({ mode: e.target.value as typeof route.mode })}>{['fixed', 'lowest_cost', 'balanced', 'quality_first'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Privacy<select className={selectClass} value={route.privacy} onChange={e => update({ privacy: e.target.value as typeof route.privacy })}><option>direct_providers_only</option><option>aggregator_allowed</option></select></label>
          <NumberField label="Maximum request cost (USD)" value={route.maxRequestCost} onChange={n => update({ maxRequestCost: n || 0 })} />
          <NumberField label="Monthly feature budget (blank = platform budget)" value={route.monthlyBudget} onChange={n => update({ monthlyBudget: n })} />
        </div>
        {route.fallbacks.map((target, index) => <div key={index} className="flex gap-2 items-end">{targets(feature, target, t => update({ fallbacks: route.fallbacks.map((f, i) => i === index ? t : f) }), `Fallback ${index + 1}`)}<Button variant="outline" onClick={() => update({ fallbacks: route.fallbacks.filter((_, i) => i !== index) })}>Remove</Button></div>)}
        <Button variant="outline" disabled={route.fallbacks.length >= 5 || !routeOptions(feature).length} onClick={() => update({ fallbacks: [...route.fallbacks, targetFromKey(modelKey(routeOptions(feature)[0]))] })}>Add fallback</Button>
      </CardContent></Card>; })}
    </TabsContent>
    <TabsContent value="cost & budgets" className="space-y-4"><Card><CardHeader><CardTitle>Monthly spending</CardTitle></CardHeader><CardContent className="space-y-4"><p>Estimated spent: ${data.usage.spent.toFixed(4)} · Reserved: ${data.usage.reserved.toFixed(4)}</p>
      <div className="grid sm:grid-cols-3 gap-4">{(['monthlyBudget', 'hardBudget', 'warningThreshold', 'emergencyThreshold', 'failureThreshold', 'cooldownSeconds'] as const).map(key => <NumberField key={key} label={key} value={control.budgets[key]} onChange={n => setData({ ...data, control: { ...control, budgets: { ...control.budgets, [key]: n || 0 } } })} />)}</div>
      <p className="text-sm">Warning and emergency thresholds are fractions from 0 to 1. The hard limit always blocks new reservations. In-flight or unreported usage retains a conservative reservation.</p>
      <label className="grid gap-1">Threshold policy<select className={selectClass} value={control.budgets.policy} onChange={e => setData({ ...data, control: { ...control, budgets: { ...control.budgets, policy: e.target.value as typeof control.budgets.policy } } })}>{['alert_only', 'prefer_cheaper_models', 'disable_nonessential_ai'].map(v => <option key={v}>{v}</option>)}</select></label>
    </CardContent></Card></TabsContent>
    <TabsContent value="health & testing" className="space-y-4"><Card><CardHeader><CardTitle>Controlled model test</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">Uses synthetic data and the normal privacy, budget, telemetry and circuit-breaker controls. Provider charges count toward the platform budget; no user AI credits are deducted.</p>
      <select aria-label="Test feature" className={selectClass} value={testFeature} onChange={e => { setTestFeature(e.target.value as Feature); setTestTarget(''); }}>{features.map(f => <option key={f}>{f}</option>)}</select>
      <select aria-label="Test provider and model" className={selectClass} value={testTarget} onChange={e => { setTestTarget(e.target.value); setTestResult(null); }}><option value="">Select provider / model</option>{testOptions.map(({ model, reason }) => <option value={modelKey(model)} key={modelKey(model)}>{modelKey(model)}{reason ? ' — unavailable' : ''}</option>)}</select>
      {selectedTest?.reason && <p role="status" className="text-sm text-destructive">{selectedTest.reason}</p>}
      <p className="text-xs text-muted-foreground">Save model and routing changes before testing. Tests also enforce the saved budget, request-cost limit and circuit state.</p>
      <Button disabled={busy || !selectedTest || Boolean(selectedTest.reason)} onClick={() => perform(async token => { setTestResult(null); const result = await testModel(token, { feature: testFeature, target: targetFromKey(testTarget) }); if ('error' in result) throw new Error(`Controlled test failed: ${result.error}. Check saved configuration, provider access and budget limits.`); setTestResult(result); })}>Run controlled test</Button>
      {testResult && <div className="space-y-2"><p>{testResult.latencyMs}ms · Input {testResult.inputTokens ?? 'unknown'} / Output {testResult.outputTokens ?? 'unknown'} tokens · ${testResult.estimatedCostUsd.toFixed(6)} · JSON validity: {testResult.structuredOutputValid === null ? 'not applicable' : String(testResult.structuredOutputValid)}</p>{testResult.response.startsWith('data:image/') ? <Image width={384} height={384} unoptimized className="max-w-sm" src={testResult.response} alt="Synthetic restoration test" /> : <pre className="whitespace-pre-wrap rounded bg-muted p-3">{testResult.response}</pre>}</div>}
    </CardContent></Card><div className="space-y-2">{data.health.map(h => <p key={`${h.providerId}:${h.modelId}`} className="text-sm">{h.providerId} / {h.modelId}: {h.failures} consecutive qualifying failures · {h.unavailableUntil > Date.now() ? `Circuit open until ${new Date(h.unavailableUntil).toLocaleString()}` : 'Circuit available'}</p>)}</div></TabsContent>
    </Tabs>
    <Button disabled={busy} onClick={() => confirm('Save model catalog, feature routing and budgets?', token => saveAIControl(token, control))}>Save configuration changes</Button>
    <AlertDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) setConfirmation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>This change affects platform AI availability, credentials or spending. Review the settings before confirming.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const action = confirmation; setConfirmation(null); void action?.run(); }}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
