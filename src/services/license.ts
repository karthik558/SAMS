import { hasSupabaseEnv, supabase } from '@/lib/supabaseClient';
import { isDemoMode } from '@/lib/demo';

export type PropertyLicense = {
  property_id: string;
  asset_limit: number; // 0 means unlimited? We will treat 0 as no explicit limit (fallback to global remaining?) For now 0 = not assigned.
  updated_at?: string;
};

export type GlobalLicenseLimits = {
  free_asset_allowance: number; // default 100
};

const LOCAL_KEY_PL = 'property_license_map';
const LOCAL_KEY_GLOBAL = 'license_global_limits';

function readLocalMap(): Record<string, PropertyLicense> {
  try { const raw = localStorage.getItem(LOCAL_KEY_PL); if (raw) return JSON.parse(raw); } catch {}
  return {};
}
function writeLocalMap(m: Record<string, PropertyLicense>) { try { localStorage.setItem(LOCAL_KEY_PL, JSON.stringify(m)); } catch {} }
function readLocalGlobal(): GlobalLicenseLimits { try { const raw = localStorage.getItem(LOCAL_KEY_GLOBAL); if (raw) return JSON.parse(raw); } catch {} return { free_asset_allowance: 100 }; }
function writeLocalGlobal(v: GlobalLicenseLimits) { try { localStorage.setItem(LOCAL_KEY_GLOBAL, JSON.stringify(v)); } catch {} }

export async function listPropertyLicenses(): Promise<PropertyLicense[]> {
  if (!hasSupabaseEnv || isDemoMode()) {
    return Object.values(readLocalMap());
  }
  const { data, error } = await supabase.from('property_license').select('*');
  if (error) throw error;
  return (data || []) as PropertyLicense[];
}

export async function getPropertyLicense(propertyId: string): Promise<PropertyLicense | null> {
  if (!hasSupabaseEnv || isDemoMode()) {
    const map = readLocalMap();
    return map[propertyId] || null;
  }
  const { data, error } = await supabase.from('property_license').select('*').eq('property_id', propertyId).maybeSingle();
  if (error) throw error;
  return data as PropertyLicense | null;
}

export async function upsertPropertyLicense(propertyId: string, assetLimit: number): Promise<PropertyLicense> {
  if (!hasSupabaseEnv || isDemoMode()) {
    const map = readLocalMap();
    map[propertyId] = { property_id: propertyId, asset_limit: assetLimit, updated_at: new Date().toISOString() };
    writeLocalMap(map);
    return map[propertyId];
  }
  const { data, error } = await supabase.from('property_license').upsert({ property_id: propertyId, asset_limit: assetLimit }).select().single();
  if (error) throw error;
  return data as PropertyLicense;
}

export async function getGlobalLimits(): Promise<GlobalLicenseLimits> {
  if (!hasSupabaseEnv || isDemoMode()) {
    return readLocalGlobal();
  }
  const { data, error } = await supabase.from('license_meta').select('value').eq('key', 'global_limits').maybeSingle();
  if (error) throw error;
  if (data?.value) return data.value as GlobalLicenseLimits;
  return { free_asset_allowance: 100 };
}

export async function updateGlobalLimits(patch: Partial<GlobalLicenseLimits>): Promise<GlobalLicenseLimits> {
  if (!hasSupabaseEnv || isDemoMode()) {
    const cur = readLocalGlobal();
    const next = { ...cur, ...patch };
    writeLocalGlobal(next);
    return next;
  }
  const current = await getGlobalLimits();
  const value = { ...current, ...patch };
  const { error } = await supabase.from('license_meta').upsert({ key: 'global_limits', value });
  if (error) throw error;
  return value;
}

// Helper to compute total assets count (DB query). Provide fallback when offline.
export async function countTotalAssets(): Promise<number> {
  if (!hasSupabaseEnv || isDemoMode()) {
    try { const raw = localStorage.getItem('demo_assets') || localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); return Array.isArray(list) ? list.length : 0; } } catch {}
    return 0;
  }
  const { count, error } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export type LicenseCheckResult = {
  ok: boolean;
  reason?: 'GLOBAL_LIMIT' | 'PROPERTY_LIMIT';
  message?: string;
  propertyLimit?: number;
  propertyUsage?: number;
  globalLimit?: number;
  globalUsage?: number;
};

export async function checkLicenseBeforeCreate(propertyId: string, increment: number = 1): Promise<LicenseCheckResult> {
  const global = await getGlobalLimits();
  const totalUsage = await countTotalAssets();
  const nextGlobal = totalUsage + increment;
  const globalLimit = global.free_asset_allowance || 0; // free tier allowance
  if (globalLimit > 0 && nextGlobal > globalLimit) {
    return { ok: false, reason: 'GLOBAL_LIMIT', message: 'License Exceed: Global asset allowance reached. Please raise a ticket to upgrade.', globalLimit, globalUsage: totalUsage };
  }
  // property limit
  const lic = await getPropertyLicense(propertyId);
  if (lic && lic.asset_limit > 0) {
    // Count property assets
    let propUsage = 0;
    if (!hasSupabaseEnv || isDemoMode()) {
      try { const raw = localStorage.getItem('assets_cache'); if (raw) { const list = JSON.parse(raw); propUsage = list.filter((a: any) => a.property_id === propertyId || a.property === propertyId).length; } } catch {}
    } else {
      const { count, error } = await supabase.from('assets').select('*', { count: 'exact', head: true }).eq('property_id', propertyId);
      if (error) throw error;
      propUsage = count || 0;
    }
    if (propUsage + increment > lic.asset_limit) {
      return { ok: false, reason: 'PROPERTY_LIMIT', message: 'License Exceed: Property asset limit reached. Please raise a ticket for upgrading the license.', propertyLimit: lic.asset_limit, propertyUsage: propUsage };
    }
    return { ok: true, propertyLimit: lic.asset_limit, propertyUsage: propUsage };
  }
  return { ok: true, globalLimit, globalUsage: totalUsage };
}
