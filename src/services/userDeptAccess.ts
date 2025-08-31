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
  if (error) throw error;
  return (data || []).map((r: any) => String(r.department));
}

export async function setUserDepartmentAccess(userId: string, departments: string[]): Promise<void> {
  if (!userId) return;
  const list = Array.from(new Set(departments.map(d => (d || '').trim()).filter(Boolean)));
  if (!hasSupabaseEnv) {
    const map = readLocal();
    map[userId] = list;
    writeLocal(map);
    return;
  }
  // fetch existing
  const existing = await listUserDepartmentAccess(userId);
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
