import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

// Property-wise Final Approver mapping
// Remote table expectation (if available): final_approvers(property_id text primary key, user_id text, user_name text nullable)

export type FinalApprover = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

export async function getFinalApprover(propertyId: string): Promise<FinalApprover | null> {
  if (!propertyId) return null;
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from('final_approvers').select('*').eq('property_id', propertyId).maybeSingle();
  if (error) throw error;
  if (data) return { property_id: data.property_id, user_id: data.user_id, user_name: data.user_name };
  return null;
}

export async function listFinalApproverPropsForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from('final_approvers').select('property_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((r: any) => String(r.property_id));
}

// List by email (preferred for Admin assigning users on Users page)
export async function listFinalApproverPropsForEmail(email: string): Promise<string[]> {
  const em = (email || '').trim();
  if (!em) return [];
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  try {
    // Prefer SECURITY DEFINER RPC that resolves auth uid from email
    const { data, error } = await supabase.rpc('list_final_approver_props_for_email_v1', { p_email: em } as any);
    if (error) throw error;
    if (Array.isArray(data)) return data.map(String);
    return [];
  } catch {
    // Fallback: try to resolve auth uid and reuse list by uid
    try {
      const { data: u, error: e1 } = await supabase.from('app_users').select('id, email').eq('email', em.toLowerCase()).maybeSingle();
      if (e1 || !u) return [];
      // If app_users.id equals auth uid in your schema, this will work; otherwise it returns empty
      return await listFinalApproverPropsForUser(String(u.id));
    } catch {
      return [];
    }
  }
}

export async function setFinalApproverForProperty(propertyId: string, userId: string, userName?: string | null): Promise<void> {
  if (!propertyId || !userId) return;
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  try {
    // Prefer SECURITY DEFINER RPC
    const { error: rpcErr } = await supabase.rpc('set_final_approver_v1', {
      p_property_id: propertyId,
      p_user_id: userId,
      p_user_name: userName ?? null,
    } as any);
    if (rpcErr) throw rpcErr;
  } catch {
    try {
      const payload = { property_id: propertyId, user_id: userId, user_name: userName ?? null } as any;
      const { error } = await supabase.from('final_approvers').upsert(payload, { onConflict: 'property_id' });
      if (error) throw error;
    } catch {
      throw new Error('FINAL_APPROVER_SAVE_FAILED');
    }
  }
}

export async function setFinalApproverPropsForUser(userId: string, userName: string | null, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  try {
    const { error: rpcErr } = await supabase.rpc('set_final_approver_for_user_v1', {
      p_user_id: userId,
      p_user_name: userName ?? null,
      p_property_ids: uniq,
    } as any);
    if (rpcErr) throw rpcErr;
  } catch {
    try {
      const current = await listFinalApproverPropsForUser(userId);
      const toAdd = uniq.filter((p) => !current.includes(p));
      const toRemove = current.filter((p) => !uniq.includes(p));
      for (const pid of toAdd) {
        const { error } = await supabase.from('final_approvers').upsert({ property_id: pid, user_id: userId, user_name: userName ?? null }, { onConflict: 'property_id' });
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase.from('final_approvers').delete().eq('user_id', userId).in('property_id', toRemove);
        if (error) throw error;
      }
    } catch {
      throw new Error('FINAL_APPROVER_SAVE_FAILED');
    }
  }
}

// Save using target user's email (resolves auth.uid on the server)
export async function setFinalApproverPropsForEmail(email: string, userName: string | null, propertyIds: string[]): Promise<void> {
  const em = (email || '').trim();
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  if (!em) return;
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  try {
    const { error: rpcErr } = await supabase.rpc('set_final_approver_for_user_by_email_v1', {
      p_email: em,
      p_user_name: userName ?? null,
      p_property_ids: uniq,
    } as any);
    if (rpcErr) throw rpcErr;
  } catch {
    // As a last resort, attempt to map email -> app_users.id and reuse userId flow
    try {
      const { data: u, error: e1 } = await supabase.from('app_users').select('id, email').eq('email', em.toLowerCase()).maybeSingle();
      if (e1 || !u) throw e1 || new Error('NO_USER');
      await setFinalApproverPropsForUser(String(u.id), userName, uniq);
    } catch {
      throw new Error('FINAL_APPROVER_SAVE_FAILED');
    }
  }
}

export async function isFinalApprover(userId: string, propertyId: string): Promise<boolean> {
  if (!userId || !propertyId) return false;
  const list = await listFinalApproverPropsForUser(userId);
  return list.includes(String(propertyId));
}
