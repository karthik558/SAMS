import { useEffect } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { fetchServerSessionTag, getLocalSessionTag, logout } from "@/services/auth";

export function SingleDeviceGuard() {
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timer: any;
    let mounted = true;

    const authUserEmail = (() => {
      try { return (JSON.parse(localStorage.getItem("auth_user") || "{}") as any)?.email || null; } catch { return null; }
    })();

    async function checkOnce() {
      const local = getLocalSessionTag();
      if (!authUserEmail || !local) return;
      try {
        const server = await fetchServerSessionTag(authUserEmail);
        if (server && server !== local) {
          await logout();
          try {
            localStorage.removeItem("current_user_id");
            localStorage.removeItem("auth_user");
          } catch {}
          // Force reload to login
          if (typeof window !== 'undefined') window.location.replace('/login');
        }
      } catch {
        // ignore transient errors
      }
    }

    if (hasSupabaseEnv) {
      // Realtime listener (best-effort): requires Realtime enabled for app_users
      try {
        const email = authUserEmail;
        if (email) {
          const channel = (supabase as any).channel('sdev-guard')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_users', filter: `email=eq.${email}` }, () => {
              checkOnce();
            })
            .subscribe();
          unsub = () => { try { (supabase as any).removeChannel?.(channel); } catch {} };
        }
      } catch {
        // fallback to polling
      }
      // Poll every 15s as a backup
      timer = setInterval(checkOnce, 15000);
      checkOnce();
    }

    return () => {
      mounted = false;
      if (unsub) try { unsub(); } catch {}
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
