import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Utensils, CheckCircle2, ArrowRight, AlertCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

const WATCHLIST_DISPLAY_LIMIT = 4;
const COLORS = {
  expired: "#ef4444", // red-500
  urgent: "#f97316",  // orange-500
  soon: "#eab308",    // yellow-500
  fresh: "#10b981",   // emerald-500
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div 
              className="h-2 w-2 rounded-full" 
              style={{ backgroundColor: entry.payload.color }} 
            />
            <span className="font-medium text-foreground">
              {entry.value}
            </span>
            <span className="text-muted-foreground">
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function FoodExpiryTracker({ items, trackedCount, overdueCount, hasSupabase }: FoodExpiryTrackerProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedItems = showAll ? items : items.slice(0, WATCHLIST_DISPLAY_LIMIT);
  const remainingCount = Math.max(0, items.length - displayedItems.length);

  // Prepare chart data
  const chartData = [
    { name: "Expired", value: overdueCount, color: COLORS.expired },
    { name: "Expiring (<7d)", value: items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7).length, color: COLORS.urgent },
    { name: "Expiring (<30d)", value: items.filter(i => i.daysRemaining > 7 && i.daysRemaining <= 30).length, color: COLORS.soon },
    { name: "Fresh", value: Math.max(0, trackedCount - items.length), color: COLORS.fresh },
  ].filter(d => d.value > 0);

  const totalAlerts = items.length;

  return (
    <Card className="rounded-xl border border-border/60 bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <Utensils className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">Food Expiry Tracker</CardTitle>
            <CardDescription className="text-xs text-muted-foreground sm:text-sm">
              Inventory freshness & expiry
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {overdueCount > 0 ? (
             <Badge variant="destructive" className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wider">
               {overdueCount} Expired
             </Badge>
           ) : (
             <Badge variant="outline" className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wider border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400 dark:bg-emerald-900/10">
               All Fresh
             </Badge>
           )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {hasSupabase ? (
          <>
            {/* Chart Section */}
            {trackedCount > 0 && (
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="relative h-32 w-32 shrink-0">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-foreground">{totalAlerts}</span>
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">Alerts</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={58}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            className="stroke-background hover:opacity-80 transition-opacity"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="flex flex-col gap-2 text-xs">
                  {chartData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-muted-foreground">{item.name}</span>
                      <span className="font-bold text-foreground ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List Items */}
            <div className="space-y-3 flex-1">
              {items.length > 0 ? (
                <div className="space-y-2">
                  {displayedItems.map((item) => {
                    const isExpired = item.severity === 'urgent'; // mapped to expired/urgent in logic
                    const isUrgent = item.severity === 'soon';
                    
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 transition hover:border-border/70"
                      >
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border", 
                           isExpired ? "border-red-200 text-red-600 dark:border-red-900/30 dark:text-red-400" : 
                           isUrgent ? "border-orange-200 text-orange-600 dark:border-orange-900/30 dark:text-orange-400" : 
                           "border-yellow-200 text-yellow-600 dark:border-yellow-900/30 dark:text-yellow-400"
                        )}>
                           {isExpired ? <AlertCircle className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h5 className="truncate text-sm font-medium text-foreground" title={item.name}>
                              {item.name}
                            </h5>
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider",
                              isExpired ? "text-red-600 dark:text-red-400" : 
                              isUrgent ? "text-orange-600 dark:text-orange-400" : 
                              "text-yellow-600 dark:text-yellow-400"
                            )}>
                              {item.daysRemaining <= 0 ? `${Math.abs(item.daysRemaining)}d Ago` : `${item.daysRemaining}d Left`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 truncate">
                              <span className="truncate">{item.propertyName}</span>
                              {item.quantity > 0 && (
                                <>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span>Qty: {item.quantity}</span>
                                </>
                              )}
                            </div>
                            <span>{item.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {items.length > WATCHLIST_DISPLAY_LIMIT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAll(!showAll)}
                    >
                      {showAll ? "Show Less" : `View ${remainingCount} More`}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/20 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">All inventory is fresh</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              <Utensils className="h-6 w-6" />
            </div>
            <p className="text-sm">Connect Supabase to enable tracking</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
