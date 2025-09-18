import { useEffect, useState, useMemo } from 'react';
import { listProperties, type Property } from '@/services/properties';
import { listAssets } from '@/services/assets';
import { getPropertyLicense, listPropertyLicenses, upsertPropertyLicense, getGlobalLimits, updateGlobalLimits } from '@/services/license';
import { hasSupabaseEnv } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import PageHeader from '@/components/layout/PageHeader';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Building2, ShieldCheck, Save, RefreshCw } from 'lucide-react';

interface PropertyRow extends Property { assetCount: number; licenseLimit: number; }

export default function LicensePage() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [globalLimit, setGlobalLimit] = useState<number>(100);
  const [globalInput, setGlobalInput] = useState<string>('');

  const reload = async () => {
    setLoading(true);
    try {
      const [props, assets, propLicenses, global] = await Promise.all([
        listProperties().catch(() => []),
        listAssets().catch(() => []),
        listPropertyLicenses().catch(() => []),
        getGlobalLimits().catch(() => ({ free_asset_allowance: 100 }))
      ]);
      const mapLic: Record<string, number> = {};
      for (const l of propLicenses) mapLic[l.property_id] = l.asset_limit;
      const assetCounts: Record<string, number> = {};
      for (const a of assets) {
        const pid = a.property_id || a.property;
        if (!pid) continue;
        assetCounts[pid] = (assetCounts[pid] || 0) + 1;
      }
      const rows: PropertyRow[] = props.map(p => ({ ...p, assetCount: assetCounts[p.id] || 0, licenseLimit: mapLic[p.id] || 0 }));
      setProperties(rows);
      setGlobalLimit(global.free_asset_allowance || 0);
      setGlobalInput(String(global.free_asset_allowance || 0));
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
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) { toast.error('Invalid number'); return; }
    try { await upsertPropertyLicense(propId, n); toast.success('Saved'); setEditing(prev => { const cp = { ...prev }; delete cp[propId]; return cp; }); await reload(); } catch (e:any) { toast.error(e.message || 'Failed'); }
  };

  const handleSaveGlobal = async () => {
    const n = Number(globalInput);
    if (!Number.isFinite(n) || n < 0) { toast.error('Invalid number'); return; }
    try { await updateGlobalLimits({ free_asset_allowance: n }); toast.success('Global limit updated'); setGlobalLimit(n); } catch (e:any) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div className='space-y-6'>
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'License' }]} />
      <div className='rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8'>
        <PageHeader icon={ShieldCheck} title='License Management' description='Configure global and per-property asset allowances' actions={<Button size='sm' variant='outline' onClick={reload} className='gap-2'><RefreshCw className='h-4 w-4'/>Refresh</Button>} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Global Free Asset Allowance</CardTitle>
          <CardDescription>Default maximum total assets before upgrade is required</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-end'>
            <div className='flex flex-col gap-1'>
              <label className='text-sm font-medium'>Total Free Assets</label>
              <Input value={globalInput} onChange={(e)=> setGlobalInput(e.target.value)} className='w-40' />
            </div>
            <div className='text-sm text-muted-foreground'>Current usage: <span className='font-semibold text-foreground'>{totalUsage}</span>{globalLimit>0 ? <> / <span className='font-semibold'>{globalLimit}</span></> : ' (unlimited)'}</div>
            <Button onClick={handleSaveGlobal} className='gap-2'><Save className='h-4 w-4'/>Save</Button>
          </div>
          {globalLimit>0 && (
            <div className='mt-4 h-2 rounded-full bg-muted/60 w-full'>
              <div className='h-full rounded-full bg-gradient-to-r from-primary to-primary/60' style={{ width: `${Math.min(100, Math.round(totalUsage / globalLimit * 100))}%` }} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Property License Allocation</CardTitle>
          <CardDescription>Assign specific asset limits to each property (0 = no specific limit)</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
            {properties.map(p => {
              const pct = p.licenseLimit>0 ? Math.min(100, Math.round(p.assetCount / p.licenseLimit * 100)) : 0;
              const editingVal = editing[p.id];
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
                    <label className='text-[11px] uppercase tracking-wide text-muted-foreground'>Asset Limit</label>
                    <Input value={editingVal ?? String(p.licenseLimit)} onChange={(e)=> setEditing(prev => ({ ...prev, [p.id]: e.target.value }))} className='h-9' />
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
