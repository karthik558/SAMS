import { StatCard } from "@/components/ui/stat-card";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MyAudits } from "@/components/dashboard/MyAudits";
import { Package, Building2, Users, AlertTriangle, TrendingUp, QrCode, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode, demoStats } from "@/lib/demo";
import { useEffect, useRef, useState } from "react";
import { listAssets } from "@/services/assets";
import { listProperties } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { listUsers } from "@/services/users";
import { listQRCodes } from "@/services/qrcodes";
import { downloadAssetTemplate, importAssetsFromFile } from "@/services/bulkImport";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";

const Index = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ assets: 1247, properties: 8, users: 24, expiring: 15 });
  const [metrics, setMetrics] = useState({ totalQuantity: 20, monthlyPurchases: 0, monthlyPurchasesPrev: 0, codesTotal: 156, codesReady: 0, assetTypes: 0 });
  const [firstName, setFirstName] = useState<string>("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [role, setRole] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<string>("");
  const [loadingUI, setLoadingUI] = useState(true);

  useEffect(() => {
  if (isDemoMode()) {
    const s = demoStats();
    setCounts(s.counts as any);
    setMetrics(s.metrics as any);
    setLoadingUI(false);
    return;
  }
  if (!hasSupabaseEnv) { setLoadingUI(false); return; }
    (async () => {
      try {
    const uiTimer = setTimeout(() => setLoadingUI(true), 100); // ensure skeleton visible if slow
        const [assetsRaw, propertiesRaw, users, qrs] = await Promise.all([
          listAssets().catch(() => [] as any[]),
          listProperties().catch(() => [] as any[]),
          listUsers().catch(() => [] as any[]),
          listQRCodes().catch(() => [] as any[]),
        ]);
        // Scope by user access for non-admins
        let assets: any[] = assetsRaw;
        let properties: any[] = propertiesRaw;
        let qrsScoped: any[] = qrs as any[];
        try {
          const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
          const u = raw ? JSON.parse(raw) : null;
          const isAdmin = String(u?.role || '').toLowerCase() === 'admin';
          if (!isAdmin) {
            const allowed = await getAccessiblePropertyIdsForCurrentUser();
            if (allowed && allowed.size) {
              properties = properties.filter((p: any) => allowed.has(String(p.id)));
              const allowedIds = new Set(Array.from(allowed));
              assets = assets.filter((a: any) => allowedIds.has(String(a.property_id || a.property)));
              // Scope QR codes to allowed property ids as well
              qrsScoped = (qrs as any[]).filter((q: any) => allowedIds.has(String(q.property)));
            }
          }
        } catch {}
  const expiringSoon = (assets as any[]).filter(a => {
          if (!a.expiryDate) return false;
          const d = new Date(a.expiryDate);
          const now = new Date();
          const diff = (d.getTime() - now.getTime()) / (1000*60*60*24);
          return diff >= 0 && diff <= 30;
        }).length;
        setCounts({ assets: assets.length, properties: properties.length, users: users.length, expiring: expiringSoon });

        // Derived metrics
  const totalQuantity = (assets as any[]).reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        const assetTypes = (() => {
          try {
            const set = new Set<string>();
            (assets as any[]).forEach((a) => {
              const t = String((a as any).type ?? "").trim();
              if (t) set.add(t);
            });
            return set.size;
          } catch { return 0; }
        })();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const startThisMonth = new Date(year, month, 1);
        const startNextMonth = new Date(year, month + 1, 1);
        const startPrevMonth = new Date(year, month - 1, 1);
        const endPrevMonth = new Date(year, month, 1);
        const monthlyPurchases = (assets as any[]).filter(a => a.purchaseDate && new Date(a.purchaseDate) >= startThisMonth && new Date(a.purchaseDate) < startNextMonth).length;
        const monthlyPurchasesPrev = (assets as any[]).filter(a => a.purchaseDate && new Date(a.purchaseDate) >= startPrevMonth && new Date(a.purchaseDate) < endPrevMonth).length;
        const codesTotal = (qrsScoped as any[]).length;
        const codesReady = (qrsScoped as any[]).filter((q: any) => !q.printed).length;
        setMetrics({ totalQuantity, monthlyPurchases, monthlyPurchasesPrev, codesTotal, codesReady, assetTypes });
  clearTimeout(uiTimer);
  setLoadingUI(false);
      } catch (e) {
        console.error(e);
  setLoadingUI(false);
      }
    })();
  }, []);

  // Load current user's first name for greeting
  useEffect(() => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
      if (raw) {
        const u = JSON.parse(raw) as { name?: string; role?: string };
        const fn = String(u?.name || "").trim().split(/\s+/)[0] || "";
        setFirstName(fn);
        setRole(String(u?.role || "").toLowerCase());
      }
    } catch {
      // ignore
    }
  }, []);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "Add Asset":
  navigate(isDemoMode() ? "/demo/assets?new=1" : "/assets?new=1");
        break;
      case "Generate QR Codes":
  navigate(isDemoMode() ? "/demo/qr-codes" : "/qr-codes");
        break;
      case "Property Report":
      case "Generate Report":
  navigate(isDemoMode() ? "/demo/reports" : "/reports");
        if (!hasSupabaseEnv) {
          toast.info("Reports may be limited without Supabase configured");
        }
        break;
      case "User Management":
  navigate(isDemoMode() ? "/demo/users" : "/users");
        break;
      case "Bulk Import":
        setBulkOpen(true);
        break;
      default:
  navigate(isDemoMode() ? "/demo" : "/");
    }
  };

  if (loadingUI) {
    return <DashboardSkeleton />;
  }

  return (
  <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{
              `Welcome to SAMS${firstName ? ", " + firstName : ""}`
            }</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => handleQuickAction("Add Asset")} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
            <Button onClick={() => handleQuickAction("Generate Report")} variant="outline" className="gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>

    {/* Stats Grid: auto-fit so hidden cards don't leave gaps */}
  <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
          <StatCard
            title="Total Assets"
            value={String(counts.assets)}
            description="Active assets"
            icon={Package}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Properties"
            value={String(counts.properties)}
            description="Managed locations"
            icon={Building2}
            trend={{ value: 2, isPositive: true }}
          />
          <StatCard
            title="Asset Types"
            value={String(metrics.assetTypes)}
            description="Distinct categories"
            icon={Shapes}
          />
          <StatCard
            title="Expiring Soon"
            value={String(counts.expiring)}
            description="Within 30 days"
            icon={AlertTriangle}
            trend={{ value: 5, isPositive: false }}
          />
        </div>

        {/* Value Overview */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Asset Quantity
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalQuantity}</div>
              <p className="text-xs text-muted-foreground">Across all assets</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Purchases
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.monthlyPurchases}</div>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const prev = metrics.monthlyPurchasesPrev;
                  const curr = metrics.monthlyPurchases;
                  if (prev === 0 && curr === 0) return "No change from last month";
                  if (prev === 0) return "+100% from last month";
                  const pct = Math.round(((curr - prev) / prev) * 100);
                  return `${pct >= 0 ? "+" : ""}${pct}% from last month`;
                })()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                QR Codes Generated
              </CardTitle>
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.codesTotal}</div>
              <p className="text-xs text-muted-foreground">Ready for printing: {metrics.codesReady}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Activity */}
  <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardCharts />
          </div>
          <div className="min-h-0 space-y-4">
            <RecentActivity />
            <MyAudits />
          </div>
        </div>

    {/* Quick Actions: auto-fit so hidden actions reflow without blank space */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts for efficient asset management
            </CardDescription>
          </CardHeader>
          <CardContent>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Bulk Import")}
              >
                <Download className="h-6 w-6" />
                <span className="text-sm">Bulk Import Assets</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Generate QR Codes")}
              >
                <Package className="h-6 w-6" />
                <span className="text-sm">Generate QR Codes</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Property Report")}
              >
                <Building2 className="h-6 w-6" />
                <span className="text-sm">Property Reports</span>
              </Button>
              {role === 'admin' && (
                <Button 
                  variant="outline" 
                  className="h-auto flex-col gap-2 p-4"
                  onClick={() => handleQuickAction("User Management")}
                >
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Manage Users</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bulk Import Dialog */}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Bulk Import Assets</DialogTitle>
              <DialogDescription>
                Download the Excel template, fill in asset rows, then upload to import. IDs are generated automatically based on Item Type + Property code.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={async () => { await downloadAssetTemplate(); }} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Select File
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  try {
                    const res = await importAssetsFromFile(file);
                    setLastImportSummary(`Inserted: ${res.inserted}, Skipped: ${res.skipped}${res.errors.length ? `, Errors: ${res.errors.length}` : ''}`);
                    if (res.errors.length) {
                      console.warn("Import errors", res.errors);
                    }
                    toast.success(`Imported ${res.inserted} asset(s)`);
                    // refresh counts & metrics quickly
                    if (hasSupabaseEnv) {
                      try {
                        const assets = await listAssets();
                        setCounts((c) => ({ ...c, assets: assets.length }));
                        const totalQuantity = assets.reduce((sum: number, a: any) => sum + (Number(a.quantity) || 0), 0);
                        setMetrics((m) => ({ ...m, totalQuantity }));
                      } catch {}
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Import failed");
                  } finally {
                    setImporting(false);
                  }
                }} />
              </div>
              {lastImportSummary && (
                <p className="text-xs text-muted-foreground">Last import: {lastImportSummary}</p>
              )}
              {!hasSupabaseEnv && (
                <p className="text-xs text-warning-foreground">Backend not connected. Import requires Supabase.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Close</Button>
              <Button disabled className="gap-2" variant="secondary">
                {importing ? "Importing..." : "Ready"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Backend Connection Notice */}
        {!hasSupabaseEnv && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-warning shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Connect to Supabase for Full Functionality</h3>
                  <p className="text-sm text-muted-foreground">
                    This asset management system requires a backend database for user authentication, 
                    asset storage, and full functionality. Add your Supabase keys to .env.local to enable features like:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• User authentication and role-based access</li>
                    <li>• Asset and property data storage</li>
                    <li>• Real-time updates and audit logs</li>
                    <li>• Report generation and data export</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  );
};

export default Index;
