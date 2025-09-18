import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type UserPreferences = {
  user_id: string;
  show_newsletter: boolean;
  compact_mode: boolean;
  enable_beta_features: boolean;
  default_landing_page: string | null; // e.g., '/assets'
  feature_flags: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

const TABLE = 'user_preferences';
const LS_KEY = 'user_preferences_';

function loadLocal(userId: string): UserPreferences | null {
  try { return JSON.parse(localStorage.getItem(LS_KEY + userId) || 'null'); } catch { return null; }
}
function saveLocal(p: UserPreferences) {
  try { localStorage.setItem(LS_KEY + p.user_id, JSON.stringify(p)); } catch {}
}

function defaults(userId: string): UserPreferences {
  return {
    user_id: userId,
    show_newsletter: false,
    compact_mode: false,
    enable_beta_features: false,
    default_landing_page: null,
    feature_flags: {},
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  if (hasSupabaseEnv && !isDemoMode()) {
    // Always trust the authenticated user id for RLS compliance
    const { data: authData } = await supabase.auth.getUser();
    const authId = authData?.user?.id;
    if (!authId) throw new Error('NO_AUTH_USER');
    const effectiveId = authId; // ignore passed userId if different
    const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', effectiveId).maybeSingle();
    if (error) throw error;
    if (data) return data as UserPreferences;
    const def = defaults(effectiveId);
    const { data: created, error: e2 } = await supabase.from(TABLE).upsert(def, { onConflict: 'user_id' }).select().single();
    if (e2) throw e2;
    return created as UserPreferences;
  }
  // local fallback uses provided id (demo / no supabase)
  const local = loadLocal(userId) || defaults(userId);
  if (!loadLocal(userId)) saveLocal(local);
  return local;
}

export async function upsertUserPreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
  if (hasSupabaseEnv && !isDemoMode()) {
    const { data: authData } = await supabase.auth.getUser();
    const authId = authData?.user?.id;
    if (!authId) throw new Error('NO_AUTH_USER');
    const effectiveId = authId;
    // Ensure we never attempt to write a row for a different user (would fail RLS)
    const row = { user_id: effectiveId, ...patch } as any;
    const { data, error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data as UserPreferences;
  }
  const cur = loadLocal(userId) || defaults(userId);
  const next: UserPreferences = { ...cur, ...patch };
  saveLocal(next);
  return next;
}
