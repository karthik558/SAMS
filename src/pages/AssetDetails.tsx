import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle, ArrowDown, Copy, ScanLine, Ticket } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { isDemoMode } from "@/lib/demo";
import { getAssetById, type Asset } from "@/services/assets";
import { listProperties } from "@/services/properties";

function readScanDetails(raw: string | null, id: string) {
  try {
    const payload = JSON.parse(raw ?? "null");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const scannedId = text(payload.assetId);
    if (scannedId && scannedId.toLowerCase() !== id.toLowerCase()) return null;
    const details = {
      name: text(payload.assetName),
      property: text(payload.propertyName) || text(payload.property),
      location: text(payload.location),
      notes: text(payload.notes),
    };
    return Object.values(details).some(Boolean) ? details : null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return (day(date) - day(today)) / 86_400_000;
}

function getDepreciation(asset: Asset) {
  if (!asset.purchaseDate) return null;
  const purchased = new Date(asset.purchaseDate);
  if (Number.isNaN(purchased.getTime())) return null;
  const type = asset.type?.toLowerCase() || "";
  if (/food|beverage|consumable/.test(type)) return null;

  let usefulYears = 5;
  let estimatedCost = 35000;
  if (/laptop|computer|it/.test(type)) {
    usefulYears = 4;
    estimatedCost = 65000;
  } else if (/server|network/.test(type)) {
    estimatedCost = 180000;
  } else if (/furniture|chair|desk/.test(type)) {
    usefulYears = 10;
    estimatedCost = 18000;
  } else if (/hvac|machinery|air/.test(type)) {
    usefulYears = 10;
    estimatedCost = 120000;
  }

  const salvageValue = Math.round(estimatedCost * 0.05);
  const depreciableAmount = estimatedCost - salvageValue;
  const elapsedYears = Math.max(0, (Date.now() - purchased.getTime()) / (86_400_000 * 365.25));
  const accumulatedDepreciation = Math.min(depreciableAmount, Math.round(depreciableAmount * elapsedYears / usefulYears));
  return { usefulYears, estimatedCost, salvageValue, accumulatedDepreciation, netBookValue: estimatedCost - accumulatedDepreciation };
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid min-h-11 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 py-2.5">
      <dt className="break-words text-sm leading-5 text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium leading-5">{value === "" ? "Not recorded" : value ?? "Not recorded"}</dd>
    </div>
  );
}

function DetailSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className="min-w-0 border-t-2 border-primary/30 pt-4 target:border-primary">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <dl className="mt-2 divide-y divide-border/70">{children}</dl>
    </section>
  );
}

function readableLabel(value?: string | null) {
  const label = value?.trim().replace(/_/g, " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : null;
}

function canSeeRecordCreator(demo: boolean) {
  if (demo) return true;
  try {
    const user = JSON.parse(localStorage.getItem("auth_user") ?? "null");
    return typeof user?.role === "string" && user.role.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

function AssetFooter({ asset, notes, showCreator, propertyCode }: {
  asset?: Asset | null;
  notes?: string;
  showCreator?: boolean;
  propertyCode?: string | null;
}) {
  const creator = asset?.createdByName || asset?.createdByEmail || asset?.createdById;
  return (
    <div className="site-container py-7 sm:py-10">
      {(asset || notes) && (
        <div className="grid gap-6 border-b pb-6 md:grid-cols-2 md:gap-x-12">
          {asset && (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Catalogue record</h2>
              <dl className="mt-2 divide-y divide-border/70">
                <DetailField label="Added to catalogue" value={formatDate(asset.created_at)} />
                {showCreator && <DetailField label="Added by" value={creator} />}
                {propertyCode && <DetailField label="Property code" value={propertyCode} />}
                <DetailField label="AMC coverage" value={asset.amcEnabled ? "Enabled" : "Not enabled"} />
              </dl>
            </section>
          )}
          {(asset?.description?.trim() || notes) && (
            <div className="space-y-5">
              {asset?.description?.trim() && (
                <section>
                  <h2 className="mb-2 text-xl font-semibold tracking-tight">Description</h2>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{asset.description}</p>
                </section>
              )}
              {notes && (
                <section>
                  <h2 className="mb-2 text-xl font-semibold tracking-tight">Notes from the QR label</h2>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{notes}</p>
                </section>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="py-3 text-sm text-muted-foreground">© {new Date().getFullYear()} SAMS Project</p>
        <Button asChild variant="ghost" className="min-h-11 px-3">
          <a href="mailto:karthik@samsproject.in">Contact support</a>
        </Button>
      </div>
    </div>
  );
}

export default function AssetDetails() {
  const demo = isDemoMode();
  const prefix = demo ? "/demo" : "";
  const catalogueHref = prefix + "/assets";
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId?.trim() ?? "";
  const [searchParams] = useSearchParams();
  const access = usePermissions();
  const scanDetails = readScanDetails(searchParams.get("payload"), id);
  const assetQuery = useQuery({
    queryKey: ["asset-detail", prefix, id],
    queryFn: () => getAssetById(id),
    retry: false,
  });
  const asset = assetQuery.data;
  const properties = useQuery({
    queryKey: ["asset-detail-properties", prefix],
    queryFn: () => listProperties(),
    enabled: Boolean(asset?.property_id || asset?.property),
    retry: false,
  });

  const scanAction = access.can("scan") && (
    <Button asChild className="min-h-11 w-full gap-2 sm:w-auto">
      <Link to={prefix + "/scan"}><ScanLine className="h-4 w-4" /> Scan another asset</Link>
    </Button>
  );
  if (assetQuery.isPending) {
    return (
      <SiteLayout catalogueHref={catalogueHref} footer={<AssetFooter />}>
        <div className="site-container py-8"><LoadingState label="Loading asset details" /></div>
      </SiteLayout>
    );
  }

  if (!asset && !scanDetails) {
    return (
      <SiteLayout catalogueHref={catalogueHref} footer={<AssetFooter />}>
        <div className="site-container py-8">
          {assetQuery.isError ? (
            <ErrorState title="Couldn’t load the asset" description="Try loading the asset again." onRetry={() => void assetQuery.refetch()} />
          ) : (
            <EmptyState icon={AlertCircle} title="Asset not found" description="Check the asset tag or look up the record in the catalogue." action={scanAction} />
          )}
        </div>
      </SiteLayout>
    );
  }

  const assetName = asset?.name || scanDetails?.name || "Scanned asset";
  const conditionLabel = readableLabel(asset?.condition);
  const propertyId = asset?.property_id || asset?.property;
  const property = properties.data?.find((item) => item.id === propertyId)?.name || asset?.property || propertyId;
  const amcDays = daysUntil(asset?.amcEndDate);
  const valuation = asset ? getDepreciation(asset) : null;
  const ticketParams = asset && new URLSearchParams({
    title: `AMC Service / Maintenance: ${asset.name}`,
    propertyId: propertyId || "",
    priority: amcDays !== null && amcDays <= 0 ? "urgent" : "high",
    description: [
      `Asset Name: ${asset.name}`,
      `Asset ID: ${asset.id}`,
      `Location: ${asset.location || "N/A"}`,
      `Department: ${asset.department || "N/A"}`,
      `Condition: ${conditionLabel || "N/A"}`,
      `AMC End Date: ${asset.amcEndDate || "N/A"}`,
      "Reason: Routine inspection / warranty renewal.",
    ].join("\n"),
  });
  const ticketAction = ticketParams && access.can("tickets", "create") && (
    <Button asChild variant="outline" className="min-h-11 gap-2">
      <Link to={`${prefix}/tickets?${ticketParams}`}><Ticket className="h-4 w-4" /> Raise service ticket</Link>
    </Button>
  );

  return (
    <SiteLayout
      catalogueHref={catalogueHref}
      footer={
        <AssetFooter
          asset={asset}
          notes={scanDetails?.notes}
          showCreator={canSeeRecordCreator(demo)}
          propertyCode={propertyId !== property ? propertyId : null}
        />
      }
    >
      <Helmet><title>{assetName} | SAMS</title></Helmet>
      <section className="border-b bg-primary/[0.05]" aria-labelledby="asset-title">
        <div className="site-container space-y-5 py-8 sm:py-12 lg:py-14">
          <div className="min-w-0 space-y-3">
            <h1 id="asset-title" className="site-heading break-words">{assetName}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-card pl-3">
                <code className="break-all text-sm font-medium">{asset?.id || id}</code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 shrink-0"
                  aria-label="Copy asset ID"
                  title="Copy asset ID"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(asset?.id || id);
                      toast.success("Asset ID copied");
                    } catch {
                      toast.error("Couldn’t copy the asset ID");
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </span>
              {asset && (
                <Button asChild variant="ghost" className="min-h-11 px-3">
                  <a href="#asset-status">View status <ArrowDown aria-hidden="true" /></a>
                </Button>
              )}
            </div>
          </div>
          {(scanAction || ticketAction) && (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              {scanAction}
              {ticketAction}
            </div>
          )}
        </div>
      </section>

      <div className="bg-card">
        <div className="site-container space-y-7 py-7 sm:space-y-9 sm:py-10">
          {asset ? (
            <>
              <div className="grid items-start gap-7 md:grid-cols-2 md:gap-x-12 md:gap-y-9">
                <DetailSection id="asset-status" title="Asset information">
                  <DetailField label="Status" value={readableLabel(asset.status)} />
                  <DetailField label="Condition" value={conditionLabel} />
                  <DetailField label="Type" value={asset.type} />
                  <DetailField label="Quantity" value={asset.quantity} />
                  <DetailField label="Serial number" value={asset.serialNumber} />
                </DetailSection>
                <DetailSection title="Location">
                  <DetailField label="Property" value={property} />
                  <DetailField label="Department" value={asset.department} />
                  <DetailField label="Specific location" value={asset.location} />
                </DetailSection>
                <DetailSection title="Purchase & expiry">
                  <DetailField label="Purchase date" value={formatDate(asset.purchaseDate)} />
                  <DetailField label="Expiry date" value={formatDate(asset.expiryDate)} />
                  <DetailField label="PO number" value={asset.poNumber} />
                </DetailSection>
                {asset.amcEnabled && (
                  <DetailSection title="AMC & maintenance">
                    <DetailField label="Contract status" value={amcDays === null ? null : amcDays < 0 ? `Overdue by ${-amcDays} days` : amcDays === 0 ? "Expires today" : `${amcDays} days remaining`} />
                    <DetailField label="AMC end date" value={formatDate(asset.amcEndDate)} />
                    <DetailField label="AMC start date" value={formatDate(asset.amcStartDate)} />
                    {asset.amcVendor && <DetailField label="Contractor / vendor" value={asset.amcVendor} />}
                  </DetailSection>
                )}
              </div>
              {valuation && (
                <details className="rounded-xl border bg-background">
                  <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Estimated depreciation</summary>
                  <div className="border-t border-border/60 p-4">
                    <p className="mb-4 text-sm text-muted-foreground">Straight-line estimate over {valuation.usefulYears} years.</p>
                    <dl className="divide-y divide-border/70 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
                      <DetailField label="Original cost estimate" value={currency.format(valuation.estimatedCost)} />
                      <DetailField label="Net book value" value={currency.format(valuation.netBookValue)} />
                      <DetailField label="Accumulated depreciation" value={currency.format(valuation.accumulatedDepreciation)} />
                      <DetailField label="Salvage value" value={currency.format(valuation.salvageValue)} />
                    </dl>
                  </div>
                </details>
              )}
            </>
          ) : (
            <>
              <div role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                {assetQuery.isError
                  ? "The catalogue is unavailable. These details come from the QR label."
                  : "No catalogue record matched this ID. These details come from the QR label."}
              </div>
              <DetailSection title="Location on the QR label">
                <DetailField label="Property" value={scanDetails?.property} />
                <DetailField label="Specific location" value={scanDetails?.location} />
              </DetailSection>
            </>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
