import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

const TABLE = "user_property_access";
const LS_KEY = "user_access"; // { [userId: string]: string[] }
const CURRENT_USER_KEY = "current_user_id";

export type UserPropertyAccess = {
  id: string;
  user_id: string;
  property_id: string;
  created_at?: string;
};

function readLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, string[]>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function listUserPropertyAccess(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (!hasSupabaseEnv) {
    const map = readLocal();
    return map[userId] || [];
  }
  const { data, error } = await supabase.from(TABLE).select("property_id").eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r: any) => r.property_id);
}

export async function setUserPropertyAccess(userId: string, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  if (!hasSupabaseEnv) {
    const map = readLocal();
    map[userId] = Array.from(new Set(propertyIds));
    writeLocal(map);
    return;
  }
  // 1) Try SECURITY DEFINER RPC to bypass RLS if available
  try {
    const { error: rpcErr } = await supabase.rpc('set_user_property_access_v1', {
      p_user_id: userId,
      p_property_ids: Array.from(new Set(propertyIds)),
    } as any);
    if (!rpcErr) {
      const map = readLocal();
      map[userId] = Array.from(new Set(propertyIds));
      writeLocal(map);
      return;
    }
    console.warn('RPC set_user_property_access_v1 failed, attempting direct writes...', rpcErr);
  } catch (e) {
    console.warn('RPC set_user_property_access_v1 not available, attempting direct writes...', e);
  }
  // 2) Direct writes (may be blocked by RLS)
  // Fetch existing REMOTE rows only
  const { data: exRows, error: exErr } = await supabase.from(TABLE).select('property_id').eq('user_id', userId);
  if (exErr) throw exErr;
  const existing = (exRows || []).map((r: any) => String(r.property_id));
  const uniq = Array.from(new Set(propertyIds));
  const toAdd = uniq.filter((p) => !existing.includes(p));
  const toRemove = existing.filter((p) => !uniq.includes(p));
  if (toAdd.length) {
    const rows = toAdd.map((property_id) => ({ user_id: userId, property_id }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).in("property_id", toRemove);
    if (error) throw error;
  }
  const map = readLocal();
  map[userId] = uniq;
  writeLocal(map);
}

export async function grantUserProperty(userId: string, propertyId: string): Promise<void> {
  if (!userId || !propertyId) return;
  if (!hasSupabaseEnv) {
    const map = readLocal();
    const arr = new Set(map[userId] || []);
    arr.add(propertyId);
    map[userId] = Array.from(arr);
    writeLocal(map);
    return;
  }
  await supabase.from(TABLE).insert({ user_id: userId, property_id: propertyId });
}

export async function revokeUserProperty(userId: string, propertyId: string): Promise<void> {
  if (!userId || !propertyId) return;
  if (!hasSupabaseEnv) {
    const map = readLocal();
    const arr = new Set(map[userId] || []);
    arr.delete(propertyId);
    map[userId] = Array.from(arr);
    writeLocal(map);
    return;
  }
  await supabase.from(TABLE).delete().eq("user_id", userId).eq("property_id", propertyId);
}

export async function getAccessiblePropertyIdsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem(CURRENT_USER_KEY);
    if (!uid) return new Set();
    const props = await listUserPropertyAccess(uid);
    return new Set(props);
  } catch {
    return new Set();
  }
}

export function setCurrentUserIdLocal(userId: string | null) {
  try {
    if (userId) localStorage.setItem(CURRENT_USER_KEY, userId);
    else localStorage.removeItem(CURRENT_USER_KEY);
  } catch {}
}
