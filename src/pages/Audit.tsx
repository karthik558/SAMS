import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ClipboardCheck, QrCode, Camera, CheckCircle2, TriangleAlert, Building2, User, CalendarClock, StopCircle, PlayCircle, Play } from "lucide-react";
import { listDepartmentAssets, getActiveSession, getAssignment, getReviewsFor, saveReviewsFor, submitAssignment, isAuditActive, startAuditSession, endAuditSession, getProgress, getDepartmentReviewSummary, listReviewsForSession, createAuditReport, listAuditReports, listRecentAuditReports, listSessions, getAuditReport, getSessionById, formatAuditSessionName, type AuditReport, type AuditSession, type AuditReview } from "@/services/audit";
import { listAssets, getAssetById, type Asset } from "@/services/assets";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { isDemoMode } from "@/lib/demo";
import { cn } from "@/lib/utils";
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

  const ChartTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
          {label && <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="h-2 w-2 rounded-full" 
                style={{ backgroundColor: entry.color || entry.fill || entry.stroke }} 
              />
              <span className="font-medium text-foreground">
                {formatter ? formatter(entry.value, entry.name, entry)[0] : entry.value}
              </span>
              <span className="text-muted-foreground">
                {formatter ? formatter(entry.value, entry.name, entry)[1] : entry.name}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

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
      const logoSrc = `${window.location.origin}/favicon.png`;
      const parts: string[] = [];
      let userName = 'Unknown';
      try {
        const raw = localStorage.getItem('auth_user');
        if (raw) {
           const u = JSON.parse(raw);
           userName = u.name || u.fullName || 'Unknown';
        }
      } catch {}
      const dateStr = new Date().toLocaleString();
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
  const title = `Audit_${friendly || sessionId}`.replace(/\s+/g, '_');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>@page{size:A4;margin:14mm} body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#111} h1{font-size:18px;margin:0 0 8px} .brand{display:flex;align-items:center;gap:10px;margin-bottom:6px} .brand img{height:28px;width:28px;object-fit:contain} .meta{color:#666;font-size:12px;margin-bottom:8px} .summary{display:flex;gap:8px;margin:8px 0 12px} .chip{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,0.08);-webkit-print-color-adjust:exact;print-color-adjust:exact} .chip.ok{background:#ecfdf5;color:#065f46;border-color:#a7f3d0} .chip.warn{background:#fffbeb;color:#92400e;border-color:#fde68a} .chip.err{background:#fef2f2;color:#991b1b;border-color:#fecaca} .section{margin:16px 0 8px;font-size:15px} table{border-collapse:collapse;width:100%;font-size:12px} th,td{padding:8px;border-bottom:1px solid #eee;text-align:left} .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:11px} .pill{display:inline-block;padding:4px 12px;border-radius:999px;background-color:#f8ece6;color:#5e3a2a;border:1px solid #b97b5b;font-size:12px;font-weight:500;margin-right:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
      </head><body>
  <div class="brand"><img src='${logoSrc}' onerror="this.src='/favicon.ico'" alt='logo' /><h1>Audit Review — ${friendly || sessionId}</h1></div>
      <div class="meta"><span class="pill">Generated at ${dateStr}</span><span class="pill">Generated by ${userName}</span></div>
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
        
        <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm sm:px-12 sm:py-12">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Audit Management
              </h1>
              <p className="text-lg text-muted-foreground">
                Verify assets, track discrepancies, and generate comprehensive reports for your department.
              </p>
            </div>
            <div className="flex gap-2">
              {headerActions}
            </div>
          </div>
          {/* Decorative background element */}
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
        <div className="space-y-8">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Session Overview</CardTitle>
                  <CardDescription>Current audit status & details</CardDescription>
                </div>
                <Badge variant={sessionBadgeVariant} className="px-3 py-1 text-xs font-medium uppercase tracking-wider">
                  {sessionStatusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property Scope</Label>
                {canManageSession ? (
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId} disabled={auditOn}>
                    <SelectTrigger className="h-10 bg-background">
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
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {selectedProperty?.name || "—"}
                  </div>
                )}
                {auditOn && canManageSession && (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                    <TriangleAlert className="h-3 w-3" />
                    Property locked during active session
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Charge</Label>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{inchargeUserName || inchargeUserId || "—"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequency</Label>
                  {canManageSession ? (
                    <Select value={String(auditFreq)} onValueChange={(v) => setAuditFreq(Number(v) as 1 | 3 | 6)} disabled={auditOn}>
                      <SelectTrigger className="h-10 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Monthly</SelectItem>
                        <SelectItem value="3">Quarterly</SelectItem>
                        <SelectItem value="6">Bi-Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm font-medium">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      {auditFreq === 1 ? "Monthly" : auditFreq === 3 ? "Quarterly" : "Bi-Annual"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Submission Progress</span>
                  <span className="font-bold text-foreground">{progress ? `${progress.submitted}/${progress.total}` : "—"}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div 
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out" 
                    style={{ width: `${Math.min(progressPercent, 100)}%` }} 
                  />
                </div>
                <p className="text-xs text-muted-foreground">{progressText}</p>
              </div>

              {canManageSession && (
                <div className="flex flex-col gap-2 pt-2">
                  {auditOn ? (
                    <Button variant="destructive" size="lg" className="w-full gap-2 shadow-sm" onClick={handleStopAudit}>
                      <StopCircle className="h-4 w-4" />
                      Stop Audit Session
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" size="lg" className="gap-2" onClick={handleResumeAudit}>
                        <PlayCircle className="h-4 w-4" />
                        Resume
                      </Button>
                      <Button size="lg" className="gap-2 shadow-sm" onClick={handleStartAudit}>
                        <Play className="h-4 w-4" />
                        Start New
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
              <CardTitle className="text-lg">Department Snapshot</CardTitle>
              <CardDescription>
                {selectedDept ? `Status for ${selectedDept}` : "Your department status"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Assets</span>
                  <span className="text-3xl font-bold tracking-tight">{rows.length}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-emerald-50/50 p-4 shadow-sm transition-colors hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified</span>
                  <span className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">{statusCounts.verified}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-red-50/50 p-4 shadow-sm transition-colors hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30">
                  <span className="text-xs font-medium uppercase tracking-wider text-red-600 dark:text-red-400">Missing</span>
                  <span className="text-3xl font-bold tracking-tight text-red-700 dark:text-red-300">{statusCounts.missing}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-amber-50/50 p-4 shadow-sm transition-colors hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30">
                  <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Damaged</span>
                  <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-300">{statusCounts.damaged}</span>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <span className="text-sm font-medium text-muted-foreground">Assignment Status</span>
                <Badge variant={assignmentStatus === "submitted" ? "secondary" : "outline"} className="capitalize">
                  {assignmentStatus || "Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {summaryEntries.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                <CardTitle className="text-lg">Department Progress</CardTitle>
                <CardDescription>Submission status across departments</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {summaryEntries.map(([dept, s]) => {
                    const reviewed = (s.verified || 0) + (s.missing || 0) + (s.damaged || 0);
                    const total = Math.max(0, Number(deptTotals[dept] || 0));
                    const pct = total > 0 ? Math.min(100, Math.round((reviewed / total) * 100)) : 0;
                    const radius = 32;
                    const circumference = 2 * Math.PI * radius;
                    const dash = (pct / 100) * circumference;
                    return (
                      <div key={dept} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                          <svg width="64" height="64" className="rotate-[-90deg]">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="6"
                              strokeDasharray={`${(pct / 100) * (2 * Math.PI * 28)} ${(2 * Math.PI * 28)}`}
                              strokeLinecap="round"
                              className="text-primary transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <span className="absolute text-xs font-bold">{pct}%</span>
                        </div>
                        <div className="space-y-1 overflow-hidden">
                          <div className="truncate font-semibold text-foreground" title={dept}>{dept}</div>
                          <div className="text-xs text-muted-foreground">{reviewed} of {total} reviewed</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Department</TableHead>
                        <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified</TableHead>
                        <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Missing</TableHead>
                        <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Damaged</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryEntries.map(([dept, s]) => (
                        <TableRow key={dept} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{dept}</TableCell>
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
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                <CardTitle className="text-lg">My Recent Scans</CardTitle>
                <CardDescription>Assets verified via QR scan</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/20">
                        <TableHead className="h-9 text-xs">Time</TableHead>
                        <TableHead className="h-9 text-xs">Asset ID</TableHead>
                        <TableHead className="h-9 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myScans.map((s) => (
                        <TableRow key={s.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(s.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium">{s.asset_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", 
                              s.status === "damaged" 
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400" 
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                            )}>
                              {s.status}
                            </Badge>
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

        <div className="space-y-8">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Department Review</CardTitle>
                  <CardDescription>
                    {isAdmin ? "Review and update asset statuses across departments" : "Verify assets and add comments"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isAdmin ? (
                    <Select value={adminDept} onValueChange={setAdminDept}>
                      <SelectTrigger className="h-9 min-w-[200px] bg-background">
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
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                      {department || "—"}
                    </Badge>
                  )}
                  {canScanAssets && (
                    <Button size="sm" variant="secondary" className="h-9 gap-2 shadow-sm" onClick={handleOpenScanner}>
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
                return (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Property: {p ? `${p.name} (${p.id})` : pid}</span>
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p>Loading assets...</p>
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ClipboardCheck className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No assets found for this department.</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="w-32 text-xs font-semibold uppercase tracking-wider">Asset ID</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                        <TableHead className="w-40 text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="min-w-[240px] text-xs font-semibold uppercase tracking-wider">Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => (
                        <TableRow key={r.id} className="group hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium text-muted-foreground group-hover:text-foreground">
                            {r.id}
                          </TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>
                            <Select
                              value={r.status}
                              onValueChange={(v: any) =>
                                setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, status: v } : x)))
                              }
                              disabled={!canEditRows}
                            >
                              <SelectTrigger className={cn("h-8 w-full border-0 bg-transparent p-0 focus:ring-0", 
                                r.status === "verified" ? "text-emerald-600 font-medium" : 
                                r.status === "missing" ? "text-destructive font-medium" : 
                                "text-amber-600 font-medium"
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="verified" className="text-emerald-600 focus:text-emerald-700">Verified</SelectItem>
                                <SelectItem value="missing" className="text-destructive focus:text-destructive">Missing</SelectItem>
                                <SelectItem value="damaged" className="text-amber-600 focus:text-amber-700">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 border-transparent bg-transparent px-0 shadow-none hover:bg-muted/50 focus-visible:border-input focus-visible:bg-background focus-visible:px-2 focus-visible:ring-1"
                              placeholder="Add note..."
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
            <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 bg-muted/10 p-4">
              <p className="text-xs text-muted-foreground">
                {canEditRows
                  ? "Changes are saved locally until you submit."
                  : "Review submitted. Contact admin for changes."}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={saveProgress} disabled={!rows.length || (!canEditRows && !isAdmin)}>
                  Save Draft
                </Button>
                <Button size="sm" onClick={submit} disabled={submitting || !canEditRows || !rows.length} className="shadow-sm">
                  {submitting ? "Submitting…" : "Submit Review"}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {(latestReport || recentReports.length > 0) && (
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Reports & Insights</CardTitle>
                    <CardDescription>Historical data and performance metrics</CardDescription>
                  </div>
                  {latestReport && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => exportAuditSessionPdf(latestReport.session_id)}>
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Export PDF
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => window.print()}>
                        Print
                      </Button>
                    </div>
                  )}
                </div>
                {latestReport ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Latest Report:</span>
                    <span>{new Date(latestReport.generated_at).toLocaleString()}</span>
                    {propertyLabel && (
                      <>
                        <span className="text-border">|</span>
                        <span>Property: {propertyLabel}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Generate a report to unlock insights.</p>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="overview" className="space-y-6">
                  <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50 p-1">
                    <TabsTrigger value="overview" className="rounded-md text-xs font-medium">Overview</TabsTrigger>
                    <TabsTrigger value="departments" className="rounded-md text-xs font-medium">Departments</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-md text-xs font-medium">History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="space-y-6 animate-in fade-in-50 duration-500">
                    {latestReport ? (
                      <div className="space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="rounded-xl border bg-card p-4 shadow-sm">
                            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Overall Summary</h3>
                            <div className="h-[300px] w-full">
                              {(() => {
                                const payload = latestReport?.payload || {};
                                const totals = payload.totals || { verified: 0, missing: 0, damaged: 0 };
                                const data = [
                                  {
                                    name: "All Assets",
                                    Verified: Number(totals.verified || 0),
                                    Missing: Number(totals.missing || 0),
                                    Damaged: Number(totals.damaged || 0),
                                  },
                                ];
                                return (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                      <Tooltip 
                                        content={<ChartTooltip formatter={(v: any, n: any) => [v, n]} />} 
                                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }} 
                                      />
                                      <Bar dataKey="Verified" radius={[4, 4, 0, 0]} fill="hsl(142, 71%, 45%)" maxBarSize={80} />
                                      <Bar dataKey="Missing" radius={[4, 4, 0, 0]} fill="hsl(339, 90%, 51%)" maxBarSize={80} />
                                      <Bar dataKey="Damaged" radius={[4, 4, 0, 0]} fill="hsl(31, 97%, 55%)" maxBarSize={80} />
                                      <Legend />
                                    </BarChart>
                                  </ResponsiveContainer>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="rounded-xl border bg-card p-4 shadow-sm">
                            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Department</h3>
                            <div className="h-[300px] w-full">
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
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                                      <XAxis 
                                        dataKey="name" 
                                        tickLine={false} 
                                        axisLine={false} 
                                        interval={0} 
                                        angle={-20} 
                                        height={60} 
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                                        dy={10}
                                      />
                                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                      <Tooltip content={<ChartTooltip formatter={(v: any, n: any) => [v, n]} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }} />
                                      <Bar dataKey="Verified" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 4, 4]} />
                                      <Bar dataKey="Missing" stackId="a" fill="hsl(339, 90%, 51%)" radius={[0, 0, 0, 0]} />
                                      <Bar dataKey="Damaged" stackId="a" fill="hsl(31, 97%, 55%)" radius={[4, 4, 0, 0]} />
                                      <Legend />
                                    </BarChart>
                                  </ResponsiveContainer>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        {latestReport?.payload?.contributors && (
                          <div className="rounded-xl border bg-muted/20 p-4">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contributors</Label>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {latestReport.payload.contributors.map((c: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="bg-background px-2 py-1 text-xs font-normal text-muted-foreground">
                                  <span className="font-medium text-foreground">{c.department}</span>
                                  <span className="mx-1.5 text-border">|</span>
                                  <span className={c.status === "submitted" ? "text-emerald-600" : "text-amber-600"}>
                                    {c.status === "submitted" ? "Submitted" : "Pending"}
                                  </span>
                                  {c.submitted_at && <span className="ml-1 opacity-70">({new Date(c.submitted_at).toLocaleDateString()})</span>}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <BarChart className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Generate a report to unlock insights.</p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="departments" className="space-y-6 animate-in fade-in-50 duration-500">
                    {latestReport ? (
                      <div className="space-y-6">
                        <div className="rounded-xl border bg-card overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Department</TableHead>
                                <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified</TableHead>
                                <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Missing</TableHead>
                                <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Damaged</TableHead>
                                <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Total</TableHead>
                                <TableHead className="h-10 w-24 text-xs font-semibold uppercase tracking-wider">Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(latestReport?.payload?.byDepartment || []).map((d: any) => (
                                <TableRow key={d.department} className="hover:bg-muted/20">
                                  <TableCell className="font-medium">{d.department}</TableCell>
                                  <TableCell>{d.verified}</TableCell>
                                  <TableCell>{d.missing}</TableCell>
                                  <TableCell>{d.damaged}</TableCell>
                                  <TableCell>{d.total}</TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="ghost" className="h-8 w-full text-xs" onClick={() => setDetailDept(d.department)}>
                                      View
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {detailDept && (
                          <div className="rounded-xl border bg-card p-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-semibold">Details: {detailDept}</Label>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {reportReviews.filter((r) => r.department === detailDept).length} items
                                </Badge>
                              </div>
                              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDetailDept("")}>
                                Close Details
                              </Button>
                            </div>
                            <div className="max-h-[400px] overflow-auto rounded-lg border bg-muted/10">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-9 text-xs">Asset ID</TableHead>
                                    <TableHead className="h-9 text-xs">Status</TableHead>
                                    <TableHead className="h-9 text-xs">Comment</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {reportReviews
                                    .filter((r) => r.department === detailDept)
                                    .map((r, i) => (
                                      <TableRow key={`${r.asset_id}-${i}`} className="hover:bg-muted/20">
                                        <TableCell className="font-mono text-xs font-medium">{r.asset_id}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", 
                                            r.status === "missing" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400" : 
                                            r.status === "damaged" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400" : 
                                            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                          )}>
                                            {r.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{r.comment || "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Building2 className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Generate a report to view department breakdown.</p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="history" className="space-y-6 animate-in fade-in-50 duration-500">
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium">Filter by Session</Label>
                        <Select value={selectedSessionId} onValueChange={handleSelectSession}>
                          <SelectTrigger className="h-9 min-w-[240px] bg-background">
                            <SelectValue placeholder="Select session..." />
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
                            <Button size="sm" className="h-9 shadow-sm" onClick={() => handleGenerateReportForSession(sessionId)}>
                              Generate Report (Active)
                            </Button>
                          )}
                          {selectedSessionId && (
                            <Button size="sm" variant="outline" className="h-9" onClick={() => handleGenerateReportForSession(selectedSessionId)}>
                              Generate Report (Selected)
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                      <div className="border-b border-border/40 bg-muted/10 px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {selectedSessionId ? (
                            loadingSessionReports
                              ? "Loading reports..."
                              : sessionReports.length === 0
                                ? "No reports found for this session."
                                : `${sessionReports.length} report${sessionReports.length === 1 ? "" : "s"} found`
                          ) : (
                            "Showing recent reports across all sessions"
                          )}
                        </p>
                      </div>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Date Generated</TableHead>
                              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Generated By</TableHead>
                              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Submissions</TableHead>
                              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider">Damaged</TableHead>
                              <TableHead className="h-10 w-40 text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(selectedSessionId ? sessionReports : recentReports).map((r) => {
                              const totals = (r.payload?.totals || {}) as any;
                              const subs = (r.payload?.submissions || {}) as any;
                              const damaged = Number(totals.damaged || 0);
                              return (
                                <TableRow key={r.id} className="hover:bg-muted/20">
                                  <TableCell className="font-medium text-foreground">
                                    {new Date(r.generated_at).toLocaleDateString()}
                                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                                      {new Date(r.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{r.generated_by || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="font-normal">
                                      {Number(subs.submitted || 0)} / {Number(subs.total || 0)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {damaged > 0 ? (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                                        {damaged} Items
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleViewReport(r.id)}>
                                        View
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => exportAuditSessionPdf(r.session_id)}>
                                        PDF
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {(selectedSessionId ? sessionReports : recentReports).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                                  No reports available.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
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
        <DialogContent className="sm:max-w-lg border-none shadow-2xl bg-white/95 backdrop-blur-xl dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Scan Asset QR
            </DialogTitle>
            <DialogDescription>
              Point your camera at the asset QR code. Select a status and save to verify.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="relative aspect-square overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-black shadow-inner">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              
              {/* Scanner Overlay Guide */}
              <div className="absolute inset-0 pointer-events-none border-[30px] border-black/30">
                <div className="w-full h-full border-2 border-blue-500/50 relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 rounded-tl-sm"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 rounded-tr-sm"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 rounded-bl-sm"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 rounded-br-sm"></div>
                </div>
              </div>
              
              {!scanActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="text-white text-sm font-medium flex flex-col items-center gap-2">
                    <Camera className="h-8 w-8 opacity-50" />
                    <span>Camera is off</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={scanStatus === "verified" ? "default" : "outline"}
                className={`gap-2 h-12 text-base ${scanStatus === "verified" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent" : "hover:border-emerald-500 hover:text-emerald-600"}`}
                onClick={() => setScanStatus("verified")}
              >
                <CheckCircle2 className="h-5 w-5" />
                Verified
              </Button>
              <Button
                variant={scanStatus === "damaged" ? "destructive" : "outline"}
                className={`gap-2 h-12 text-base ${scanStatus === "damaged" ? "" : "hover:border-red-500 hover:text-red-600"}`}
                onClick={() => setScanStatus("damaged")}
              >
                <TriangleAlert className="h-5 w-5" />
                Damaged
              </Button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div className="text-sm text-muted-foreground mb-1">Scanned Asset:</div>
              <div className="font-mono text-base font-medium text-foreground flex items-center gap-2">
                {scanAssetId ? (
                  <>
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-sm">{scanAssetId}</span>
                    <span className="text-muted-foreground text-sm truncate">{scanAssetName || "Unknown Asset"}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic text-sm">Waiting for scan...</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional Note</Label>
              <Textarea
                placeholder="Add a note (e.g., issue observed, location discrepancy)..."
                value={scanComment}
                onChange={(e) => setScanComment(e.target.value)}
                disabled={!scanAssetId || scanBusy}
                className="resize-none bg-white dark:bg-slate-950"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2 w-full sm:w-auto">
              {!scanActive ? (
                <Button onClick={startScan} variant="outline" className="gap-2 flex-1 sm:flex-none">
                  <Camera className="h-4 w-4" />
                  Start Camera
                </Button>
              ) : (
                <Button variant="outline" onClick={stopScan} className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
                  Stop Camera
                </Button>
              )}
            </div>
            
            <Button
              className="flex-1 sm:flex-none min-w-[100px]"
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
              {scanBusy ? "Saving..." : "Save Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
