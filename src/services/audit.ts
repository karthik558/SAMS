import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { listAssets, type Asset } from "@/services/assets";
import { playNotificationSound } from "@/lib/sound";

export type AuditSession = {
  id: string;
  started_at: string;
  frequency_months: 3 | 6;
  initiated_by?: string | null;
  is_active: boolean;
  property_id?: string | null;
};

export type AuditAssignment = {
  session_id: string;
  department: string;
  status: "pending" | "submitted";
  submitted_at?: string | null;
  submitted_by?: string | null;
};

export type AuditReview = {
  session_id: string;
  asset_id: string;
  department: string;
  status: "verified" | "missing" | "damaged";
  comment?: string | null;
  updated_at?: string;
};

export async function isAuditActive(): Promise<boolean> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  try {
    const { data, error } = await supabase.from("audit_sessions").select("id, is_active").eq("is_active", true).limit(1);
    if (error) throw error;
    return (data?.length || 0) > 0;
  } catch { return false; }
}

export async function getActiveSession(): Promise<AuditSession | null> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data } = await supabase.from("audit_sessions").select("*").eq("is_active", true).maybeSingle();
  return (data as any) || null;
}

export async function startAuditSession(freq: 3 | 6, initiated_by?: string | null, property_id?: string | null): Promise<AuditSession> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  // Try v2 with property scoping; fallback to v1 if not available
  try {
    const { data, error } = await supabase.rpc("start_audit_session_v2", { p_frequency_months: freq, p_initiated_by: initiated_by ?? null, p_property_id: property_id ?? null });
    if (error) throw error;
    try { playNotificationSound(); } catch {}
    return data as any;
  } catch (e) {
    const { data, error } = await supabase.rpc("start_audit_session_v1", { p_frequency_months: freq, p_initiated_by: initiated_by ?? null });
    if (error) throw error;
    try { playNotificationSound(); } catch {}
    return data as any;
  }
}

export async function endAuditSession(): Promise<void> {
  const current = await getActiveSession();
  if (!current) return;
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.rpc("end_audit_session_v1", { p_session_id: current.id });
  if (error) throw error;
}

export async function getAssignment(sessionId: string, department: string): Promise<AuditAssignment> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_assignments").select("*").eq("session_id", sessionId).eq("department", department).maybeSingle();
  if (error) throw error;
  if (data) return data as any;
  const { data: created, error: e2 } = await supabase.rpc("ensure_audit_assignment_v1", { p_session_id: sessionId, p_department: department });
  if (e2) throw e2;
  return created as any;
}

export async function listDepartmentAssets(department: string, propertyId?: string): Promise<Asset[]> {
  const all = await listAssets();
  const norm = (s: string) => (s || '').toLowerCase();
  const pid = norm(String(propertyId || ''));
  return (all || [])
    .filter(a => norm(a.department || '') === norm(department || ''))
    .filter(a => {
      if (!propertyId) return true;
      const apid = norm(String(a.property_id || ''));
      const aprop = norm(String(a.property || ''));
      // Match by exact property_id, or by property code/name equality, or by containing code within name
      return apid === pid || aprop === pid || (pid && aprop.includes(pid));
    });
}

export async function getReviewsFor(sessionId: string, department: string): Promise<AuditReview[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_reviews").select("*").eq("session_id", sessionId).eq("department", department);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function saveReviewsFor(sessionId: string, department: string, rows: AuditReview[]): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = rows.map(r => ({ asset_id: r.asset_id, status: r.status, comment: r.comment ?? null }));
  const { error } = await supabase.rpc("upsert_audit_reviews_v1", { p_session_id: sessionId, p_department: department, p_rows_json: payload });
  if (error) throw error;
}

export async function submitAssignment(sessionId: string, department: string, submitted_by?: string | null): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.rpc("submit_audit_assignment_v1", { p_session_id: sessionId, p_department: department, p_submitted_by: submitted_by ?? null });
  if (error) throw error;
}

export async function getProgress(sessionId: string, departments: string[]): Promise<{ total: number; submitted: number; }> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_assignments").select("department,status").eq("session_id", sessionId);
  if (error) throw error;
  const norm = (s: string) => (s || '').toString().trim().toLowerCase();
  const total = departments.length;
  let submitted = departments.filter(d => (data || []).find((a: any) => norm(a.department) === norm(d) && a.status === 'submitted')).length;
  // Fallback: if no assignments yet, infer submissions by presence of a submitted assignment or, as a last resort, by any review activity
  if (!submitted && (data || []).length === 0 && departments.length) {
    const { data: revs } = await supabase
      .from("audit_reviews")
      .select("department")
      .eq("session_id", sessionId);
    const have = new Set((revs || []).map((r: any) => norm(r.department)));
    submitted = departments.filter(d => have.has(norm(d))).length;
  }
  return { total, submitted };
}

export async function listAssignments(sessionId: string): Promise<AuditAssignment[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_assignments").select("*").eq("session_id", sessionId);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function getDepartmentReviewSummary(sessionId: string): Promise<Record<string, { verified: number; missing: number; damaged: number }>> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_reviews").select("department,status").eq("session_id", sessionId);
  if (error) throw error;
  const summary: Record<string, { verified: number; missing: number; damaged: number }> = {};
  (data || []).forEach((r: any) => {
    const dept = (r.department || '').toString();
    if (!summary[dept]) summary[dept] = { verified: 0, missing: 0, damaged: 0 };
    if (r.status === 'verified') summary[dept].verified++;
    else if (r.status === 'missing') summary[dept].missing++;
    else if (r.status === 'damaged') summary[dept].damaged++;
  });
  return summary;
}

export async function listReviewsForSession(sessionId: string): Promise<AuditReview[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_reviews").select("*").eq("session_id", sessionId);
  if (error) throw error;
  return (data as any[]) || [];
}

export type AuditReport = {
  id: string;
  session_id: string;
  generated_at: string;
  generated_by?: string | null;
  payload: any;
};

export type AuditIncharge = {
  property_id: string;
  user_id: string;
  user_name?: string | null;
};

// Local storage fallback keys
const AI_LS_KEY = 'audit_incharge_map'; // { [property_id]: { user_id, user_name } }

function readLocalAI(): Record<string, { user_id: string; user_name?: string | null }>{
  try { return JSON.parse(localStorage.getItem(AI_LS_KEY) || '{}'); } catch { return {}; }
}
function writeLocalAI(data: Record<string, { user_id: string; user_name?: string | null }>) {
  try { localStorage.setItem(AI_LS_KEY, JSON.stringify(data)); } catch {}
}

export async function getAuditIncharge(propertyId: string): Promise<AuditIncharge | null> {
  if (!propertyId) return null;
  if (!hasSupabaseEnv) {
    const map = readLocalAI();
    const v = map[propertyId];
    return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
  }
  try {
    const { data, error } = await supabase.from('audit_incharge').select('*').eq('property_id', propertyId).maybeSingle();
    if (error) throw error;
    if (data) return { property_id: data.property_id, user_id: data.user_id, user_name: data.user_name };
    // No remote row: check local fallback
    const map = readLocalAI();
    const v = map[propertyId];
    return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
  } catch (e) {
    // Fallback to local if remote read blocked by RLS or table missing
    const map = readLocalAI();
    const v = map[propertyId];
    return v ? { property_id: propertyId, user_id: v.user_id, user_name: v.user_name ?? null } : null;
  }
}

export async function setAuditIncharge(propertyId: string, userId: string, userName?: string | null): Promise<void> {
  if (!propertyId || !userId) return;
  if (!hasSupabaseEnv) {
    const map = readLocalAI();
    map[propertyId] = { user_id: userId, user_name: userName ?? null };
    writeLocalAI(map);
    return;
  }
  try {
    // Prefer SECURITY DEFINER RPC first
    const { error: rpcErr } = await supabase.rpc('set_audit_incharge_v1', {
      p_property_id: propertyId,
      p_user_id: userId,
      p_user_name: userName ?? null,
    } as any);
    if (rpcErr) throw rpcErr;
  } catch (rpcFailed) {
    const payload = { property_id: propertyId, user_id: userId, user_name: userName ?? null } as any;
    // upsert by unique(property_id)
    try {
      const { error } = await supabase.from('audit_incharge').upsert(payload, { onConflict: 'property_id' });
      if (error) throw error;
    } catch (e) {
      // Save locally if remote blocked (e.g., not admin)
      const map = readLocalAI();
      map[propertyId] = { user_id: userId, user_name: userName ?? null };
      writeLocalAI(map);
    }
  }
}

export async function listAuditInchargeForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  if (!hasSupabaseEnv) {
    const map = readLocalAI();
    return Object.entries(map).filter(([, v]) => String(v.user_id) === String(userId)).map(([pid]) => String(pid));
  }
  try {
    const { data, error } = await supabase.from('audit_incharge').select('property_id').eq('user_id', userId);
    if (error) throw error;
    const remote = (data || []).map((r: any) => String(r.property_id));
    // Merge with local fallback in case some writes were saved locally
    const map = readLocalAI();
    const local = Object.entries(map).filter(([, v]) => String(v.user_id) === String(userId)).map(([pid]) => String(pid));
    return Array.from(new Set([...remote, ...local]));
  } catch (e) {
    // Fallback to local on error
    const map = readLocalAI();
    return Object.entries(map).filter(([, v]) => String(v.user_id) === String(userId)).map(([pid]) => String(pid));
  }
}

export async function setAuditInchargeForUser(userId: string, userName: string | null, propertyIds: string[]): Promise<void> {
  if (!userId) return;
  const uniq = Array.from(new Set((propertyIds || []).map(String)));
  if (!hasSupabaseEnv) {
    const map = readLocalAI();
    // Remove prior assignments for this user not in list
    Object.keys(map).forEach((pid) => {
      if (String(map[pid].user_id) === String(userId) && !uniq.includes(String(pid))) {
        delete map[pid];
      }
    });
    // Upserts
    uniq.forEach((pid) => { map[pid] = { user_id: userId, user_name: userName ?? map[pid]?.user_name ?? null }; });
    writeLocalAI(map);
    return;
  }
  try {
    // Prefer SECURITY DEFINER RPC to handle set + cleanup atomically
    const { error: rpcErr } = await supabase.rpc('set_audit_incharge_for_user_v1', {
      p_user_id: userId,
      p_user_name: userName ?? null,
      p_property_ids: uniq,
    } as any);
    if (rpcErr) throw rpcErr;
  } catch (e) {
    try {
      // Load current assignments for this user
      const current = await listAuditInchargeForUser(userId);
      const toAdd = uniq.filter((p) => !current.includes(p));
      const toRemove = current.filter((p) => !uniq.includes(p));
      // Upsert adds (reassigns if another user had it)
      for (const pid of toAdd) {
        const { error } = await supabase.from('audit_incharge').upsert({ property_id: pid, user_id: userId, user_name: userName ?? null }, { onConflict: 'property_id' });
        if (error) throw error;
      }
      // Remove unselected assignments for this user
      if (toRemove.length) {
        const { error } = await supabase.from('audit_incharge').delete().eq('user_id', userId).in('property_id', toRemove);
        if (error) throw error;
      }
    } catch {
      // Fallback to local when remote blocked (e.g., RLS not allowing writes)
      const map = readLocalAI();
      // Remove prior assignments for this user not in list
      Object.keys(map).forEach((pid) => {
        if (String(map[pid].user_id) === String(userId) && !uniq.includes(String(pid))) {
          delete map[pid];
        }
      });
      // Upserts
      uniq.forEach((pid) => { map[pid] = { user_id: userId, user_name: userName ?? map[pid]?.user_name ?? null }; });
      writeLocalAI(map);
    }
  }
}

export async function createAuditReport(sessionId: string, generated_by?: string | null): Promise<AuditReport> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.rpc("create_audit_report_v1", { p_session_id: sessionId, p_generated_by: generated_by ?? null });
  if (error) throw error;
  return data as any;
}

export async function listAuditReports(sessionId: string): Promise<AuditReport[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_reports").select("*").eq("session_id", sessionId).order("generated_at", { ascending: false });
  if (error) throw error;
  return (data as any[]) || [];
}

export async function getAuditReport(id: string): Promise<AuditReport | null> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function listRecentAuditReports(limit: number = 20): Promise<AuditReport[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase
    .from("audit_reports")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as any[]) || [];
}

export async function listSessions(limit: number = 200): Promise<AuditSession[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase
    .from("audit_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    // fetch more to ensure dropdown shows full history
    .range(0, Math.max(0, (limit || 200) - 1));
  if (error) throw error;
  return (data as any[]) || [];
}

export async function getSessionById(id: string): Promise<AuditSession | null> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from("audit_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}
