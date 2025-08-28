import { useEffect, useMemo, useState } from "react";
import { listApprovals, decideApprovalFinal, forwardApprovalToAdmin, updateApprovalPatch, listApprovalEvents, type ApprovalRequest, type ApprovalEvent } from "@/services/approvals";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listDepartments, type Department } from "@/services/departments";

export default function Approvals() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [managerPatch, setManagerPatch] = useState<string>("")
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const fmt = (v?: string | null) => {
    try {
      if (!v) return "-";
      const d = new Date(v);
      return isNaN(d.getTime()) ? "-" : d.toLocaleString();
    } catch { return "-"; }
  };
  const auth = useMemo(() => {
    try { const raw = localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }, []);
  const role = (auth?.role || '').toLowerCase();
  const myDept = auth?.department || '';
  const myIdentity = (auth?.email || auth?.id || '').toLowerCase();
  const [adminDeptFilter, setAdminDeptFilter] = useState<string>("ALL");
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    // Load departments for admin filter dynamically
    (async () => {
      if (role !== 'admin') return;
      try {
        const list = await listDepartments();
        setDepartments(list.filter(d => d.is_active !== false));
      } catch {}
    })();
  }, [role]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (role === 'manager') {
          if (myDept && String(myDept).trim().length) {
            const data = await listApprovals(undefined, myDept);
            setItems(Array.isArray(data) ? data : []);
          } else {
            // Manager has no department assigned; do not show cross-department approvals
            setItems([]);
          }
        } else if (role === 'admin') {
          const data = await listApprovals(undefined, (adminDeptFilter && adminDeptFilter !== 'ALL') ? adminDeptFilter : undefined);
          setItems(Array.isArray(data) ? data : []);
        } else {
          const data = await listApprovals(undefined, undefined, myIdentity || undefined);
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Failed to load approvals', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [role, myDept, adminDeptFilter, myIdentity]);

  useEffect(() => {
    (async () => {
      if (!selectedId) { setEvents([]); return; }
      try { setEvents(await listApprovalEvents(selectedId)); } catch {}
    })();
  }, [selectedId]);

  const onForward = async (id: string) => {
    try {
      if (managerPatch.trim()) {
        try { JSON.parse(managerPatch); } catch { toast.error('Patch must be valid JSON'); return; }
        await updateApprovalPatch(id, 'manager', JSON.parse(managerPatch));
      }
      const res = await forwardApprovalToAdmin(id, 'manager', managerNotes);
      if (res) setItems(s => s.map(i => i.id === id ? res : i));
      toast.success('Forwarded to admin');
    } catch (e:any) { toast.error(e?.message || 'Failed to forward'); }
  };

  const onDecision = async (id: string, d: "approved" | "rejected") => {
    const res = await decideApprovalFinal(id, d, "admin", adminNotes);
    if (res) setItems((s) => s.map(i => i.id === id ? res : i));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Approvals</h1>
  <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Back</Button>
              <CardTitle>Requests</CardTitle>
            </div>
            {role === 'admin' && (
              <div className="w-48">
        <Select value={adminDeptFilter} onValueChange={setAdminDeptFilter}>
                  <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
          <SelectItem value="ALL">All departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div>Loading…</div> : (Array.isArray(items) && items.length) ? items.map(a => {
            const actionLabel = (a?.action ? String(a.action).toUpperCase() : 'REQUEST');
            const assetLabel = a?.assetId || '-';
            const requestedBy = a?.requestedBy || '-';
            const statusLabel = a?.status || '-';
            return (
            <div key={a.id} className="border rounded p-3 bg-background">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{actionLabel} • Asset {assetLabel}</div>
                  <div className="text-xs text-muted-foreground">Requested by {requestedBy} on {fmt(a?.requestedAt)}</div>
                  <div className="text-xs mt-1">Status: <span className="font-medium">{statusLabel}</span></div>
                </div>
                <div className="flex gap-2">
                  {a.status === 'pending_manager' && role === 'manager' && (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedId(a.id)}>Review</Button>
                  )}
                  {a.status === 'pending_admin' && role === 'admin' && (
                    <Button size="sm" onClick={() => setSelectedId(a.id)}>Open</Button>
                  )}
                  {role === 'user' && a.requestedBy?.toLowerCase() === myIdentity && (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedId(a.id)}>View</Button>
                  )}
                </div>
              </div>
              {selectedId === a.id && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {/* Left: details and events */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Events</div>
                    <div className="rounded border bg-muted/30 p-2 max-h-48 overflow-auto text-xs">
                      {events.length ? events.map(ev => (
                        <div key={ev.id} className="py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ev.eventType}</span>
                            <span className="text-muted-foreground">{fmt(ev.createdAt)}</span>
                          </div>
                          {ev.message ? <div>{ev.message}</div> : null}
                          {ev.author ? <div className="text-muted-foreground">by {ev.author}</div> : null}
                        </div>
                      )) : <div className="text-muted-foreground">No events</div>}
                    </div>
                  </div>

                  {/* Right: actions per role/stage */}
                  <div className="space-y-2">
                    {role === 'manager' && a.status === 'pending_manager' && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Stage edits (JSON patch)</div>
                        <Textarea rows={6} value={managerPatch} onChange={e => setManagerPatch(e.target.value)} placeholder='{"name":"New name"}' />
                        <Input placeholder="Notes to admin (optional)" value={managerNotes} onChange={e => setManagerNotes(e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onForward(a.id)}>Forward to Admin</Button>
                        </div>
                      </div>
                    )}
                    {role === 'admin' && a.status === 'pending_admin' && (
                      <div className="space-y-2">
                        <Input placeholder="Decision notes (optional)" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onDecision(a.id, 'approved')}>Approve & Apply</Button>
                          <Button size="sm" variant="destructive" onClick={() => onDecision(a.id, 'rejected')}>Reject</Button>
                        </div>
                      </div>
                    )}
                    {role === 'user' && a.requestedBy?.toLowerCase() === myIdentity && (
                      <div className="text-sm text-muted-foreground">Awaiting decision.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
          }) : <div className="text-sm text-muted-foreground">No approvals</div>}
        </CardContent>
      </Card>
    </div>
  );
}
