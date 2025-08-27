import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type Activity = {
  id: number;
  type: string;
  message: string;
  user_name: string | null;
  created_at: string;
};

const table = "recent_activity";

export async function listActivity(limit = 20): Promise<Activity[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase
    .from(table)
    .select("id, type, message, user_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function logActivity(type: string, message: string, user_name?: string | null) {
  if (!hasSupabaseEnv) return; // silently ignore when not configured
  const { error } = await supabase.from(table).insert({ type, message, user_name: user_name ?? null });
  if (error) console.error("logActivity error", error);
}

export function subscribeActivity(onInsert: (a: Activity) => void) {
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
