import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

const TABLE = "user_department_access";
const LS_KEY = "user_dept_access"; // { [userId: string]: string[] of department names }
const CURRENT_USER_KEY = "current_user_id";

export type UserDepartmentAccess = {
  id: string;
  user_id: string;
  department: string; // department name (normalized text)
  created_at?: string;
};

function readLocal(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLocal(data: Record<string, string[]>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

export async function listUserDepartmentAccess(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (!hasSupabaseEnv) {
    const map = readLocal();
    return map[userId] || [];
  }
  const { data, error } = await supabase.from(TABLE).select("department").eq("user_id", userId);
  if (error) {
    // Permission/RLS or other errors -> fall back to local so UI remains consistent
    const map = readLocal();
    return map[userId] || [];
  }
  const remote = (data || []).map((r: any) => String(r.department));
  // Merge with local cache to keep UI stable if remote writes were blocked
  const local = readLocal()[userId] || [];
  return Array.from(new Set([...
    remote,
    ...local,
  ]));
}

export async function setUserDepartmentAccess(userId: string, departments: string[]): Promise<{ savedRemotely: boolean }> {
  if (!userId) return;
  const list = Array.from(new Set(departments.map(d => (d || '').trim()).filter(Boolean)));
  if (!hasSupabaseEnv) {
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    return { savedRemotely: false };
  }
  // 1) Try secure RPC if available (preferred under RLS)
  try {
    const { error: rpcErr } = await supabase.rpc('set_user_department_access_v1', {
      p_user_id: userId,
      p_departments: list,
    } as any);
    if (!rpcErr) {
      const map = readLocal();
      map[userId] = list;
      writeLocal(map);
      return { savedRemotely: true };
    }
    // Fall through to direct writes if RPC missing or errors
    console.warn('RPC set_user_department_access failed, attempting direct writes...', rpcErr);
  } catch (e) {
    console.warn('RPC set_user_department_access not available, attempting direct writes...', e);
  }

  // 2) Direct writes as fallback (may be blocked by RLS without admin policy)
  try {
  // Fetch existing REMOTE rows only (do not merge local cache here)
  const { data: exRows, error: exErr } = await supabase.from(TABLE).select('department').eq('user_id', userId);
  if (exErr) throw exErr;
  const existing = (exRows || []).map((r: any) => String(r.department));
    const toAdd = list.filter((d) => !existing.includes(d));
    const toRemove = existing.filter((d) => !list.includes(d));
    if (toAdd.length) {
      const rows = toAdd.map((department) => ({ user_id: userId, department }));
      const { error } = await supabase.from(TABLE).insert(rows);
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).in("department", toRemove);
      if (error) throw error;
    }
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    return { savedRemotely: true };
  } catch (error) {
    // 3) Final fallback: local mirror only
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    console.warn("setUserDepartmentAccess: Remote save failed, saved locally only.", error);
    return { savedRemotely: false };
  }
}

export async function getAccessibleDepartmentsForCurrentUser(): Promise<Set<string>> {
  try {
    const uid = localStorage.getItem(CURRENT_USER_KEY);
    if (!uid) return new Set();
    const depts = await listUserDepartmentAccess(uid);
    return new Set(depts.map(d => d.toString()));
  } catch {
    return new Set();
  }
}
