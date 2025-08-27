import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type SystemSettings = {
  id: boolean; // singleton true
  timezone: string | null;
  language: string | null;
  backup_frequency: "hourly" | "daily" | "weekly" | "monthly" | string | null;
  auto_backup: boolean | null;
  appearance: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  notifications: boolean | null;
  email_notifications: boolean | null;
  notification_types: Record<string, any> | null;
  dark_mode: boolean | null;
  dashboard_prefs: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

const SYS_TABLE = "system_settings";
const USER_TABLE = "user_settings";

export async function getSystemSettings(): Promise<SystemSettings> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(SYS_TABLE).select("*").maybeSingle();
  if (error) throw error;
  if (data) return data as SystemSettings;
  // create default singleton
  const def: Partial<SystemSettings> = { id: true, timezone: "UTC", language: "en", backup_frequency: "daily", auto_backup: true, appearance: {} };
  const { data: created, error: e2 } = await supabase.from(SYS_TABLE).insert(def).select().single();
  if (e2) throw e2;
  return created as SystemSettings;
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const upsert = { id: true, ...patch } as any;
  const { data, error } = await supabase.from(SYS_TABLE).upsert(upsert, { onConflict: "id" }).select().single();
  if (error) throw error;
  return data as SystemSettings;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(USER_TABLE).select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data as UserSettings;
  const def: Partial<UserSettings> = { user_id: userId, notifications: true, email_notifications: true, notification_types: { asset_expiry: true, low_stock: true, new_assets: false, system_updates: true }, dark_mode: false, dashboard_prefs: {} };
  const { data: created, error: e2 } = await supabase.from(USER_TABLE).upsert(def, { onConflict: "user_id" }).select().single();
  if (e2) throw e2;
  return created as UserSettings;
}

export async function upsertUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const row = { user_id: userId, ...patch } as any;
  const { data, error } = await supabase.from(USER_TABLE).upsert(row, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return data as UserSettings;
}
