import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Package, Building2, ChevronLeft } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getAssetById, type Asset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { toast } from "sonner";

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
    <div className="min-h-screen w-full bg-background flex items-start justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-3 sm:mb-4 flex items-center gap-2">
          <Button variant="ghost" onClick={() => history.back()} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        </div>
        <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Package className="h-6 w-6" /> {asset?.name || "Asset Details"}
              </CardTitle>
              <CardDescription>Scanned from QR • {new Date().toLocaleString()}</CardDescription>
            </div>
            {asset?.status && <Badge variant="outline">{asset.status}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <DetailRow label="Asset ID" value={asset?.id} />
            <DetailRow label="Asset Name" value={asset?.name} />
            <DetailRow label="Property" value={asset?.property_id ? propertyLabel(asset.property_id) : propertyLabel(asset?.property || "")} icon={<Building2 className="h-4 w-4 text-muted-foreground" />} />
            <DetailRow label="Location" value={asset?.location || "-"} icon={<MapPin className="h-4 w-4 text-muted-foreground" />} />
            <DetailRow label="Purchase Date" value={asset?.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : "-"} icon={<Calendar className="h-4 w-4 text-muted-foreground" />} />
          </div>

          {asset?.poNumber && (
            <div className="pt-2 text-xs text-muted-foreground">PO: {asset.poNumber}</div>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3 bg-muted/30">
      {icon}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground break-all">{value ?? "-"}</div>
      </div>
    </div>
  );
}
