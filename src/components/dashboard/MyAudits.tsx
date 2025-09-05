import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { isDemoMode } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listSessions, getSessionById, isAuditActive, getProgress } from "@/services/audit";

type Row = { id: string; property?: string | null; startedAt?: string | null; status: string; submitted?: string };

export function MyAudits() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const active = await isAuditActive().catch(() => false);
        let rows: Row[] = [];
        try {
          const list = await listSessions(10);
          rows = (list || []).map((s: any) => ({ id: s.id, property: s.property_id ?? null, startedAt: s.started_at ?? s.created_at ?? null, status: s.is_active ? 'Active' : 'Ended' }));
        } catch {}
        // Add currently active (if not already in list)
        if (active) {
          try {
            const sid = localStorage.getItem('active_audit_session_id');
            if (sid) {
              const sess = await getSessionById(sid);
              if (sess) {
                const row = { id: sess.id, property: (sess as any)?.property_id ?? null, startedAt: (sess as any)?.started_at ?? null, status: 'Active' };
                if (!rows.find(r => r.id === row.id)) rows.unshift(row);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>My Audits</CardTitle>
          <CardDescription>Your recent and active audit sessions</CardDescription>
        </div>
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {!items.length && !loading && (
          <p className="text-sm text-muted-foreground">No audits yet.</p>
        )}
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded border p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">Session {r.id}</div>
                <div className="text-xs text-muted-foreground truncate">
                  Property: {r.property || '—'}
                  {r.startedAt ? ` • Started ${new Date(r.startedAt).toLocaleString()}` : ''}
                </div>
              </div>
              <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>{r.status}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => { try { window.location.href = '/audit'; } catch { } }}>Go to Audit</Button>
        </div>
      </CardContent>
    </Card>
  );
}
