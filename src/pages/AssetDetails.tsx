import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { 
  Calendar, 
  MapPin, 
  Package, 
  Building2, 
  ShieldCheck, 
  AlertCircle, 
  Copy, 
  ScanLine, 
  ArrowLeft, 
  ClipboardList, 
  Factory, 
  AlertTriangle, 
  Edit,
  Wrench,
  CalendarClock,
  Ticket,
  Clock,
  TrendingDown
} from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode, getDemoAssets } from "@/lib/demo";
import { getAssetById, type Asset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const qrPayload = useMemo(() => {
    try { return JSON.parse(searchParams.get("payload") || "null"); } catch { return null; }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const props = await listProperties();
        setPropsById(Object.fromEntries(props.map(p => [p.id, p])));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        let data: Asset | null = null;
        try {
          data = await getAssetById(id);
        } catch {
          data = null;
        }

        // Graceful fallback to demo assets when asset not found in main DB
        if (!data) {
          try {
            const list = getDemoAssets();
            const clean = id.trim().toLowerCase();
            data = list.find(a => a.id.toLowerCase() === clean) || null;
          } catch {}
        }

        // As a fallback, use data from QR payload when present
        if (!data && qrPayload) {
          data = {
            id: qrPayload.assetId || id,
            name: qrPayload.assetName || "Scanned Asset",
            type: "",
            property: qrPayload.propertyName || qrPayload.property || "",
            property_id: null,
            quantity: 1,
            purchaseDate: null,
            expiryDate: null,
            poNumber: null,
            condition: null,
            status: "",
            location: qrPayload.location || null,
          } as Asset;
        }

        setAsset(data);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load asset");
      }
    })();
  }, [id, qrPayload]);

  const propertyLabel = (code: string | null | undefined) => {
    if (!code) return "-";
    return propsById[code]?.name || code;
  };

  const safeFormatDate = (val: string | null | undefined) => {
    if (!val) return "-";
    try {
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
    } catch {
      return String(val);
    }
  };

  const issuedDateLabel = safeFormatDate(asset?.purchaseDate);
  const expiryDateLabel = safeFormatDate(asset?.expiryDate);
  const conditionLabel = asset?.condition || 'Not specified';

  const amcDaysRemaining = useMemo(() => {
    if (!asset?.amcEndDate) return null;
    const amcEnd = new Date(asset.amcEndDate);
    if (Number.isNaN(amcEnd.getTime())) return null;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(amcEnd.getFullYear(), amcEnd.getMonth(), amcEnd.getDate());
    return Math.ceil((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  }, [asset?.amcEndDate]);

  const formatCurrency = (val: number) => {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
    } catch {
      return `₹${val.toLocaleString()}`;
    }
  };

  const depreciationInfo = useMemo(() => {
    if (!asset?.purchaseDate) return null;
    const pDate = new Date(asset.purchaseDate);
    if (Number.isNaN(pDate.getTime())) return null;

    const typeLower = (asset.type || "").toLowerCase();
    if (typeLower.includes("food") || typeLower.includes("beverage") || typeLower.includes("consumable")) {
      return null;
    }

    let usefulYears = 5;
    let estimatedCost = 35000;
    if (typeLower.includes("laptop") || typeLower.includes("computer") || typeLower.includes("it")) {
      usefulYears = 4;
      estimatedCost = 65000;
    } else if (typeLower.includes("server") || typeLower.includes("network")) {
      usefulYears = 5;
      estimatedCost = 180000;
    } else if (typeLower.includes("furniture") || typeLower.includes("chair") || typeLower.includes("desk")) {
      usefulYears = 10;
      estimatedCost = 18000;
    } else if (typeLower.includes("hvac") || typeLower.includes("machinery") || typeLower.includes("air")) {
      usefulYears = 10;
      estimatedCost = 120000;
    }

    const salvageValue = Math.round(estimatedCost * 0.05);
    const depreciableAmount = estimatedCost - salvageValue;

    const now = new Date();
    const elapsedDays = Math.max(0, (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = usefulYears * 365.25;
    const elapsedYears = elapsedDays / 365.25;

    const annualDepreciation = depreciableAmount / usefulYears;
    const accumulatedDepreciation = Math.min(depreciableAmount, Math.round(annualDepreciation * elapsedYears));
    const netBookValue = Math.max(salvageValue, estimatedCost - accumulatedDepreciation);
    const percentElapsed = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    return {
      estimatedCost,
      salvageValue,
      netBookValue,
      accumulatedDepreciation,
      usefulYears,
      elapsedYears: Math.min(usefulYears, Number(elapsedYears.toFixed(1))),
      percentElapsed,
    };
  }, [asset?.purchaseDate, asset?.type]);

  const handleRaiseTicket = () => {
    if (!asset) return;
    const title = encodeURIComponent(`AMC Service / Maintenance: ${asset.name}`);
    const propId = encodeURIComponent(asset.property_id || asset.property || "");
    const priority = amcDaysRemaining != null && amcDaysRemaining <= 0 ? "urgent" : "high";
    const desc = encodeURIComponent(
      `Asset Name: ${asset.name}\nAsset ID: ${asset.id}\nLocation: ${asset.location || 'N/A'}\nDepartment: ${asset.department || 'N/A'}\nCondition: ${conditionLabel}\nAMC End Date: ${asset.amcEndDate || 'N/A'}\nReason: Routine inspection / warranty renewal.`
    );
    const target = isDemoMode()
      ? `/demo/tickets?title=${title}&propertyId=${propId}&priority=${priority}&description=${desc}`
      : `/tickets?title=${title}&propertyId=${propId}&priority=${priority}&description=${desc}`;
    navigate(target);
  };

  if (!asset) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/60 text-center shadow-lg rounded-2xl">
          <CardHeader>
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <AlertCircle className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">Asset not found</CardTitle>
            <CardDescription>We could not load details for this asset. It may have been removed or the link is invalid.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-lg">
              <Link to={isDemoMode() ? "/demo/assets" : "/assets"}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to assets
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg">
              <Link to={isDemoMode() ? "/demo/scan" : "/scan"}>
                <ScanLine className="mr-2 h-4 w-4" /> Scan again
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
            onClick={() => window.history.length > 1 ? window.history.back() : navigate(isDemoMode() ? '/demo/assets' : '/assets')}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Assets
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
            onClick={() => navigate(isDemoMode() ? '/demo/scan' : '/scan')}
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan Another
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info Card */}
          <Card className="lg:col-span-2 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md">
            <div className="border-b border-border/60 bg-muted/30 px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                    <Package className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground leading-tight">{asset.name || 'Asset Details'}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {asset.status && <StatusChip status={asset.status} />}
                      <Badge variant="outline" className="bg-background/50 text-xs font-medium rounded-lg">
                        {asset.type || 'Unknown type'}
                      </Badge>
                      {hasSupabaseEnv ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800 rounded-lg">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-200 rounded-lg">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Offline preview
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6 space-y-8">
              {/* Asset ID Section */}
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary/80">Asset ID</p>
                  <p className="font-mono text-lg font-bold text-foreground tracking-tight">{asset.id}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(asset.id!); toast.success('Asset ID copied'); } catch { toast.error('Copy failed'); }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy ID
                </Button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Location Details
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Property" value={asset.property_id ? propertyLabel(asset.property_id) : propertyLabel(asset.property || '')} />
                    <DetailRow label="Department" value={asset.department} />
                    <DetailRow label="Specific Location" value={asset.location} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" /> Status & Condition
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Condition" value={conditionLabel} />
                    <DetailRow label="Quantity" value={asset.quantity != null ? asset.quantity.toString() : '-'} />
                    <DetailRow label="PO Number" value={asset.poNumber} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Important Dates
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Purchase Date" value={issuedDateLabel} />
                    <DetailRow label="Expiry Date" value={expiryDateLabel} />
                  </div>
                </div>

                {asset.amcEnabled && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> AMC & Maintenance
                    </h3>
                    <div className="space-y-3">
                      <DetailRow
                        label="Contract Status"
                        value={
                          amcDaysRemaining == null ? "Covered" :
                          amcDaysRemaining < 0 ? (
                            <span className="font-semibold text-destructive">{Math.abs(amcDaysRemaining)}d Overdue</span>
                          ) : amcDaysRemaining <= 7 ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">Expires in {amcDaysRemaining}d</span>
                          ) : (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">Active ({amcDaysRemaining}d left)</span>
                          )
                        }
                      />
                      <DetailRow label="AMC End Date" value={safeFormatDate(asset.amcEndDate)} />
                      {asset.amcStartDate && <DetailRow label="AMC Start Date" value={safeFormatDate(asset.amcStartDate)} />}
                      {asset.amcVendor && <DetailRow label="Contractor / Vendor" value={asset.amcVendor} />}
                    </div>
                  </div>
                )}
              </div>

              {/* Lifecycle & Straight-Line Depreciation Valuation */}
              {depreciationInfo && (
                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <TrendingDown className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Asset Valuation & Depreciation</h4>
                        <p className="text-xs text-muted-foreground">Straight-Line Depreciation model ({depreciationInfo.usefulYears}-year lifespan)</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium w-fit bg-muted/30">
                      {depreciationInfo.percentElapsed}% Life Elapsed
                    </Badge>
                  </div>

                  {/* Valuation Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">Original Est.</span>
                      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(depreciationInfo.estimatedCost)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">Net Book Value</span>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(depreciationInfo.netBookValue)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">Accum. Deprec.</span>
                      <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(depreciationInfo.accumulatedDepreciation)}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
                      <span className="text-[10px] uppercase font-medium text-muted-foreground">Salvage Value</span>
                      <p className="text-sm font-bold text-muted-foreground mt-0.5">{formatCurrency(depreciationInfo.salvageValue)}</p>
                    </div>
                  </div>

                  {/* Lifecycle Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Age: {depreciationInfo.elapsedYears} yrs</span>
                      <span>Target: {depreciationInfo.usefulYears} yrs</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          depreciationInfo.percentElapsed >= 90 ? "bg-destructive" :
                          depreciationInfo.percentElapsed >= 70 ? "bg-amber-500" :
                          "bg-primary"
                        )}
                        style={{ width: `${depreciationInfo.percentElapsed}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {qrPayload?.notes && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-5">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" /> Scan Notes
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{qrPayload.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar / Actions */}
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/30 py-4">
                <CardTitle className="text-base font-semibold">Asset Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  onClick={handleRaiseTicket}
                  className="w-full gap-2 rounded-lg font-medium shadow-xs"
                >
                  <Ticket className="h-4 w-4" />
                  Raise Service Ticket
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(isDemoMode() ? '/demo/scan' : '/scan')}
                  className="w-full gap-2 rounded-lg border-border/70 bg-background hover:bg-muted text-xs font-medium"
                >
                  <ScanLine className="h-4 w-4 text-muted-foreground" />
                  Scan Another Asset
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(asset.id!);
                      toast.success('Asset ID copied');
                    } catch {
                      toast.error('Copy failed');
                    }
                  }}
                  className="w-full gap-2 rounded-lg border-border/70 bg-background hover:bg-muted text-xs font-medium"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copy Asset ID
                </Button>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/30 py-4">
                <CardTitle className="text-base font-semibold">System Info</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scanned By</span>
                  <span className="font-medium">{qrPayload?.scannedBy || 'System'}</span>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground text-center">
                  Asset Record {asset.id}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '-'}</span>
    </div>
  );
}
