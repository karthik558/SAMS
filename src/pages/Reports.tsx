/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileBarChart, 
  Download, 
  CalendarIcon, 
  BarChart3,
  FileText,
  ChevronDown
} from "lucide-react";
// format no longer needed after centralizing date range picker
import { cn } from "@/lib/utils";
import DateRangePicker from "@/components/ui/date-range-picker";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { listProperties, type Property } from "@/services/properties";
import { listItemTypes, type ItemType } from "@/services/itemTypes";
import { listReports, createReport, clearReports, type Report } from "@/services/reports";
import { logActivity } from "@/services/activity";
import { addNotification } from "@/services/notifications";
import { listAssets, type Asset } from "@/services/assets";
import { listApprovals, type ApprovalRequest } from "@/services/approvals";
import { listDepartments, type Department } from "@/services/departments";
import { listSessions, listReviewsForSession, getSessionById, formatAuditSessionName, type AuditSession } from "@/services/audit";
import { listTickets, type Ticket } from "@/services/tickets";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusChip from "@/components/ui/status-chip";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const reportTypes = [
  {
    id: "asset-summary",
    name: "Asset Summary Report",
    description: "Complete overview of all assets by property and type",
    icon: BarChart3
  },
  {
    id: "property-wise",
    name: "Property-wise Asset Report", 
    description: "Detailed breakdown of assets for each property",
    icon: FileText
  },
  {
    id: "department-wise",
    name: "Department-wise Asset Report",
    description: "Detailed breakdown of assets for each department",
    icon: FileText
  },
  {
    id: "expiry-tracking",
    name: "Expiry Tracking Report",
    description: "Assets approaching expiry dates with timeline",
    icon: CalendarIcon
  }
  ,
  {
    id: "audit-review",
    name: "Audit Review Report",
    description: "Audit session reviews (by department or all) with issues highlighted",
    icon: FileBarChart
  }
];

type CurrentUser = { id?: string; email?: string; name?: string; fullName?: string; role?: string; department?: string | null };

export default function Reports() {
  // Identify user & role early (used for defaults below)
  const currentUser: CurrentUser = (() => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) as CurrentUser : {} as CurrentUser;
    } catch {
      // ignore parse errors
      return {} as CurrentUser;
    }
  })();
  const role: string = (currentUser?.role || '').toLowerCase();
  const isAdminRole = (role || '').includes('admin');
  const myDept: string | null = currentUser?.department ?? null;
  const [selectedReportType, setSelectedReportType] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [selectedAssetType, setSelectedAssetType] = useState("all");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [emailReport, setEmailReport] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [recentReports, setRecentReports] = useState<Report[] | null>(null);
  const [assetsCache, setAssetsCache] = useState<Asset[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptForReport, setDeptForReport] = useState<string>("ALL");
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>([]);
  const [selectedAuditSessionId, setSelectedAuditSessionId] = useState<string>("");
  // Allowed property scope for non-admins
  const [allowedProps, setAllowedProps] = useState<Set<string>>(new Set());
  // Quick Generate dialog state for Audit Review Report
  const [auditQuickOpen, setAuditQuickOpen] = useState<boolean>(false);
  const [qrSessionId, setQrSessionId] = useState<string>("");
  const [qrDept, setQrDept] = useState<string>("ALL");
  const [qrProperty, setQrProperty] = useState<string>("all");
  // Recent Reports filters
  const [rrRange, setRrRange] = useState<'all' | 'today' | '7d' | 'custom'>('all');
  const [rrFrom, setRrFrom] = useState<Date | undefined>();
  const [rrTo, setRrTo] = useState<Date | undefined>();

  // Scope recent reports to current user (non-admin) and allowed properties.
  const scopeRecentReports = (reports: Report[] | null | undefined, allowed: Set<string>): Report[] => {
    const list = Array.isArray(reports) ? reports : [];
    // Treat as admin if role indicates admin OR if no property restrictions are recorded
    const treatAsAdmin = isAdminRole || (allowed && allowed.size === 0);
    if (treatAsAdmin) return list;
    const uid = String(currentUser?.id || '');
    const email = String(currentUser?.email || '');
    const name = String(currentUser?.name || currentUser?.fullName || '');
    const me = (v: unknown) => {
      const s = String(v || '');
      return !!s && (s === uid || s === email || s === name);
    };
    return list.filter((r) => (me((r as any).created_by_id) || me((r as any).created_by)) && (!((r as any).filter_property) || allowed.has(String((r as any).filter_property))));
  };

  // Approvals Log state (admin/manager only)
  const [approvalsAll, setApprovalsAll] = useState<ApprovalRequest[] | null>(null);
  const [apStatus, setApStatus] = useState<'all'|'pending'|'approved'|'rejected'>('all');
  const [apDateFrom, setApDateFrom] = useState<Date | undefined>();
  const [apDateTo, setApDateTo] = useState<Date | undefined>();
  const [apDepartments, setApDepartments] = useState<Department[]>([]);
  const [apDeptFilter, setApDeptFilter] = useState<string>('ALL');
  const [showApprovalsLog, setShowApprovalsLog] = useState<boolean>(false);
  // Tickets Report state
  const [tkScope, setTkScope] = useState<string>(() => (isAdminRole ? 'all' : 'mine-received'));
  const [tkFrom, setTkFrom] = useState<Date | undefined>();
  const [tkTo, setTkTo] = useState<Date | undefined>();

  // Load properties, item types, and recent reports
  // When Supabase is enabled, pull live data; else use light fallbacks
  useEffect(() => {
    (async () => {
      // Load allowed property IDs for current user
      const isAdmin = isAdminRole;
      let allowed = new Set<string>();
      try { if (!isAdmin) allowed = await getAccessiblePropertyIdsForCurrentUser(); } catch { /* ignore */ }
      setAllowedProps(allowed);
      try {

    if (hasSupabaseEnv || isDemoMode()) {
          const [props, types] = await Promise.all([
            listProperties().catch(() => []),
            listItemTypes().catch(() => []),
          ]);
          const propsScoped = (isAdmin || !allowed.size) ? (props as Property[]) : (props as Property[]).filter(p => allowed.has(String(p.id)));
          setProperties(propsScoped);
          setItemTypes((types as ItemType[]).map(t => t.name));
          // Preload assets for downloads/export
          try {
            const assets = await listAssets();
            const assetsScoped = (isAdmin || !allowed.size) ? (assets as Asset[]) : (assets as Asset[]).filter(a => allowed.has(String(a.property || a.property_id || '')));
            setAssetsCache(assetsScoped);
          } catch { /* ignore */ }
          // Load departments for admin Approvals Log filter and for department-wise reports
          try {
            const depts = await listDepartments() as Department[];
            setDepartments(depts);
            if (isAdminRole) setApDepartments(depts);
          } catch { /* ignore */ }
        } else {
          setProperties([
            { id: "PROP-001", name: "Main Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-002", name: "Warehouse", type: "Storage", status: "Active", address: null, manager: null } as any,
            { id: "PROP-003", name: "Branch Office", type: "Office", status: "Active", address: null, manager: null } as any,
          ]);
          setItemTypes(["Electronics","Furniture","Machinery","Vehicles","Office Supplies"]);
        }
      } catch (e) {
        console.error(e);
      }
      try {
  if (hasSupabaseEnv || isDemoMode()) {
          const reports = await listReports();
          setRecentReports(scopeRecentReports(reports, allowed));
        } else {
          setRecentReports(null);
        }
      } catch (e) {
        console.error(e);
      }
      // Load audit sessions for audit-review report
      try {
        if (hasSupabaseEnv || isDemoMode()) {
          const sess = await listSessions(200);
          // Scope sessions by allowed property for non-admins; if no allowed or none match, fall back to all sessions to avoid empty dropdowns
          if (isAdmin) {
            setAuditSessions(sess || []);
          } else {
            let scoped = (sess || []).filter((s: any) => s?.property_id && allowed && allowed.has(String(s.property_id)));
            if (!allowed || allowed.size === 0 || scoped.length === 0) scoped = (sess || []);
            setAuditSessions(scoped);
          }
        }
      } catch (e) {
        console.error(e);
        setAuditSessions([]);
      }
    })();
  }, []);

  // Load approvals for the Approvals Log whenever department filter or role changes
  useEffect(() => {
    (async () => {
      try {
        const dept = isAdminRole ? (apDeptFilter === 'ALL' ? null : apDeptFilter) : (role === 'manager' ? (myDept || null) : null);
        if (role === 'manager') {
          // Property-scope approvals to properties this manager has access to
          try {
            const allowed = allowedProps; // already loaded on mount
            let assets = assetsCache;
            if (!assets) {
              try { assets = await listAssets(); } catch { assets = []; }
            }
            const allowedAssetIds = (assets || [])
              .filter(a => a.property_id && allowed && allowed.has(String(a.property_id)))
              .map(a => a.id);
            const list = await listApprovals(undefined, dept as any, undefined, allowedAssetIds);
            setApprovalsAll(list);
          } catch {
            const list = await listApprovals(undefined, dept as any, undefined, []);
            setApprovalsAll(list);
          }
        } else {
          const list = await listApprovals(undefined, dept as any, undefined);
          setApprovalsAll(list);
        }
      } catch (e) {
        console.error(e);
        setApprovalsAll([]);
      }
    })();
  }, [role, myDept, apDeptFilter, allowedProps, assetsCache]);

  // Export Tickets CSV (role-aware)
  const exportTicketsCsv = async () => {
    try {
      const id = (currentUser?.id || '').toString();
      const email = (currentUser?.email || '').toString();
      const scope = tkScope;
      const tasks: Promise<Ticket[]>[] = [];
      if (scope === 'mine-received') {
        if (id) tasks.push(listTickets({ assignee: id }));
        if (email && email !== id) tasks.push(listTickets({ assignee: email }));
      } else if (scope === 'mine-raised') {
        if (id) tasks.push(listTickets({ createdBy: id }));
        if (email && email !== id) tasks.push(listTickets({ createdBy: email }));
      } else if (scope === 'all') {
        tasks.push(listTickets({}));
      } else if (scope === 'target-admin') {
        tasks.push(listTickets({ targetRole: 'admin' as any }));
      } else if (scope === 'target-manager') {
        tasks.push(listTickets({ targetRole: 'manager' as any }));
      } else {
        tasks.push(listTickets({}));
      }
      const results = (await Promise.all(tasks)).flat();
      // de-duplicate by id
      const map = new Map<string, Ticket>();
      results.forEach(t => { map.set(t.id, t); });
      const list = Array.from(map.values());
      // date filter on createdAt
      const from = tkFrom ? new Date(new Date(tkFrom).setHours(0,0,0,0)) : null;
      const to = tkTo ? new Date(new Date(tkTo).setHours(23,59,59,999)) : null;
      const inRange = (iso?: string | null) => {
        if (!from && !to) return true;
        if (!iso) return false;
        const d = new Date(iso);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      };
      const filtered = list.filter(t => inRange(t.createdAt)).sort((a,b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (!filtered.length) { toast.info('No tickets found for the selected filters'); return; }
      const rows = filtered.map(t => ({
        id: t.id,
        title: t.title,
        description: (t.description || '').toString().replace(/\n/g, ' '),
        status: t.status,
        targetRole: t.targetRole,
        priority: t.priority || 'medium',
        assignee: t.assignee || '',
        createdBy: t.createdBy,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt || '',
        slaDueAt: t.slaDueAt || '',
        closeNote: t.closeNote || '',
      }));
      const nameParts = ['Tickets Report'];
      if (scope === 'mine-received') nameParts.push('(Received by me)');
      else if (scope === 'mine-raised') nameParts.push('(Raised by me)');
      else if (scope === 'target-admin') nameParts.push('(Target: Admin)');
      else if (scope === 'target-manager') nameParts.push('(Target: Manager)');
      const name = `${nameParts.join(' ')} - ${new Date().toISOString().slice(0,10)}`;
      downloadCsvFromRows(name, rows);
      toast.success('Tickets report downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export tickets');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast.error("Please select a report type");
      return;
    }

    const reportData = {
      type: selectedReportType,
      dateFrom,
      dateTo,
      property: selectedProperty,
      assetType: selectedAssetType,
      department: selectedReportType === 'department-wise' ? (deptForReport === 'ALL' ? undefined : deptForReport) : (selectedReportType === 'audit-review' ? (deptForReport === 'ALL' ? undefined : deptForReport) : undefined),
      format: reportFormat,
      email: emailReport
    };

  try {
  if (hasSupabaseEnv || isDemoMode()) {
        const displayName = `${reportTypes.find(r => r.id === selectedReportType)?.name}${selectedReportType === 'audit-review' ? (selectedAuditSessionId ? ` - Session ${selectedAuditSessionId}` : '') : ''}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`;
        await createReport({
          name: displayName,
          type: selectedReportType,
          format: reportFormat.toUpperCase(),
          status: "Completed",
          date_from: dateFrom ? new Date(dateFrom).toISOString().slice(0,10) : null,
          date_to: dateTo ? new Date(dateTo).toISOString().slice(0,10) : null,
          file_url: null,
          filter_session_id: selectedReportType === 'audit-review' ? (selectedAuditSessionId || null) : null,
          filter_department: reportData.department ?? null,
          filter_property: selectedProperty !== 'all' ? selectedProperty : null,
          filter_asset_type: selectedAssetType !== 'all' ? selectedAssetType : null,
          // Note: backend may not persist this, but keep in name for parsing later
          // filter_session_id: selectedReportType === 'audit-review' ? selectedAuditSessionId : null,
          created_by: (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null) as any,
          created_by_id: (currentUser?.id || null) as any,
        } as any);
        let reports = await listReports();
        // Enrich top record with creator info if backend omitted columns
        try {
          if (reports && reports.length) {
            const top = { ...reports[0] } as any;
            const justNow = top.created_at ? (Date.now() - new Date(top.created_at).getTime() < 60_000) : true;
            if (justNow && !top.created_by) {
              top.created_by = (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null);
              top.created_by_id = (currentUser?.id || null);
            }
            reports = [top, ...reports.slice(1) as any];
          }
        } catch {}
        setRecentReports(scopeRecentReports(reports as any, allowedProps));
        // Log activity that a report was generated
        try {
          const rname = `${reportTypes.find(r => r.id === selectedReportType)?.name}${reportData.department ? ` - ${reportData.department}` : ''}`;
          await logActivity('report_generated', `${rname} generated${reportFormat ? ` (${reportFormat.toUpperCase()})` : ''}`, (currentUser?.name || currentUser?.email || null));
        } catch {}
        await addNotification({
          title: "Report generated",
          message: `${reportTypes.find(r => r.id === selectedReportType)?.name} is ready for download`,
          type: "report",
        });
      }
      // Also generate a client-side export immediately using current selections
      try {
        if (selectedReportType === 'audit-review') {
          if (!selectedAuditSessionId) { toast.error('Please select an audit session'); return; }
          const rows = await buildAuditRows(selectedAuditSessionId, reportData.department, (selectedProperty !== 'all' ? selectedProperty : undefined));
          if (rows.length) {
            const name = `${reportTypes.find(r => r.id === selectedReportType)?.name} - Session ${selectedAuditSessionId}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`;
            if (reportFormat === 'pdf') {
              try {
                const sessMeta = await getSessionById(selectedAuditSessionId);
                const friendly = formatAuditSessionName(sessMeta || { id: selectedAuditSessionId } as any);
                downloadAuditPdfFromRows(friendly, rows);
              } catch {
                downloadAuditPdfFromRows(selectedAuditSessionId, rows);
              }
            }
            else downloadCsvFromRows(name, rows);
          } else { toast.info('No reviews found for that selection'); }
        } else {
          const assetsAll = assetsCache ?? await listAssets().catch(() => [] as Asset[]);
          const isAdmin = isAdminRole;
          const assets = (isAdmin || !allowedProps.size) ? (assetsAll as Asset[]) : (assetsAll as Asset[]).filter(a => allowedProps.has(String(a.property || a.property_id || '')));
          const rows = buildRows({
            type: selectedReportType,
            assets: assets as Asset[],
            dateFrom,
            dateTo,
            department: reportData.department,
            propertyId: selectedProperty !== 'all' ? selectedProperty : undefined,
            assetType: selectedAssetType !== 'all' ? selectedAssetType : undefined,
          });
          if (rows.length) {
            const name = `${reportTypes.find(r => r.id === selectedReportType)?.name}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`;
            if (reportFormat === 'pdf') downloadPdfFromRows(name, rows);
            else downloadCsvFromRows(name, rows);
          } else {
            toast.info('No data matched your filters');
          }
        }
      } catch { /* ignore */ }
      toast.success(`${reportTypes.find(r => r.id === selectedReportType)?.name} generated${hasSupabaseEnv ? "" : " (local)"}.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    }
  };

  const handleQuickReport = (reportType: string) => {
  const report = reportTypes.find(r => r.id === reportType);
  (async () => {
    try {
      // Ensure assets are loaded
      if (reportType === 'audit-review') {
        // Open website-style modal to select filters
        let sid = selectedAuditSessionId;
        try {
          if (!sid && !auditSessions.length) {
            const sess = await listSessions(200);
            setAuditSessions(sess || []);
            if (sess && sess.length) sid = sess[0].id;
          } else if (!sid && auditSessions.length) {
            sid = auditSessions[0].id;
          }
        } catch {}
        setQrSessionId(sid || "");
        setQrDept(deptForReport || 'ALL');
        setQrProperty(selectedProperty || 'all');
        setAuditQuickOpen(true);
        return;
      } else {
        const assetsAll = assetsCache ?? await listAssets().catch(() => [] as Asset[]);
        const isAdmin = isAdminRole;
        const assets = (isAdmin || !allowedProps.size) ? (assetsAll as Asset[]) : (assetsAll as Asset[]).filter(a => allowedProps.has(String(a.property || a.property_id || '')));
        setAssetsCache(Array.isArray(assets) ? assets : []);
        // Build rows
        const rows = buildRows({
          type: reportType,
          assets: assets as Asset[],
          dateFrom: undefined,
          dateTo: undefined,
          department: reportType === 'department-wise' ? (deptForReport === 'ALL' ? undefined : deptForReport) : undefined,
        });
        if (!rows.length) { toast.info('No data for this report'); return; }
        downloadCsvFromRows(`${report?.name || 'Report'} - ${new Date().toISOString().slice(0,10)}`, rows);
      }
      // Log the quick report for Recent Reports with filter metadata
      if (hasSupabaseEnv || isDemoMode()) {
        try {
          await createReport({
            name: `${report?.name}${(reportType === 'department-wise' && deptForReport && deptForReport !== 'ALL') ? ` - ${deptForReport}` : ''} - ${new Date().toISOString().slice(0,10)}`,
            type: reportType,
            format: 'CSV',
            status: 'Completed',
            date_from: null,
            date_to: null,
            file_url: null,
            filter_session_id: null,
            filter_department: reportType === 'department-wise' ? (deptForReport === 'ALL' ? null : deptForReport) : null,
            filter_property: null,
            filter_asset_type: null,
            created_by: (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null),
            created_by_id: (currentUser?.id || null),
          });
          let reports = await listReports();
          try {
            if (reports && reports.length) {
              const top = { ...reports[0] } as any;
              const justNow = top.created_at ? (Date.now() - new Date(top.created_at).getTime() < 60_000) : true;
              if (justNow && !top.created_by) {
                top.created_by = (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null);
                top.created_by_id = (currentUser?.id || null);
              }
              reports = [top, ...reports.slice(1) as any];
            }
          } catch {}
          setRecentReports(scopeRecentReports(reports, allowedProps));
        } catch (e) { /* ignore logging failure */ }
      }
      toast.success(`${report?.name} generated`);
    } catch (e:any) {
      console.error(e);
      toast.error(e?.message || 'Failed to generate quick report');
    }
  })();
  };

  async function confirmQuickAudit() {
    try {
      const sid = qrSessionId;
      if (!sid) { toast.error('Please select an audit session'); return; }
      const dep = qrDept === 'ALL' ? undefined : qrDept;
      const propId = qrProperty !== 'all' ? qrProperty : undefined;
      const rows = await buildAuditRows(sid, dep, propId);
      if (!rows.length) { toast.info('No data for this report'); return; }
      const name = `Audit Review Report - Session ${sid}${(dep ? ` - ${dep}` : '')} - ${new Date().toISOString().slice(0,10)}`;
      downloadCsvFromRows(name, rows);
      // Log recent report
      if (hasSupabaseEnv || isDemoMode()) {
        try {
          await createReport({
            name,
            type: 'audit-review',
            format: 'CSV',
            status: 'Completed',
            date_from: null,
            date_to: null,
            file_url: null,
            filter_session_id: sid,
            filter_department: dep || null,
            filter_property: propId || null,
            filter_asset_type: null,
            created_by: (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null),
            created_by_id: (currentUser?.id || null),
          });
          const reports = await listReports();
          setRecentReports(scopeRecentReports(reports, allowedProps));
        } catch {}
      }
      // Persist choices into main filters for consistency
      setSelectedAuditSessionId(sid);
      setDeptForReport(qrDept);
      setSelectedProperty(qrProperty);
      setAuditQuickOpen(false);
      toast.success('Audit review report generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate audit review report');
    }
  }

  // Build rows for report export
  function buildRows(opts: { type: string; assets: Asset[]; dateFrom?: Date; dateTo?: Date; department?: string; propertyId?: string; assetType?: string; }) {
    const { type, assets, dateFrom, dateTo, department, propertyId, assetType } = opts;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const inRange = (d: string | null) => {
      if (!d) return true;
      const dt = new Date(d);
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      return true;
    };
    const byDept = (a: any) => !department || (String(a.department || '').toLowerCase() === String(department).toLowerCase());
    const byProp = (a: any) => !propertyId || String(a.property_id || a.property) === propertyId;
    const byType = (a: any) => !assetType || String(a.type) === assetType;

    switch (type) {
      case 'asset-summary':
        return assets.filter(a => inRange(a.purchaseDate) && byProp(a) && byType(a)).map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          property: a.property,
          department: (a as any).department || '',
          quantity: a.quantity,
          purchaseDate: a.purchaseDate,
          expiryDate: a.expiryDate,
          status: a.status,
        }));
      case 'property-wise':
        return assets.filter(a => inRange(a.purchaseDate) && byProp(a) && byType(a)).map(a => ({
          property: a.property,
          id: a.id,
          name: a.name,
          type: a.type,
          department: (a as any).department || '',
          quantity: a.quantity,
          status: a.status,
        }));
      case 'department-wise':
        return assets.filter(a => inRange(a.purchaseDate) && byDept(a) && byProp(a) && byType(a)).map(a => ({
          department: (a as any).department || '',
          id: a.id,
          name: a.name,
          type: a.type,
          property: a.property,
          quantity: a.quantity,
          status: a.status,
        }));
      case 'expiry-tracking':
        return assets.filter(a => a.expiryDate && inRange(a.expiryDate) && byProp(a) && byType(a)).map(a => ({
          id: a.id,
          name: a.name,
          property: a.property,
          department: (a as any).department || '',
          expiryDate: a.expiryDate,
          status: a.status,
        }));
      default:
        return [];
    }
  }

  const toCsv = (data: any[]) => {
    if (!data.length) return '';
    const cols = Object.keys(data[0]);
    const header = cols.join(',');
    const lines = data.map(r => cols.map(c => {
      const v = (r[c] ?? '').toString().replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(','));
    return [header, ...lines].join('\n');
  };

  function downloadCsvFromRows(name: string, rows: any[]) {
    const csv = toCsv(rows);
    if (!csv) { toast.info('No data to download for this report'); return; }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
  a.href = url; a.download = `${name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadPdfFromRows(name: string, rows: any[]) {
    if (!rows.length) { toast.info('No data to download for this report'); return; }
    // Build simple printable HTML table
    const cols = Object.keys(rows[0]);
    const thead = `<tr>${cols.map(c => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">${c}</th>`).join('')}</tr>`;
    const tbody = rows.map(r => `<tr>${cols.map(c => `<td style="padding:8px;border-bottom:1px solid #f0f0f0;">${(r[c] ?? '')}</td>`).join('')}</tr>`).join('');
    // Use app base to resolve public path for favicon
    const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const normalizedBase = (base || '').replace(/\/$/, '');
    const logoSrc = `${normalizedBase}/favicon.png`;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${name}</title>
    <style>@page{size:A4;margin:16mm} body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#111} h1{font-size:18px;margin:0 0 12px} table{border-collapse:collapse;width:100%;font-size:12px} .meta{color:#666;font-size:12px;margin-bottom:8px} .brand{display:flex;align-items:center;gap:10px;margin-bottom:8px} .brand img{height:28px;width:28px;object-fit:contain}</style>
    </head><body>
    <div class="brand"><img src='${logoSrc}' onerror="this.src='/favicon.ico'" alt='logo' /><h1>${name}</h1></div>
    <div class="meta">Generated at ${new Date().toLocaleString()}</div>
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    doc?.open(); doc?.write(html); doc?.close();
    const trigger = () => { try { iframe.contentWindow?.focus(); setTimeout(() => iframe.contentWindow?.print(), 50); } finally { setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000); } };
    setTimeout(trigger, 200);
  }

  // Build rows for Audit Review Report from audit_reviews
  async function buildAuditRows(sessionId: string, department?: string, propertyId?: string): Promise<any[]> {
    try {
      if (!(hasSupabaseEnv || isDemoMode())) return [];
      const reviews = await listReviewsForSession(sessionId).catch(() => []);
      // Resolve session property to use as a fallback when asset metadata is unavailable due to RLS
      let sessionPropertyId: string | null = null;
      try {
        const sess = await getSessionById(sessionId);
        sessionPropertyId = ((sess as any)?.property_id ?? null) ? String((sess as any).property_id) : null;
      } catch {}
      const filtered = (reviews || []).filter((r: any) => !department || String(r.department || '').toLowerCase() === String(department).toLowerCase());
      // Enrich with asset details when available
      let assets: Asset[] = assetsCache || [];
      if (!assets.length) {
        try { assets = await listAssets().catch(() => [] as any); setAssetsCache(assets); } catch {}
      }
      const byId = new Map((assets || []).map(a => [String(a.id), a]));
    const rows = filtered.map((r: any) => {
        const a = byId.get(String(r.asset_id));
        return {
          session_id: r.session_id,
          department: r.department || '',
          asset_id: r.asset_id,
          asset_name: a?.name || '',
          property: (a as any)?.property || '',
      // Fall back to session property when asset metadata is unavailable
      property_id: ((a as any)?.property_id ?? null) ? String((a as any).property_id) : (sessionPropertyId ?? null),
          type: a?.type || '',
          status: r.status,
          comment: r.comment || '',
          updated_at: r.updated_at || ''
        };
      });
    // If a specific property is selected, apply it; otherwise, for non-admins apply allowed property scoping
    const isAdmin = isAdminRole;
    // Be tolerant when property_id is unreadable due to RLS; don't drop rows just because property can't be resolved
    const rows2Unscoped = rows.filter(r => !propertyId || !r.property_id || String(r.property_id) === String(propertyId));
    const rows2 = (isAdmin || propertyId || !allowedProps.size)
      ? rows2Unscoped
      : rows2Unscoped.filter(r => r.property_id && allowedProps.has(String(r.property_id)));
      // Put issues first to make them prominent
      const order = { missing: 0, damaged: 1, verified: 2 } as any;
    return rows2.sort((a,b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    } catch {
      return [];
    }
  }

  // PDF with highlighting for missing/damaged
  function downloadAuditPdfFromRows(name: string, rows: any[]) {
    if (!rows.length) { toast.info('No data to download for this report'); return; }
    const cols = Object.keys(rows[0]);
    const thead = `<tr>${cols.map(c => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">${c}</th>`).join('')}</tr>`;
    const tbody = rows.map(r => {
      const status = String(r.status || '').toLowerCase();
      const bg = status === 'missing' ? '#fee2e2' : (status === 'damaged' ? '#fef3c7' : 'transparent');
      const fw = status === 'missing' ? '600' : 'normal';
      return `<tr style="background:${bg};font-weight:${fw};">${cols.map(c => {
        const val = (r[c] ?? '');
        return `<td style="padding:8px;border-bottom:1px solid #f0f0f0;">${val}</td>`;
      }).join('')}</tr>`;
    }).join('');
    const totals = rows.reduce((acc, r) => { const s = String(r.status || '').toLowerCase(); acc[s] = (acc[s]||0)+1; return acc; }, {} as Record<string, number>);
    const summary = `<div class="summary"><span class="chip ok">Verified: ${totals['verified'] || 0}</span><span class="chip warn">Damaged: ${totals['damaged'] || 0}</span><span class="chip err">Missing: ${totals['missing'] || 0}</span></div>`;
    const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const normalizedBase = (base || '').replace(/\/$/, '');
    const logoSrc = `${normalizedBase}/favicon.png`;
  const titleName = `SAMS-AuditReport-${name}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${titleName}</title>
    <style>@page{size:A4;margin:16mm} body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#111} h1{font-size:18px;margin:0 0 8px} table{border-collapse:collapse;width:100%;font-size:12px} .meta{color:#666;font-size:12px;margin-bottom:8px} .brand{display:flex;align-items:center;gap:10px;margin-bottom:6px} .brand img{height:28px;width:28px;object-fit:contain} .summary{display:flex;gap:8px;margin:8px 0 12px} .chip{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,0.08)} .chip.ok{background:#ecfdf5;color:#065f46;border-color:#a7f3d0} .chip.warn{background:#fffbeb;color:#92400e;border-color:#fde68a} .chip.err{background:#fef2f2;color:#991b1b;border-color:#fecaca}</style>
    </head><body>
  <div class="brand"><img src='${logoSrc}' onerror="this.src='/favicon.ico'" alt='logo' /><h1>SAMS Audit Report — ${name}</h1></div>
    <div class="meta">Generated at ${new Date().toLocaleString()}</div>
    ${summary}
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    doc?.open(); doc?.write(html); doc?.close();
    const trigger = () => { try { iframe.contentWindow?.focus(); setTimeout(() => iframe.contentWindow?.print(), 50); } finally { setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000); } };
    setTimeout(trigger, 200);
  }

  // Download a CSV for a given recent report (client-side export snapshot)
  const downloadReportCsv = async (report: any) => {
    try {
      // Prepare data set
      if (String(report.type || '') === 'audit-review') {
        const sid = (report as any).filter_session_id || (() => {
          const n = String(report.name || '');
          const m = n.match(/Session\s+([\w-]+)/i);
          return m ? m[1] : '';
        })();
        const dep = (report as any).filter_department || (() => {
          const n = String(report.name || '');
          const m = n.match(/-\s([^-]+)\s-\s\d{4}-\d{2}-\d{2}$/);
          const v = m ? m[1].trim() : undefined;
          if (!v || /^all$/i.test(v)) return undefined;
          return v;
        })();
        if (!sid) { toast.error('No session ID found on this report'); return; }
  const rows = await buildAuditRows(sid, dep, ((report as any).filter_property || undefined));
        if (!rows.length) { toast.info('No data to download for this report'); return; }
        downloadCsvFromRows(String(report.name || 'report'), rows);
        toast.success('Report downloaded');
        return;
      }
      let rows: any[] = [];
      const assets: Asset[] = (assetsCache && assetsCache.length)
        ? assetsCache
        : (await listAssets().catch(() => [])) as Asset[];
      if (!assetsCache || (assetsCache && !assetsCache.length)) {
        try { setAssetsCache(assets); } catch {}
      }
      const from = report.date_from ? new Date(report.date_from) : undefined;
      const to = report.date_to ? new Date(report.date_to) : undefined;
      // Prefer stored filter metadata
      const depStored = (report as any).filter_department || undefined;
      const propStored = (report as any).filter_property || undefined;
      const typeStored = (report as any).filter_asset_type || undefined;
      // Fallback to parsing from name if needed
      const dep = depStored ?? (() => {
        const n = String(report.name || '');
        const m = n.match(/Department-wise[^-]*-\s*([^\-\n]+)/i);
        const v = m ? m[1].trim() : undefined;
        if (!v) return undefined;
        if (/^all\b/i.test(v)) return undefined;
        return v;
      })();
      rows = buildRows({ type: String(report.type || ''), assets, dateFrom: from, dateTo: to, department: dep, propertyId: propStored, assetType: typeStored });
      if (!rows.length) { toast.info('No data to download for this report'); return; }
      downloadCsvFromRows(String(report.name || 'report'), rows);
      toast.success('Report downloaded');
    } catch (e) {
      console.error(e);
      toast.error("Failed to download report");
    }
  };
  const downloadReportPdf = async (report: any) => {
    try {
      if (String(report.type || '') === 'audit-review') {
        const sid = (report as any).filter_session_id || (() => {
          const n = String(report.name || '');
          const m = n.match(/Session\s+([\w-]+)/i);
          return m ? m[1] : '';
        })();
        const dep = (report as any).filter_department || (() => {
          const n = String(report.name || '');
          const m = n.match(/-\s([^-]+)\s-\s\d{4}-\d{2}-\d{2}$/);
          const v = m ? m[1].trim() : undefined;
          if (!v || /^all$/i.test(v)) return undefined;
          return v;
        })();
        if (!sid) { toast.error('No session ID found on this report'); return; }
  const rows = await buildAuditRows(sid, dep, ((report as any).filter_property || undefined));
        if (!rows.length) { toast.info('No data to download for this report'); return; }
        try {
          const sessMeta = await getSessionById(sid);
          const friendly = formatAuditSessionName(sessMeta || { id: sid } as any);
          downloadAuditPdfFromRows(friendly, rows);
        } catch {
          downloadAuditPdfFromRows(String(report.name || 'report'), rows);
        }
        return;
      }
      const assets: Asset[] = (assetsCache && assetsCache.length)
        ? assetsCache
        : (await listAssets().catch(() => [])) as Asset[];
      if (!assetsCache || (assetsCache && !assetsCache.length)) {
        try { setAssetsCache(assets); } catch {}
      }
      const from = report.date_from ? new Date(report.date_from) : undefined;
      const to = report.date_to ? new Date(report.date_to) : undefined;
      const depStored = (report as any).filter_department || undefined;
      const propStored = (report as any).filter_property || undefined;
      const typeStored = (report as any).filter_asset_type || undefined;
      const dep = depStored ?? (() => {
        const n = String(report.name || '');
        const m = n.match(/Department-wise[^-]*-\s*([^\-\n]+)/i);
        const v = m ? m[1].trim() : undefined;
        if (!v) return undefined;
        if (/^all\b/i.test(v)) return undefined;
        return v;
      })();
      const rows = buildRows({ type: String(report.type || ''), assets, dateFrom: from, dateTo: to, department: dep, propertyId: propStored, assetType: typeStored });
      if (!rows.length) { toast.info('No data to download for this report'); return; }
      downloadPdfFromRows(String(report.name || 'report'), rows);
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    }
  };

  // Derived approvals filtered dataset for the Approvals Log
  const approvalsFiltered = (() => {
    const list = approvalsAll ?? [];
    const from = apDateFrom ? new Date(apDateFrom.setHours(0,0,0,0)) : null;
    const to = apDateTo ? new Date(apDateTo.setHours(23,59,59,999)) : null;
    return list.filter(a => {
      const when = a?.requestedAt ? new Date(a.requestedAt) : null;
      if (from && (!when || when < from)) return false;
      if (to && (!when || when > to)) return false;
      if (apStatus === 'approved') return a.status === 'approved';
      if (apStatus === 'rejected') return a.status === 'rejected';
      if (apStatus === 'pending') return a.status === 'pending_manager' || a.status === 'pending_admin';
      return true; // all
    }).sort((a,b) => (new Date(b.requestedAt).getTime()) - (new Date(a.requestedAt).getTime()));
  })();

  const reportSummary = useMemo(() => {
    const list = Array.isArray(recentReports) ? recentReports : [];
    let completed = 0;
    let latest = 0;
    list.forEach((entry: any) => {
      const status = String(entry?.status || 'completed').toLowerCase();
      if (status === 'completed' || status === 'complete' || status === 'done') completed += 1;
      const stamp = entry?.created_at || entry?.createdAt || entry?.createdAtUtc || entry?.createdDate;
      if (stamp) {
        const value = new Date(stamp).getTime();
        if (!Number.isNaN(value) && value > latest) latest = value;
      }
    });
    const total = list.length;
    const pending = Math.max(total - completed, 0);
    const lastGeneratedLabel = latest ? new Date(latest).toLocaleString() : '—';
    return { total, completed, pending, lastGeneratedLabel };
  }, [recentReports]);

  const pendingApprovalsCount = useMemo(() => {
    return approvalsFiltered.filter((approval) => {
      const status = String(approval.status || '').toLowerCase();
      return status.includes('pending');
    }).length;
  }, [approvalsFiltered]);

  const activeAuditSessions = useMemo(() => {
    return auditSessions.filter((session) => Boolean(session?.is_active)).length;
  }, [auditSessions]);

  const heroTiles = useMemo(() => {
    return [
      {
        key: 'generated',
        label: 'Reports Generated',
        value: reportSummary.total.toLocaleString(),
        hint: reportSummary.total
          ? `Last generated ${reportSummary.lastGeneratedLabel}`
          : 'Create your first report to populate this feed',
        icon: FileBarChart,
        iconClass: 'text-primary',
      },
      {
        key: 'completed',
        label: 'Completed Reports',
        value: reportSummary.completed.toLocaleString(),
        hint: reportSummary.pending
          ? `${reportSummary.pending.toLocaleString()} pending`
          : 'No pending reports',
        icon: Download,
        iconClass: 'text-emerald-500 dark:text-emerald-400',
      },
      {
        key: 'approvals',
        label: 'Pending Approvals',
        value: pendingApprovalsCount.toLocaleString(),
        hint: pendingApprovalsCount ? 'Awaiting review' : 'All approvals up to date',
        icon: FileText,
        iconClass: 'text-amber-500 dark:text-amber-400',
      },
      {
        key: 'audits',
        label: 'Active Audit Sessions',
        value: activeAuditSessions.toLocaleString(),
        hint: `${auditSessions.length.toLocaleString()} total sessions`,
        icon: BarChart3,
        iconClass: 'text-sky-500 dark:text-sky-400',
      },
    ];
  }, [reportSummary, pendingApprovalsCount, activeAuditSessions, auditSessions]);

  const exportApprovalsCsv = () => {
    try {
      const rows = approvalsFiltered.map(a => ({
        id: a.id,
        assetId: a.assetId,
        action: a.action,
        status: a.status,
        department: a.department ?? '',
        requestedBy: a.requestedBy,
        requestedAt: a.requestedAt,
        reviewedBy: a.reviewedBy ?? '',
        reviewedAt: a.reviewedAt ?? '',
  notes: (a.notes ?? '').toString().replace(/\n/g,' '),
      }));
      const toCsv = (data: any[]) => {
        if (!data.length) return '';
        const cols = Object.keys(data[0]);
        const header = cols.join(',');
        const lines = data.map(r => cols.map(c => {
          const v = (r[c] ?? '').toString().replace(/"/g, '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        }).join(','));
        return [header, ...lines].join('\n');
      };
      const csv = toCsv(rows);
      if (!csv) { toast.info('No approvals to export'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `approvals_log_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Approvals log downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export approvals');
    }
  };

  const toggleApprovalsLog = () => {
    setShowApprovalsLog((prev) => {
      const next = !prev;
      if (!prev) {
        setTimeout(() => {
          const el = document.getElementById('approvals-log');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6" id="reports-top">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Reports" }]} />

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <PageHeader
          icon={FileBarChart}
          title="Reports & Insights"
          description="Generate compliance-ready exports, enrich audit reviews, and keep your teams informed."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {(isAdminRole || role === 'manager') && (
                <Button
                  className="gap-2"
                  variant="outline"
                  size="sm"
                  onClick={toggleApprovalsLog}
                >
                  <FileText className="h-4 w-4" /> Approvals Log
                </Button>
              )}
              <Button onClick={handleGenerateReport} className="gap-2" size="sm">
                <Download className="h-4 w-4" /> Generate Report
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {heroTiles.map((tile) => (
          <div key={tile.key} className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{tile.value}</p>
              </div>
              <tile.icon className={`h-5 w-5 ${tile.iconClass}`} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </div>

      {/* Quick Report Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportTypes.map((report) => (
            <Card
              key={report.id}
              className="rounded-2xl border border-border/60 bg-card shadow-sm transition hover:shadow-md"
            >
              <CardHeader className="flex flex-col gap-3 pb-2">
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <report.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base text-foreground">{report.name}</CardTitle>
                    <CardDescription className="mt-1 text-xs text-muted-foreground">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0 sm:flex-row sm:items-center">
                <Button
                  onClick={() => handleQuickReport(report.id)}
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" /> Quick Generate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setSelectedReportType(report.id);
                    const el = document.getElementById('custom-report-generator');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>

        {/* Quick Generate — Audit Review Picker */}
        <Dialog open={auditQuickOpen} onOpenChange={setAuditQuickOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Audit Review — Quick Generate</DialogTitle>
              <DialogDescription>Select filters to generate CSV</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Audit Session</Label>
                <Select value={qrSessionId} onValueChange={setQrSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select audit session" />
                  </SelectTrigger>
                  <SelectContent>
                    {auditSessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>{formatAuditSessionName(s)} {s.is_active ? '(Active)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={qrDept} onValueChange={setQrDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={qrProperty} onValueChange={setQrProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="All properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditQuickOpen(false)}>Cancel</Button>
              <Button onClick={confirmQuickAudit} disabled={!qrSessionId}>Generate CSV</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Custom Report Generator */}
        <Card id="custom-report-generator" className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Custom Report Generator</CardTitle>
            <CardDescription>
              Configure and generate custom reports with specific filters and date ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      {report.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="block mb-2">Date Range</Label>
              <DateRangePicker
                value={{ from: dateFrom, to: dateTo }}
                onChange={(r) => { setDateFrom(r.from); setDateTo(r.to); }}
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedReportType === 'audit-review' && (
                <div className="space-y-2 md:col-span-1">
                  <Label>Audit Session</Label>
                  <Select value={selectedAuditSessionId} onValueChange={setSelectedAuditSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audit session" />
                    </SelectTrigger>
                    <SelectContent>
                      {auditSessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>{formatAuditSessionName(s)} {s.is_active ? '(Active)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Property Filter</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asset Type Filter</Label>
                <Select value={selectedAssetType} onValueChange={setSelectedAssetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {itemTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedReportType === 'department-wise' || selectedReportType === 'audit-review') && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={deptForReport} onValueChange={setDeptForReport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Output Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Report Format</Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Delivery Options</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="email-report"
                    checked={emailReport}
                    onCheckedChange={(v) => setEmailReport(Boolean(v))}
                  />
                  <Label htmlFor="email-report" className="text-sm font-normal">
                    Email report to administrators
                  </Label>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <Button onClick={handleGenerateReport} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Generate Custom Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Recent Reports</CardTitle>
                <CardDescription>Previously generated reports and scheduled reports</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="w-40">
                  <Select value={rrRange} onValueChange={(v: any) => setRrRange(v)}>
                    <SelectTrigger><SelectValue placeholder="Range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {rrRange === 'custom' && (
                  <div className="min-w-[260px]">
                    <DateRangePicker
                      value={{ from: rrFrom, to: rrTo }}
                      onChange={(r) => { setRrFrom(r.from); setRrTo(r.to); }}
                    />
                  </div>
                )}
                {isAdminRole && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = window.confirm('Clear all recent report logs? This cannot be undone.');
                      if (!ok) return;
                      try {
                        await clearReports();
                        // Refetch to verify cleared server-side
                        try {
                          const fresh = await listReports();
                          setRecentReports(scopeRecentReports(fresh as any, allowedProps));
                          if (!fresh || fresh.length === 0) {
                            toast.success('Recent report logs cleared');
                          } else {
                            toast.error('Could not clear all logs. Check Supabase RLS/policies.');
                          }
                        } catch {
                          setRecentReports([]);
                          toast.success('Recent report logs cleared');
                        }
                      } catch (e) {
                        console.error(e);
                        toast.error('Failed to clear logs');
                      }
                    }}
                  >
                    Clear Logs
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const list = (recentReports ?? []) as any[];
                const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0,0,0,0);
                const from = rrRange === 'today' ? todayStart : rrRange === '7d' ? sevenDaysAgo : (rrRange === 'custom' ? (rrFrom ? new Date(new Date(rrFrom).setHours(0,0,0,0)) : undefined) : undefined);
                const to = rrRange === 'custom' ? (rrTo ? new Date(new Date(rrTo).setHours(23,59,59,999)) : undefined) : undefined;
                const filtered = list.filter(r => {
                  const when = r.created_at ? new Date(r.created_at) : null;
                  if (rrRange === 'all') return true;
                  if (rrRange === 'today') return when && when >= todayStart;
                  if (rrRange === '7d') return when && when >= sevenDaysAgo;
                  if (rrRange === 'custom') {
                    if (from && (!when || when < from)) return false;
                    if (to && (!when || when > to)) return false;
                    return true;
                  }
                  return true;
                });
                if (!filtered.length) {
                  return (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No recent reports
                    </div>
                  );
                }
                const limited = rrRange === 'all' ? filtered.slice(0, 5) : filtered;
                return limited.map((report: any, index: number) => (
                  <div key={report.id ?? index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.type} • {report.created_at ? new Date(report.created_at).toLocaleString() : "-"} • {report.format} • by {report.created_by || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded",
                        (report.status || "Completed") === "Completed" 
                          ? "bg-success/10 text-success" 
                          : "bg-warning/10 text-warning"
                      )}>
                        {report.status || "Completed"}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Download className="h-4 w-4" />
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => downloadReportCsv(report)}>Download CSV</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadReportPdf(report)}>Download PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ));
              })()}
              {(() => {
                if (rrRange === 'all') {
                  const total = (recentReports ?? []).length;
                  if (total > 5) {
                    return (
                      <div className="pt-2 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setRrRange('7d')}>
                          Show more
                        </Button>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Tickets Report (Managers/Admins) */}
        {(isAdminRole || role === 'manager') && (
          <Card id="tickets-report" className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Tickets Report</CardTitle>
              <CardDescription>Export tickets with scope and date filters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-48">
                  <Select value={tkScope} onValueChange={setTkScope}>
                    <SelectTrigger><SelectValue placeholder="Scope" /></SelectTrigger>
                    <SelectContent>
                      {/* Manager scopes */}
                      <SelectItem value="mine-received">Received by me</SelectItem>
                      <SelectItem value="mine-raised">Raised by me</SelectItem>
                      {/* Admin extra scopes */}
                      {isAdminRole && (
                        <>
                          <SelectItem value="all">All (everyone)</SelectItem>
                          <SelectItem value="target-admin">Target: Admin</SelectItem>
                          <SelectItem value="target-manager">Target: Manager</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <DateRangePicker value={{ from: tkFrom, to: tkTo }} onChange={(r) => { setTkFrom(r.from); setTkTo(r.to); }} />
                </div>
                <Button variant="outline" size="sm" onClick={exportTicketsCsv}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approvals Log (restricted to admin/manager) */}
        {(isAdminRole || role === 'manager') && showApprovalsLog && (
          <Card id="approvals-log" className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Approvals Log</CardTitle>
              <CardDescription>Department-scoped approvals with status and date filters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40">
                  <Select value={apStatus} onValueChange={(v: any) => setApStatus(v)}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isAdminRole ? (
                  <div className="w-48">
                    <Select value={apDeptFilter} onValueChange={setApDeptFilter}>
                      <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All departments</SelectItem>
                        {apDepartments.map(d => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  myDept ? <div className="text-sm text-muted-foreground">Department: <span className="font-medium text-foreground">{myDept}</span></div> : null
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  <DateRangePicker
                    value={{ from: apDateFrom, to: apDateTo }}
                    onChange={(r) => { setApDateFrom(r.from); setApDateTo(r.to); }}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportApprovalsCsv} disabled={!approvalsFiltered.length}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Reviewed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalsFiltered.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="font-mono text-xs">{a.assetId}</TableCell>
                        <TableCell className="capitalize">{a.action}</TableCell>
                        <TableCell className="capitalize"><StatusChip status={a.status} /></TableCell>
                        <TableCell>{a.department || '-'}</TableCell>
                        <TableCell>{a.requestedBy}</TableCell>
                        <TableCell>{a.requestedAt?.slice(0,19).replace('T',' ')}</TableCell>
                        <TableCell>{a.reviewedBy || '-'}</TableCell>
                        <TableCell>{a.reviewedAt ? a.reviewedAt.slice(0,19).replace('T',' ') : '-'}</TableCell>
                      </TableRow>
                    ))}
                    {!approvalsFiltered.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">No approvals found for the selected filters</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {(!hasSupabaseEnv) && (
          <Card className="rounded-2xl border border-warning/50 bg-warning/10 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <FileBarChart className="h-6 w-6 text-warning shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Advanced Reporting Features</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect Supabase to enable persisted reports, scheduling, and email delivery.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
