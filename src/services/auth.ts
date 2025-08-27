import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

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

export async function verifyCredentials(email: string, password: string): Promise<MinimalUser | null> {
  if (!hasSupabaseEnv) return null;
  const { data, error } = await supabase.rpc("verify_user_credentials", { p_email: email, p_password: password });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0] as MinimalUser;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  if (!hasSupabaseEnv) return; // noop in local mode
  const { error } = await supabase.rpc("set_user_password", { uid: userId, raw_password: password });
  if (error) throw error;
}
