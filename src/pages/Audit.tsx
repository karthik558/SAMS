import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ClipboardCheck } from "lucide-react";
import { listDepartmentAssets, getActiveSession, getAssignment, getReviewsFor, saveReviewsFor, submitAssignment, isAuditActive, startAuditSession, endAuditSession, getProgress, getDepartmentReviewSummary, listReviewsForSession, createAuditReport, listAuditReports, listRecentAuditReports, listSessions, getAuditReport, getSessionById, type AuditReport, type AuditSession, type AuditReview } from "@/services/audit";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { isDemoMode } from "@/lib/demo";
import { listDepartments, type Department } from "@/services/departments";
import { listProperties, type Property } from "@/services/properties";

type Row = { id: string; name: string; status: "verified" | "missing" | "damaged"; comment: string };

export default function Audit() {
  const [department, setDepartment] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [auditOn, setAuditOn] = useState<boolean>(false);
  const [auditFreq, setAuditFreq] = useState<3 | 6>(3);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [progress, setProgress] = useState<{ total: number; submitted: number } | null>(null);
  const [summary, setSummary] = useState<Record<string, { verified: number; missing: number; damaged: number }>>({});
  const [adminDept, setAdminDept] = useState<string>("");
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [latestReport, setLatestReport] = useState<AuditReport | null>(null);
  const [viewReportId, setViewReportId] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<AuditReport[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionReports, setSessionReports] = useState<AuditReport[]>([]);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [assignmentStatus, setAssignmentStatus] = useState<"pending" | "submitted" | "">("");
  const [reportReviews, setReportReviews] = useState<AuditReview[]>([]);
  const [detailDept, setDetailDept] = useState<string>("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  // When viewing a specific report (including history), resolve its session's property id for display
  const [viewPropertyId, setViewPropertyId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        const user = raw ? JSON.parse(raw) : null;
        setRole((user?.role || '').toLowerCase());
        const dept = user?.department || "";
        setDepartment(dept);
        const active = await isAuditActive();
        setAuditOn(active);
        const deps = await listDepartments();
        setDepartments(deps);
        try {
          const props = await listProperties();
          setProperties(props as Property[]);
        } catch {}
        if (active) {
          const sess = await getActiveSession();
          const sid = sess?.id || "";
          const pid = (sess as any)?.property_id || localStorage.getItem('active_audit_property_id') || '';
          try { if (sid) localStorage.setItem('active_audit_session_id', sid); } catch (e) { console.error(e); }
          try { if (pid) localStorage.setItem('active_audit_property_id', String(pid)); } catch {}
          if (!sid) {
            // Inconsistent state: mark as no active session
            setAuditOn(false);
            setSessionId("");
            setRows([]);
            setProgress(null);
            setSummary({});
          } else {
            setSessionId(sid);
            setSelectedPropertyId(String(pid || ""));
            // initial load for manager/admin
            const initialDept = ((user?.role || '').toLowerCase() === 'admin')
              ? (dept && deps.find(d => d.name.toLowerCase() === String(dept).toLowerCase()) ? dept : (deps[0]?.name || ""))
              : dept;
            if ((user?.role || '').toLowerCase() === 'admin') setAdminDept(initialDept);
            if (initialDept) {
              const asg0 = await getAssignment(sid, initialDept);
              setAssignmentStatus(((asg0 as any)?.status) || 'pending');
              const assets = await listDepartmentAssets(initialDept, (pid || undefined));
              const prior = await getReviewsFor(sid, initialDept);
              const merged: Row[] = (assets || []).map(a => {
                const r = prior.find(p => p.asset_id === a.id);
                return { id: a.id, name: a.name, status: (r?.status as any) || "verified", comment: r?.comment || "" };
              });
              setRows(merged);
            } else {
              setRows([]);
            }
            // admin summary
            const prog = await getProgress(sid, deps.map(d => d.name));
            setProgress(prog);
            const sum = await getDepartmentReviewSummary(sid);
            setSummary(sum);
            // Also load sessions and recent reports even while active
            try {
              const rec = await listRecentAuditReports(20);
              setRecentReports(rec);
              try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
              if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
              const sessList = await listSessions(20);
              setSessions(sessList);
            } catch {}
          }
        } else {
          setSessionId("");
          setRows([]);
          setProgress(null);
          setSummary({});
          // Load recent reports across sessions (persisted history)
          try {
            const rec = await listRecentAuditReports(20);
            setRecentReports(rec);
            try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
            // If no local latest picked, show the most recent one
            if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
            const sess = await listSessions(20);
            setSessions(sess);
          } catch {}
            // Fallback: if we have a locally tracked active session ID, try to restore it
            try {
              const cachedSid = localStorage.getItem('active_audit_session_id');
              if (cachedSid) {
                const sess = await getSessionById(cachedSid);
                if (sess && sess.is_active) {
                  setAuditOn(true);
                  setSessionId(sess.id);
                  const pid = (sess as any)?.property_id || localStorage.getItem('active_audit_property_id') || '';
                  setSelectedPropertyId(String(pid || ''));
                  // Load initial dept rows and admin summary similar to active branch
                  const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
                  const user = raw ? JSON.parse(raw) : null;
                  const deps = await listDepartments();
                  setDepartments(deps);
                  const dept = user?.department || '';
                  const initialDept = ((user?.role || '').toLowerCase() === 'admin')
                    ? (dept && deps.find(d => d.name.toLowerCase() === String(dept).toLowerCase()) ? dept : (deps[0]?.name || ''))
                    : dept;
                  if ((user?.role || '').toLowerCase() === 'admin') setAdminDept(initialDept);
                  if (initialDept) {
                    const asg1 = await getAssignment(sess.id, initialDept);
                    setAssignmentStatus(((asg1 as any)?.status) || 'pending');
                    const assets = await listDepartmentAssets(initialDept, (pid || undefined));
                    const prior = await getReviewsFor(sess.id, initialDept);
                    const merged: Row[] = (assets || []).map(a => {
                      const r = prior.find(p => p.asset_id === a.id);
                      return { id: a.id, name: a.name, status: (r?.status as any) || 'verified', comment: r?.comment || '' };
                    });
                    setRows(merged);
                  }
                  const prog = await getProgress(sess.id, deps.map(d => d.name));
                  setProgress(prog);
                  const sum = await getDepartmentReviewSummary(sess.id);
                  setSummary(sum);
                }
              }
            } catch (e) { console.error(e); }
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load audit items");
      } finally { setLoading(false); }
    })();
  }, []);

  // Reload rows when admin changes selected department
  useEffect(() => {
    (async () => {
      if (role !== 'admin') return;
      if (!sessionId) return;
      const dep = adminDept?.trim();
      if (!dep) { setRows([]); return; }
      try {
        setLoading(true);
        const asg2 = await getAssignment(sessionId, dep);
        setAssignmentStatus(((asg2 as any)?.status) || 'pending');
        const assets = await listDepartmentAssets(dep, (selectedPropertyId || undefined));
        const prior = await getReviewsFor(sessionId, dep);
        const merged: Row[] = (assets || []).map(a => {
          const r = prior.find(p => p.asset_id === a.id);
          return { id: a.id, name: a.name, status: (r?.status as any) || 'verified', comment: r?.comment || '' };
        });
        setRows(merged);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to load department items');
      } finally {
        setLoading(false);
      }
    })();
  }, [adminDept, role, sessionId]);

  const saveProgress = async () => {
    const dep = role === 'admin' ? adminDept : department;
    if (!sessionId || !dep) return;
    try {
      await saveReviewsFor(sessionId, dep, rows.map(r => ({ session_id: sessionId, asset_id: r.id, department: dep, status: r.status, comment: r.comment })) as any);
      toast.success("Progress saved");
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
  };

  const submit = async () => {
    const dep = role === 'admin' ? adminDept : department;
    if (!sessionId || !dep) return;
    if (!confirm("Submit audit for your department? You can still edit until admin closes the session.")) return;
    try {
      setSubmitting(true);
      await saveProgress();
      const raw = localStorage.getItem('auth_user');
      const au = raw ? JSON.parse(raw) : null;
      await submitAssignment(sessionId, dep, au?.name || au?.email || au?.id || null);
      toast.success("Submitted");
      setAssignmentStatus('submitted');
    } catch (e: any) { toast.error(e?.message || "Submit failed"); } finally { setSubmitting(false); }
  };

  // Load full reviews for latest report to enable dept-wise details
  useEffect(() => {
    (async () => {
      if (!latestReport?.session_id) { setReportReviews([]); return; }
      try { const rows = await listReviewsForSession(latestReport.session_id); setReportReviews(rows || []); } catch { setReportReviews([]); }
    })();
  }, [latestReport?.id, latestReport?.session_id]);

  // Resolve property for the currently viewed report's session
  useEffect(() => {
    (async () => {
      try {
        const sid = latestReport?.session_id || null;
        if (!sid) { setViewPropertyId(""); return; }
        const sess = await getSessionById(sid);
        const pid = (sess as any)?.property_id || "";
        setViewPropertyId(String(pid || ""));
      } catch {
        setViewPropertyId("");
      }
    })();
  }, [latestReport?.session_id]);

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Audit" }]} />
        <PageHeader icon={ClipboardCheck} title="Inventory Audit" description="Verify assets in your department and submit results" />
        {(auditOn && selectedPropertyId) && (
          <div className="text-sm text-muted-foreground">
            Property: <span className="font-medium text-foreground">{(() => {
              const p = (properties || []).find(pp => String(pp.id) === String(selectedPropertyId));
              return p ? `${p.name} (${p.id})` : selectedPropertyId;
            })()}</span>
          </div>
        )}
      </div>

      {/* Admin Control Panel */}
      {role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Controls</CardTitle>
            <CardDescription>Start/stop sessions and monitor progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <Label>Frequency</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant={auditFreq === 3 ? 'default' : 'outline'} size="sm" onClick={() => setAuditFreq(3)}>Every 3 months</Button>
                  <Button variant={auditFreq === 6 ? 'default' : 'outline'} size="sm" onClick={() => setAuditFreq(6)}>Every 6 months</Button>
                </div>
              </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
                {!auditOn ? (
                  <Button className="w-full md:w-auto" onClick={async () => {
                    try {
                      const raw = localStorage.getItem('auth_user');
                      const au = raw ? JSON.parse(raw) : null;
          if (!selectedPropertyId) { toast.error('Please select a property for this audit'); return; }
          const created = await startAuditSession(auditFreq, (au?.name || au?.email || au?.id || null), selectedPropertyId);
                      const sid = created?.id || '';
                      if (!sid) {
                        toast.error('Failed to start audit session');
                        return;
                      }
                      setAuditOn(true);
                      setSessionId(sid);
          try { localStorage.setItem('active_audit_session_id', sid); } catch (e) { console.error(e); }
          try { localStorage.setItem('active_audit_property_id', String(selectedPropertyId)); } catch {}
                      try {
                        const prog = await getProgress(sid, departments.map(d => d.name));
                        setProgress(prog);
                      } catch {}
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to start audit session');
                    }
                  }}>Start Audit</Button>
                ) : (
                  <Button className="w-full md:w-auto" variant="destructive" onClick={async () => {
                    const sid = sessionId;
                    try {
                      await endAuditSession();
                      setAuditOn(false);
                      setProgress(null);
                      setSummary({});
                      try { localStorage.removeItem('active_audit_session_id'); } catch (e) { console.error(e); }
                      if (sid) {
                        try {
                          // Enforce at most 2 reports per session when auto-generating on stop
                          const existing = await listAuditReports(sid);
                          if ((existing?.length || 0) >= 2) {
                            const latest = [...(existing||[])].sort((a,b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];
                            if (latest) {
                              setLatestReport(latest);
                              setViewReportId(latest.id);
                              toast.info('This session already has 2 reports. Showing the latest report.');
                              try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                            }
                          } else {
                            const raw = localStorage.getItem('auth_user');
                            const au = raw ? JSON.parse(raw) : null;
                            const rep = await createAuditReport(sid, au?.name || au?.email || au?.id || null);
                            setLatestReport(rep);
                            setViewReportId(rep?.id || null);
                            const list = await listAuditReports(sid);
                            setReports(list);
                            toast.message('Audit ended. A report was generated.', { description: 'Scroll below to view charts or print.' });
                            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                          }
                        } catch (e: any) {
                          console.error(e);
                          toast.error(e?.message || 'Failed to create audit report');
                        }
                      }
                      try {
                        const rec = await listRecentAuditReports(20);
                        setRecentReports(rec);
                        try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
                        if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
                        const sessList = await listSessions(20);
                        setSessions(sessList);
                      } catch (e) { console.error(e); }
                    } catch (e: any) {
                      console.error(e);
                      toast.error(e?.message || 'Failed to stop audit session');
                    }
                  }}>Stop Audit</Button>
                )}
              </div>
            </div>
            {/* Property selection for property-scoped auditing */}
            {!auditOn && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
                <div className="space-y-1">
                  <Label>Property</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">This audit will only include assets from the selected property.</p>
                </div>
              </div>
            )}

            <div className="print:hidden">
              <Label>Progress</Label>
              {progress ? (
                <p className="text-sm text-muted-foreground">{progress.submitted} of {progress.total} departments submitted</p>
              ) : (
                <p className="text-sm text-muted-foreground">No active session</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Button variant="outline" onClick={async () => {
                try {
                  if (!sessionId) { toast.info('No active session'); return; }
                  const rows = await listReviewsForSession(sessionId);
                  const headers = ['session_id','department','asset_id','status','comment','updated_at'];
                  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                  const csv = [
                    headers.join(','),
                    ...rows.map(r => [r.session_id, r.department, r.asset_id, r.status, r.comment || '', r.updated_at || ''].map(esc).join(','))
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const pid = (viewPropertyId || selectedPropertyId || '').toString();
                  const propSlug = pid ? `-${pid}` : '';
                  a.download = `audit-reviews-${sessionId || 'latest'}${propSlug}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (e: any) { toast.error(e?.message || 'Export failed'); }
              }}>Export CSV</Button>
            </div>

            {Object.keys(summary).length > 0 && (
              <div className="overflow-auto print:hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Missing</TableHead>
                      <TableHead>Damaged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary).map(([dept, s]) => (
                      <TableRow key={dept}>
                        <TableCell>{dept}</TableCell>
                        <TableCell>{s.verified}</TableCell>
                        <TableCell>{s.missing}</TableCell>
                        <TableCell>{s.damaged}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {(latestReport || recentReports.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      if (!latestReport) return `Reports available: ${recentReports.length}`;
                      const pid = viewPropertyId || selectedPropertyId;
                      const propLabel = pid ? (() => {
                        const p = (properties || []).find(pp => String(pp.id) === String(pid));
                        return p ? `${p.name} (${p.id})` : pid;
                      })() : null;
                      return `Generated at ${new Date(latestReport.generated_at).toLocaleString()}${propLabel ? ` • Property: ${propLabel}` : ''}`;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => window.print()}>Print</Button>
                    <Button variant="outline" onClick={() => window.print()}>Export PDF</Button>
                  </div>
                </div>
                <div className="hidden print:block mb-4">
                  <div className="flex items-center gap-3">
                    <picture>
                      <source srcSet="/favicon.png" type="image/png" />
                      <img src="/favicon.ico" alt="Logo" className="h-8 w-8" />
                    </picture>
                    <div>
                      <div className="text-lg font-semibold">Audit Report</div>
                      {latestReport?.generated_at && (
                        <div className="text-xs text-muted-foreground">Generated: {new Date(latestReport.generated_at).toLocaleString()}</div>
                      )}
                      {(() => {
                        const pid = viewPropertyId || selectedPropertyId;
                        if (!pid) return null;
                        const p = (properties || []).find(pp => String(pp.id) === String(pid));
                        return <div className="text-xs text-muted-foreground">Property: {p ? `${p.name} (${p.id})` : pid}</div>;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Overall Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const payload = (latestReport?.payload) || {};
                        const totals = payload.totals || { verified: 0, missing: 0, damaged: 0 };
                        const data = [{ name: 'All', Verified: Number(totals.verified || 0), Missing: Number(totals.missing || 0), Damaged: Number(totals.damaged || 0) }];
                        return (
                          <ChartContainer config={{ Verified: { color: 'hsl(var(--primary))' }, Missing: { color: 'hsl(var(--destructive))' }, Damaged: { color: 'hsl(46 93% 50%)' }}}>
                            <BarChart data={data}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="Verified" radius={[4,4,0,0]} fill="var(--color-Verified)" />
                              <Bar dataKey="Missing" radius={[4,4,0,0]} fill="var(--color-Missing)" />
                              <Bar dataKey="Damaged" radius={[4,4,0,0]} fill="var(--color-Damaged)" />
                              <ChartLegend content={<ChartLegendContent />} />
                            </BarChart>
                          </ChartContainer>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 lg:col-span-1">
                    <CardHeader>
                      <CardTitle>By Department</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const payload = (latestReport?.payload) || {};
                        const byDept = (payload.byDepartment || []) as Array<{ department: string; verified: number; missing: number; damaged: number; total: number }>;
                        const data = byDept.map(d => ({ name: d.department, Verified: d.verified, Missing: d.missing, Damaged: d.damaged }));
                        return (
                          <ChartContainer config={{ Verified: { color: 'hsl(var(--primary))' }, Missing: { color: 'hsl(var(--destructive))' }, Damaged: { color: 'hsl(46 93% 50%)' }}}>
                            <BarChart data={data}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} height={60} />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="Verified" stackId="a" fill="var(--color-Verified)" />
                              <Bar dataKey="Missing" stackId="a" fill="var(--color-Missing)" />
                              <Bar dataKey="Damaged" stackId="a" fill="var(--color-Damaged)" />
                              <ChartLegend content={<ChartLegendContent />} />
                            </BarChart>
                          </ChartContainer>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
                {/* Department breakdown with drill-down */}
                {latestReport && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Department Breakdown</CardTitle>
                      <CardDescription>View department-level results and details</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const byDept = (latestReport?.payload?.byDepartment || []) as Array<{ department: string; verified: number; missing: number; damaged: number; total: number }>
                        if (!byDept.length) return <p className="text-sm text-muted-foreground">No breakdown available.</p>;
                        return (
                          <div className="space-y-4">
                            <div className="overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Verified</TableHead>
                                    <TableHead>Missing</TableHead>
                                    <TableHead>Damaged</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead className="w-28">Details</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {byDept.map((d) => (
                                    <TableRow key={d.department}>
                                      <TableCell>{d.department}</TableCell>
                                      <TableCell>{d.verified}</TableCell>
                                      <TableCell>{d.missing}</TableCell>
                                      <TableCell>{d.damaged}</TableCell>
                                      <TableCell>{d.total}</TableCell>
                                      <TableCell>
                                        <Button size="sm" variant="outline" onClick={() => setDetailDept(d.department)}>View</Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {detailDept && (
                              <div>
                                <div className="mb-2 flex items-center justify-between">
                                  <Label>Details • {detailDept}</Label>
                                  <Button size="sm" variant="ghost" onClick={() => setDetailDept("")}>Clear</Button>
                                </div>
                                <div className="overflow-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Asset ID</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Comment</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(reportReviews || []).filter(r => r.department === detailDept).map((r, i) => (
                                        <TableRow key={`${r.asset_id}-${i}`}>
                                          <TableCell className="font-mono text-xs">{r.asset_id}</TableCell>
                                          <TableCell className={r.status === 'missing' ? 'text-red-600' : r.status === 'damaged' ? 'text-yellow-600' : ''}>{r.status}</TableCell>
                                          <TableCell>{r.comment || ''}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
                <Card className="print:hidden">
                  <CardHeader>
                    <CardTitle>Audit History</CardTitle>
                    <CardDescription>Previous audit reports with status and contributors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Label>Sessions</Label>
                        <Select value={selectedSessionId} onValueChange={async (sid) => {
                          setSelectedSessionId(sid);
                          try {
                            const reps = await listAuditReports(sid);
                            setSessionReports(reps || []);
                            if (reps && reps.length) {
                              setLatestReport(reps[0]);
                              setViewReportId(reps[0].id);
                              try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                            }
                          } catch {}
                        }}>
                          <SelectTrigger className="min-w-[220px]"><SelectValue placeholder="Select session" /></SelectTrigger>
                          <SelectContent>
                            {sessions.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.id} • {new Date(s.started_at).toLocaleString()} {s.is_active ? '(Active)' : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" onClick={() => setHistoryOpen(v => !v)}>{historyOpen ? 'Hide' : 'Show'} History</Button>
                    </div>
                    <div className="mb-4 flex items-center justify-end gap-2">
                      {sessionId && (
                        <Button size="sm" onClick={async () => {
                          try {
                            // Enforce at most 2 reports per session (active)
                            const existing = await listAuditReports(sessionId);
                            if ((existing?.length || 0) >= 2) {
                              const latest = [...(existing||[])].sort((a,b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];
                              if (latest) { setLatestReport(latest); setViewReportId(latest.id); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} }
                              toast.info('This session already has 2 reports. Showing the latest report.');
                              return;
                            }
                            const raw = localStorage.getItem('auth_user');
                            const au = raw ? JSON.parse(raw) : null;
                            const rep = await createAuditReport(sessionId, au?.name || au?.email || au?.id || null);
                            setLatestReport(rep);
                            setViewReportId(rep?.id || null);
                            const rec = await listRecentAuditReports(20);
                            setRecentReports(rec);
                            try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
                            toast.success('Report created for active session');
                            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                          } catch (e: any) {
                            toast.error(e?.message || 'Failed to create report');
                          }
                        }}>Generate Report (Active Session)</Button>
                      )}
                      {selectedSessionId && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            // Enforce at most 2 reports per session (selected)
                            const existing = await listAuditReports(selectedSessionId);
                            if ((existing?.length || 0) >= 2) {
                              const latest = [...(existing||[])].sort((a,b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];
                              if (latest) { setLatestReport(latest); setViewReportId(latest.id); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} }
                              toast.info('This session already has 2 reports. Showing the latest report.');
                              return;
                            }
                            const raw = localStorage.getItem('auth_user');
                            const au = raw ? JSON.parse(raw) : null;
                            const rep = await createAuditReport(selectedSessionId, au?.name || au?.email || au?.id || null);
                            setLatestReport(rep);
                            setViewReportId(rep?.id || null);
                            const reps = await listAuditReports(selectedSessionId);
                            setSessionReports(reps || []);
                            const rec = await listRecentAuditReports(20);
                            setRecentReports(rec);
                            try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
                            toast.success('Report created');
                            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
                          } catch (e: any) {
                            toast.error(e?.message || 'Failed to create report');
                          }
                        }}>Generate Report (Selected Session)</Button>
                      )}
                    </div>
                    {historyOpen && (
                      <div className="overflow-auto mb-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Generated By</TableHead>
                              <TableHead>Submissions</TableHead>
                              <TableHead>Damaged</TableHead>
                              <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(selectedSessionId ? sessionReports : recentReports).map(r => {
                              const p = r.payload || {};
                              const totals = p.totals || {};
                              const subs = p.submissions || {};
                              const damaged = Number(totals.damaged || 0);
                              return (
                                <TableRow key={r.id}>
                                  <TableCell>{new Date(r.generated_at).toLocaleString()}</TableCell>
                                  <TableCell>{r.generated_by || '-'}</TableCell>
                                  <TableCell>{Number(subs.submitted || 0)} / {Number(subs.total || 0)}</TableCell>
                                  <TableCell>
                                    <span className={damaged > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>{damaged}</span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" onClick={async () => { try { const rep = await getAuditReport(r.id); if (rep) { setLatestReport(rep); setViewReportId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }); } } catch {} }}>View</Button>
                                      <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    {latestReport?.payload?.contributors && (
                      <div className="mt-4">
                        <Label>Contributors</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {latestReport.payload.contributors.map((c: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
                              {c.department} • {c.status === 'submitted' ? 'Submitted' : 'Pending'}{c.submitted_at ? ` • ${c.submitted_at}` : ''}{c.submitted_by ? ` • ${c.submitted_by}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

  <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Department</CardTitle>
          <CardDescription>{role === 'admin' ? 'Select a department to review' : 'Your assigned department for this audit'}</CardDescription>
        </CardHeader>
        <CardContent>
          {role === 'admin' ? (
            <Select value={adminDept} onValueChange={setAdminDept}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => (
                  <SelectItem value={d.name} key={d.id || d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={department} readOnly className="max-w-sm" />
          )}
        </CardContent>
      </Card>

  {sessionId && (
  <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Review Items</CardTitle>
          <CardDescription>
            {role === 'admin' ? 'Admin review for selected department' : 'Mark each asset as verified, missing, or damaged. Add comments if needed.'}
            {(() => {
              const pid = viewPropertyId || selectedPropertyId;
              if (!pid) return null;
              const p = (properties || []).find(pp => String(pp.id) === String(pid));
              return <span className="ml-2 text-muted-foreground">• Property: {p ? `${p.name} (${p.id})` : pid}</span>;
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items found for your department.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Asset ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="min-w-[240px]">Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        <Select value={r.status} onValueChange={(v: any) => setRows(prev => prev.map((x, i) => i === idx ? { ...x, status: v } : x))} disabled={assignmentStatus === 'submitted' && role !== 'admin'}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="missing">Missing</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input placeholder="Optional notes" value={r.comment} onChange={(e) => setRows(prev => prev.map((x, i) => i === idx ? { ...x, comment: e.target.value } : x))} disabled={assignmentStatus === 'submitted' && role !== 'admin'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {role !== 'admin' && assignmentStatus === 'submitted' ? (
            <div className="flex justify-end mt-4 text-sm text-muted-foreground">Submitted</div>
          ) : (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={saveProgress}>Save</Button>
              <Button onClick={submit} disabled={submitting || !rows.length}>Submit</Button>
            </div>
          )}
        </CardContent>
  </Card>
  )}

      {/* Reports section visible to non-admins as well, with printable scope */}
      {role !== 'admin' && (latestReport || recentReports.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Reports</CardTitle>
            <CardDescription>View and print your department's audit outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
              <div className="text-sm text-muted-foreground">
                {(() => {
                  if (!latestReport) return `Reports available: ${recentReports.length}`;
                  const pid = viewPropertyId || selectedPropertyId;
                  const propLabel = pid ? (() => {
                    const p = (properties || []).find(pp => String(pp.id) === String(pid));
                    return p ? `${p.name} (${p.id})` : pid;
                  })() : null;
                  return `Generated at ${new Date(latestReport.generated_at).toLocaleString()}${propLabel ? ` • Property: ${propLabel}` : ''}`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => window.print()}>Print</Button>
                <Button variant="outline" onClick={() => window.print()}>Export PDF</Button>
              </div>
            </div>
            {/* Printable report area */}
            <div className="mt-4">
              <div className="hidden print:block mb-4">
                <div className="flex items-center gap-3">
                  <picture>
                    <source srcSet="/favicon.png" type="image/png" />
                    <img src="/favicon.ico" alt="Logo" className="h-8 w-8" />
                  </picture>
                  <div>
                    <div className="text-lg font-semibold">Audit Report</div>
                    {latestReport?.generated_at && (
                      <div className="text-xs text-muted-foreground">Generated: {new Date(latestReport.generated_at).toLocaleString()}</div>
                    )}
                    {(() => {
                      const pid = viewPropertyId || selectedPropertyId;
                      if (!pid) return null;
                      const p = (properties || []).find(pp => String(pp.id) === String(pid));
                      return <div className="text-xs text-muted-foreground">Property: {p ? `${p.name} (${p.id})` : pid}</div>;
                    })()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const payload = (latestReport?.payload) || {};
                      const totals = payload.totals || { verified: 0, missing: 0, damaged: 0 };
                      const data = [{ name: 'All', Verified: Number(totals.verified || 0), Missing: Number(totals.missing || 0), Damaged: Number(totals.damaged || 0) }];
                      return (
                        <ChartContainer config={{ Verified: { color: 'hsl(var(--primary))' }, Missing: { color: 'hsl(var(--destructive))' }, Damaged: { color: 'hsl(46 93% 50%)' }}}>
                          <BarChart data={data}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="Verified" radius={[4,4,0,0]} fill="var(--color-Verified)" />
                            <Bar dataKey="Missing" radius={[4,4,0,0]} fill="var(--color-Missing)" />
                            <Bar dataKey="Damaged" radius={[4,4,0,0]} fill="var(--color-Damaged)" />
                            <ChartLegend content={<ChartLegendContent />} />
                          </BarChart>
                        </ChartContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
                <Card className="col-span-1 lg:col-span-1">
                  <CardHeader>
                    <CardTitle>By Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const payload = (latestReport?.payload) || {};
                      const byDept = (payload.byDepartment || []) as Array<{ department: string; verified: number; missing: number; damaged: number; total: number }>;
                      const data = byDept.map(d => ({ name: d.department, Verified: d.verified, Missing: d.missing, Damaged: d.damaged }));
                      return (
                        <ChartContainer config={{ Verified: { color: 'hsl(var(--primary))' }, Missing: { color: 'hsl(var(--destructive))' }, Damaged: { color: 'hsl(46 93% 50%)' }}}>
                          <BarChart data={data}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} height={60} />
                            <YAxis allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="Verified" stackId="a" fill="var(--color-Verified)" />
                            <Bar dataKey="Missing" stackId="a" fill="var(--color-Missing)" />
                            <Bar dataKey="Damaged" stackId="a" fill="var(--color-Damaged)" />
                            <ChartLegend content={<ChartLegendContent />} />
                          </BarChart>
                        </ChartContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
              {/* Department breakdown with drill-down */}
              {latestReport && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Department Breakdown</CardTitle>
                    <CardDescription>View department-level results and details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const byDept = (latestReport?.payload?.byDepartment || []) as Array<{ department: string; verified: number; missing: number; damaged: number; total: number }>
                      if (!byDept.length) return <p className="text-sm text-muted-foreground">No breakdown available.</p>;
                      return (
                        <div className="space-y-4">
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Department</TableHead>
                                  <TableHead>Verified</TableHead>
                                  <TableHead>Missing</TableHead>
                                  <TableHead>Damaged</TableHead>
                                  <TableHead>Total</TableHead>
                                  <TableHead className="w-28">Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {byDept.map((d) => (
                                  <TableRow key={d.department}>
                                    <TableCell>{d.department}</TableCell>
                                    <TableCell>{d.verified}</TableCell>
                                    <TableCell>{d.missing}</TableCell>
                                    <TableCell>{d.damaged}</TableCell>
                                    <TableCell>{d.total}</TableCell>
                                    <TableCell>
                                      <Button size="sm" variant="outline" onClick={() => setDetailDept(d.department)}>View</Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {detailDept && (
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <Label>Details • {detailDept}</Label>
                                <Button size="sm" variant="ghost" onClick={() => setDetailDept("")}>Clear</Button>
                              </div>
                              <div className="overflow-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Asset ID</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Comment</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(reportReviews || []).filter(r => r.department === detailDept).map((r, i) => (
                                      <TableRow key={`${r.asset_id}-${i}`}>
                                        <TableCell className="font-mono text-xs">{r.asset_id}</TableCell>
                                        <TableCell className={r.status === 'missing' ? 'text-red-600' : r.status === 'damaged' ? 'text-yellow-600' : ''}>{r.status}</TableCell>
                                        <TableCell>{r.comment || ''}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
            {/* History actions (non-print) */}
            <div className="mt-6 print:hidden">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Generated By</TableHead>
                      <TableHead>Submissions</TableHead>
                      <TableHead>Damaged</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recentReports || []).map(r => {
                      const p = r.payload || {};
                      const totals = p.totals || {};
                      const subs = p.submissions || {};
                      const damaged = Number(totals.damaged || 0);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.generated_at).toLocaleString()}</TableCell>
                          <TableCell>{r.generated_by || '-'}</TableCell>
                          <TableCell>{Number(subs.submitted || 0)} / {Number(subs.total || 0)}</TableCell>
                          <TableCell>
                            <span className={damaged > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>{damaged}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={async () => { try { const rep = await getAuditReport(r.id); if (rep) { setLatestReport(rep); setViewReportId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }); } } catch {} }}>View</Button>
                              <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
