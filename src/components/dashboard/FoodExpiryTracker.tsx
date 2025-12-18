import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Utensils, CheckCircle2, ArrowRight, AlertCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 p-2 shadow-xl backdrop-blur-sm text-xs">
        <div className="font-medium text-foreground mb-1">{label}</div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Cumulative Expiries:</span>
          <span className="font-bold text-foreground">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function FoodExpiryTracker({ items, trackedCount, overdueCount, hasSupabase }: FoodExpiryTrackerProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedItems = showAll ? items : items.slice(0, WATCHLIST_DISPLAY_LIMIT);
  const remainingCount = Math.max(0, items.length - displayedItems.length);

  // Calculate stats
  const expiringSoonCount = items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7).length;
  const expiringLaterCount = items.filter(i => i.daysRemaining > 7 && i.daysRemaining <= 30).length;

  // Prepare trend data (Cumulative expiries over next 30 days)
  const trendData = [
    { name: 'Now', value: overdueCount },
    { name: '+7d', value: overdueCount + expiringSoonCount },
    { name: '+14d', value: overdueCount + items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 14).length },
    { name: '+30d', value: overdueCount + items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 30).length },
  ];

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
      <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0">
        {hasSupabase ? (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-center">
                <div className="text-lg font-bold text-foreground">{expiringSoonCount}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Urgent</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-center">
                <div className="text-lg font-bold text-foreground">{expiringLaterCount}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Upcoming</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-center">
                <div className="text-lg font-bold text-foreground">{trackedCount}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</div>
              </div>
            </div>

            {/* Trend Chart */}
            {trackedCount > 0 && (
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="foodTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                      tickLine={false}
                      axisLine={false}
                      dy={5}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#eab308" 
                      fillOpacity={1} 
                      fill="url(#foodTrend)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* List Items */}
            <div className="space-y-2 flex-1">
              {items.length > 0 ? (
                <div className="space-y-2">
                  {displayedItems.map((item) => {
                    const isExpired = item.severity === 'urgent'; // mapped to expired/urgent in logic
                    const isUrgent = item.severity === 'soon';
                    
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 rounded-md border border-border/40 bg-muted/30 p-2 transition hover:border-border/70"
                      >
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border", 
                           isExpired ? "border-red-200 text-red-600 dark:border-red-900/30 dark:text-red-400" : 
                           isUrgent ? "border-orange-200 text-orange-600 dark:border-orange-900/30 dark:text-orange-400" : 
                           "border-yellow-200 text-yellow-600 dark:border-yellow-900/30 dark:text-yellow-400"
                        )}>
                           {isExpired ? <AlertCircle className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h5 className="truncate text-xs font-medium text-foreground" title={item.name}>
                              {item.name}
                            </h5>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider",
                              isExpired ? "text-red-600 dark:text-red-400" : 
                              isUrgent ? "text-orange-600 dark:text-orange-400" : 
                              "text-yellow-600 dark:text-yellow-400"
                            )}>
                              {item.daysRemaining <= 0 ? `${Math.abs(item.daysRemaining)}d Ago` : `${item.daysRemaining}d Left`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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
                      className="w-full h-7 text-[10px] text-muted-foreground hover:text-foreground"
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
