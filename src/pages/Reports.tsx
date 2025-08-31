import { useEffect, useState } from "react";
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
  Filter, 
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
import { listItemTypes } from "@/services/itemTypes";
import { listReports, createReport, clearReports, type Report } from "@/services/reports";
import { addNotification } from "@/services/notifications";
import { listAssets, type Asset } from "@/services/assets";
import { listApprovals, type ApprovalRequest } from "@/services/approvals";
import { listDepartments, type Department } from "@/services/departments";
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
];

export default function Reports() {
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
  // Recent Reports filters
  const [rrRange, setRrRange] = useState<'all' | 'today' | '7d' | 'custom'>('all');
  const [rrFrom, setRrFrom] = useState<Date | undefined>();
  const [rrTo, setRrTo] = useState<Date | undefined>();

  // Approvals Log state (admin/manager only)
  const [approvalsAll, setApprovalsAll] = useState<ApprovalRequest[] | null>(null);
  const [apStatus, setApStatus] = useState<'all'|'pending'|'approved'|'rejected'>('all');
  const [apDateFrom, setApDateFrom] = useState<Date | undefined>();
  const [apDateTo, setApDateTo] = useState<Date | undefined>();
  const [apDepartments, setApDepartments] = useState<Department[]>([]);
  const [apDeptFilter, setApDeptFilter] = useState<string>('ALL');
  const [showApprovalsLog, setShowApprovalsLog] = useState<boolean>(false);
  const currentUser = (() => { try { const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })() as any;
  const role: string = (currentUser?.role || '').toLowerCase();
  const myDept: string | null = currentUser?.department ?? null;

  // Load properties, item types, and recent reports
  // When Supabase is enabled, pull live data; else use light fallbacks
  useEffect(() => {
    (async () => {
      try {
    if (hasSupabaseEnv || isDemoMode()) {
          const [props, types] = await Promise.all([
            listProperties().catch(() => []),
            listItemTypes().catch(() => []),
          ]);
          setProperties(props as Property[]);
          setItemTypes((types as any[]).map(t => t.name));
          // Preload assets for downloads/export
          try {
      const assets = await listAssets();
            setAssetsCache(assets as Asset[]);
          } catch { /* ignore */ }
          // Load departments for admin Approvals Log filter and for department-wise reports
          try {
            const depts = await listDepartments() as Department[];
            setDepartments(depts);
            if (role === 'admin') setApDepartments(depts);
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
          setRecentReports(reports);
        } else {
          setRecentReports(null);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load approvals for the Approvals Log whenever department filter or role changes
  useEffect(() => {
    (async () => {
      try {
        const dept = role === 'admin' ? (apDeptFilter === 'ALL' ? null : apDeptFilter) : (role === 'manager' ? (myDept || null) : null);
        const list = await listApprovals(undefined, dept as any, undefined);
        setApprovalsAll(list);
      } catch (e) {
        console.error(e);
        setApprovalsAll([]);
      }
    })();
  }, [role, myDept, apDeptFilter]);

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
      department: selectedReportType === 'department-wise' ? (deptForReport === 'ALL' ? undefined : deptForReport) : undefined,
      format: reportFormat,
      email: emailReport
    };

  try {
  if (hasSupabaseEnv || isDemoMode()) {
        await createReport({
          name: `${reportTypes.find(r => r.id === selectedReportType)?.name}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`,
          type: selectedReportType,
          format: reportFormat.toUpperCase(),
          status: "Completed",
          date_from: dateFrom ? new Date(dateFrom).toISOString().slice(0,10) : null,
          date_to: dateTo ? new Date(dateTo).toISOString().slice(0,10) : null,
          file_url: null,
          filter_department: reportData.department ?? null,
          filter_property: selectedProperty !== 'all' ? selectedProperty : null,
      filter_asset_type: selectedAssetType !== 'all' ? selectedAssetType : null,
      // creator metadata
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
        setRecentReports(reports);
        await addNotification({
          title: "Report generated",
          message: `${reportTypes.find(r => r.id === selectedReportType)?.name} is ready for download`,
          type: "report",
        });
      }
      // Also generate a client-side export immediately using current selections
      try {
        const assets = assetsCache ?? await listAssets().catch(() => [] as any);
        const rows = buildRows({
          type: selectedReportType,
          assets: assets as any[],
          dateFrom,
          dateTo,
          department: reportData.department,
          propertyId: selectedProperty !== 'all' ? selectedProperty : undefined,
          assetType: selectedAssetType !== 'all' ? selectedAssetType : undefined,
        });
        if (rows.length) {
          if (reportFormat === 'pdf') downloadPdfFromRows(`${reportTypes.find(r => r.id === selectedReportType)?.name}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`, rows);
          else downloadCsvFromRows(`${reportTypes.find(r => r.id === selectedReportType)?.name}${reportData.department ? ` - ${reportData.department}` : ''} - ${new Date().toISOString().slice(0,10)}`, rows);
        } else {
          toast.info('No data matched your filters');
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
      const assets = assetsCache ?? await listAssets().catch(() => [] as any);
      setAssetsCache(Array.isArray(assets) ? assets : []);
      // Build rows
      const rows = buildRows({
        type: reportType,
        assets: assets as any[],
        dateFrom: undefined,
        dateTo: undefined,
        department: reportType === 'department-wise' ? (deptForReport === 'ALL' ? undefined : deptForReport) : undefined,
      });
      if (!rows.length) { toast.info('No data for this report'); return; }
      downloadCsvFromRows(`${report?.name || 'Report'} - ${new Date().toISOString().slice(0,10)}`, rows);
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
            filter_department: reportType === 'department-wise' ? (deptForReport === 'ALL' ? null : deptForReport) : null,
            filter_property: null,
            filter_asset_type: null,
            created_by: (currentUser?.name || currentUser?.fullName || currentUser?.email || currentUser?.id || null) as any,
            created_by_id: (currentUser?.id || null) as any,
          } as any);
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
          setRecentReports(reports);
        } catch (e) { /* ignore logging failure */ }
      }
      toast.success(`${report?.name} generated`);
    } catch (e:any) {
      console.error(e);
      toast.error(e?.message || 'Failed to generate quick report');
    }
  })();
  };

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
    const html = `<!doctype html><html><head><meta charset=\"utf-8\"/><title>${name}</title>
    <style>@page{size:A4;margin:16mm} body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#111} h1{font-size:18px;margin:0 0 12px} table{border-collapse:collapse;width:100%;font-size:12px} .meta{color:#666;font-size:12px;margin-bottom:8px} .brand{display:flex;align-items:center;gap:10px;margin-bottom:8px} .brand img{height:28px;width:28px;object-fit:contain}</style>
    </head><body>
    <div class=\"brand\"><img src='${logoSrc}' onerror=\"this.src='/favicon.ico'\" alt='logo' /><h1>${name}</h1></div>
    <div class=\"meta\">Generated at ${new Date().toLocaleString()}</div>
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

  return (
    <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Reports" }]} />
        <PageHeader
          icon={FileBarChart}
          title="Reports & Analytics"
          description="Generate comprehensive reports for audit and analysis"
          actions={
            <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
              {(role === 'admin' || role === 'manager') && (
                <Button
                  className="gap-2 w-full sm:w-auto"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowApprovalsLog((v) => !v);
                    setTimeout(() => {
                      const el = document.getElementById('approvals-log');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 0);
                  }}
                >
                  <FileText className="h-4 w-4" /> Approvals Log
                </Button>
              )}
              <Button onClick={handleGenerateReport} className="gap-2 w-full sm:w-auto" size="sm">
                <Download className="h-4 w-4" />
                Generate Report
              </Button>
            </div>
          }
        />

        {/* Quick Report Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:shadow-medium transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
            <CardTitle className="text-base flex items-center gap-2">
                      <report.icon className="h-5 w-5" />
                      {report.name}
                    </CardTitle>
            <CardDescription className="mt-1 text-xs">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
          <CardContent className="pt-0">
                <Button
                  onClick={() => handleQuickReport(report.id)}
            variant="secondary"
            size="sm"
            className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Quick Generate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Report Generator */}
        <Card>
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
              <Label>Date Range</Label>
              <DateRangePicker
                value={{ from: dateFrom, to: dateTo }}
                onChange={(r) => { setDateFrom(r.from); setDateTo(r.to); }}
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {selectedReportType === 'department-wise' && (
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
        <Card>
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
                {role === 'admin' && (
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
                          setRecentReports(fresh);
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
                return filtered.map((report: any, index: number) => (
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
            </div>
          </CardContent>
        </Card>

        {/* Approvals Log (restricted to admin/manager) */}
        {(role === 'admin' || role === 'manager') && showApprovalsLog && (
          <Card id="approvals-log">
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
                {role === 'admin' ? (
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
          <Card className="border-warning/50 bg-warning/5">
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