import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { Calendar, MapPin, Package, Building2, ShieldCheck, AlertCircle, Copy, ScanLine } from "lucide-react";
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/40 flex items-center justify-center px-4 py-6 pb-24">
      <Card className="w-full max-w-md md:max-w-lg shadow-medium border-border/60">
        <CardHeader className="pb-2 items-center text-center">
          <div className="mx-auto mb-2 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary p-3">
            <Package className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl md:text-2xl font-semibold leading-tight">
            {asset?.name || "Asset Details"}
          </CardTitle>
          <CardDescription>Scanned • {new Date().toLocaleString()}</CardDescription>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {hasSupabaseEnv && asset ? (
              <Badge className="h-7 rounded-full px-3 text-xs inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </Badge>
            ) : (
              <Badge className="h-7 rounded-full px-3 text-xs inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <AlertCircle className="h-3.5 w-3.5" /> Offline preview
              </Badge>
            )}
            {asset?.status && (
              <div className="inline-flex items-center">
                <StatusChip status={asset.status} />
              </div>
            )}
          </div>
        </CardHeader>
  <CardContent className="space-y-4">
          {asset?.id && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Asset ID</div>
                <div className="font-mono text-sm font-semibold">{asset.id}</div>
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
          )}
          <MetaChip icon={<Building2 className="h-4 w-4" />} label="Property" value={asset?.property_id ? propertyLabel(asset.property_id) : propertyLabel(asset?.property || "")} />
          <MetaChip icon={<MapPin className="h-4 w-4" />} label="Location" value={asset?.location || "-"} />
          <MetaChip icon={<Calendar className="h-4 w-4" />} label="Purchase Date" value={asset?.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : "-"} />
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
            {asset?.poNumber && (
              <Badge variant="outline" className="text-xs">PO: {asset.poNumber}</Badge>
            )}
          </div>
          <Separator className="my-1" />
          <div className="pt-1">
            <Button asChild className="w-full gap-2 rounded-full">
              <a href="/scan">
                <ScanLine className="h-4 w-4" /> Scan Another
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
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
