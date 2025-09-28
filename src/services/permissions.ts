import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type PageKey = 'assets' | 'properties' | 'qrcodes' | 'users' | 'reports' | 'settings' | 'audit';

export type UserPermission = {
  id?: string;
  user_id: string;
  page: PageKey;
  can_view: boolean;
  can_edit: boolean;
};

const TABLE = 'user_permissions';
const LS_KEY = 'user_permissions'; // { [userId]: { [page]: { v: boolean, e: boolean } } }
const CURRENT_USER_KEY = 'current_user_id';

type LocalPermMap = Record<string, Record<PageKey, { v: boolean; e: boolean }>>;

function readLocal(): LocalPermMap {
  try {
    const key = isDemoMode() ? 'demo_user_permissions' : LS_KEY;
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch { return {}; }
}
function writeLocal(data: LocalPermMap) {
  try {
    const key = isDemoMode() ? 'demo_user_permissions' : LS_KEY;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function getCurrentUserId(): string | null {
  try {
    const key = isDemoMode() ? 'demo_current_user_id' : CURRENT_USER_KEY;
    return localStorage.getItem(key);
  } catch { return null; }
}

export async function listUserPermissions(userId: string): Promise<Record<PageKey, { v: boolean; e: boolean }>> {
  if (!userId) return {} as any;
  if (!hasSupabaseEnv) {
    const map = readLocal();
    return (map[userId] || {}) as any;
  }
  try {
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (error) throw error;
    // Build from remote
    const remote: Record<PageKey, { v: boolean; e: boolean }> = {} as any;
    (data || []).forEach((row: any) => {
      const page = row.page as PageKey;
      remote[page] = { v: !!row.can_view, e: !!row.can_edit };
    });
    // Merge in local entries for pages missing remotely (helps when RLS blocked or RPC not yet created)
    const localAll = readLocal();
    const local = (localAll[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
    const merged: Record<PageKey, { v: boolean; e: boolean }> = { ...remote } as any;
    (Object.keys(local) as PageKey[]).forEach((p) => {
      if (!(p in merged)) merged[p] = local[p];
    });
    return merged;
  } catch {
    // Fallback to local when table missing or any error
    const map = readLocal();
    return (map[userId] || {}) as any;
  }
}

export async function setUserPermissions(userId: string, perms: Record<PageKey, { v?: boolean; e?: boolean }>): Promise<void> {
  if (!userId) return;
  if (!hasSupabaseEnv) {
    const map = readLocal();
    const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
    (Object.keys(perms) as PageKey[]).forEach((p) => {
      const existing = cur[p] || { v: false, e: false };
      const next = { v: perms[p].v ?? existing.v, e: perms[p].e ?? existing.e };
      cur[p] = next;
    });
    map[userId] = cur;
    writeLocal(map);
    return;
  }
  // Build rows for RPC/upsert
  const rows: Array<{ page: PageKey; v: boolean; e: boolean }> = (Object.keys(perms) as PageKey[]).map((page) => ({
    page,
    v: !!perms[page].v,
    e: !!perms[page].e,
  }));
  // 1) Try SECURITY DEFINER RPC (JSON variant) to bypass RLS and avoid composite type issues
  try {
    const { error: rpcJsonErr } = await supabase.rpc('set_user_permissions_json_v1', {
      p_user_id: userId,
      p_perms: rows, // JSON array [{page, v, e}]
    } as any);
    if (!rpcJsonErr) {
      // Mirror to local
      const map = readLocal();
      const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
      rows.forEach((r) => { cur[r.page] = { v: r.v, e: r.e }; });
      map[userId] = cur;
      writeLocal(map);
      return;
    }
    console.warn('RPC set_user_permissions_json_v1 failed, trying typed RPC next...', rpcJsonErr);
  } catch (e) {
    console.warn('RPC set_user_permissions_json_v1 not available, trying typed RPC...', e);
  }
  // 1b) Try typed composite RPC if available
  try {
    const { error: rpcErr } = await supabase.rpc('set_user_permissions_v1', {
      p_user_id: userId,
      p_perms: rows as any,
    } as any);
    if (!rpcErr) {
      const map = readLocal();
      const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
      rows.forEach((r) => { cur[r.page] = { v: r.v, e: r.e }; });
      map[userId] = cur;
      writeLocal(map);
      return;
    }
    console.warn('RPC set_user_permissions_v1 failed, attempting direct upsert...', rpcErr);
  } catch (e) {
    console.warn('RPC set_user_permissions_v1 not available, attempting direct upsert...', e);
  }
  // 2) Direct upsert (may be blocked by RLS without admin policy)
  try {
    const upsertRows: UserPermission[] = rows.map((r) => ({ user_id: userId, page: r.page, can_view: r.v, can_edit: r.e }));
    const { error } = await supabase.from(TABLE).upsert(upsertRows as any, { onConflict: 'user_id,page' });
    if (error) throw error;
    // Mirror to local
    const map = readLocal();
    const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
    rows.forEach((r) => { cur[r.page] = { v: r.v, e: r.e }; });
    map[userId] = cur;
    writeLocal(map);
  } catch {
    // Fallback to local on error
    const map = readLocal();
    const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
    rows.forEach((r) => { cur[r.page] = { v: r.v, e: r.e }; });
    map[userId] = cur;
    writeLocal(map);
  }
}

export async function canUserView(userId: string, page: PageKey): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.v;
}

export async function canUserEdit(userId: string, page: PageKey): Promise<boolean | null> {
  const perms = await listUserPermissions(userId);
  if (!(page in perms)) return null;
  return !!perms[page]?.e;
}

// Role-based defaults. Dashboard and Scan QR are always visible and not part of PageKey.
export function roleDefaults(roleRaw?: string): Record<PageKey, { v: boolean; e: boolean }> {
  const role = (roleRaw || '').toLowerCase();
  const base: Record<PageKey, { v: boolean; e: boolean }> = {
    assets: { v: false, e: false },
    properties: { v: false, e: false },
    qrcodes: { v: false, e: false },
    users: { v: false, e: false },
    reports: { v: false, e: false },
    settings: { v: false, e: false },
    audit: { v: false, e: false },
  };
  if (role === 'admin') {
    Object.keys(base).forEach((k) => {
      // @ts-expect-error: iterating string keys; index type aligns with PageKey at runtime
      base[k] = { v: true, e: true };
    });
  } else if (role === 'manager') {
  base.assets = { v: true, e: true };
  base.properties = { v: true, e: true };
  base.qrcodes = { v: true, e: true };
  base.reports = { v: true, e: false };
  base.settings = { v: true, e: false };
  // Audit visibility for managers is handled by runtime conditions (active session/reports),
  // not by defaults. Admins can grant explicit audit perms via overrides.
    // users remains false by default, but can be elevated via overrides
  } else {
    // user
  base.assets = { v: true, e: true };
  base.qrcodes = { v: true, e: true };
  base.settings = { v: true, e: false };
  }
  return base;
}

export function mergeDefaultsWithOverrides(roleRaw: string | undefined, overrides: Record<PageKey, { v: boolean; e: boolean }>): Record<PageKey, { v: boolean; e: boolean }>{
  const d = roleDefaults(roleRaw);
  const out: Record<PageKey, { v: boolean; e: boolean }> = { ...d };
  (Object.keys(overrides) as PageKey[]).forEach((k) => {
    out[k] = {
      v: overrides[k].v ?? d[k].v,
      e: overrides[k].e ?? d[k].e,
    };
  });
  return out;
}
