import { useEffect, useState, useMemo } from 'react';
import { listProperties, type Property } from '@/services/properties';
import { listAssets } from '@/services/assets';
import { getPropertyLicense, listPropertyLicenses, upsertPropertyLicense, type LicensePlan } from '@/services/license';
import { hasSupabaseEnv } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import PageHeader from '@/components/layout/PageHeader';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Building2, ShieldCheck, Save, RefreshCw } from 'lucide-react';

interface PropertyRow extends Property { assetCount: number; licenseLimit: number; plan?: LicensePlan | null; derived?: number | null; }

export default function LicensePage() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [editingPlans, setEditingPlans] = useState<Record<string, LicensePlan | 'none'>>({});
  const [globalMessage] = useState('Global capacity is unlimited. Manage per-property plans below.');

  const reload = async () => {
    setLoading(true);
    try {
      const [props, assets, propLicenses] = await Promise.all([
        listProperties().catch(() => []),
        listAssets().catch(() => []),
        listPropertyLicenses().catch(() => [])
      ]);
  const mapLic: Record<string, { limit: number; plan?: LicensePlan | null; } > = {};
  for (const l of propLicenses as any[]) mapLic[l.property_id] = { limit: l.asset_limit, plan: l.plan };
      const assetCounts: Record<string, number> = {};
      for (const a of assets) {
        const pid = a.property_id || a.property;
        if (!pid) continue;
        assetCounts[pid] = (assetCounts[pid] || 0) + 1;
      }
      function derivedFromPlan(plan?: LicensePlan | null): number | null {
        switch (plan) {
          case 'free': return 100;
          case 'standard': return 500;
          case 'pro': return 2500;
          case 'business': return null; // unlimited unless numeric set
          default: return null;
        }
      }
      const rows: PropertyRow[] = props.map(p => {
        const entry = mapLic[p.id];
        const plan = entry?.plan;
        const rawLimit = entry?.limit ?? 0;
        const derived = rawLimit === 0 ? derivedFromPlan(plan) : null;
        const effective = rawLimit > 0 ? rawLimit : (derived ?? 0);
        return { ...p, assetCount: assetCounts[p.id] || 0, licenseLimit: effective, plan, derived };
      });
      setProperties(rows);
      // Initialize editingPlans for newly loaded properties if absent
      setEditingPlans(prev => {
        const next = { ...prev };
        for (const r of rows) {
          if (!next[r.id]) next[r.id] = (r.plan || 'none');
        }
        return next;
      });
    } catch (e:any) {
      console.error(e);
      toast.error('Failed to load license data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const totalUsage = useMemo(() => properties.reduce((s,p)=> s + p.assetCount, 0), [properties]);

  const handleSaveProperty = async (propId: string) => {
    const raw = editing[propId];
    if (raw == null) return;
    let n = Number(raw);
    if (raw === '' || raw == null) n = 0;
    if (!Number.isFinite(n) || n < 0) { toast.error('Invalid number'); return; }
    // find plan from mutated property object
  const planSel = editingPlans[propId];
  const plan = (!planSel || planSel === 'none') ? null : planSel;
    // For non-business plans numeric should be 0 (derive on read)
    const toStore = plan && plan !== 'business' ? 0 : n;
    try { await upsertPropertyLicense(propId, toStore, plan); toast.success('Saved'); setEditing(prev => { const cp = { ...prev }; delete cp[propId]; return cp; }); await reload(); } catch (e:any) { toast.error(e.message || 'Failed'); }
  };

  // Removed global plan saving; global is unlimited now.

  return (
    <div className='space-y-6'>
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'License' }]} />
      <div className='rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8'>
        <PageHeader icon={ShieldCheck} title='License Management' description='Configure global and per-property asset allowances' actions={<Button size='sm' variant='outline' onClick={reload} className='gap-2'><RefreshCw className='h-4 w-4'/>Refresh</Button>} />
      </div>
      {!!properties.length && (
        <Card className='border border-primary/30 bg-primary/5'>
          <CardContent className='p-4 text-sm flex flex-wrap gap-2'>
            <span className='font-medium text-primary'>Global Unlimited</span>
            <span className='text-muted-foreground'>Manage capacity per property with plans or custom limits.</span>
            <span className='ml-auto text-xs text-muted-foreground'>Total assets: <span className='font-semibold text-foreground'>{totalUsage}</span></span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Per-Property Plans & Limits</CardTitle>
          <CardDescription>Assign a plan or custom numeric limit per property. Plan derives a default limit unless you set a specific number (0 = unlimited).</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
            {properties.map(p => {
              const pct = p.licenseLimit>0 ? Math.min(100, Math.round(p.assetCount / p.licenseLimit * 100)) : 0;
              const editingVal = editing[p.id];
              const currentPlanSel = editingPlans[p.id];
              const currentPlan = currentPlanSel && currentPlanSel !== 'none' ? currentPlanSel as LicensePlan : undefined;
              return (
                <div key={p.id} className='rounded-xl border border-border/60 bg-card/80 p-4 flex flex-col gap-3 shadow-sm'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex items-center gap-2'>
                      <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary'><Building2 className='h-5 w-5'/></div>
                      <div>
                        <div className='font-semibold text-sm'>{p.name}</div>
                        <div className='text-xs text-muted-foreground'>{p.id}</div>
                      </div>
                    </div>
                    <div className='text-right text-xs text-muted-foreground'>Assets: <span className='font-semibold text-foreground'>{p.assetCount}</span>{p.licenseLimit>0 && <> / <span className='font-semibold'>{p.licenseLimit}</span></>}</div>
                  </div>
                  <div className='space-y-2'>
                    <label className='text-[11px] uppercase tracking-wide text-muted-foreground'>Plan & Limit</label>
                    <div className='flex gap-2 items-center'>
                      <Select
                        value={currentPlan ? currentPlan : 'none'}
                        onValueChange={(val)=> {
                          const planValue = val as LicensePlan | 'none';
                          setEditingPlans(prev => ({ ...prev, [p.id]: planValue }));
                          if (planValue !== 'business' && planValue !== 'none') {
                            setEditing(prev => ({ ...prev, [p.id]: '0' }));
                          } else if (planValue === 'business') {
                            setEditing(prev => ({ ...prev, [p.id]: prev[p.id] ?? (p.licenseLimit>0 ? String(p.licenseLimit) : '') }));
                          } else { // none
                            setEditing(prev => ({ ...prev, [p.id]: prev[p.id] ?? (p.licenseLimit>0 ? String(p.licenseLimit) : '0') }));
                          }
                        }}
                      >
                        <SelectTrigger className='h-9 w-32 text-xs'>
                          <SelectValue placeholder='None' />
                        </SelectTrigger>
                        <SelectContent className='text-xs'>
                          <SelectItem value='none'>None</SelectItem>
                          <SelectItem value='free'>Free</SelectItem>
                          <SelectItem value='standard'>Standard</SelectItem>
                          <SelectItem value='pro'>Pro</SelectItem>
                          <SelectItem value='business'>Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className='flex flex-col flex-1'>
                        <Input
                          value={editingVal ?? (p.licenseLimit>0 ? String(p.licenseLimit) : (p.derived ?? 0).toString())}
                          disabled={currentPlan !== 'business'}
                          onChange={(e)=> setEditing(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className='h-9 text-xs'
                          placeholder={currentPlan === 'business' ? 'Enter custom or 0=unlimited' : (p.derived != null ? `Derived ${p.derived}` : '0 = unlimited')}
                        />
                        {currentPlan && currentPlan !== 'business' && p.derived != null && (
                          <div className='mt-1 text-[10px] text-muted-foreground'>Derived from {currentPlan} plan: {p.derived} assets</div>
                        )}
                      </div>
                    </div>
                    <Button size='sm' onClick={()=> handleSaveProperty(p.id)} className='gap-2 h-8'><Save className='h-4 w-4'/>Save</Button>
                  </div>
                  {p.licenseLimit>0 && (
                    <div className='space-y-1'>
                      <div className='flex items-center justify-between text-[11px] text-muted-foreground'>
                        <span>Utilization</span>
                        <span className='font-medium text-foreground'>{pct}%</span>
                      </div>
                      <div className='h-2 w-full rounded-full bg-muted/50'>
                        <div className='h-full rounded-full bg-gradient-to-r from-primary via-primary/70 to-primary/40' style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!properties.length && !loading && <div className='text-sm text-muted-foreground'>No properties found.</div>}
          {loading && <div className='text-sm text-muted-foreground'>Loading…</div>}
        </CardContent>
      </Card>

      {!hasSupabaseEnv && (
        <Card className='border-warning/50 bg-warning/5'>
          <CardContent className='p-6 text-sm text-muted-foreground'>Backend not configured: license settings stored locally only.</CardContent>
        </Card>
      )}
    </div>
  );
}
