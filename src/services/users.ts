import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoUsers } from "@/lib/demo";
import { accountAction, USER_PROFILE_COLUMNS } from "@/services/auth";
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
};

const table = "app_users";
const USERS_CACHE_KEY = "users:list";
const USERS_CACHE_TTL = 30_000;

export async function listUsers(options?: { force?: boolean }): Promise<AppUser[]> {
  if (isDemoMode()) return getDemoUsers() as any;
  if (!hasSupabaseEnv) { return []; }
  const { data: identity, error: authError } = await supabase.auth.getUser();
  if (authError || !identity.user) throw new Error("Authentication required");
  return getCachedValue(
    `${USERS_CACHE_KEY}:${identity.user.id}`,
    async () => {
      const { data, error } = await supabase.from(table).select(USER_PROFILE_COLUMNS).order("name");
      if (error) throw error;
      return data ?? [];
    },
    { ttlMs: USERS_CACHE_TTL, force: options?.force }
  );
}

// Credentials go exclusively to the authenticated server function and Supabase Auth.
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  const { user } = await accountAction({ action: "create", profile: payload });
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return user as AppUser;
}

export async function updateUser(id: string, patch: Partial<AppUser>): Promise<AppUser> {
  const { user } = await accountAction({ action: "update", id, profile: patch });
  invalidateCacheByPrefix(USERS_CACHE_KEY);
  return user as AppUser;
}

export async function deleteUser(id: string): Promise<void> {
  await accountAction({ action: "delete", id });
  invalidateCacheByPrefix(USERS_CACHE_KEY);
}
