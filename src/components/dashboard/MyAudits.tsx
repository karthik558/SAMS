import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { isDemoMode } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listSessions, getSessionById, isAuditActive, getProgress, formatAuditSessionName } from "@/services/audit";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";

type Row = { id: string; property?: string | null; startedAt?: string | null; status: string; submitted?: string };

export function MyAudits() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const active = await isAuditActive().catch(() => false);
        let rows: Row[] = [];
        // Determine if current user is admin; non-admins should see only their allowed properties
        let isAdmin = false;
        let allowed: Set<string> = new Set();
        try {
          const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
          const u = raw ? JSON.parse(raw) : null;
          isAdmin = String(u?.role || '').toLowerCase() === 'admin';
          if (!isAdmin) {
            allowed = await getAccessiblePropertyIdsForCurrentUser();
          }
        } catch {}
        try {
          const list = await listSessions(10);
          rows = (list || [])
            .map((s: any) => ({ id: s.id, property: s.property_id ?? null, startedAt: s.started_at ?? s.created_at ?? null, status: s.is_active ? 'Active' : 'Ended' }))
            .filter((r) => {
              if (isAdmin) return true;
              // For non-admins, only show sessions scoped to allowed properties
              if (!r.property) return false;
              return allowed.has(String(r.property));
            });
        } catch {}
        // Add currently active (if not already in list)
        if (active) {
          try {
            const sid = localStorage.getItem('active_audit_session_id');
            if (sid) {
              const sess = await getSessionById(sid);
              if (sess) {
                const row = { id: sess.id, property: (sess as any)?.property_id ?? null, startedAt: (sess as any)?.started_at ?? null, status: 'Active' };
                const allowRow = isAdmin || (row.property && allowed.has(String(row.property)));
                if (allowRow && !rows.find(r => r.id === row.id)) rows.unshift(row);
              }
            }
          } catch {}
        }
        // Sort by start/created time desc and keep only last 3
        const sorted = rows.sort((a, b) => {
          const ta = a.startedAt ? Date.parse(a.startedAt) : 0;
          const tb = b.startedAt ? Date.parse(b.startedAt) : 0;
          return tb - ta;
        });
        setItems(sorted.slice(0, 3));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="rounded-xl border border-border/60 bg-card shadow-sm min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-2">
          <span className="rounded-full bg-primary/10 p-2 text-primary">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">My Audits</CardTitle>
            <CardDescription className="text-xs text-muted-foreground sm:text-sm">
              Your recent and active audit sessions
            </CardDescription>
          </div>
        </div>
        {!isDemoMode() && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => navigate("/audit")}
          >
            View all
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!items.length && !loading && (
          <p className="text-sm text-muted-foreground">No audits yet.</p>
        )}
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{formatAuditSessionName({ id: r.id, property_id: r.property as any, started_at: r.startedAt || '', frequency_months: undefined as any, is_active: r.status==='Active' })}</div>
                <div className="text-xs text-muted-foreground truncate">{r.startedAt ? `Started ${new Date(r.startedAt).toLocaleString()}` : ''}</div>
              </div>
              <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>{r.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
