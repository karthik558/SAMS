import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoUsers } from "@/lib/demo";
import { createPasswordHash } from "@/services/auth";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";

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
const USERS_CACHE_KEY = "users:list";
const USERS_CACHE_TTL = 30_000;

export async function listUsers(options?: { force?: boolean }): Promise<AppUser[]> {
  if (isDemoMode()) return getDemoUsers() as any;
  if (!hasSupabaseEnv) { return []; }
  try {
    const columns = "id, name, email, role, department, phone, last_login, status, avatar_url, must_change_password, password_changed_at, active_session_id";
    return await getCachedValue(
      USERS_CACHE_KEY,
      async () => {
        const { data, error } = await supabase.from(table).select(columns).order("name");
        if (error) throw error;
        return data ?? [];
      },
      { ttlMs: USERS_CACHE_TTL, force: options?.force }
    );
  } catch {
    return [];
  }
}

// Optionally accept a password for local fallback; DB uses auth for real password handling
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { password, ...dbPayload } = payload as any;
  
  // Ensure role is lowercase
  if (dbPayload.role) {
    dbPayload.role = dbPayload.role.toLowerCase();
  }
  
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
  
  // Create user_settings entry with email notifications enabled
  // This is a fallback in case the database trigger doesn't exist
  try {
    await supabase.from('user_settings').insert({
      user_id: data.id,
      email_notifications: true,
    }).select().single();
  } catch (settingsError) {
    // Ignore conflict errors (user_settings already exists from trigger)
    console.log('user_settings creation skipped (already exists or trigger handled it)');
  }
  
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return data as AppUser;
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return data as AppUser;
}

export async function deleteUser(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  invalidateCacheByPrefix(USERS_CACHE_KEY);
}
