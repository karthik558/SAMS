import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";
import { playNotificationSound } from "@/lib/sound";
import { listUsers } from "@/services/users";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: string; // e.g., report, qr, system
  read: boolean;
  created_at: string; // ISO
};

const table = "notifications";
const LS_KEY = "notifications";

function loadLocal(): Notification[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) as Notification[] : [];
  } catch {
    return [];
  }
}

function saveLocal(list: Notification[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export async function listNotifications(limit = 50): Promise<Notification[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const uid = getCurrentUserId();
      if (!uid) return [];
      const { data, error } = await supabase
        .from(table)
        .select("id, title, message, type, read, created_at")
        .eq('user_id', uid)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Notification[];
    } catch (e) {
      console.warn("notifications table unavailable, using localStorage", e);
    }
  }
  return loadLocal().slice(0, limit);
}

export async function addNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const uid = getCurrentUserId();
      // Try to capture user_name for auditability
      let user_name: string | null = null;
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        if (raw) { const u = JSON.parse(raw); user_name = u?.name || u?.email || u?.id || null; }
      } catch {}
      const { data, error } = await supabase
        .from(table)
        .insert({
          id: payload.id,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          read: payload.read,
          created_at: payload.created_at,
          user_id: uid ?? null,
          user_name,
        })
        .select("id, title, message, type, read, created_at")
        .single();
      if (error) throw error;
      // Local side-effect: play sound once notification is recorded remotely
      try { if (!opts?.silent) playNotificationSound(); } catch {}
      return data as Notification;
    } catch (e) {
      console.warn("notifications insert failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  const updated = [payload, ...list];
  saveLocal(updated);
  try { if (!opts?.silent) playNotificationSound(); } catch {}
  return payload;
}

// Direct notification to a specific user (by user_id). Useful for @mentions or ticket assignment updates.
export async function addUserNotification(
  userId: string,
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  opts?: { silent?: boolean }
): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      let user_name: string | null = null;
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        if (raw) { const u = JSON.parse(raw); user_name = u?.name || u?.email || u?.id || null; }
      } catch {}
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          id: payload.id,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          read: payload.read,
          created_at: payload.created_at,
          user_id: userId,
          user_name,
        })
        .select("id, title, message, type, read, created_at")
        .single();
      if (error) throw error;
      try { if (!opts?.silent) playNotificationSound(); } catch {}
      return data as Notification;
    } catch (e) {
      console.warn('addUserNotification failed, falling back to localStorage', e);
    }
  }
  const list = loadLocal();
  const updated = [payload, ...list];
  saveLocal(updated);
  try { if (!opts?.silent) playNotificationSound(); } catch {}
  return payload;
}

// Helper: read current actor name/email for attribution
function getActorName(): string | null {
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.name || u?.email || u?.id || null;
  } catch { return null; }
}

// Fan-out notifications to all users with the specified role (e.g., 'admin' or 'manager').
// When Supabase is available, inserts one row per recipient user_id so it respects per-user RLS.
export async function addRoleNotification(
  input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean },
  role: 'admin' | 'manager',
  opts?: { silent?: boolean }
): Promise<void> {
  // In demo or without Supabase, fall back to a single local notification (best-effort)
  if (!hasSupabaseEnv || isDemoMode()) {
    await addNotification(input, opts);
    return;
  }
  try {
    // Prefer server-side RPC to bypass RLS and fan out securely
    try {
      const { error: rpcError } = await supabase.rpc('add_notifications_for_role_v1', {
        p_title: input.title,
        p_message: input.message,
        p_type: input.type,
        p_role: role,
      } as any);
      if (!rpcError) { try { if (!opts?.silent) playNotificationSound(); } catch {} ; return; }
      console.warn('RPC add_notifications_for_role_v1 failed, attempting client-side insert...', rpcError);
    } catch (e) {
      console.warn('RPC add_notifications_for_role_v1 not available, attempting client-side insert...', e);
    }
    // Load recipients from app_users
    const users = await listUsers();
    const recipients = users.filter(u => (u.role || '').toLowerCase() === role && (u.status || '').toLowerCase() !== 'inactive');
    if (!recipients.length) {
      // No recipients found; still record a notification for the actor so there's traceability
      await addNotification(input);
      return;
    }
    const actorName = getActorName();
    const rows = recipients.map(r => ({
      id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
      title: input.title,
      message: input.message,
      type: input.type,
      read: input.read ?? false,
      created_at: new Date().toISOString(),
      user_id: r.id,
      user_name: actorName,
    }));
    // Insert in one batch
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw error;
    // The sender gets a local beep as feedback that notifications were sent
    try { if (!opts?.silent) playNotificationSound(); } catch {}
  } catch (e) {
    console.warn('addRoleNotification failed, falling back to single notification', e);
    await addNotification(input, opts);
  }
}

export async function markAllRead(): Promise<void> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const uid = getCurrentUserId();
      if (!uid) return;
      const { error } = await supabase.from(table).update({ read: true }).neq("read", true).eq('user_id', uid);
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("notifications markAllRead failed, falling back", e);
    }
  }
  const list = loadLocal().map(n => ({ ...n, read: true }));
  saveLocal(list);
}

export async function clearAllNotifications(): Promise<void> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const uid = getCurrentUserId();
      if (!uid) return;
      const { error } = await supabase.from(table).delete().eq('user_id', uid);
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("notifications clearAll failed, falling back", e);
    }
  }
  saveLocal([]);
}
