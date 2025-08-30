import { useEffect, useState } from "react";
import NotFound from "@/pages/NotFound";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, roleDefaults, type PageKey } from "@/services/permissions";

type Props = {
  page: PageKey;
  children: React.ReactNode;
};

export function RequireView({ page, children }: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let role = "";
        try {
          const raw = localStorage.getItem("auth_user");
          role = raw ? (JSON.parse(raw).role || "") : "";
        } catch {}
        const r = role.toLowerCase();
        const uid = getCurrentUserId();
        let perms: Record<PageKey, { v: boolean; e: boolean }> = {} as any;
        if (uid) {
          try {
            perms = await listUserPermissions(uid);
          } catch {}
        }
        const effective = Object.keys(perms || {}).length
          ? mergeDefaultsWithOverrides(r, perms)
          : roleDefaults(r);
        const ok = !!effective[page]?.v;
        if (!cancelled) setAllowed(ok);
      } catch {
        // Fallback to deny if anything goes wrong
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  if (allowed === null) return null;
  if (!allowed) return <NotFound />;
  return <>{children}</>;
}

export default RequireView;
