import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { Calendar, MapPin, Package, Building2, ShieldCheck, AlertCircle, Copy, ScanLine, ArrowLeft, ClipboardList, Factory, AlertTriangle, Edit } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getAssetById, type Asset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isSupabase = hasSupabaseEnv;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const qrPayload = useMemo(() => {
    try { return JSON.parse(searchParams.get("payload") || "null"); } catch { return null; }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        // Load properties for label rendering
        if (isSupabase) {
          const props = await listProperties();
          setPropsById(Object.fromEntries(props.map(p => [p.id, p])));
        }
      } catch {}
    })();
  }, [isSupabase]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        if (isSupabase) {
          const data = await getAssetById(id);
          setAsset(data);
        } else {
          // As a fallback (no Supabase), use data from QR payload when present
          if (qrPayload) {
            setAsset({
              id: qrPayload.assetId,
              name: qrPayload.assetName,
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
            } as Asset);
          } else {
            setAsset(null);
          }
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load asset");
      }
    })();
  }, [id, isSupabase, qrPayload]);

  const propertyLabel = (code: string | null | undefined) => {
    if (!code) return "-";
    return propsById[code]?.name || code;
  };

  const issuedDateLabel = asset?.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '-';
  const expiryDateLabel = asset?.expiryDate ? new Date(asset.expiryDate).toLocaleDateString() : '-';
  const conditionLabel = asset?.condition || 'Not specified';

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
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <a href="/assets">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to assets
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary">
              <a href="/scan">
                <ScanLine className="mr-2 h-4 w-4" /> Scan again
              </a>
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
          <Button variant="ghost" size="sm" className="gap-2 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/assets')}>
            <ArrowLeft className="h-4 w-4" /> Back to Assets
          </Button>
          <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors" onClick={() => window.location.assign('/scan')}>
            <ScanLine className="h-4 w-4" /> Scan Another
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
                      <Badge variant="outline" className="bg-background/50 text-xs font-medium">
                        {asset.type || 'Unknown type'}
                      </Badge>
                      {hasSupabaseEnv ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-amber-600 bg-amber-50 border-amber-200">
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
                  className="gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all bg-background/50"
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
              </div>

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
                <CardTitle className="text-base font-semibold">System Info</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scanned By</span>
                  <span className="font-medium">{qrPayload?.scannedBy || 'Unknown'}</span>
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

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '-'}</span>
    </div>
  );
}
