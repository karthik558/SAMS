import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoUsers } from "@/lib/demo";
import { createPasswordHash } from "@/services/auth";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  last_login: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
  password_changed_at?: string | null;
  active_session_id?: string | null;
  password_hash?: string | null;
};

const table = "app_users";

export async function listUsers(): Promise<AppUser[]> {
  if (isDemoMode()) return getDemoUsers() as any;
  if (!hasSupabaseEnv) { return []; }
  try {
    const columns = "id, name, email, role, department, phone, last_login, status, avatar_url, must_change_password, password_changed_at, active_session_id";
    const { data, error } = await supabase.from(table).select(columns).order("name");
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

// Optionally accept a password for local fallback; DB uses auth for real password handling
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { password, ...dbPayload } = payload as any;
  const hashed = password ? await createPasswordHash(password) : null;
  const insertPayload: any = {
    ...dbPayload,
    password_hash: hashed,
  };
  if (hashed) {
    insertPayload.password_changed_at = dbPayload?.password_changed_at ?? null;
    if (!dbPayload?.must_change_password) {
      insertPayload.password_changed_at = new Date().toISOString();
    }
  }
  const { data, error } = await supabase.from(table).insert(insertPayload).select().single();
  if (error) throw error;
  return data as AppUser;
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as AppUser;
}

export async function deleteUser(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
