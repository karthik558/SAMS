import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type PageKey = 'assets' | 'properties' | 'qrcodes' | 'users' | 'reports' | 'settings';

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
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function writeLocal(data: LocalPermMap) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export function getCurrentUserId(): string | null {
  try { return localStorage.getItem(CURRENT_USER_KEY); } catch { return null; }
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
    const out: Record<PageKey, { v: boolean; e: boolean }> = {} as any;
    (data || []).forEach((row: any) => {
      const page = row.page as PageKey;
      out[page] = { v: !!row.can_view, e: !!row.can_edit };
    });
    return out;
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
  // Upsert each page permission row
  const rows: UserPermission[] = [];
  (Object.keys(perms) as PageKey[]).forEach((page) => {
    rows.push({ user_id: userId, page, can_view: !!perms[page].v, can_edit: !!perms[page].e });
  });
  // Delete unspecified pages? We won't; we only upsert changed pages.
  try {
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,page' });
    if (error) throw error;
  } catch {
    // Fallback to local on error
    const map = readLocal();
    const cur = (map[userId] || {}) as Record<PageKey, { v: boolean; e: boolean }>;
    (Object.keys(perms) as PageKey[]).forEach((p) => {
      const existing = cur[p] || { v: false, e: false };
      const next = { v: perms[p].v ?? existing.v, e: perms[p].e ?? existing.e };
      cur[p] = next;
    });
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
  };
  if (role === 'admin') {
    Object.keys(base).forEach((k) => {
      // @ts-ignore
      base[k] = { v: true, e: true };
    });
  } else if (role === 'manager') {
  base.assets = { v: true, e: true };
  base.properties = { v: true, e: true };
  base.qrcodes = { v: true, e: true };
  base.reports = { v: true, e: false };
  base.settings = { v: true, e: false };
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
