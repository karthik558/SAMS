import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { updateAsset } from "@/services/assets";

export type ApprovalAction = "create" | "edit" | "decommission";
export type ApprovalStatus = "pending_manager" | "pending_admin" | "approved" | "rejected";

export type ApprovalRequest = {
  id: string;
  assetId: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedBy: string; // user id or email
  requestedAt: string; // ISO
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  // Optional change summary when action = edit
  patch?: Record<string, any> | null;
  department?: string | null;
};

export type ApprovalEvent = {
  id: string;
  approvalId: string;
  eventType: string; // submitted | forwarded | approved | rejected | applied | patch_updated
  message?: string | null;
  author?: string | null;
  createdAt: string;
};

const TABLE = "approvals";
const LS_KEY = "approvals";
const EV_LS_KEY = "approval_events";

function loadLocal(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ApprovalRequest[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: ApprovalRequest[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function loadLocalEvents(): ApprovalEvent[] {
  try { return JSON.parse(localStorage.getItem(EV_LS_KEY) || '[]') as ApprovalEvent[]; } catch { return []; }
}
function saveLocalEvents(list: ApprovalEvent[]) {
  try { localStorage.setItem(EV_LS_KEY, JSON.stringify(list)); } catch {}
}

export async function resyncApprovalDepartments(): Promise<{ updated: number; total: number; errors: number; }> {
  // Get approvals and users; update approvals.department to match requester’s current department
  if (hasSupabaseEnv) {
    try {
      const [{ data: approvals, error: aErr }, { data: users, error: uErr }] = await Promise.all([
        supabase.from(TABLE).select("id, requested_by, department"),
        supabase.from("app_users").select("id, email, department")
      ]);
      if (aErr) throw aErr; if (uErr) throw uErr;
      const byEmail = new Map<string, string | null>();
      const byId = new Map<string, string | null>();
      for (const u of users || []) {
        if (u?.email) byEmail.set(String(u.email).toLowerCase(), u.department ?? null);
        if (u?.id) byId.set(String(u.id), u.department ?? null);
      }
      let updated = 0; let errors = 0;
      for (const a of approvals || []) {
        const key = (a.requested_by || '').toLowerCase();
        const target = byEmail.get(key) ?? byId.get(a.requested_by || '') ?? null;
        if (typeof target !== 'undefined' && a.department !== target) {
          try {
            const { error } = await supabase.from(TABLE).update({ department: target }).eq('id', a.id);
            if (error) throw error; updated++;
          } catch { errors++; }
        }
      }
      return { updated, total: (approvals || []).length, errors };
    } catch {
      // fall through to local
    }
  }
  // Local fallback
  const list = loadLocal();
  let usersFallback: any[] = [];
  try {
    const raw = localStorage.getItem('app_users_fallback');
    usersFallback = raw ? JSON.parse(raw) : [];
  } catch {}
  const byEmail = new Map<string, string | null>();
  const byId = new Map<string, string | null>();
  for (const u of usersFallback) {
    if (u?.email) byEmail.set(String(u.email).toLowerCase(), u.department ?? null);
    if (u?.id) byId.set(String(u.id), u.department ?? null);
  }
  let updated = 0;
  const next = list.map(a => {
    const key = (a.requestedBy || '').toLowerCase();
    const target = byEmail.get(key) ?? byId.get(a.requestedBy || '') ?? null;
    if (typeof target !== 'undefined' && a.department !== target) {
      updated++;
      return { ...a, department: target } as ApprovalRequest;
    }
    return a;
  });
  saveLocal(next);
  return { updated, total: list.length, errors: 0 };
}

export async function listApprovals(status?: ApprovalStatus, department?: string | null, requestedBy?: string | null, assetIds?: string[] | null): Promise<ApprovalRequest[]> {
  if (hasSupabaseEnv) {
    try {
  let query = supabase.from(TABLE).select("*").order("requested_at", { ascending: false });
      if (status) query = query.eq("status", status);
      if (department) {
        const d = String(department).trim();
        if (d.length) {
          query = (query as any).ilike("department", d);
        }
      }
  if (requestedBy) query = (query as any).ilike("requested_by", String(requestedBy));
      if (assetIds && assetIds.length) query = (query as any).in('asset_id', Array.from(new Set(assetIds.map(String))));
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toCamel);
    } catch (e) {
      console.warn("approvals table unavailable, using localStorage", e);
    }
  }
  const list = loadLocal();
  let out = list;
  if (status) out = out.filter(a => a.status === status);
  if (department) out = out.filter(a => (a.department || '').toLowerCase() === (department || '').toLowerCase());
  if (requestedBy) out = out.filter(a => (a.requestedBy || '').toLowerCase() === (requestedBy || '').toLowerCase());
  if (assetIds && assetIds.length) {
    const set = new Set(assetIds.map((x) => String(x).toLowerCase()));
    out = out.filter(a => set.has(String(a.assetId).toLowerCase()));
  }
  return out;
}

export async function submitApproval(input: Omit<ApprovalRequest, "id" | "status" | "requestedAt" | "reviewedBy" | "reviewedAt">): Promise<ApprovalRequest> {
  // Try to infer requester department from auth_user (demo-aware)
  let dept: string | null = null;
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      dept = u?.department || null;
    }
  } catch {}
  // Fallback: try local users cache if still null
  if (!dept) {
    try {
      const rawU = localStorage.getItem('app_users_fallback');
      if (rawU && (input.requestedBy || '').length) {
        const users = JSON.parse(rawU) as Array<{ id?: string; email?: string; department?: string | null }>;
        const key = (input.requestedBy || '').toLowerCase();
        const found = users.find(u => (u.email || '').toLowerCase() === key || (u.id || '') === input.requestedBy);
        dept = found?.department || null;
      }
    } catch {}
  }
  const normalizedDept = typeof (input.department ?? dept) === 'string'
    ? String(input.department ?? dept).trim() || null
    : ((input.department ?? dept) as any ?? null);
  let finalDept = normalizedDept;
  // If still null and Supabase is available, try to look up from app_users by email or id
  if (!finalDept && hasSupabaseEnv) {
    try {
      const key = (input.requestedBy || '').toLowerCase();
      let q = supabase.from('app_users').select('department').limit(1);
      if (key.includes('@')) q = q.eq('email', key);
      else q = q.eq('id', input.requestedBy);
      const { data, error } = await q;
      if (!error && data && data[0]) finalDept = (data[0] as any).department ?? null;
    } catch {}
  }
  const payload: ApprovalRequest = {
    id: `APR-${Math.floor(Math.random()*900000+100000)}`,
    assetId: input.assetId,
    action: input.action,
    status: "pending_manager",
    requestedBy: input.requestedBy,
    requestedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    notes: input.notes ?? null,
    patch: input.patch ?? null,
  department: finalDept,
  };
  if (hasSupabaseEnv) {
    try {
  const { data, error } = await supabase.from(TABLE).insert(toSnake(payload)).select("*").single();
      if (error) throw error;
      const created = toCamel(data);
  // log submitted event
  try { await supabase.from('approval_events').insert({ approval_id: created.id, event_type: 'submitted', author: created.requestedBy, message: created.notes || created.action }); } catch {}
      return created;
    } catch (e) {
      console.warn("approvals insert failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  saveLocal([payload, ...list]);
  return payload;
}

export async function forwardApprovalToAdmin(id: string, manager: string, notes?: string): Promise<ApprovalRequest | null> {
  const patch = { status: 'pending_admin' as ApprovalStatus, reviewedBy: manager, reviewedAt: new Date().toISOString(), notes: notes ?? null };
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).update(toSnake(patch)).eq("id", id).select("*").single();
      if (error) throw error;
      const updated = toCamel(data);
  try { await supabase.from('approval_events').insert({ approval_id: id, event_type: 'forwarded', author: manager, message: notes || 'Forwarded to admin' }); } catch {}
      return updated;
    } catch (e) {
      console.warn("approvals update failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    const updated = { ...list[idx], ...patch } as ApprovalRequest;
    const next = [...list];
    next[idx] = updated;
    saveLocal(next);
    return updated;
  }
  return null;
}

export async function decideApprovalFinal(id: string, decision: Exclude<ApprovalStatus, "pending_manager" | "pending_admin">, admin: string, notes?: string): Promise<ApprovalRequest | null> {
  const patch = { status: decision, reviewedBy: admin, reviewedAt: new Date().toISOString(), notes: notes ?? null };
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).update(toSnake(patch)).eq("id", id).select("*").single();
      if (error) throw error;
      const updated = toCamel(data);
      try { await supabase.from('approval_events').insert({ approval_id: id, event_type: decision === 'approved' ? 'approved' : 'rejected', author: admin, message: notes ?? decision }); } catch {}
      // If approved and it's an edit with a patch, try to apply changes to the asset
      if (decision === 'approved' && updated.action === 'edit' && updated.patch && Object.keys(updated.patch).length) {
        try {
          await updateAsset(updated.assetId, updated.patch as any);
          try { await supabase.from('approval_events').insert({ approval_id: id, event_type: 'applied', author: admin, message: 'Patch applied to asset' }); } catch {}
        } catch (e) {
          // Best-effort only; log failure note
          try { await supabase.from('approval_events').insert({ approval_id: id, event_type: 'applied', author: admin, message: 'Patch could not be applied: ' + (e as any)?.message }); } catch {}
        }
      }
      return updated;
    } catch (e) {
      console.warn("approvals final decision failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    const updated = { ...list[idx], ...patch } as ApprovalRequest;
    const next = [...list];
    next[idx] = updated;
    saveLocal(next);
    return updated;
  }
  return null;
}

// Admin overrides approval without level 1 (manager) step
export async function adminOverrideApprove(id: string, admin: string, notes?: string): Promise<ApprovalRequest | null> {
  const msg = notes && notes.trim().length ? notes : "admin approved it without level 1 approval";
  const res = await decideApprovalFinal(id, 'approved', admin, msg);
  if (res && hasSupabaseEnv) {
    try {
      await supabase.from('approval_events').insert({
        approval_id: id,
        event_type: 'admin_override_approved',
        author: admin,
        message: msg,
      });
    } catch {}
  }
  return res;
}

export async function updateApprovalPatch(id: string, manager: string, patchData: Record<string, any>): Promise<ApprovalRequest | null> {
  const patch = { patch: patchData } as Partial<ApprovalRequest>;
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).update(toSnake(patch)).eq('id', id).select('*').single();
      if (error) throw error;
      const updated = toCamel(data);
  try { await supabase.from('approval_events').insert({ approval_id: id, event_type: 'manager_updated', author: manager, message: 'Manager updated patch' }); } catch {}
      return updated;
    } catch (e) {
      console.warn('updateApprovalPatch failed, using localStorage', e);
    }
  }
  const list = loadLocal();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) {
    const updated = { ...list[idx], patch: patchData } as ApprovalRequest;
    const next = [...list];
    next[idx] = updated;
    saveLocal(next);
    return updated;
  }
  return null;
}

export async function listApprovalEvents(approvalId: string): Promise<ApprovalEvent[]> {
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from('approval_events')
        .select('*')
        .eq('approval_id', approvalId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const remote = (data ?? []).map(ev => ({
        id: ev.id,
        approvalId: ev.approval_id,
        eventType: ev.event_type,
        message: ev.message ?? null,
        author: ev.author ?? null,
        createdAt: ev.created_at,
      }));
      // Merge with any local fallback events (e.g., when inserts were blocked by RLS)
      const local = loadLocalEvents().filter(ev => ev.approvalId === approvalId);
      return [...remote, ...local].sort((a,b) => (a.createdAt > b.createdAt ? 1 : -1));
    } catch (e) {
      console.warn('approval_events query failed', e);
    }
  }
  // Local fallback
  return loadLocalEvents().filter(ev => ev.approvalId === approvalId).sort((a,b) => (a.createdAt > b.createdAt ? 1 : -1));
}

// Add a comment event on an approval (used for per-field diff notes)
export async function addApprovalComment(approvalId: string, author: string, field: string, message: string): Promise<void> {
  const msg = `${field}: ${message}`;
  // Try remote first when available
  if (hasSupabaseEnv) {
    try {
      // Prefer SECURITY DEFINER RPC if present (handles missing parent row and RLS)
      try {
        const { error: rpcError } = await supabase.rpc('add_approval_event_v1', {
          p_approval_id: approvalId,
          p_event_type: 'comment',
          p_author: author,
          p_message: msg,
          p_comments: msg,
        } as any);
        if (!rpcError) return;
        // If RPC not deployed or failed, fall back to direct insert
      } catch (e) {
        // Fall through to direct insert
      }
      const { error } = await supabase.from('approval_events').insert({ approval_id: approvalId, event_type: 'comment', author, message: msg });
      if (!error) return;
      throw error;
    } catch (e) {
      console.warn('addApprovalComment remote insert failed, falling back to local', e);
    }
  }
  // Local fallback: persist event so UI can show the comment
  const ev: ApprovalEvent = {
    id: `AEV-${Math.floor(Math.random()*900000+100000)}`,
    approvalId,
    eventType: 'comment',
    author,
    message: msg,
    createdAt: new Date().toISOString(),
  };
  const list = loadLocalEvents();
  saveLocalEvents([...list, ev]);
}

function toCamel(row: any): ApprovalRequest {
  return {
    id: row.id,
    assetId: row.asset_id,
    action: row.action,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    notes: row.notes ?? null,
    patch: row.patch ?? null,
  department: row.department ?? null,
  };
}

function toSnake(input: Partial<ApprovalRequest>) {
  const row: any = {};
  if ("id" in input) row.id = input.id;
  if ("assetId" in input) row.asset_id = input.assetId;
  if ("action" in input) row.action = input.action;
  if ("status" in input) row.status = input.status;
  if ("requestedBy" in input) row.requested_by = input.requestedBy;
  if ("requestedAt" in input) row.requested_at = input.requestedAt;
  if ("reviewedBy" in input) row.reviewed_by = input.reviewedBy ?? null;
  if ("reviewedAt" in input) row.reviewed_at = input.reviewedAt ?? null;
  if ("notes" in input) row.notes = input.notes ?? null;
  if ("patch" in input) row.patch = input.patch ?? null;
  if ("department" in input) row.department = input.department ?? null;
  return row;
}
