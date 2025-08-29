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

async function fetchProfileByEmail(email: string): Promise<MinimalUser | null> {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, name, email, role, department, phone, status, avatar_url, must_change_password")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return (data as MinimalUser) ?? null;
}

export async function loginWithPassword(email: string, password: string): Promise<MinimalUser | null> {
  if (!hasSupabaseEnv) return null;
  // Standard secure auth flow over TLS; avoids exposing credentials to public RPC
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Fetch user profile from app_users table
  return await fetchProfileByEmail(email);
}

// Start password sign-in, returning MFA factors info if required (no throw on MFA-required)
export async function initiatePasswordSignIn(email: string, password: string): Promise<{ user: MinimalUser | null; mfa: { factors: Array<{ id: string; friendlyName?: string | null }> } | null }> {
  if (!hasSupabaseEnv) return { user: null, mfa: null };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // MFA required indicated in data.mfa
  const mfaFactors = (data as any)?.mfa?.factors || [];
  if (Array.isArray(mfaFactors) && mfaFactors.length > 0) {
    const factors = mfaFactors.map((f: any) => ({ id: f.id, friendlyName: f.friendly_name ?? null }));
    return { user: null, mfa: { factors } };
  }
  if (error) throw error;
  const user = await fetchProfileByEmail(email);
  return { user, mfa: null };
}

export async function mfaChallenge(factorId: string): Promise<{ challengeId: string }> {
  const { data, error } = await (supabase as any).auth.mfa.challenge({ factorId });
  if (error) throw error;
  return { challengeId: data.id };
}

export async function mfaVerify(factorId: string, challengeId: string, code: string, emailForProfile: string): Promise<MinimalUser | null> {
  const { data, error } = await (supabase as any).auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw error;
  return await fetchProfileByEmail(emailForProfile);
}

// MFA management helpers (TOTP)
export async function listMfaFactors(): Promise<{ totp: Array<{ id: string }> }> {
  if (!hasSupabaseEnv) return { totp: [] };
  const { data, error } = await (supabase as any).auth.mfa.listFactors();
  if (error) throw error;
  // Support both potential shapes
  const totp = (data?.totp || data?.all || []).filter((f: any) => (f?.factor_type || f?.type) === 'totp').map((f: any) => ({ id: f.id }));
  return { totp };
}

export async function mfaEnrollTotp(): Promise<{ factorId: string; otpauthUrl: string }> {
  if (!hasSupabaseEnv) throw new Error('NO_SUPABASE');
  const { data, error } = await (supabase as any).auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  const factorId = data?.id;
  // Try known locations for the otpauth URI
  const rawUri = data?.totp?.uri || data?.totp?.qr_code || data?.uri || data?.provisioning_uri;
  if (!factorId || !rawUri) throw new Error('Failed to get TOTP enrollment data');
  // Best-effort label/issuer normalization
  let otpauthUrl = rawUri;
  try {
    const prefix = 'otpauth://totp/';
    if (rawUri.startsWith(prefix)) {
      const rest = rawUri.slice(prefix.length);
      const qIndex = rest.indexOf('?');
      const query = qIndex >= 0 ? rest.slice(qIndex + 1) : '';
      const params = new URLSearchParams(query);
      if (!params.get('issuer')) params.set('issuer', 'SAMS');
      const label = encodeURIComponent(`SAMS`);
      otpauthUrl = `${prefix}${label}?${params.toString()}`;
    }
  } catch {}
  return { factorId, otpauthUrl };
}

export async function mfaActivateTotp(factorId: string, code: string): Promise<void> {
  if (!hasSupabaseEnv) throw new Error('NO_SUPABASE');
  // Some SDK versions do not expose mfa.activate; use challenge + verify instead
  const { data: ch, error: chErr } = await (supabase as any).auth.mfa.challenge({ factorId });
  if (chErr) throw chErr;
  const challengeId = ch?.id;
  const { error: vErr } = await (supabase as any).auth.mfa.verify({ factorId, challengeId, code });
  if (vErr) throw vErr;
}

export async function logout(): Promise<void> {
  if (!hasSupabaseEnv) return;
  await supabase.auth.signOut();
}

const SESSION_TAG_KEY = 'active_session_id';
export function generateSessionTag(): string {
  const a = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  return Array.from(a).map(x => x.toString(16).padStart(2, '0')).join('');
}
export function getLocalSessionTag(): string | null {
  try { return localStorage.getItem(SESSION_TAG_KEY); } catch { return null; }
}
export function setLocalSessionTag(tag: string) {
  try { localStorage.setItem(SESSION_TAG_KEY, tag); } catch {}
}

export async function ensureSingleActiveSession(email: string, tag: string, overwrite = false): Promise<{ ok: true } | { conflict: true }> {
  if (!hasSupabaseEnv) return { ok: true } as any;
  const { data, error } = await supabase.from('app_users').select('id, active_session_id').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw error;
  const current = (data as any)?.active_session_id as string | null | undefined;
  if (current && current !== tag && !overwrite) {
    return { conflict: true } as any;
  }
  const next = tag || generateSessionTag();
  const { error: upErr } = await supabase.from('app_users').update({ active_session_id: next }).eq('email', email.toLowerCase());
  if (upErr) throw upErr;
  setLocalSessionTag(next);
  return { ok: true } as any;
}

export async function fetchServerSessionTag(email: string): Promise<string | null> {
  if (!hasSupabaseEnv) return getLocalSessionTag();
  const { data, error } = await supabase.from('app_users').select('active_session_id').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return (data as any)?.active_session_id ?? null;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  if (!hasSupabaseEnv) return; // noop in local mode
  const { error } = await supabase.rpc("set_user_password", { uid: userId, raw_password: password });
  if (error) throw error;
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  if (!hasSupabaseEnv) throw new Error('NO_SUPABASE');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
