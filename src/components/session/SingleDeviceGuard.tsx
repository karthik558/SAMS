import { useEffect } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { fetchServerSessionTag, getLocalSessionTag, logout } from "@/services/auth";

export function SingleDeviceGuard() {
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let timer: any;
    let mounted = true;
  let authUnsub: any;

    const authUserEmail = (() => {
      try { return (JSON.parse(localStorage.getItem("auth_user") || "{}") as any)?.email || null; } catch { return null; }
    })();

    function isProtectedPath(p: string) {
      // Only enforce inside the authenticated app shell; skip public/demo routes and marketing site
      // Special-case: /assets/:id is a public asset preview page
      if (/^\/assets\/[A-Za-z0-9\-]+$/.test(p)) return false;
      return (
        p === '/' ||
        p.startsWith('/assets') ||
        p.startsWith('/properties') ||
        p.startsWith('/qr-codes') ||
        p.startsWith('/approvals') ||
        p.startsWith('/tickets') ||
        p.startsWith('/reports') ||
        p.startsWith('/users') ||
        p.startsWith('/settings')
      );
    }

    async function checkOnce() {
      const local = getLocalSessionTag();
      if (!authUserEmail || !local) return;
      try {
        // Do not interrupt if user is on public pages (scan, site), auth pages, or demo
        const path = typeof window !== 'undefined' ? (window.location.pathname || '') : '';
        if (!isProtectedPath(path)) return;
      } catch {}
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

      // Also subscribe to auth state changes to re-check immediately
      try {
        authUnsub = (supabase as any).auth.onAuthStateChange?.(() => {
          checkOnce();
        });
      } catch {}
    }

  return () => {
      mounted = false;
      if (unsub) try { unsub(); } catch {}
      if (timer) clearInterval(timer);
      try {
        if (authUnsub && typeof authUnsub?.data?.subscription?.unsubscribe === 'function') {
          authUnsub.data.subscription.unsubscribe();
        }
      } catch {}
    };
  }, []);

  return null;
}
