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

// Create Supabase Auth user (via Edge Function) and then insert profile row with the same id
export async function createUser(payload: Omit<AppUser, "id"> & { password?: string }): Promise<AppUser> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { password, ...dbPayload } = payload as any;

  // 1) Ensure an auth user exists using a server-side endpoint (service role)
  // Try Supabase Edge Function first, then fall back to local API route.
  let authId: string | null = null;

  const provisionViaEdge = async () => {
    const payload = {
      email: dbPayload.email,
      password,
      user_metadata: {
        name: dbPayload.name,
        role: dbPayload.role,
        department: dbPayload.department,
        phone: dbPayload.phone,
        status: dbPayload.status,
        must_change_password: !!dbPayload.must_change_password,
      },
      email_confirm: true,
    };
    const { data, error } = await (supabase as any).functions.invoke('admin-create-user', {
      body: payload,
    });
    if (error) {
      // Supabase Functions client returns a structured error; surface it
      throw new Error(error?.message || 'Edge provisioning failed');
    }
    return (data && (data.user?.id || data.id)) as string | null;
  };

  const provisionViaApi = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const resp = await fetch('/api/admin-create-user', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: dbPayload.email,
        password,
        user_metadata: {
          name: dbPayload.name,
          role: dbPayload.role,
          department: dbPayload.department,
          phone: dbPayload.phone,
          status: dbPayload.status,
          must_change_password: !!dbPayload.must_change_password,
        },
        email_confirm: true,
      }),
    });
    if (!resp.ok) {
      const status = resp.status;
      let detail = '';
      try { const j = await resp.json(); detail = j?.error || ''; } catch {}
      if (status === 404) throw new Error('API route /api/admin-create-user not found (404). Deploy serverless API or use Edge Function.');
      throw new Error(`API provisioning failed: ${status} ${detail}`);
    }
    const data = await resp.json();
    return (data && (data.user?.id || data.id)) as string | null;
  };

  try {
    authId = await provisionViaEdge();
  } catch (e1: any) {
    try {
      authId = await provisionViaApi();
    } catch (e2: any) {
      const msg = e1?.message || e2?.message || 'Auth provisioning failed';
      throw new Error(msg);
    }
  }

  // 2) Insert into app_users, prefer using auth id for 1:1 mapping when available
  const row = authId ? { id: authId, ...dbPayload } : { ...dbPayload };
  const { data, error } = await supabase.from(table).insert(row).select().single();
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
