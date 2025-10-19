import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type UserPreferences = {
  user_id: string;
  user_email?: string | null;
  show_newsletter: boolean;
  show_help_center?: boolean;
  compact_mode: boolean;
  enable_beta_features: boolean;
  default_landing_page: string | null; // e.g., '/assets'
  feature_flags: Record<string, any>;
  // New personalization fields
  sidebar_collapsed?: boolean;
  enable_sounds?: boolean;
  density?: 'comfortable' | 'compact' | 'ultra';
  auto_theme?: boolean;
  show_announcements?: boolean;
  sticky_header?: boolean;
  top_nav_mode?: boolean;
  created_at?: string;
  updated_at?: string;
};

const TABLE = 'user_preferences';
const LS_KEY = 'user_preferences_';

function loadLocal(userId: string | null | undefined): UserPreferences | null {
  if (!userId) return null;
  try { return JSON.parse(localStorage.getItem(LS_KEY + userId) || 'null'); } catch { return null; }
}
function saveLocalFor(userId: string | null | undefined, prefs: UserPreferences) {
  if (!userId) return;
  try {
    const payload = { ...prefs, user_id: userId };
    localStorage.setItem(LS_KEY + userId, JSON.stringify(payload));
  } catch {}
}
function saveLocal(p: UserPreferences) {
  saveLocalFor(p.user_id, p);
}

function cachePreferences(pref: UserPreferences, aliasIds: Array<string | null | undefined> = []) {
  saveLocal(pref);
  aliasIds
    .filter((id): id is string => Boolean(id) && id !== pref.user_id)
    .forEach((id) => saveLocalFor(id, pref));
}

function collectAliasIds(primary: string | null | undefined, effective: string | null | undefined): string[] {
  const aliases = new Set<string>();
  if (primary && primary !== effective) aliases.add(primary);
  try {
    const authRaw = localStorage.getItem('auth_user');
    if (authRaw) {
      const auth = JSON.parse(authRaw) as { id?: string } | null;
      const authId = auth?.id;
      if (authId && authId !== effective) aliases.add(authId);
    }
  } catch {}
  try {
    const storedCurrent = localStorage.getItem('current_user_id');
    if (storedCurrent && storedCurrent !== effective) aliases.add(storedCurrent);
  } catch {}
  return Array.from(aliases);
}

function defaults(userId: string): UserPreferences {
  return {
    user_id: userId,
    user_email: null,
    show_newsletter: false,
    show_help_center: true,
    compact_mode: false,
    enable_beta_features: false,
    default_landing_page: null,
    feature_flags: {},
    sidebar_collapsed: false,
    enable_sounds: true,
    density: 'comfortable',
    auto_theme: false,
    show_announcements: true,
    sticky_header: false,
    top_nav_mode: false,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  if (hasSupabaseEnv && !isDemoMode()) {
    try {
      // Require an active Supabase session for RLS-protected table
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error('NO_SESSION');
      // Avoid cross-user contamination: ensure session email matches app user email (if present)
      let appEmail: string | null = null;
      try {
        const raw = localStorage.getItem('auth_user');
        if (raw) appEmail = (JSON.parse(raw).email || '').toLowerCase();
      } catch {}
      const { data: checkUser } = await supabase.auth.getUser();
      const sessEmail = (checkUser?.user?.email || '').toLowerCase();
      if (appEmail && sessEmail && appEmail !== sessEmail) throw new Error('SESSION_MISMATCH');
      // Always use the Supabase Auth UID to satisfy FK and RLS (ignore passed-in userId)
      const { data: authData } = await supabase.auth.getUser();
      const effectiveId = authData?.user?.id || '';
      const effectiveEmail = authData?.user?.email || null;
      if (!effectiveId) throw new Error('NO_USER_ID');
      const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', effectiveId).maybeSingle();
      if (error) throw error;
      if (data) {
        const resolved = applyPostLoadDefaults({ ...(data as UserPreferences), user_id: effectiveId });
        cachePreferences(resolved, collectAliasIds(userId, effectiveId));
        return resolved;
      }
      const def = { ...defaults(effectiveId), user_email: effectiveEmail };
      const { data: created, error: e2 } = await supabase.from(TABLE).upsert(def, { onConflict: 'user_id' }).select().single();
      if (e2) throw e2;
      const seeded = applyPostLoadDefaults({ ...(created as UserPreferences), user_id: effectiveId });
      cachePreferences(seeded, collectAliasIds(userId, effectiveId));
      return seeded;
    } catch (error) {
      console.warn('getUserPreferences falling back to local storage', error);
    }
  }
  const aliasIds = collectAliasIds(userId, null);
  const candidates = [userId, ...aliasIds];
  let localRaw: UserPreferences | null = null;
  for (const candidate of candidates) {
    localRaw = loadLocal(candidate);
    if (localRaw) break;
  }
  if (!localRaw) {
    const baseId = (candidates.find((id) => typeof id === 'string') as string | undefined) || userId || 'local';
    localRaw = defaults(baseId);
  }
  const local = applyPostLoadDefaults({ ...localRaw });
  cachePreferences(local, candidates);
  return local;
}

export async function upsertUserPreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
  if (hasSupabaseEnv && !isDemoMode()) {
    try {
      // Require an active Supabase session for RLS-protected table
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error('NO_SESSION');
      // Avoid cross-user contamination: ensure session email matches app user email (if present)
      let appEmail: string | null = null;
      try {
        const raw = localStorage.getItem('auth_user');
        if (raw) appEmail = (JSON.parse(raw).email || '').toLowerCase();
      } catch {}
      const { data: checkUser } = await supabase.auth.getUser();
      const sessEmail = (checkUser?.user?.email || '').toLowerCase();
      if (appEmail && sessEmail && appEmail !== sessEmail) throw new Error('SESSION_MISMATCH');
      const { data: authData2 } = await supabase.auth.getUser();
      const effectiveId = authData2?.user?.id || '';
      const email = authData2?.user?.email || null;
      if (!effectiveId) throw new Error('NO_USER_ID');
      const row = { user_id: effectiveId, user_email: email, ...patch } as any;
      const { data, error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' }).select().single();
      if (error) throw error;
      const updated = applyPostLoadDefaults({ ...(data as UserPreferences), user_id: effectiveId });
      cachePreferences(updated, collectAliasIds(userId, effectiveId));
      return updated;
    } catch (error) {
      console.warn('upsertUserPreferences falling back to local storage', error);
    }
  }
  const cur = loadLocal(userId) || defaults(userId);
  const next: UserPreferences = { ...cur, ...patch };
  saveLocal(next);
  return next;
}

export function peekCachedUserPreferences(userId?: string | null): UserPreferences | null {
  const primary = userId ?? null;
  const aliasIds = collectAliasIds(primary, null);
  const candidates = [primary, ...aliasIds].filter((id): id is string => Boolean(id));
  for (const candidate of candidates) {
    const cached = loadLocal(candidate);
    if (cached) {
      return applyPostLoadDefaults({ ...cached });
    }
  }
  return null;
}

function applyPostLoadDefaults(p: UserPreferences): UserPreferences {
  // Fill any missing new fields with defaults
  if (typeof p.show_newsletter !== 'boolean') p.show_newsletter = Boolean(p.show_newsletter);
  if (typeof p.sidebar_collapsed === 'undefined') p.sidebar_collapsed = false;
  if (typeof p.enable_sounds === 'undefined') p.enable_sounds = true;
  if (typeof p.auto_theme === 'undefined') p.auto_theme = false;
  if (typeof p.show_announcements === 'undefined') p.show_announcements = true;
  if (typeof p.sticky_header === 'undefined') p.sticky_header = false;
  if (typeof p.top_nav_mode === 'undefined') p.top_nav_mode = false;
  if (typeof p.show_help_center === 'undefined') p.show_help_center = true;
  if (!p.density) {
    // Map legacy compact_mode
    p.density = p.compact_mode ? 'compact' : 'comfortable';
  }
  return p;
}
