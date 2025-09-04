import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";

export type Activity = {
  id: number;
  type: string;
  message: string;
  user_name: string | null;
  created_at: string;
};

const table = "recent_activity";

// Demo-mode local storage helpers
const DEMO_LS_KEY = "demo_recent_activity";

function loadDemoActivity(): Activity[] {
  try {
    const raw = localStorage.getItem(DEMO_LS_KEY);
    const parsed: Activity[] = raw ? JSON.parse(raw) : [];
    if (parsed.length === 0) {
      // Seed a handful of today activities
      const now = new Date();
      const base: Activity[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        type: ["system", "asset_created", "qr_generated", "report"][i % 4],
        message:
          i % 4 === 1
            ? `Created demo asset AST-${String(100 + i)}`
            : i % 4 === 2
            ? `Generated QR codes for Property ${((i % 5) + 1).toString().padStart(3, "0")}`
            : i % 4 === 3
            ? `Report export completed`
            : "Welcome to SAMS Demo",
        user_name: i % 3 === 0 ? "Admin" : i % 3 === 1 ? "Manager" : "System",
        created_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + i, (i * 7) % 60, 0).toISOString(),
      }));
      saveDemoActivity(base);
      return base;
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveDemoActivity(list: Activity[]) {
  try {
    localStorage.setItem(DEMO_LS_KEY, JSON.stringify(list));
  } catch {}
}

export async function listActivity(limit = 20): Promise<Activity[]> {
  if (isDemoMode()) {
    const data = loadDemoActivity()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
    return data;
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  // Limit to current user's activity
  const uid = getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from(table)
    .select("id, type, message, user_name, created_at")
    .eq('user_id', uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function logActivity(type: string, message: string, user_name?: string | null) {
  // Derive a sensible default actor label when not explicitly provided
  let derivedName: string | null = null;
  try {
    const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      derivedName = u?.name || u?.email || u?.id || null;
    }
  } catch {}
  if (isDemoMode()) {
    const list = loadDemoActivity();
    const next: Activity = {
      id: (list[0]?.id ?? 0) + 1,
      type,
      message,
      user_name: (user_name ?? derivedName) ?? null,
      created_at: new Date().toISOString(),
    };
    saveDemoActivity([next, ...list]);
    return;
  }
  if (!hasSupabaseEnv) return; // silently ignore when not configured
  const uid = getCurrentUserId();
  const { error } = await supabase.from(table).insert({ type, message, user_name: (user_name ?? derivedName) ?? null, user_id: uid ?? null });
  if (error) console.error("logActivity error", error);
}

export function subscribeActivity(onInsert: (a: Activity) => void) {
  if (isDemoMode()) {
    // No realtime; optional polling could be added. Return no-op unsubscribe.
    return () => {};
  }
  if (!hasSupabaseEnv) return () => {};
  try {
    const channel = supabase
      .channel("recent_activity_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        (payload: any) => {
          const a = payload.new as Activity;
          onInsert(a);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn("Realtime subscribe failed; falling back to polling", e);
    return () => {};
  }
}
