import { useEffect, useMemo, useState } from "react";
import { listApprovals, decideApprovalFinal, forwardApprovalToAdmin, listApprovalEvents, adminOverrideApprove, addApprovalComment, type ApprovalRequest, type ApprovalEvent } from "@/services/approvals";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listDepartments, type Department } from "@/services/departments";
import { getAssetById, listAssets, type Asset } from "@/services/assets";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { Separator } from "@/components/ui/separator";
import DateRangePicker from "@/components/ui/date-range-picker";
import PageHeader from "@/components/layout/PageHeader";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusChip from "@/components/ui/status-chip";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import MetricCard from "@/components/ui/metric-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";

export default function Approvals() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [allowedPropertyIds, setAllowedPropertyIds] = useState<Set<string>>(new Set());
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

  // Load allowed properties for current user (managers are restricted property-wise)
  useEffect(() => {
    (async () => {
      try {
        if (role === 'manager') {
          const props = await getAccessiblePropertyIdsForCurrentUser();
          setAllowedPropertyIds(new Set(Array.from(props).map((p) => String(p))));
        } else {
          setAllowedPropertyIds(new Set());
        }
      } catch {
        setAllowedPropertyIds(new Set());
      }
    })();
  }, [role]);
  const [adminDeptFilter, setAdminDeptFilter] = useState<string>("ALL");
  const [departments, setDepartments] = useState<Department[]>([]);
  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending'|'approved'|'rejected'|'all'>("pending");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [initializedDefault, setInitializedDefault] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState("");
  // Inline diff comment state (field -> pending text)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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
            let scoped = Array.isArray(data) ? data : [];
            // Property-scope: If manager has explicit property access, filter approvals to those assets' properties
            if (allowedPropertyIds && allowedPropertyIds.size > 0) {
              try {
                const assets = hasSupabaseEnv ? await listAssets() : [];
                const byId = new Map<string, Asset>();
                for (const a of assets as Asset[]) byId.set(String(a.id), a);
                scoped = scoped.filter((ap) => {
                  const a = byId.get(String(ap.assetId));
                  if (!a) return false; // if asset unknown, do not leak
                  const pid = String(a.property_id || '').trim();
                  if (pid) return allowedPropertyIds.has(pid);
                  // Fallback: if property_id missing, try property code/name match (best-effort)
                  const pname = String(a.property || '').toLowerCase();
                  return Array.from(allowedPropertyIds).some((p) => String(p).toLowerCase() === pname);
                });
              } catch {
                // If anything fails, fail closed (no cross-property exposure)
                scoped = [];
              }
            }
            setItems(scoped);
          } else {
            // Manager has no department assigned; do not show cross-department approvals
            setItems([]);
          }
        } else if (role === 'admin') {
          const dept = (adminDeptFilter && adminDeptFilter !== 'ALL') ? adminDeptFilter : undefined;
          if (statusFilter === 'pending') {
            // Admin sees both manager and admin pending for override or normal flow
            const [mgr, adm] = await Promise.all([
              listApprovals('pending_manager' as any, dept),
              listApprovals('pending_admin' as any, dept),
            ]);
            setItems([...(mgr || []), ...(adm || [])]);
          } else {
            const status = statusFilter === 'approved' ? 'approved' : (statusFilter === 'rejected' ? 'rejected' : undefined);
            const data = await listApprovals(status as any, dept);
            setItems(Array.isArray(data) ? data : []);
          }
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
  }, [role, myDept, adminDeptFilter, myIdentity, statusFilter, allowedPropertyIds]);

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
      // Guard: managers can only act on approvals within their property scope
      if (role === 'manager' && selectedAsset && allowedPropertyIds && allowedPropertyIds.size > 0) {
        const pid = String(selectedAsset.property_id || '').trim();
        if (!pid || !allowedPropertyIds.has(pid)) {
          toast.error('You are not allowed to act on approvals for this property');
          return;
        }
      }
      const res = await forwardApprovalToAdmin(id, 'manager', managerNotes);
      if (res) setItems(s => s.map(i => i.id === id ? res : i));
      toast.success('Forwarded to admin');
    } catch (e:any) { toast.error(e?.message || 'Failed to forward'); }
  };

  const onDecision = async (id: string, d: "approved" | "rejected") => {
    // Guard: managers shouldn't reach here; admins are allowed. Keep check for safety if reused.
    if (role === 'manager') {
      toast.error('Only admins can take final decisions');
      return;
    }
    const res = await decideApprovalFinal(id, d, "admin", adminNotes);
    if (res) setItems((s) => s.map(i => i.id === id ? res : i));
  };

  // Derived filtered list (date range + client-side status where necessary)
  const visibleItems = useMemo(() => {
    // For pending, ignore date filters entirely and show all relevant items
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

  const approvalMetrics = useMemo(() => {
    const base = visibleItems;
    const statusCounts: Record<'pending_manager' | 'pending_admin' | 'approved' | 'rejected', number> = {
      pending_manager: 0,
      pending_admin: 0,
      approved: 0,
      rejected: 0,
    };
    const departmentMap = new Map<string, number>();
    let totalTurnaroundMs = 0;
    let turnaroundCount = 0;

    base.forEach((request) => {
      statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
      const dept = (request.department || '').trim() || 'Unassigned';
      departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1);

      if (request.requestedAt && request.reviewedAt) {
        const start = new Date(request.requestedAt).getTime();
        const end = new Date(request.reviewedAt).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
          totalTurnaroundMs += end - start;
          turnaroundCount += 1;
        }
      }
    });

    return {
      total: base.length,
      statusCounts,
      pending: statusCounts.pending_manager + statusCounts.pending_admin,
      departmentCounts: Array.from(departmentMap.entries()),
      avgTurnaroundHours: turnaroundCount ? totalTurnaroundMs / turnaroundCount / (1000 * 60 * 60) : null,
    };
  }, [visibleItems]);

  const statusChartData = useMemo(() => {
    const labels: Record<'pending_manager' | 'pending_admin' | 'approved' | 'rejected', string> = {
      pending_manager: 'Pending • Manager',
      pending_admin: 'Pending • Admin',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    const fills: Record<'pending_manager' | 'pending_admin' | 'approved' | 'rejected', string> = {
      pending_manager: '#f59e0b',
      pending_admin: '#6366f1',
      approved: '#22c55e',
      rejected: '#ef4444',
    };
    return (Object.entries(approvalMetrics.statusCounts) as Array<['pending_manager' | 'pending_admin' | 'approved' | 'rejected', number]>).map(([key, value]) => ({
      key,
      label: labels[key],
      value,
      fill: fills[key],
    }));
  }, [approvalMetrics.statusCounts]);

  const departmentChartData = useMemo(() => {
    const palette = ['#6366f1', '#0ea5e9', '#22c55e', '#f97316', '#facc15', '#f43f5e'];
    return approvalMetrics.departmentCounts
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        fill: palette[index % palette.length],
      }));
  }, [approvalMetrics.departmentCounts]);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-border/70 bg-card/95 px-3 py-2 text-xs shadow-sm">
        {label ? <div className="mb-1 font-medium text-foreground">{label}</div> : null}
        <div className="space-y-1">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              {entry?.color ? (
                <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              ) : null}
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatDuration = (hours: number | null | undefined) => {
    if (hours == null || Number.isNaN(hours)) return '—';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Approvals" }]} />
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <PageHeader
          icon={ClipboardCheck}
          title="Approvals"
          description="Review asset requests and keep decision workflows moving"
        />
      </div>
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={ClipboardCheck}
            title="Requests in View"
            value={approvalMetrics.total.toLocaleString()}
            caption="Filtered by role, status, and dates"
          />
          <MetricCard
            icon={ClipboardCheck}
            title="Pending Queue"
            value={approvalMetrics.pending.toLocaleString()}
            caption="Awaiting manager or admin decisions"
            iconClassName="text-amber-500 dark:text-amber-300"
            valueClassName="text-amber-600 dark:text-amber-300"
          />
          <MetricCard
            icon={ClipboardCheck}
            title="Avg Turnaround"
            value={formatDuration(approvalMetrics.avgTurnaroundHours)}
            caption="Completed requests with a decision timestamp"
            iconClassName="text-sky-500 dark:text-sky-300"
          />
          <MetricCard
            icon={ClipboardCheck}
            title="Departments"
            value={approvalMetrics.departmentCounts.length.toLocaleString()}
            caption="Unique departments represented"
            iconClassName="text-emerald-500 dark:text-emerald-300"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
          <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>Where each approval currently sits in the workflow</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" strokeOpacity={0.35} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} interval={0} angle={-10} dy={12} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="top" className="text-xs font-medium" fill="hsl(var(--foreground))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle>Departments</CardTitle>
              <CardDescription>Top departments contributing to the current queue</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-4 space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={departmentChartData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {departmentChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="outside" className="text-[11px] font-medium" fill="hsl(var(--foreground))" />
                    </Pie>
                    <RechartsTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 px-6 text-xs text-muted-foreground">
                {departmentChartData.slice(0, 5).map((entry) => (
                  <span key={entry.name} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span>{entry.name}</span>
                    <span className="font-semibold text-foreground">{entry.value}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

  <Card>
        <CardHeader>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>Requests</CardTitle>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="w-40">
                <Select value={statusFilter} onValueChange={(v: any) => onChangeStatus(v)}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <SelectTrigger className="h-8"><SelectValue placeholder="All departments" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <DateRangePicker
                  value={{ from: dateFrom, to: dateTo }}
                  onChange={(r) => { setDateFrom(r.from); setDateTo(r.to); }}
          className="min-w-[16rem] h-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <PageSkeleton /> : (Array.isArray(visibleItems) && visibleItems.length) ? visibleItems.map(a => {
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
                  <div className="text-xs mt-1 flex items-center gap-2">Status: <StatusChip status={statusLabel} /></div>
                </div>
                <div className="flex gap-2">
                  {a.status === 'pending_manager' && role === 'manager' && (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedId(a.id)}>Review</Button>
                  )}
                  {a.status === 'pending_admin' && role === 'admin' && (
                    <Button size="sm" onClick={() => setSelectedId(a.id)}>Open</Button>
                  )}
                  {a.status === 'pending_manager' && role === 'admin' && (
                    <Button size="sm" variant="secondary" onClick={() => { setSelectedId(a.id); setOverrideOpen(true); }}>Admin Override</Button>
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
                        <div className="rounded border bg-muted/30 p-2 text-xs max-h-64 overflow-auto">
                          {Object.entries(selectedApproval.patch || {}).map(([k, after]) => {
                            const before = (selectedAsset as any)?.[k];
                            const beforeStr = before == null ? '-' : String(before);
                            const afterStr = after == null ? '-' : String(after as any);
                            return (
                              <div key={k} className="flex flex-col gap-1 py-1">
                                <div className="flex items-start gap-2">
                                  <div className="font-medium min-w-[120px]">{k}</div>
                                  <div className="text-muted-foreground line-through break-all">{beforeStr}</div>
                                  <div className="break-all">{afterStr}</div>
                                </div>
                                {(role === 'manager' || role === 'admin') && (
                                  <div className="flex items-center gap-2 pl-[120px]">
                                    <Input
                                      placeholder="Add a note…"
                                      value={commentDrafts[k] || ""}
                                      onChange={(e) => setCommentDrafts(s => ({ ...s, [k]: e.target.value }))}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const msg = (commentDrafts[k] || '').trim();
                                        if (!selectedApproval || !msg) return;
                                        try {
                                          const author = (auth?.email || auth?.id || role || 'user');
                                          await addApprovalComment(selectedApproval.id, author, k, msg);
                                          setCommentDrafts(s => ({ ...s, [k]: "" }));
                                          toast.success('Comment added');
                                          // refresh events to show the new comment
                                          try { setEvents(await listApprovalEvents(selectedApproval.id)); } catch {}
                                        } catch { toast.error('Failed to add comment'); }
                                      }}
                                    >
                                      Comment
                                    </Button>
                                  </div>
                                )}
                                {/* Existing comments for this field */}
                                {events.filter(ev => ev.eventType === 'comment' && (ev.message || '').startsWith(`${k}:`)).length > 0 && (
                                  <div className="space-y-1 pl-[120px]">
                                    {events.filter(ev => ev.eventType === 'comment' && (ev.message || '').startsWith(`${k}:`)).map(ev => {
                                      const msg = (ev.message || '').slice(`${k}:`.length).trim();
                                      return (
                                        <div key={ev.id} className="text-[11px] text-muted-foreground">
                                          <span className="font-medium">{ev.author || 'someone'}:</span> {msg}
                                          <span className="ml-2 opacity-70">{fmt(ev.createdAt)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
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
      {/* Admin Override Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve without Level 1</DialogTitle>
            <DialogDescription>
              This will approve the request immediately and log: "admin approved it without level 1 approval".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Optional note (defaults to the message above)"
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!selectedId) { setOverrideOpen(false); return; }
              try {
                const res = await adminOverrideApprove(selectedId, 'admin', overrideNotes);
                if (res) {
                  setItems((s) => s.map(i => i.id === selectedId ? res : i));
                  toast.success('Approved by admin');
                }
              } catch (e: any) {
                toast.error(e?.message || 'Override failed');
              } finally {
                setOverrideOpen(false);
                setOverrideNotes("");
              }
            }}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
