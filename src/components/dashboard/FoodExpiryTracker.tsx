import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  UtensilsCrossed, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  ExternalLink,
  ChevronRight,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";

export type FoodExpiryItem = {
  id: string;
  name: string;
  propertyName: string;
  departmentName: string | null;
  endDate: Date;
  daysRemaining: number;
  severity: "urgent" | "soon" | "info";
  quantity: number;
  typeLabel: string;
};

interface FoodExpiryTrackerProps {
  items: FoodExpiryItem[];
  trackedCount: number;
  overdueCount: number;
  hasSupabase: boolean;
}

const DEFAULT_PAGE_SIZE = 5;

export function FoodExpiryTracker({ items, trackedCount, overdueCount, hasSupabase }: FoodExpiryTrackerProps) {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<"urgent" | "30d" | "all">("urgent");
  const [showAll, setShowAll] = useState(false);

  // Stats calculation
  const urgentCount = useMemo(() => 
    items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7).length,
    [items]
  );
  const upcomingCount = useMemo(() => 
    items.filter(i => i.daysRemaining > 7 && i.daysRemaining <= 30).length,
    [items]
  );

  // Total units at risk (overdue + expiring within 7 days)
  const unitsAtRisk = useMemo(() => {
    return items
      .filter(i => i.daysRemaining <= 7)
      .reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 1), 0);
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (filterMode === "urgent") {
      return items.filter(i => i.daysRemaining <= 7);
    }
    if (filterMode === "30d") {
      return items.filter(i => i.daysRemaining <= 30);
    }
    return items;
  }, [items, filterMode]);

  const displayedItems = showAll ? filteredItems : filteredItems.slice(0, DEFAULT_PAGE_SIZE);
  const hasMore = filteredItems.length > DEFAULT_PAGE_SIZE;

  const handleAssetClick = (assetId: string) => {
    const path = isDemoMode() ? `/demo/assets/${assetId}` : `/assets/${assetId}`;
    navigate(path);
  };

  const handleViewFoodAssets = () => {
    const path = isDemoMode() ? "/demo/assets?search=food" : "/assets?search=food";
    navigate(path);
  };

  const isTrackingActive = hasSupabase || isDemoMode() || items.length > 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Card Header */}
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-inset ring-border/50">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                Food & Perishables Tracker
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Batch expiration & freshness shelf-life monitoring
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {overdueCount > 0 ? (
              <Badge variant="outline" className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-destructive border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueCount} Expired
              </Badge>
            ) : (
              <Badge variant="outline" className="flex h-8 items-center gap-1.5 rounded-lg border-border/70 bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Fresh Stock
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewFoodAssets}
              className="h-8 gap-1.5 rounded-lg border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
            >
              Assets
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {isTrackingActive ? (
          <>
            {/* Clean Neutral Metrics Strip */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20 p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Expired
                  </span>
                  {overdueCount > 0 && <span className="h-2 w-2 rounded-full bg-destructive" />}
                </div>
                <div className={cn("mt-1 text-2xl font-semibold tabular-nums", overdueCount > 0 ? "text-destructive" : "text-foreground")}>
                  {overdueCount}
                </div>
                <span className="text-[10px] text-muted-foreground">Requires disposal</span>
              </div>

              <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20 p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Due ≤ 7 Days
                  </span>
                  {urgentCount > 0 && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                </div>
                <div className={cn("mt-1 text-2xl font-semibold tabular-nums", urgentCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                  {urgentCount}
                </div>
                <span className="text-[10px] text-muted-foreground">Prioritize usage</span>
              </div>

              <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20 p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Due ≤ 30 Days
                  </span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {upcomingCount}
                </div>
                <span className="text-[10px] text-muted-foreground">In rotation</span>
              </div>

              <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20 p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Units At Risk
                  </span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {unitsAtRisk}
                </div>
                <span className="text-[10px] text-muted-foreground">Expiring soon</span>
              </div>
            </div>

            {/* Filter Toggle: Active on WHITE in light mode, high contrast in dark mode */}
            <div className="flex items-center justify-between pt-1">
              <div className="inline-flex items-center rounded-lg bg-muted/60 p-1 border border-border/50">
                <button
                  type="button"
                  onClick={() => { setFilterMode("urgent"); setShowAll(false); }}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-all",
                    filterMode === "urgent"
                      ? "bg-white text-foreground shadow-xs font-semibold border border-border/30 dark:bg-card dark:text-foreground dark:border-border/80 dark:shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Critical ≤ 7d ({items.filter(i => i.daysRemaining <= 7).length})
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterMode("30d"); setShowAll(false); }}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-all",
                    filterMode === "30d"
                      ? "bg-white text-foreground shadow-xs font-semibold border border-border/30 dark:bg-card dark:text-foreground dark:border-border/80 dark:shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  30 Days ({items.filter(i => i.daysRemaining <= 30).length})
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterMode("all"); setShowAll(false); }}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-all",
                    filterMode === "all"
                      ? "bg-white text-foreground shadow-xs font-semibold border border-border/30 dark:bg-card dark:text-foreground dark:border-border/80 dark:shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({items.length})
                </button>
              </div>

              <span className="text-[11px] text-muted-foreground">
                Showing {displayedItems.length} of {filteredItems.length}
              </span>
            </div>

            {/* Clean Interactive Items List */}
            <div className="space-y-2">
              {displayedItems.length > 0 ? (
                displayedItems.map((item) => {
                  const isExpired = item.daysRemaining < 0;
                  const isUrgent = item.daysRemaining >= 0 && item.daysRemaining <= 7;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAssetClick(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAssetClick(item.id); }}
                      className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-border hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40 text-muted-foreground">
                          {isExpired ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : isUrgent ? (
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              {item.name}
                            </p>
                            {item.quantity > 0 && (
                              <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-medium shrink-0 bg-muted">
                                Qty: {item.quantity}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {item.departmentName && (
                              <>
                                <span className="truncate max-w-[120px] font-medium text-foreground/80">
                                  {item.departmentName}
                                </span>
                                <span className="text-muted-foreground/30">•</span>
                              </>
                            )}
                            <span className="flex items-center gap-1 truncate max-w-[130px]">
                              <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                              {item.propertyName}
                            </span>
                            <span className="text-muted-foreground/30">•</span>
                            <span>
                              Expiry: {item.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors border",
                          isExpired 
                            ? "bg-destructive/10 text-destructive border-destructive/20" 
                            : isUrgent 
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              : "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {isExpired 
                            ? `Expired ${Math.abs(item.daysRemaining)}d ago` 
                            : item.daysRemaining === 0 
                              ? "Expires Today" 
                              : `${item.daysRemaining}d Left`}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 py-8 text-center">
                  <div className="rounded-full bg-muted p-2.5 text-muted-foreground mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {filterMode === "urgent" ? "No Spoilage Risks" : "No Perishable Items Found"}
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground mt-0.5">
                    {filterMode === "urgent" 
                      ? "All food and kitchen inventory items are fresh and safely within shelf life." 
                      : "Tag items with 'Food' type or department to track shelf-life and batches."}
                  </p>
                </div>
              )}

              {/* View More / Less Toggle */}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full h-8 rounded-lg border-border/60 bg-muted/20 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground shadow-xs transition-colors"
                >
                  {showAll ? "Show Less" : `View ${filteredItems.length - DEFAULT_PAGE_SIZE} More Items`}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 p-8 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Food Expiry Tracking Offline</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Connect database storage or demo mode to monitor perishable inventory and shelf-life alerts.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
