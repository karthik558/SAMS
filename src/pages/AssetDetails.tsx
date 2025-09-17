import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { Calendar, MapPin, Package, Building2, ShieldCheck, AlertCircle, Copy, ScanLine, ArrowLeft, ClipboardList, Factory, AlertTriangle } from "lucide-react";
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
      <div className="min-h-screen w-full bg-muted/20 flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/60 text-center">
          <CardHeader>
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle>Asset not found</CardTitle>
            <CardDescription>We could not load details for this asset. It may have been removed or the link is invalid.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <a href="/assets">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to assets
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
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
    <div className="min-h-screen w-full bg-muted/20 py-10 px-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/assets')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.assign('/scan')}>
            <ScanLine className="h-4 w-4" /> Scan Another
          </Button>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl md:text-2xl font-semibold leading-tight flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </span>
                  <span>{asset.name || 'Asset Details'}</span>
                </CardTitle>
                <CardDescription className="mt-1 text-xs md:text-sm">Viewed on {new Date().toLocaleString()} {qrPayload?.scannedBy ? `• scanned by ${qrPayload.scannedBy}` : ''}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {asset.status && <StatusChip status={asset.status} />}
                <Badge variant="outline" className="bg-muted/40 text-xs">
                  <ClipboardList className="mr-1 h-3.5 w-3.5" /> {asset.type || 'Unknown type'}
                </Badge>
                {asset.department && (
                  <Badge variant="outline" className="bg-muted/40 text-xs">
                    <Factory className="mr-1 h-3.5 w-3.5" /> {asset.department}
                  </Badge>
                )}
                {hasSupabaseEnv ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verified
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Offline preview
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {asset.id && (
              <div className="rounded-xl border border-border/70 bg-card/90 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Asset ID</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{asset.id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(asset.id!); toast.success('Asset ID copied'); } catch { toast.error('Copy failed'); }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <MetaChip icon={<Building2 className="h-4 w-4" />} label="Property" value={asset.property_id ? propertyLabel(asset.property_id) : propertyLabel(asset.property || '')} />
              <MetaChip icon={<MapPin className="h-4 w-4" />} label="Location" value={asset.location || '-'} />
              <MetaChip icon={<Calendar className="h-4 w-4" />} label="Purchase Date" value={issuedDateLabel} />
              <MetaChip icon={<Calendar className="h-4 w-4" />} label="Expiry Date" value={expiryDateLabel} />
              <MetaChip icon={<ClipboardList className="h-4 w-4" />} label="Quantity" value={asset.quantity != null ? asset.quantity.toString() : '-'} />
              <MetaChip icon={<Factory className="h-4 w-4" />} label="Condition" value={conditionLabel} />
            </div>

            <div className="flex flex-wrap gap-2">
              {asset.poNumber && (
                <Badge variant="outline" className="text-xs">PO: {asset.poNumber}</Badge>
              )}
              {asset.type && (
                <Badge variant="outline" className="text-xs">Category: {asset.type}</Badge>
              )}
            </div>

            {qrPayload?.notes && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Scan notes</p>
                <p className="text-sm text-foreground leading-relaxed">{qrPayload.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetaChip({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-foreground break-all">{value ?? '-'}</div>
    </div>
  );
}
