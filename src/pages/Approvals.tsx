import { useEffect, useMemo, useState } from "react";
import { listApprovals, decideApprovalFinal, forwardApprovalToAdmin, listApprovalEvents, type ApprovalRequest, type ApprovalEvent } from "@/services/approvals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listDepartments, type Department } from "@/services/departments";
import { getAssetById, type Asset } from "@/services/assets";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Approvals() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
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
  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending'|'approved'|'rejected'|'all'>("pending");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [initializedDefault, setInitializedDefault] = useState(false);

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
            const status = statusFilter === 'pending' ? 'pending_manager' : (statusFilter === 'approved' ? 'approved' : (statusFilter === 'rejected' ? 'rejected' : undefined));
            const data = await listApprovals(status as any, myDept);
            setItems(Array.isArray(data) ? data : []);
          } else {
            // Manager has no department assigned; do not show cross-department approvals
            setItems([]);
          }
        } else if (role === 'admin') {
          const dept = (adminDeptFilter && adminDeptFilter !== 'ALL') ? adminDeptFilter : undefined;
          const status = statusFilter === 'pending' ? 'pending_admin' : (statusFilter === 'approved' ? 'approved' : (statusFilter === 'rejected' ? 'rejected' : undefined));
          const data = await listApprovals(status as any, dept);
          setItems(Array.isArray(data) ? data : []);
        } else {
          // Users: fetch all own approvals; filter client-side below
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
  }, [role, myDept, adminDeptFilter, myIdentity, statusFilter]);

  useEffect(() => {
    (async () => {
      if (!selectedId) { setEvents([]); setSelectedApproval(null); setSelectedAsset(null); return; }
      const ap = items.find(i => i.id === selectedId) || null;
      setSelectedApproval(ap || null);
      try { setEvents(await listApprovalEvents(selectedId)); } catch {}
      // Try to get current asset for before/after diff
      try {
        if (ap && hasSupabaseEnv) {
          const a = await getAssetById(ap.assetId);
          setSelectedAsset(a);
        } else {
          setSelectedAsset(null);
        }
      } catch { setSelectedAsset(null); }
    })();
  }, [selectedId]);

  const onForward = async (id: string) => {
    try {
      const res = await forwardApprovalToAdmin(id, 'manager', managerNotes);
      if (res) setItems(s => s.map(i => i.id === id ? res : i));
      toast.success('Forwarded to admin');
    } catch (e:any) { toast.error(e?.message || 'Failed to forward'); }
  };

  const onDecision = async (id: string, d: "approved" | "rejected") => {
    const res = await decideApprovalFinal(id, d, "admin", adminNotes);
    if (res) setItems((s) => s.map(i => i.id === id ? res : i));
  };

  // Derived filtered list (date range + client-side status where necessary)
  const visibleItems = useMemo(() => {
    const df = (statusFilter === 'pending') ? null : (dateFrom ? new Date(dateFrom) : null);
    const dt = (statusFilter === 'pending') ? null : (dateTo ? new Date(dateTo) : null);
    const norm = (arr: ApprovalRequest[]) => arr.filter(a => {
      const when = a?.requestedAt ? new Date(a.requestedAt) : null;
      if (df && (!when || when < new Date(df.setHours(0,0,0,0)))) return false;
      if (dt && (!when || when > new Date(dt.setHours(23,59,59,999)))) return false;
      // For user role, apply status filter here
      if (role === 'user') {
        if (statusFilter === 'pending') return a.status === 'pending_manager' || a.status === 'pending_admin';
        if (statusFilter === 'approved') return a.status === 'approved';
        if (statusFilter === 'rejected') return a.status === 'rejected';
      }
      return true;
    }).sort((a,b) => {
      const da = a?.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const db = b?.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return db - da; // newest first
    });
    return norm(items);
  }, [items, dateFrom, dateTo, role, statusFilter]);

  // Always default to pending; if switching away from pending, default date range to today when not set.
  useEffect(() => {
    if (!initializedDefault) {
      setStatusFilter('pending');
      setInitializedDefault(true);
    }
  }, [initializedDefault]);

  const onChangeStatus = (v: 'pending'|'approved'|'rejected'|'all') => {
    setStatusFilter(v);
    if (v === 'pending') {
      // Show all pending regardless of date
      setDateFrom(undefined);
      setDateTo(undefined);
    } else {
      // Default to today if not already set
      const today = new Date();
      today.setHours(0,0,0,0);
      if (!dateFrom) setDateFrom(new Date(today));
      const end = new Date(today);
      if (!dateTo) setDateTo(new Date(end));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Approvals</h1>
  <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>Requests</CardTitle>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="w-40">
                <Select value={statusFilter} onValueChange={(v: any) => onChangeStatus(v)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-[12rem]">
                  <span className="text-xs text-muted-foreground w-10 text-right">From</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full sm:w-44 justify-start truncate", !dateFrom && "text-muted-foreground")}> 
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom as any} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2 min-w-[12rem]">
                  <span className="text-xs text-muted-foreground w-10 text-right">To</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full sm:w-44 justify-start truncate", !dateTo && "text-muted-foreground")}> 
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo as any} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div>Loading…</div> : (Array.isArray(visibleItems) && visibleItems.length) ? visibleItems.map(a => {
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

                  {/* Right: diff preview and actions per role/stage */}
                  <div className="space-y-2">
                    {/* Diff preview */}
                    {selectedApproval?.patch && Object.keys(selectedApproval.patch || {}).length ? (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Changes</div>
                        <div className="rounded border bg-muted/30 p-2 text-xs max-h-48 overflow-auto">
                          {Object.entries(selectedApproval.patch || {}).map(([k, after]) => {
                            const before = (selectedAsset as any)?.[k];
                            const beforeStr = before == null ? '-' : String(before);
                            const afterStr = after == null ? '-' : String(after as any);
                            return (
                              <div key={k} className="flex items-start gap-2 py-1">
                                <div className="font-medium min-w-[120px]">{k}</div>
                                <div className="text-muted-foreground line-through break-all">{beforeStr}</div>
                                <div className="break-all">{afterStr}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No changes provided</div>
                    )}
                    {role === 'manager' && a.status === 'pending_manager' && (
                      <div className="space-y-2">
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
          }) : (
            <div className="text-sm text-muted-foreground">
              No approvals for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
