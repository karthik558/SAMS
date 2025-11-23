import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ClipboardCheck, QrCode, Camera, CheckCircle2, TriangleAlert } from "lucide-react";
import { listDepartmentAssets, getActiveSession, getAssignment, getReviewsFor, saveReviewsFor, submitAssignment, isAuditActive, startAuditSession, endAuditSession, getProgress, getDepartmentReviewSummary, listReviewsForSession, createAuditReport, listAuditReports, listRecentAuditReports, listSessions, getAuditReport, getSessionById, formatAuditSessionName, type AuditReport, type AuditSession, type AuditReview } from "@/services/audit";
import { listAssets, getAssetById, type Asset } from "@/services/assets";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import { listAuditInchargeForUser, getAuditIncharge as fetchAuditIncharge } from "@/services/audit";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { listDepartments, type Department } from "@/services/departments";
import { listProperties, type Property } from "@/services/properties";
import { verifyAssetViaScan, listMyScansForSession } from "@/services/auditScans";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

type Row = { id: string; name: string; status: "verified" | "missing" | "damaged"; comment: string };

export default function Audit() {
  const [department, setDepartment] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [canAuditAdmin, setCanAuditAdmin] = useState<boolean>(false);
  const [auditOn, setAuditOn] = useState<boolean>(false);
  const [auditFreq, setAuditFreq] = useState<1 | 3 | 6>(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [progress, setProgress] = useState<{ total: number; submitted: number } | null>(null);
  const [summary, setSummary] = useState<Record<string, { verified: number; missing: number; damaged: number }>>({});
  const [adminDept, setAdminDept] = useState<string>("");
  const [latestReport, setLatestReport] = useState<AuditReport | null>(null);
  const [viewReportId, setViewReportId] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<AuditReport[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessionReports, setSessionReports] = useState<AuditReport[]>([]);
  const [loadingSessionReports, setLoadingSessionReports] = useState<boolean>(false);
  const [assignmentStatus, setAssignmentStatus] = useState<"pending" | "submitted" | "">("");
  const [reportReviews, setReportReviews] = useState<AuditReview[]>([]);
  const [detailDept, setDetailDept] = useState<string>("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [allowedPropertyIds, setAllowedPropertyIds] = useState<Set<string> | null>(null);
  // When viewing a specific report (including history), resolve its session's property id for display
  const [viewPropertyId, setViewPropertyId] = useState<string>("");
  // Auditor Incharge for selected property (read-only in this page)
  const [inchargeUserId, setInchargeUserId] = useState<string>("");
  const [inchargeUserName, setInchargeUserName] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  // Per-department totals to compute progress rings
  const [deptTotals, setDeptTotals] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const lastRefreshKey = useRef(0);
  const hasLoadedAuditRef = useRef(false);
  // Scan UI state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<"verified" | "damaged">("verified");
  const [scanAssetId, setScanAssetId] = useState<string>("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanAssetName, setScanAssetName] = useState<string>("");
  const [myScans, setMyScans] = useState<Array<{ id: string; asset_id: string; status: "verified"|"damaged"; scanned_at: string }>>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [scanComment, setScanComment] = useState("");

  const stopScan = () => {
    try { (readerRef.current as any)?.reset?.(); } catch {}
    // stop any active stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanActive(false);
  };

  const resolveAssetId = (text: string): string | null => {
    try {
      if (!text) return null;
      if (/^https?:\/\//i.test(text)) {
        const url = new URL(text);
        const m = url.pathname.match(/\/assets\/([^/?#]+)/i);
        return m ? decodeURIComponent(m[1]) : null;
      }
      if (/^\//.test(text)) {
        const m = text.match(/\/assets\/([^/?#]+)/i);
        return m ? decodeURIComponent(m[1]) : null;
      }
      // Plain asset id fallback
      return text.trim();
    } catch { return null; }
  };

  const setScannedAsset = async (id: string) => {
    try {
      setScanAssetId(id);
      // Try local rows first
      const local = rows.find(r => String(r.id) === String(id));
      if (local?.name) { setScanAssetName(local.name); return; }
      // Fallback: fetch from API
      const asset = await getAssetById(String(id));
      setScanAssetName(asset?.name || "");
    } catch {
      setScanAssetName("");
    }
  };

  const startScan = async () => {
    setScanAssetId("");
    setScanActive(false);
    try {
      // Ensure getUserMedia polyfill for older browsers (Safari)
      try {
        const navAny = navigator as any;
        if (!navigator.mediaDevices) (navigator as any).mediaDevices = {};
        if (!navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia = (constraints: MediaStreamConstraints) => {
            const getUserMedia = navAny.getUserMedia || navAny.webkitGetUserMedia || navAny.mozGetUserMedia;
            if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia not supported'));
            }
            return new Promise((resolve, reject) => getUserMedia.call(navigator, constraints, resolve, reject));
          };
        }
      } catch {}

      const isSecure = (window as any).isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
      if (!isSecure) {
        toast.info('Camera requires HTTPS or localhost. Please open over https://');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera API not available on this device/browser');
        return;
      }
      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();
      try {
        await readerRef.current.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current!,
          (result, err) => {
            if (result) {
              const text = result.getText();
              const id = resolveAssetId(text || '');
              if (id) { setScannedAsset(String(id)); stopScan(); }
            }
          }
        );
      } catch (e: any) {
        // Fallback: try specific device (first camera)
        try {
          const devices = await (BrowserMultiFormatReader as any).listVideoInputDevices?.() || [];
          const deviceId = devices[0]?.deviceId;
          if (!deviceId) throw e;
          await readerRef.current.decodeFromVideoDevice(
            deviceId,
            videoRef.current!,
            (result, err) => {
              if (result) {
                const text = result.getText();
                const id = resolveAssetId(text || '');
                if (id) { setScannedAsset(String(id)); stopScan(); }
              }
            }
          );
        } catch (err: any) {
          const name = err?.name || '';
          const msg = name === 'NotAllowedError'
            ? 'Camera permission denied. Allow access in browser settings.'
            : (name === 'NotFoundError' ? 'No camera found on this device.' : (err?.message || 'Failed to start camera'));
          toast.error(msg);
          return;
        }
      }
      setScanActive(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to start camera');
    }
  };

  // Build and print a PDF with all department submissions for a session
  async function exportAuditSessionPdf(sessionId: string) {
    try {
      if (!sessionId) return;
      const reviews = await listReviewsForSession(sessionId).catch(() => [] as AuditReview[]);
      if (!reviews.length) { toast.info('No data to export for this session'); return; }
      let assets: Asset[] = [];
      try { assets = await listAssets(); } catch {}
      const aById = new Map<string, Asset>((assets || []).map(a => [String(a.id), a]));
      // Group by department
      const byDept = new Map<string, AuditReview[]>();
      for (const r of reviews) {
        const d = (r.department || '').toString() || 'Unknown';
        if (!byDept.has(d)) byDept.set(d, []);
        byDept.get(d)!.push(r);
      }
      // Build HTML
      const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const normalizedBase = (base || '').replace(/\/$/, '');
      const logoSrc = `${normalizedBase}/favicon.png`;
      const parts: string[] = [];
      // Summary across departments
      const totals = reviews.reduce((acc: Record<string, number>, r) => { const k = String(r.status||'').toLowerCase(); acc[k] = (acc[k]||0)+1; return acc; }, {});
      parts.push(`<div class="summary"><span class="chip ok">Verified: ${totals['verified']||0}</span><span class="chip warn">Damaged: ${totals['damaged']||0}</span><span class="chip err">Missing: ${totals['missing']||0}</span></div>`);
      for (const [dept, rows] of byDept.entries()) {
        parts.push(`<h2 class="section">Department: ${dept}</h2>`);
        const cols = ['asset_id','asset_name','property','status','comment','updated_at'];
        const thead = `<tr>${cols.map(c=>`<th>${c.replace('_',' ').toUpperCase()}</th>`).join('')}</tr>`;
        const tbody = rows.map(r => {
          const a = aById.get(String(r.asset_id));
          const name = a?.name || '';
          const prop = (a as any)?.property || '';
          const status = String(r.status || '').toLowerCase();
          const bg = status === 'missing' ? '#fee2e2' : (status === 'damaged' ? '#fef3c7' : 'transparent');
          const fw = status === 'missing' ? '600' : 'normal';
          return `<tr style="background:${bg};font-weight:${fw};"><td class="mono">${r.asset_id}</td><td>${name}</td><td>${prop}</td><td>${r.status}</td><td>${r.comment||''}</td><td>${r.updated_at||''}</td></tr>`;
        }).join('');
        parts.push(`<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
      }
  const sessMeta = await getSessionById(sessionId);
  const friendly = formatAuditSessionName(sessMeta || { id: sessionId } as any);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Audit ${friendly || sessionId}</title>
      <style>@page{size:A4;margin:14mm} body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#111} h1{font-size:18px;margin:0 0 8px} .brand{display:flex;align-items:center;gap:10px;margin-bottom:6px} .brand img{height:28px;width:28px;object-fit:contain} .meta{color:#666;font-size:12px;margin-bottom:8px} .summary{display:flex;gap:8px;margin:8px 0 12px} .chip{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,0.08)} .chip.ok{background:#ecfdf5;color:#065f46;border-color:#a7f3d0} .chip.warn{background:#fffbeb;color:#92400e;border-color:#fde68a} .chip.err{background:#fef2f2;color:#991b1b;border-color:#fecaca} .section{margin:16px 0 8px;font-size:15px} table{border-collapse:collapse;width:100%;font-size:12px} th,td{padding:8px;border-bottom:1px solid #eee;text-align:left} .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:11px}</style>
      </head><body>
  <div class="brand"><img src='${logoSrc}' onerror="this.src='/favicon.ico'" alt='logo' /><h1>Audit Review — ${friendly || sessionId}</h1></div>
      <div class="meta">Generated at ${new Date().toLocaleString()}</div>
      ${parts.join('')}
      </body></html>`;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      doc?.open(); doc?.write(html); doc?.close();
      const trigger = () => { try { iframe.contentWindow?.focus(); setTimeout(() => iframe.contentWindow?.print(), 50); } finally { setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000); } };
      setTimeout(trigger, 200);
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const forceReload = refreshKey !== 0 && refreshKey !== lastRefreshKey.current;
        lastRefreshKey.current = refreshKey;
        if (!hasLoadedAuditRef.current || forceReload) {
          setLoading(true);
        }
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        const user = raw ? JSON.parse(raw) : null;
        const roleName = (user?.role || '').toLowerCase();
        setRole(roleName);
        const isAdminUser = roleName === 'admin';
        let allowedProps: Set<string> | null = null;
        try {
          let uid = getCurrentUserId();
          if (!uid) {
            try { const rawU = localStorage.getItem('auth_user'); const au = rawU ? JSON.parse(rawU) : null; uid = au?.id ? String(au.id) : ''; } catch {}
          }
          const allowed = uid ? await canUserEdit(uid, 'audit') : null;
          setCanAuditAdmin(Boolean(allowed));
        } catch { setCanAuditAdmin(false); }
        if (!isAdminUser) {
          try {
            const allowedRaw = await getAccessiblePropertyIdsForCurrentUser();
            const normalized = new Set<string>();
            if (allowedRaw) {
              for (const value of allowedRaw) normalized.add(String(value));
            }
            allowedProps = normalized;
            setAllowedPropertyIds(normalized);
          } catch {
            const empty = new Set<string>();
            allowedProps = empty;
            setAllowedPropertyIds(empty);
          }
        } else {
          setAllowedPropertyIds(null);
        }
        const dept = user?.department || "";
        setDepartment(dept);
        const active = await isAuditActive();
        setAuditOn(active);
        const deps = await listDepartments();
        setDepartments(deps);
        try {
          const props = await listProperties();
          // Property-scope restriction: non-admins see only properties where they are incharge
          let filtered = props as Property[];
          try {
            let uid = getCurrentUserId();
            if (!uid) {
              try { const rawU = localStorage.getItem('auth_user'); const au = rawU ? JSON.parse(rawU) : null; uid = au?.id ? String(au.id) : ''; } catch {}
            }
            setMyId(uid || "");
            if (!isAdminUser) {
              if (uid) {
                const mine = await listAuditInchargeForUser(uid, (user?.email || undefined));
                // if user has any incharge properties, allow admin controls implicitly
                try { setCanAuditAdmin((prev) => prev || (mine && mine.length > 0)); } catch {}
                filtered = (props as Property[]).filter(p => {
                  const idStr = String(p.id);
                  const matchesIncharge = mine.includes(idStr) || mine.includes(idStr.toLowerCase());
                  const hasAccess = !allowedProps ? false : allowedProps.has(idStr);
                  return matchesIncharge && hasAccess;
                });
              } else {
                filtered = [];
              }
            }
          } catch {}
          setProperties(filtered);
        } catch {}
        // Load incharge for selected property (if any)
        try {
          const pid = localStorage.getItem('active_audit_property_id') || '';
          if (pid) {
            const ai = await fetchAuditIncharge(String(pid));
            if (ai) { setInchargeUserId(ai.user_id); setInchargeUserName(ai.user_name || ""); }
            else { setInchargeUserId(""); setInchargeUserName(""); }
          }
        } catch { setInchargeUserId(""); setInchargeUserName(""); }
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
            // Compute per-department totals for progress rings
            try {
              const totals: Record<string, number> = {};
              for (const d of deps) {
                try {
                  const assets = await listDepartmentAssets(d.name, (pid || undefined));
                  totals[d.name] = (assets || []).length;
                } catch {
                  totals[d.name] = 0;
                }
              }
              setDeptTotals(totals);
            } catch {}
            // Also load sessions and recent reports even while active
            try {
              let rec = await listRecentAuditReports(20);
              if (!isAdminUser) {
                if (allowedProps && allowedProps.size) {
                  const filtered: typeof rec = [] as any;
                  for (const r of rec) {
                    try {
                      const sess = await getSessionById(r.session_id);
                      const pidValue = (sess as any)?.property_id;
                      if (pidValue && allowedProps.has(String(pidValue))) filtered.push(r);
                    } catch {}
                  }
                  rec = filtered;
                } else {
                  rec = [] as any;
                }
              }
              setRecentReports(rec);
              try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
              if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
              const sessList = await listSessions(200);
              if (!isAdminUser) {
                const scoped = (sessList || []).filter((s: any) => {
                  const pidValue = s?.property_id;
                  if (!pidValue) return false;
                  return Boolean(allowedProps && allowedProps.has(String(pidValue)));
                });
                setSessions(scoped);
              } else {
                setSessions(sessList);
              }
            } catch {}
          }
        } else {
          setSessionId("");
          setRows([]);
          setProgress(null);
          setSummary({});
          setDeptTotals({});
          // Load recent reports across sessions (persisted history)
          try {
            let rec = await listRecentAuditReports(20);
            if (!isAdminUser) {
              if (allowedProps && allowedProps.size) {
                const filtered: typeof rec = [] as any;
                for (const r of rec) {
                  try {
                    const sessInfo = await getSessionById(r.session_id);
                    const pidValue = (sessInfo as any)?.property_id;
                    if (pidValue && allowedProps.has(String(pidValue))) filtered.push(r);
                  } catch {}
                }
                rec = filtered;
              } else {
                rec = [] as any;
              }
            }
            setRecentReports(rec);
            try { localStorage.setItem('has_audit_reports', rec.length > 0 ? '1' : '0'); } catch {}
            // If no local latest picked, show the most recent one
            if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
            const sessList = await listSessions(200);
            if (!isAdminUser) {
              const scoped = (sessList || []).filter((s: any) => {
                const pidValue = s?.property_id;
                if (!pidValue) return false;
                return Boolean(allowedProps && allowedProps.has(String(pidValue)));
              });
              setSessions(scoped);
            } else {
              setSessions(sessList);
            }
          } catch {}
            // Fallback: if we have a locally tracked active session ID, try to restore it
            try {
              const cachedSid = localStorage.getItem('active_audit_session_id');
              if (cachedSid) {
                const sess = await getSessionById(cachedSid);
                if (sess && sess.is_active) {
                  const sessionPidRaw = (sess as any)?.property_id;
                  if (!isAdminUser) {
                    const pidCandidate = sessionPidRaw ? String(sessionPidRaw) : "";
                    if (!pidCandidate || !(allowedProps && allowedProps.has(pidCandidate))) {
                      try { localStorage.removeItem('active_audit_session_id'); } catch {}
                      try { localStorage.removeItem('active_audit_property_id'); } catch {}
                      return;
                    }
                  }
                  setAuditOn(true);
                  setSessionId(sess.id);
                  const pid = sessionPidRaw || localStorage.getItem('active_audit_property_id') || '';
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
                  try {
                    const totals: Record<string, number> = {};
                    for (const d of deps) {
                      try {
                        const assets = await listDepartmentAssets(d.name, (pid || undefined));
                        totals[d.name] = (assets || []).length;
                      } catch {
                        totals[d.name] = 0;
                      }
                    }
                    setDeptTotals(totals);
                  } catch {}
                }
              }
            } catch (e) { console.error(e); }
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load audit items");
      } finally {
        hasLoadedAuditRef.current = true;
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const deptLower = (role === "admin" ? adminDept : department).toLowerCase();
    const propertyLower = String(selectedPropertyId || "").toLowerCase();
    const userLower = (myId || "").toLowerCase();
    const matchesRecord = (record: any) => {
      if (!record) return false;
      if (deptLower) {
        const recDept = String(record.department || record.dept || record.department_name || "").toLowerCase();
        if (recDept && recDept !== deptLower) {
          return false;
        }
      }
      if (propertyLower) {
        const recProp = String(record.property_id || record.propertyId || record.property || "").toLowerCase();
        if (recProp && recProp !== propertyLower) {
          return false;
        }
      }
      if (userLower) {
        const assignedTo = String(
          record.assigned_to || record.user_id || record.reviewer_id || record.updated_by || record.created_by || ""
        ).toLowerCase();
        if (assignedTo && assignedTo === userLower) {
          return true;
        }
      }
      return true;
    };
    const shouldRefresh = (payload: any) => matchesRecord(payload?.new) || matchesRecord(payload?.old);
    const channel = supabase
      .channel(`audit_page_updates_${userLower || "viewer"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_sessions" }, (payload) => {
        if (shouldRefresh(payload)) setRefreshKey((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_assignments" }, (payload) => {
        if (shouldRefresh(payload)) setRefreshKey((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_reviews" }, (payload) => {
        if (shouldRefresh(payload)) setRefreshKey((prev) => prev + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_reports" }, (payload) => {
        if (shouldRefresh(payload)) setRefreshKey((prev) => prev + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, department, adminDept, selectedPropertyId, myId]);

  // Load my scan history when session becomes available
  useEffect(() => {
    (async () => {
      try { if (!sessionId) { setMyScans([]); return; } const rows = await listMyScansForSession(sessionId); setMyScans(rows.map(r => ({ id: r.id, asset_id: r.asset_id, status: r.status, scanned_at: r.scanned_at }))); } catch { setMyScans([]); }
    })();
  }, [sessionId]);

  // When selected property changes, refresh incharge info and persist selection
  useEffect(() => {
    (async () => {
      const pid = String(selectedPropertyId || '');
      try { if (pid) localStorage.setItem('active_audit_property_id', pid); } catch {}
      if (!pid) { setInchargeUserId(''); setInchargeUserName(''); return; }
      try {
        const ai = await fetchAuditIncharge(pid);
        if (ai) { setInchargeUserId(ai.user_id); setInchargeUserName(ai.user_name || ""); }
        else { setInchargeUserId(''); setInchargeUserName(''); }
      } catch { setInchargeUserId(''); setInchargeUserName(''); }
    })();
  }, [selectedPropertyId]);

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
  }, [adminDept, role, sessionId, selectedPropertyId]);

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

  const isAdmin = role === "admin";
  const selectedDept = isAdmin ? adminDept : department;
  const canEditRows = !(assignmentStatus === "submitted" && !isAdmin);
  const canScanAssets = auditOn && canEditRows;
  const canManageSession = Boolean(isAdmin || canAuditAdmin || (inchargeUserId && myId && String(myId) === String(inchargeUserId)));

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => String(p.id) === String(selectedPropertyId)) || null;
  }, [properties, selectedPropertyId]);

  const propertyLabel = selectedProperty ? `${selectedProperty.name} (${selectedProperty.id})` : selectedPropertyId || "";

  const statusCounts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      { verified: 0, missing: 0, damaged: 0 } as Record<"verified" | "missing" | "damaged", number>
    );
  }, [rows]);

  const summaryEntries = useMemo(() => Object.entries(summary), [summary]);

  const sessionStatus = auditOn ? "active" : sessionId ? "paused" : "idle";
  const sessionStatusLabel = sessionStatus === "active" ? "Active" : sessionStatus === "paused" ? "Paused" : "Idle";
  const sessionBadgeVariant = sessionStatus === "active" ? ("default" as const) : sessionStatus === "paused" ? ("secondary" as const) : ("outline" as const);
  const progressText = progress ? `${progress.submitted} of ${progress.total} departments submitted` : "No active session";
  const progressPercent = progress && progress.total ? Math.round((progress.submitted / progress.total) * 100) : 0;

  const ensureAllowedPropertyIds = useCallback(async () => {
    if (isAdmin) return null;
    if (allowedPropertyIds) return allowedPropertyIds;
    try {
      const allowedRaw = await getAccessiblePropertyIdsForCurrentUser();
      const normalized = new Set<string>();
      if (allowedRaw) {
        for (const value of allowedRaw) normalized.add(String(value));
      }
      setAllowedPropertyIds(normalized);
      return normalized;
    } catch {
      const empty = new Set<string>();
      setAllowedPropertyIds(empty);
      return empty;
    }
  }, [isAdmin, allowedPropertyIds]);

  const scrollToTop = () => {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  };

  const refreshRecentReports = useCallback(async () => {
    try {
      let rec = await listRecentAuditReports(20);
      if (!isAdmin) {
        const allowed = await ensureAllowedPropertyIds();
        if (allowed && allowed.size) {
          const filtered: AuditReport[] = [];
          for (const r of rec) {
            try {
              const sess = await getSessionById(r.session_id);
              const pid = (sess as any)?.property_id;
              if (pid && allowed.has(String(pid))) filtered.push(r);
            } catch {}
          }
          rec = filtered;
        } else {
          rec = [];
        }
      }
      setRecentReports(rec);
      try { localStorage.setItem("has_audit_reports", rec.length > 0 ? "1" : "0"); } catch {}
      if (!latestReport && rec.length > 0) setLatestReport(rec[0]);
      return rec;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [ensureAllowedPropertyIds, isAdmin, latestReport]);

  const refreshSessions = useCallback(async () => {
    try {
      const sessList = await listSessions(200);
      if (!isAdmin) {
        const allowed = await ensureAllowedPropertyIds();
        const scoped = (sessList || []).filter((s: any) => {
          const pid = s?.property_id;
          if (!pid) return false;
          return Boolean(allowed && allowed.has(String(pid)));
        });
        setSessions(scoped);
      } else {
        setSessions(sessList || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [ensureAllowedPropertyIds, isAdmin]);

  const handleStartAudit = async () => {
    try {
      if (!selectedPropertyId) {
        toast.error("Please select a property for this audit");
        return;
      }
      const raw = localStorage.getItem("auth_user");
      const au = raw ? JSON.parse(raw) : null;
      const created = await startAuditSession(auditFreq, au?.name || au?.email || au?.id || null, selectedPropertyId);
      const sid = created?.id || "";
      if (!sid) {
        toast.error("Failed to start audit session");
        return;
      }
      setAuditOn(true);
      setSessionId(sid);
      try { localStorage.setItem("active_audit_session_id", sid); } catch {}
      try { localStorage.setItem("active_audit_property_id", String(selectedPropertyId)); } catch {}
      try {
        const prog = await getProgress(sid, departments.map((d) => d.name));
        setProgress(prog);
      } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Failed to start audit session");
    }
  };

  const handleStopAudit = async () => {
    if (!sessionId) {
      toast.info("No active session to stop");
      return;
    }
    const sid = sessionId;
    try {
      await endAuditSession();
      setAuditOn(false);
      setSessionId("");
      setProgress(null);
      setSummary({});
      setDeptTotals({});
      try { localStorage.removeItem("active_audit_session_id"); } catch {}
      try { localStorage.removeItem("active_audit_property_id"); } catch {}
      try {
        const existing = await listAuditReports(sid);
        if ((existing?.length || 0) >= 2) {
          const latest = [...(existing || [])].sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];
          if (latest) {
            setLatestReport(latest);
            setViewReportId(latest.id);
            toast.info("This session already has 2 reports. Showing the latest report.");
            scrollToTop();
          }
        } else {
          const raw = localStorage.getItem("auth_user");
          const au = raw ? JSON.parse(raw) : null;
          const rep = await createAuditReport(sid, au?.name || au?.email || au?.id || null);
          setLatestReport(rep);
          setViewReportId(rep?.id || null);
          toast.message("Audit ended. A report was generated.", { description: "Scroll to Reports to review details." });
          scrollToTop();
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to create audit report");
      }
      await refreshRecentReports();
      await refreshSessions();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to stop audit session");
    }
  };

  const handleResumeAudit = async () => {
    try {
      const sess = await getActiveSession();
      if (!sess || !sess.id) {
        toast.info("No active session to resume");
        return;
      }
      setAuditOn(true);
      setSessionId(sess.id);
      const pid = (sess as any)?.property_id || "";
      if (pid) {
        setSelectedPropertyId(String(pid));
        try { localStorage.setItem("active_audit_property_id", String(pid)); } catch {}
      }
      try { localStorage.setItem("active_audit_session_id", String(sess.id)); } catch {}
      try {
        const prog = await getProgress(sess.id, departments.map((d) => d.name));
        setProgress(prog);
      } catch {}
    } catch (e) {
      console.error(e);
      toast.error("Failed to resume audit session");
    }
  };

  const handleExportCsv = async () => {
    try {
      if (!sessionId) {
        toast.info("No active session");
        return;
      }
      const data = await listReviewsForSession(sessionId);
      const headers = ["session_id", "department", "asset_id", "status", "comment", "updated_at"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        headers.join(","),
        ...data.map((r) => [r.session_id, r.department, r.asset_id, r.status, r.comment || "", r.updated_at || ""].map(esc).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const pid = (viewPropertyId || selectedPropertyId || "").toString();
      const propSlug = pid ? `-${pid}` : "";
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-reviews-${sessionId || "latest"}${propSlug}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    }
  };

  const handleOpenScanner = () => {
    setScanOpen(true);
    setTimeout(() => {
      try { startScan(); } catch {}
    }, 200);
  };

  const handleViewReport = async (reportId: string) => {
    try {
      const rep = await getAuditReport(reportId);
      if (!rep) return;
      let pidValue = "";
      try {
        const sess = await getSessionById(rep.session_id);
        const rawPid = (sess as any)?.property_id;
        pidValue = rawPid ? String(rawPid) : "";
      } catch {}
      if (!isAdmin) {
        const allowed = await ensureAllowedPropertyIds();
        if (!pidValue || !(allowed && allowed.has(pidValue))) {
          toast.error("You do not have access to this report.");
          return;
        }
      }
      setLatestReport(rep);
      setViewReportId(reportId);
      setViewPropertyId(pidValue);
      scrollToTop();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateReportForSession = async (sid: string) => {
    if (!sid) return;
    try {
      let sessionMeta: AuditSession | null = null;
      try {
        sessionMeta = sessions.find((s) => s.id === sid) || (await getSessionById(sid));
      } catch {
        sessionMeta = await getSessionById(sid);
      }
      const sessionPid = sessionMeta ? (sessionMeta as any)?.property_id : undefined;
      if (!isAdmin) {
        const allowed = await ensureAllowedPropertyIds();
        if (!sessionPid || !(allowed && allowed.has(String(sessionPid)))) {
          toast.error("You do not have access to this session.");
          return;
        }
      }
      const existing = await listAuditReports(sid);
      if ((existing?.length || 0) >= 2) {
        const latest = [...(existing || [])].sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];
        if (latest) {
          setLatestReport(latest);
          setViewReportId(latest.id);
          toast.info("This session already has 2 reports. Showing the latest report.");
          scrollToTop();
        }
        return;
      }
      const raw = localStorage.getItem("auth_user");
      const au = raw ? JSON.parse(raw) : null;
      const rep = await createAuditReport(sid, au?.name || au?.email || au?.id || null);
      setLatestReport(rep);
      setViewReportId(rep?.id || null);
      if (sid === selectedSessionId) {
        try {
          const reps = await listAuditReports(sid);
          setSessionReports(reps || []);
        } catch {}
      }
      await refreshRecentReports();
      toast.success("Report created");
      scrollToTop();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create report");
    }
  };

  const handleSelectSession = async (sid: string) => {
    if (!sid) {
      setSelectedSessionId("");
      setSessionReports([]);
      return;
    }
    if (!isAdmin) {
      const allowed = await ensureAllowedPropertyIds();
      const targetSession = sessions.find((s) => s.id === sid) || (await getSessionById(sid));
      const pidValue = targetSession ? (targetSession as any)?.property_id : undefined;
      if (!pidValue || !(allowed && allowed.has(String(pidValue)))) {
        toast.error("You do not have access to this session.");
        return;
      }
    }
    setSelectedSessionId(sid);
    setLoadingSessionReports(true);
    try {
      const reps = await listAuditReports(sid);
      setSessionReports(reps || []);
      if (reps && reps.length) {
        setLatestReport(reps[0]);
        setViewReportId(reps[0].id);
        scrollToTop();
      }
    } catch (e) {
      console.error(e);
      setSessionReports([]);
    } finally {
      setLoadingSessionReports(false);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {sessionId && (
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          Export CSV
        </Button>
      )}
      {canScanAssets && (
        <Button size="sm" className="gap-2" onClick={handleOpenScanner}>
          <QrCode className="h-4 w-4" />
          Scan Asset
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-4 print:hidden">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Audit" }]} />
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
          <PageHeader
            icon={ClipboardCheck}
            title="Inventory Audit"
            description="Verify assets in your department and submit results"
            actions={headerActions}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Session Overview</CardTitle>
                  <CardDescription>Scope and ownership of the current audit.</CardDescription>
                </div>
                <Badge variant={sessionBadgeVariant}>{sessionStatusLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Property</Label>
                {canManageSession ? (
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={auditOn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {selectedProperty?.name || "—"}
                  </div>
                )}
                {auditOn && canManageSession && (
                  <p className="text-xs text-muted-foreground">Property cannot be changed while the session is active.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Auditor in charge</Label>
                  <div className="mt-1 text-sm font-medium text-foreground">{inchargeUserName || inchargeUserId || "—"}</div>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit frequency</Label>
                  {canManageSession ? (
                    <Select value={String(auditFreq)} onValueChange={(v) => setAuditFreq(Number(v) as 1 | 3 | 6)} disabled={auditOn}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Every 1 month</SelectItem>
                        <SelectItem value="3">Every 3 months</SelectItem>
                        <SelectItem value="6">Every 6 months</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {auditFreq === 1 ? "Every 1 month" : auditFreq === 3 ? "Every 3 months" : "Every 6 months"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Department submissions</span>
                  <span className="font-medium">{progress ? `${progress.submitted}/${progress.total}` : "—"}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progressText}</p>
              </div>

              {canManageSession && (
                <div className="flex flex-wrap items-center gap-2">
                  {auditOn ? (
                    <Button variant="destructive" className="gap-2" onClick={handleStopAudit}>
                      Stop Audit
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" className="gap-2" onClick={handleResumeAudit}>
                        Resume
                      </Button>
                      <Button className="gap-2" onClick={handleStartAudit}>
                        Start Audit
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department Snapshot</CardTitle>
              <CardDescription>
                {selectedDept ? `Asset status for ${selectedDept}` : "Asset status for your department"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Assets</div>
                  <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Verified</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-600">{statusCounts.verified}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Missing</div>
                  <div className="mt-1 text-2xl font-semibold text-destructive">{statusCounts.missing}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Damaged</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-500">{statusCounts.damaged}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Assignment</span>
                <Badge variant={assignmentStatus === "submitted" ? "secondary" : "outline"}>
                  {assignmentStatus ? assignmentStatus.charAt(0).toUpperCase() + assignmentStatus.slice(1) : "Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {summaryEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Department Progress</CardTitle>
                <CardDescription>Overview of submissions across departments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {summaryEntries.map(([dept, s]) => {
                    const reviewed = (s.verified || 0) + (s.missing || 0) + (s.damaged || 0);
                    const total = Math.max(0, Number(deptTotals[dept] || 0));
                    const pct = total > 0 ? Math.min(100, Math.round((reviewed / total) * 100)) : 0;
                    const radius = 32;
                    const circumference = 2 * Math.PI * radius;
                    const dash = (pct / 100) * circumference;
                    return (
                      <Card key={dept} className="border-dashed">
                        <CardContent className="flex items-center gap-4 p-4">
                          <svg width="80" height="80" className="shrink-0">
                            <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              fill="none"
                              stroke="#0ea5e9"
                              strokeWidth="8"
                              strokeDasharray={`${dash} ${circumference - dash}`}
                              strokeLinecap="round"
                              transform="rotate(-90 40 40)"
                            />
                            <text x="40" y="44" textAnchor="middle" fontSize="14" className="fill-foreground">
                              {pct}%
                            </text>
                          </svg>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{dept}</div>
                            <div className="text-xs text-muted-foreground">{reviewed} of {total || "—"} reviewed</div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="overflow-auto">
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
                      {summaryEntries.map(([dept, s]) => (
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
              </CardContent>
            </Card>
          )}

          {myScans.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>My Recent Scans</CardTitle>
                <CardDescription>Log of assets verified via QR scanning.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myScans.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs text-muted-foreground">{new Date(s.scanned_at).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">{s.asset_id}</TableCell>
                          <TableCell className={s.status === "damaged" ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
                            {s.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Department Review</CardTitle>
                  <CardDescription>
                    {isAdmin ? "Select a department to review and update asset statuses." : "Mark each asset and add optional notes."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin ? (
                    <Select value={adminDept} onValueChange={setAdminDept}>
                      <SelectTrigger className="min-w-[200px]">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id || d.name} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{department || "—"}</Badge>
                  )}
                  {canScanAssets && (
                    <Button size="sm" variant="secondary" className="gap-2" onClick={handleOpenScanner}>
                      <QrCode className="h-4 w-4" />
                      Scan
                    </Button>
                  )}
                </div>
              </div>
              {(() => {
                const pid = viewPropertyId || selectedPropertyId;
                if (!pid) return null;
                const p = properties.find((pp) => String(pp.id) === String(pid));
                return <p className="text-xs text-muted-foreground mt-2">Property: {p ? `${p.name} (${p.id})` : pid}</p>;
              })()}
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets found for this department.</p>
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
                            <Select
                              value={r.status}
                              onValueChange={(v: any) =>
                                setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, status: v } : x)))
                              }
                              disabled={!canEditRows}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="missing">Missing</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Optional notes"
                              value={r.comment}
                              onChange={(e) =>
                                setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))
                              }
                              disabled={!canEditRows}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {canEditRows
                  ? "Save drafts as you go. Submit when the department review is complete."
                  : "This review has been submitted. Only administrators can make further changes."}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={saveProgress} disabled={!rows.length || (!canEditRows && !isAdmin)}>
                  Save Draft
                </Button>
                <Button onClick={submit} disabled={submitting || !canEditRows || !rows.length}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {(latestReport || recentReports.length > 0) && (
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Reports &amp; Insights</CardTitle>
                    <CardDescription>Visualise outcomes and revisit historical audits.</CardDescription>
                  </div>
                  {latestReport && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportAuditSessionPdf(latestReport.session_id)}>
                        Export PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        Print
                      </Button>
                    </div>
                  )}
                </div>
                {latestReport ? (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Latest report</span>{" "}
                    {new Date(latestReport.generated_at).toLocaleString()}
                    {propertyLabel ? <span className="ml-1">• Property: {propertyLabel}</span> : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Generate a report to unlock insights.</p>
                )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="departments">Departments</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="space-y-4">
                    {latestReport ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Card className="border-dashed">
                            <CardHeader>
                              <CardTitle className="text-base">Overall Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {(() => {
                                const payload = latestReport?.payload || {};
                                const totals = payload.totals || { verified: 0, missing: 0, damaged: 0 };
                                const data = [
                                  {
                                    name: "All",
                                    Verified: Number(totals.verified || 0),
                                    Missing: Number(totals.missing || 0),
                                    Damaged: Number(totals.damaged || 0),
                                  },
                                ];
                                return (
                                  <ChartContainer
                                    config={{
                                      Verified: { color: "hsl(142, 71%, 45%)" },
                                      Missing: { color: "hsl(339, 90%, 51%)" },
                                      Damaged: { color: "hsl(31, 97%, 55%)" },
                                    }}
                                  >
                                    <BarChart data={data}>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                      <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                                      <Bar dataKey="Verified" radius={[6, 6, 0, 0]} fill="var(--color-Verified)" />
                                      <Bar dataKey="Missing" radius={[6, 6, 0, 0]} fill="var(--color-Missing)" />
                                      <Bar dataKey="Damaged" radius={[6, 6, 0, 0]} fill="var(--color-Damaged)" />
                                      <ChartLegend content={<ChartLegendContent />} />
                                    </BarChart>
                                  </ChartContainer>
                                );
                              })()}
                            </CardContent>
                          </Card>
                          <Card className="border-dashed">
                            <CardHeader>
                              <CardTitle className="text-base">By Department</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {(() => {
                                const payload = latestReport?.payload || {};
                                const byDept = (payload.byDepartment || []) as Array<{
                                  department: string;
                                  verified: number;
                                  missing: number;
                                  damaged: number;
                                }>;
                                const data = byDept.map((d) => ({
                                  name: d.department,
                                  Verified: d.verified,
                                  Missing: d.missing,
                                  Damaged: d.damaged,
                                }));
                                return (
                                  <ChartContainer
                                    config={{
                                      Verified: { color: "hsl(142, 71%, 45%)" },
                                      Missing: { color: "hsl(339, 90%, 51%)" },
                                      Damaged: { color: "hsl(31, 97%, 55%)" },
                                    }}
                                  >
                                    <BarChart data={data}>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                                      <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} height={60} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                      <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                                      <Bar dataKey="Verified" stackId="a" fill="var(--color-Verified)" radius={[0, 0, 4, 4]} />
                                      <Bar dataKey="Missing" stackId="a" fill="var(--color-Missing)" radius={[0, 0, 0, 0]} />
                                      <Bar dataKey="Damaged" stackId="a" fill="var(--color-Damaged)" radius={[4, 4, 0, 0]} />
                                      <ChartLegend content={<ChartLegendContent />} />
                                    </BarChart>
                                  </ChartContainer>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        </div>
                        {latestReport?.payload?.contributors && (
                          <div>
                            <Label>Contributors</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {latestReport.payload.contributors.map((c: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="gap-1">
                                  {c.department} • {c.status === "submitted" ? "Submitted" : "Pending"}
                                  {c.submitted_at ? ` • ${c.submitted_at}` : ""}
                                  {c.submitted_by ? ` • ${c.submitted_by}` : ""}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Generate a report to unlock insights.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="departments" className="space-y-4">
                    {latestReport ? (
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
                                <TableHead className="w-32">Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(latestReport?.payload?.byDepartment || []).map((d: any) => (
                                <TableRow key={d.department}>
                                  <TableCell>{d.department}</TableCell>
                                  <TableCell>{d.verified}</TableCell>
                                  <TableCell>{d.missing}</TableCell>
                                  <TableCell>{d.damaged}</TableCell>
                                  <TableCell>{d.total}</TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="outline" onClick={() => setDetailDept(d.department)}>
                                      View
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {detailDept && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Details • {detailDept}</Label>
                              <Button size="sm" variant="ghost" onClick={() => setDetailDept("")}>
                                Clear
                              </Button>
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
                                  {reportReviews
                                    .filter((r) => r.department === detailDept)
                                    .map((r, i) => (
                                      <TableRow key={`${r.asset_id}-${i}`}>
                                        <TableCell className="font-mono text-xs">{r.asset_id}</TableCell>
                                        <TableCell className={r.status === "missing" ? "text-destructive" : r.status === "damaged" ? "text-amber-500" : ""}>
                                          {r.status}
                                        </TableCell>
                                        <TableCell>{r.comment || ""}</TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Generate a report to view department breakdown.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="history" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Session</Label>
                        <Select value={selectedSessionId} onValueChange={handleSelectSession}>
                          <SelectTrigger className="min-w-[220px]">
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                          <SelectContent>
                            {sessions.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {formatAuditSessionName(s)}
                                {s.is_active ? " (Active)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {canManageSession && (
                        <div className="flex flex-wrap items-center gap-2">
                          {sessionId && (
                            <Button size="sm" onClick={() => handleGenerateReportForSession(sessionId)}>
                              Generate Report (Active)
                            </Button>
                          )}
                          {selectedSessionId && (
                            <Button size="sm" variant="outline" onClick={() => handleGenerateReportForSession(selectedSessionId)}>
                              Generate Report (Selected)
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedSessionId ? (
                      <p className="text-xs text-muted-foreground">
                        {loadingSessionReports
                          ? "Loading reports for selected session…"
                          : sessionReports.length === 0
                            ? "No reports found for this session yet."
                            : `${sessionReports.length} report${sessionReports.length === 1 ? "" : "s"} available.`}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Select a session to filter history, or browse recent reports below.</p>
                    )}
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Generated By</TableHead>
                            <TableHead>Submissions</TableHead>
                            <TableHead>Damaged</TableHead>
                            <TableHead className="w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedSessionId ? sessionReports : recentReports).map((r) => {
                            const totals = (r.payload?.totals || {}) as any;
                            const subs = (r.payload?.submissions || {}) as any;
                            const damaged = Number(totals.damaged || 0);
                            return (
                              <TableRow key={r.id}>
                                <TableCell>{new Date(r.generated_at).toLocaleString()}</TableCell>
                                <TableCell>{r.generated_by || "-"}</TableCell>
                                <TableCell>
                                  {Number(subs.submitted || 0)} / {Number(subs.total || 0)}
                                </TableCell>
                                <TableCell>
                                  <span className={damaged > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>{damaged}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleViewReport(r.id)}>
                                      View
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => exportAuditSessionPdf(r.session_id)}>
                                      Export PDF
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(selectedSessionId ? sessionReports : recentReports).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                No reports available yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={scanOpen}
        onOpenChange={(v) => {
          setScanOpen(v);
          if (v) {
            setTimeout(() => {
              try {
                startScan();
              } catch {}
            }, 200);
          } else {
            stopScan();
            setScanAssetId("");
            setScanAssetName("");
            setScanComment("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan asset QR
            </DialogTitle>
            <DialogDescription>Point your camera at the asset QR. Pick a status and save.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-md bg-black/80">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-[70%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={scanStatus === "verified" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setScanStatus("verified")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Verified
              </Button>
              <Button
                variant={scanStatus === "damaged" ? "destructive" : "outline"}
                className="gap-2"
                onClick={() => setScanStatus("damaged")}
              >
                <TriangleAlert className="h-4 w-4" />
                Damaged
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Scanned asset:{" "}
              <span className="font-mono text-foreground">{scanAssetId || "—"}</span>
              {scanAssetId && (
                <span>
                  {" "}— <span className="text-foreground">{scanAssetName || "Unknown"}</span>
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label>Optional note</Label>
              <Textarea
                placeholder="Add a note (e.g., issue observed, location)"
                value={scanComment}
                onChange={(e) => setScanComment(e.target.value)}
                disabled={!scanAssetId || scanBusy}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {!scanActive && (
              <Button onClick={startScan} className="gap-2">
                <Camera className="h-4 w-4" />
                Start
              </Button>
            )}
            {scanActive && (
              <Button variant="outline" onClick={stopScan}>
                Stop
              </Button>
            )}
            <Button
              disabled={!scanAssetId || scanBusy}
              onClick={async () => {
                if (!sessionId || !scanAssetId) return;
                try {
                  setScanBusy(true);
                  await verifyAssetViaScan({ sessionId, assetId: scanAssetId, status: scanStatus, comment: scanComment || null });
                  toast.success(`Marked ${scanAssetId} as ${scanStatus}`);
                  try {
                    const dep = isAdmin ? adminDept : department;
                    if (dep) {
                      setRows((prev) => prev.map((rr) => (rr.id === scanAssetId ? { ...rr, status: scanStatus, comment: scanComment } : rr)));
                      const prior = await getReviewsFor(sessionId, dep);
                      setRows((prev) =>
                        prev.map((rr) => {
                          if (rr.id !== scanAssetId) return rr;
                          const r = prior.find((p) => p.asset_id === rr.id);
                          return r ? { ...rr, status: r.status as any, comment: r.comment || "" } : rr;
                        })
                      );
                    }
                  } catch {}
                  try {
                    const hist = await listMyScansForSession(sessionId);
                    setMyScans(hist.map((r) => ({ id: r.id, asset_id: r.asset_id, status: r.status, scanned_at: r.scanned_at })));
                  } catch {}
                  setScanAssetId("");
                  setScanAssetName("");
                  setScanComment("");
                  try {
                    if (sessionId) {
                      const sum = await getDepartmentReviewSummary(sessionId);
                      setSummary(sum);
                    }
                  } catch {}
                } catch (e: any) {
                  toast.error(e?.message || "Failed to verify");
                } finally {
                  setScanBusy(false);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
