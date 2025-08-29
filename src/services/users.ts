import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

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
};

const table = "app_users";

export async function listUsers(): Promise<AppUser[]> {
  if (!hasSupabaseEnv) {
    // Defer to UI fallback; return empty to trigger seeding
    return [];
  }
  try {
    const { data, error } = await supabase.from(table).select("*").order("name");
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

// Optionally accept a password for local fallback; DB uses auth for real password handling
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { password, ...dbPayload } = payload as any;
  const { data, error } = await supabase.from(table).insert(dbPayload).select().single();
  if (error) throw error;
  return data as AppUser;
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as AppUser;
}

export async function deleteUser(id: string): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
