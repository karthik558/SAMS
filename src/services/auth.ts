import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { clearCache } from "@/lib/data-cache";
import { isDemoMode } from "@/lib/demo";

export type MinimalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
};

export const USER_PROFILE_COLUMNS = "id, name, email, role, department, phone, last_login, status, avatar_url, must_change_password, password_changed_at, active_session_id";

export async function accountAction(body: Record<string, unknown>) {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.functions.invoke("account-security", { body });
  if (error) {
    const response = error.context;
    const failure = response instanceof Response ? await response.json().catch(() => null) : null;
    throw new Error(failure?.error || "Account operation failed. Please try again.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getAuthenticatedUser(): Promise<MinimalUser | null> {
  if (!hasSupabaseEnv || isDemoMode()) return null;
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user) return null;
  const { data, error } = await supabase.from("app_users")
    .select(USER_PROFILE_COLUMNS).eq("id", identity.user.id).maybeSingle();
  if (error || !data || data.status?.toLowerCase() !== "active") return null;
  return data;
}

export async function loginWithPassword(email: string, password: string): Promise<MinimalUser | null> {
  if (!hasSupabaseEnv || isDemoMode() || !email.trim() || !password) return null;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return null;
  const profile = await getAuthenticatedUser();
  if (profile) return profile;
  await logout();
  return null;
}

export async function loginWithUsernameOrEmail(identifier: string, password: string): Promise<MinimalUser | null> {
  const input = identifier.trim().toLowerCase();
  if (input.includes("@")) return loginWithPassword(input, password);
  if (!input || !password || !hasSupabaseEnv || isDemoMode()) return null;
  // Resolve usernames only on the server, without exposing an anonymous directory.
  const result = await accountAction({ action: "login", identifier: input, password });
  if (!result?.session) return null;
  const { error } = await supabase.auth.setSession(result.session);
  if (error) return null;
  const profile = await getAuthenticatedUser();
  if (!profile) await logout();
  return profile;
}

export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  if (!hasSupabaseEnv || isDemoMode() || !password) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return false;
  const profile = await loginWithPassword(data.user.email, password);
  return profile?.id === data.user.id;
}

export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!hasSupabaseEnv || isDemoMode()) throw new Error("Authentication required");
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.email?.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Authentication required");
  if (!await verifyCurrentUserPassword(currentPassword)) throw new Error("INVALID_CURRENT_PASSWORD");
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
}

// The server validates the caller's JWT and current database role, never these email arguments.
export async function adminSetUserPassword(_adminEmail: string, _adminPassword: string, targetUserId: string, newPassword: string): Promise<void> {
  await accountAction({ action: "password", id: targetUserId, password: newPassword });
}

export async function logout(): Promise<void> {
  clearCache();
  try {
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("app_users_fallback");
    localStorage.removeItem("password_reset_requests_local");
  } finally {
    if (hasSupabaseEnv) await supabase.auth.signOut({ scope: "local" });
  }
}

export async function updateLastLogin(email: string): Promise<void> {
  if (!hasSupabaseEnv) return;
  const { data } = await supabase.auth.getUser();
  if (data.user?.email?.toLowerCase() !== email.trim().toLowerCase()) return;
  await supabase.from("app_users").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
}
