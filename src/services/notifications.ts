import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

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
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id, title, message, type, read, created_at")
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

export async function addNotification(input: Omit<Notification, "id" | "read" | "created_at"> & { read?: boolean }): Promise<Notification> {
  const payload: Notification = {
    id: `NTF-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    message: input.message,
    type: input.type,
    read: input.read ?? false,
    created_at: new Date().toISOString(),
  };
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(table)
        .insert({
          id: payload.id,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          read: payload.read,
          created_at: payload.created_at,
        })
        .select("id, title, message, type, read, created_at")
        .single();
      if (error) throw error;
      return data as Notification;
    } catch (e) {
      console.warn("notifications insert failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  const updated = [payload, ...list];
  saveLocal(updated);
  return payload;
}

export async function markAllRead(): Promise<void> {
  if (hasSupabaseEnv) {
    try {
      const { error } = await supabase.from(table).update({ read: true }).neq("read", true);
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
  if (hasSupabaseEnv) {
    try {
      const { error } = await supabase.from(table).delete().neq("id", "");
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("notifications clearAll failed, falling back", e);
    }
  }
  saveLocal([]);
}
