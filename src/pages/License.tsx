import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProperties, createProperty as sbCreateProperty, type Property } from '@/services/properties';
import { listAssets } from '@/services/assets';
import { getPropertyLicense, listPropertyLicenses, upsertPropertyLicense, type LicensePlan } from '@/services/license';
import { hasSupabaseEnv } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/layout/PageHeader';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Building2, ShieldCheck, Save, RefreshCw, Lock, Plus, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { loginWithPassword } from '@/services/auth';

interface PropertyRow extends Property { assetCount: number; licenseLimit: number; plan?: LicensePlan | null; derived?: number | null; }

export default function LicensePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [editingPlans, setEditingPlans] = useState<Record<string, LicensePlan | 'none'>>({});
  const [globalMessage] = useState('Global capacity is unlimited. Manage per-property plans below.');
  // Add Property dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<{ id: string; name: string; address: string; type: string; status: string; manager: string }>({ id: '', name: '', address: '', type: 'Office', status: 'Active', manager: '' });
  const [newPlan, setNewPlan] = useState<LicensePlan | 'none'>('none');
  const [newLimit, setNewLimit] = useState<string>('0');
  // Password confirmation gate
  const [authOpen, setAuthOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const SESSION_KEY = 'license_access_verified_at';

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

  function derivedFromPlan(plan?: LicensePlan | null): number | null {
    switch (plan) {
      case 'free': return 100;
      case 'standard': return 500;
      case 'pro': return 2500;
      case 'business': return null;
      default: return null;
    }
  }

  // Determine current user and role; only admins allowed and require password confirmation
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      const role = ((u?.role || '') as string).toLowerCase();
      const email = (u?.email || '') as string;
      if (!email) {
        toast.error('Not signed in');
        navigate('/login');
        return;
      }
      setAdminEmail(email);
      if (role !== 'admin') {
        toast.error('Unauthorized');
        navigate('/');
        return;
      }
      // If recently verified in this session (5 min), skip prompt
      try {
        const ts = Number(sessionStorage.getItem(SESSION_KEY) || '0');
        if (ts && Date.now() - ts < 5 * 60 * 1000) {
          setAuthorized(true);
          setAuthOpen(false);
        }
      } catch {}
    } catch {}
  }, [navigate]);

  // Load only after authorization
  useEffect(() => { if (authorized) reload(); }, [authorized]);

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

  async function handleCreateProperty() {
    try {
      if (!newForm.name.trim()) { toast.error('Enter a property name'); return; }
      setAdding(true);
      // Generate ID if missing
      const id = newForm.id.trim() || `PROP-${Math.floor(Math.random()*900+100)}`;
      let created: Property | null = null;
      if (hasSupabaseEnv) {
        // Persist to Supabase
        created = await sbCreateProperty({
          id,
          name: newForm.name.trim(),
          address: newForm.address.trim() || null,
          type: newForm.type,
          status: newForm.status,
          manager: newForm.manager.trim() || null,
        } as Property);
      } else {
        // Local optimistic add only
        created = {
          id,
          name: newForm.name.trim(),
          address: newForm.address.trim() || null,
          type: newForm.type,
          status: newForm.status,
          manager: newForm.manager.trim() || null,
        } as Property;
      }

      // Compute license store values
      const plan = newPlan === 'none' ? null : newPlan;
      let n = Number(newLimit);
      if (!Number.isFinite(n) || n < 0) n = 0;
      const toStore = plan && plan !== 'business' ? 0 : n;
      try {
        await upsertPropertyLicense(id, toStore, plan);
      } catch (e:any) {
        if (hasSupabaseEnv) throw e; // only ignore when backend not configured
      }

      // Update UI: if backend present, reload; else optimistic append
      if (hasSupabaseEnv) {
        await reload();
      } else if (created) {
        const rawLimit = toStore;
        const derived = rawLimit === 0 ? derivedFromPlan(plan as any) : null;
        const effective = rawLimit > 0 ? rawLimit : (derived ?? 0);
        const row: PropertyRow = { ...created, assetCount: 0, licenseLimit: effective, plan: plan as any, derived } as any;
        setProperties(prev => [...prev, row]);
        setEditingPlans(prev => ({ ...prev, [id]: newPlan }));
      }

      setAddOpen(false);
      setNewForm({ id: '', name: '', address: '', type: 'Office', status: 'Active', manager: '' });
      setNewPlan('none');
      setNewLimit('0');
      toast.success('Property created');
    } catch (e:any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create property');
    } finally {
      setAdding(false);
    }
  }

  // Removed global plan saving; global is unlimited now.

  return (
    <div className='space-y-6'>
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'License' }]} />
      <div className='rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8'>
        <PageHeader
          icon={ShieldCheck}
          title='License Management'
          description='Configure global and per-property asset allowances'
          actions={
            <div className='flex gap-2'>
              <Button size='sm' className='gap-2' onClick={() => setAddOpen(true)}>
                <Plus className='h-4 w-4' />
                Add Property
              </Button>
              <Button size='sm' variant='outline' onClick={reload} className='gap-2'>
                <RefreshCw className='h-4 w-4'/>Refresh
              </Button>
            </div>
          }
        />
      </div>
      {/* Password confirmation modal */}
      <Dialog open={authOpen} onOpenChange={(o)=> { setAuthOpen(o); if (!o && !authorized) navigate('/'); }}>
        <DialogContent className='w-[calc(100vw-2rem)] sm:max-w-md rounded-xl sm:rounded-2xl border border-border/60 bg-card p-0 overflow-hidden'>
          <DialogHeader className='px-5 pt-5 pb-0'>
            <DialogTitle className='text-base flex items-center gap-2'>
              <span className='inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary'>
                <Lock className='h-4 w-4' />
              </span>
              Admin verification
            </DialogTitle>
            <DialogDescription>Enter your password to access license settings.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!adminEmail) { toast.error('Not signed in'); return; }
              try {
                setVerifying(true);
                setAuthError(null);
                const u = await loginWithPassword(adminEmail, password);
                if (!u || (u.role || '').toLowerCase() !== 'admin') {
                  const msg = 'Invalid password. Please try again.';
                  setAuthError(msg);
                  toast.error(msg);
                  setVerifying(false);
                  return;
                }
                setAuthorized(true);
                setAuthOpen(false);
                try { sessionStorage.setItem(SESSION_KEY, String(Date.now())); } catch {}
              } catch (e:any) {
                const msg = e?.message || 'Verification failed';
                setAuthError(String(msg));
                toast.error(msg);
              } finally {
                setVerifying(false);
                setPassword('');
              }
            }}
          >
            <div className='grid gap-3 p-5'>
              <div className='text-xs text-muted-foreground'>
                Signed in as: <span className='font-medium text-foreground'>{adminEmail || '—'}</span>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='admin-password' className='text-xs'>Password</Label>
                <div className='relative'>
                  <Input
                    id='admin-password'
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e)=> setPassword(e.target.value)}
                    placeholder='Enter your password'
                    autoComplete='current-password'
                    autoFocus
                    disabled={verifying}
                  />
                  <button
                    type='button'
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={()=> setShowPassword(v=>!v)}
                    className='absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground'
                  >
                    {showPassword ? <EyeOff className='h-4 w-4'/> : <Eye className='h-4 w-4'/>}
                  </button>
                </div>
                {authError && (
                  <div className='mt-1 inline-flex items-center gap-2 text-[13px] text-destructive'>
                    <AlertCircle className='h-4 w-4' />
                    <span className='leading-none'>{authError}</span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className='px-5 pb-5 gap-2 flex-col-reverse sm:flex-row sm:justify-end'>
              <Button type='button' variant='outline' onClick={()=> navigate('/')} className='w-full sm:w-auto' disabled={verifying}>Cancel</Button>
              <Button type='submit' className='w-full sm:w-auto gap-2' disabled={!password || verifying}>
                {verifying && <Loader2 className='h-4 w-4 animate-spin'/>}
                {verifying ? 'Verifying…' : 'Verify'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {authorized && !!properties.length && (
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
          {!authorized && (
            <div className='text-sm text-muted-foreground'>Please verify your password to view and edit license settings.</div>
          )}
          {authorized && (
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
                    <div className='grid grid-cols-1 sm:[grid-template-columns:12rem_minmax(0,1fr)] md:[grid-template-columns:14rem_minmax(0,1fr)] gap-3 items-start'>
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
                        <SelectTrigger className='h-10 w-full text-xs'>
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
                      <div className='flex flex-col min-w-0'>
                        <Input
                          value={editingVal ?? (p.licenseLimit>0 ? String(p.licenseLimit) : (p.derived ?? 0).toString())}
                          disabled={currentPlan !== 'business'}
                          onChange={(e)=> setEditing(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className='h-10 text-xs tabular-nums'
                          placeholder={currentPlan === 'business' ? 'Enter custom or 0=unlimited' : (p.derived != null ? `Derived ${p.derived}` : '0 = unlimited')}
                        />
                        <div className='mt-1 h-4 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted-foreground'>
                          {currentPlan && currentPlan !== 'business' && p.derived != null ? (
                            <span>Derived from {currentPlan} plan: {p.derived} assets</span>
                          ) : (
                            <span className='invisible'>·</span>
                          )}
                        </div>
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
          )}
          {authorized && !properties.length && !loading && <div className='text-sm text-muted-foreground'>No properties found.</div>}
          {authorized && loading && <div className='text-sm text-muted-foreground'>Loading…</div>}
        </CardContent>
      </Card>

      {!hasSupabaseEnv && (
        <Card className='border-warning/50 bg-warning/5'>
          <CardContent className='p-6 text-sm text-muted-foreground'>Backend not configured: license settings stored locally only.</CardContent>
        </Card>
      )}

      {/* Add Property Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className='sm:max-w-xl rounded-2xl border border-border/60 bg-card/95 p-0 overflow-hidden'>
          <DialogHeader className='border-b border-border/60 px-5 py-4'>
            <DialogTitle className='text-base'>Add Property & Assign License</DialogTitle>
            <DialogDescription>Create a new property and set its license plan or custom limit.</DialogDescription>
          </DialogHeader>
          <div className='p-5'>
            <div className='grid gap-4'>
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='prop-id'>Property ID (optional)</Label>
                  <Input id='prop-id' value={newForm.id} onChange={(e)=> setNewForm(s=>({ ...s, id: e.target.value }))} placeholder='e.g., PROP-123' />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='prop-type'>Type</Label>
                  <Select value={newForm.type} onValueChange={(v)=> setNewForm(s=>({ ...s, type: v }))}>
                    <SelectTrigger id='prop-type'><SelectValue placeholder='Type' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='Office'>Office</SelectItem>
                      <SelectItem value='Storage'>Storage</SelectItem>
                      <SelectItem value='Manufacturing'>Manufacturing</SelectItem>
                      <SelectItem value='Site Office'>Site Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='prop-name'>Name</Label>
                <Input id='prop-name' value={newForm.name} onChange={(e)=> setNewForm(s=>({ ...s, name: e.target.value }))} placeholder='Property name' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='prop-address'>Address</Label>
                <Input id='prop-address' value={newForm.address} onChange={(e)=> setNewForm(s=>({ ...s, address: e.target.value }))} placeholder='Address (optional)' />
              </div>
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='prop-status'>Status</Label>
                  <Select value={newForm.status} onValueChange={(v)=> setNewForm(s=>({ ...s, status: v }))}>
                    <SelectTrigger id='prop-status'><SelectValue placeholder='Status' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='Active'>Active</SelectItem>
                      <SelectItem value='Inactive'>Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='prop-manager'>Manager</Label>
                  <Input id='prop-manager' value={newForm.manager} onChange={(e)=> setNewForm(s=>({ ...s, manager: e.target.value }))} placeholder='Manager (optional)' />
                </div>
              </div>

              <div className='mt-1 rounded-lg border border-border/60 p-3'>
                <div className='mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>License</div>
                <div className='grid gap-3 sm:[grid-template-columns:12rem_minmax(0,1fr)] md:[grid-template-columns:14rem_minmax(0,1fr)] items-start'>
                  <Select value={newPlan} onValueChange={(v)=> {
                    const pv = v as LicensePlan | 'none';
                    setNewPlan(pv);
                    if (pv !== 'business' && pv !== 'none') setNewLimit('0');
                  }}>
                    <SelectTrigger className='h-10 text-sm'><SelectValue placeholder='None' /></SelectTrigger>
                    <SelectContent className='text-sm'>
                      <SelectItem value='none'>None</SelectItem>
                      <SelectItem value='free'>Free</SelectItem>
                      <SelectItem value='standard'>Standard</SelectItem>
                      <SelectItem value='pro'>Pro</SelectItem>
                      <SelectItem value='business'>Business</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className='min-w-0'>
                    <Input
                      value={newLimit}
                      onChange={(e)=> setNewLimit(e.target.value.replace(/[^0-9]/g, ''))}
                      disabled={newPlan !== 'business' && newPlan !== 'none'}
                      className='h-10 text-sm tabular-nums'
                      placeholder={newPlan === 'business' || newPlan === 'none' ? 'Enter custom or 0=unlimited' : (()=>{
                        const d = derivedFromPlan(newPlan as any);
                        return d != null ? `Derived ${d}` : '0 = unlimited';
                      })()}
                    />
                    <div className='mt-1 h-4 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted-foreground'>
                      {newPlan && newPlan !== 'business' && newPlan !== 'none' ? (
                        <span>Derived from {newPlan} plan: {derivedFromPlan(newPlan as any) ?? 0} assets</span>
                      ) : (
                        <span className='invisible'>·</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className='mt-2 text-[11px] text-muted-foreground'>Tip: Plans derive a default limit. Choose Business or None to set a custom number. Use 0 for unlimited.</p>
              </div>
            </div>
          </div>
          <DialogFooter className='px-5 pb-5'>
            <Button variant='outline' onClick={()=> setAddOpen(false)} disabled={adding}>Cancel</Button>
            <Button onClick={handleCreateProperty} disabled={adding}>{adding ? 'Creating…' : 'Create & Assign'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
