import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, ArrowRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export type AmcAlertItem = {
  id: string;
  name: string;
  propertyName: string;
  startDate: Date | null;
  endDate: Date;
  daysRemaining: number;
  severity: "urgent" | "soon" | "info";
};

interface AmcWatchlistProps {
  items: AmcAlertItem[];
  trackedCount: number;
  overdueCount: number;
  hasSupabase: boolean;
}

const WATCHLIST_DISPLAY_LIMIT = 4;

const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 p-2 shadow-xl backdrop-blur-sm">
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color || entry.fill || entry.stroke }}
            />
            <span className="text-muted-foreground">
              Cumulative Expiries:
            </span>
            <span className="font-medium text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function AmcWatchlist({ items, trackedCount, overdueCount, hasSupabase }: AmcWatchlistProps) {
  const [showAll, setShowAll] = useState(false);

  const displayedItems = showAll ? items : items.slice(0, WATCHLIST_DISPLAY_LIMIT);
  const remainingCount = Math.max(0, items.length - displayedItems.length);

  // Calculate stats
  const urgentCount = items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7).length;
  const upcomingCount = items.filter(i => i.daysRemaining > 7 && i.daysRemaining <= 30).length;

  // Prepare trend data (Cumulative expiries over next 30 days)
  const trendData = [
    { name: 'Now', value: overdueCount },
    { name: '+7d', value: overdueCount + urgentCount },
    { name: '+14d', value: overdueCount + items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 14).length },
    { name: '+30d', value: overdueCount + items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 30).length },
  ];

  return (
    <Card className="rounded-xl border border-border/60 bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-orange-500/10 p-2 text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-foreground">AMC Watchlist</CardTitle>
            <CardDescription className="text-xs text-muted-foreground sm:text-sm">
              Contract renewals & expiries
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {overdueCount > 0 && (
             <Badge variant="destructive" className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wider">
               {overdueCount} Overdue
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
                <div className="text-lg font-bold text-foreground">{urgentCount}</div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Urgent</div>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2 text-center">
                <div className="text-lg font-bold text-foreground">{upcomingCount}</div>
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
                      <linearGradient id="amcTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
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
                    <Tooltip content={<ChartTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#f97316" 
                      fillOpacity={1} 
                      fill="url(#amcTrend)" 
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
                    const isUrgent = item.severity === 'urgent';
                    const isSoon = item.severity === 'soon';
                    
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 rounded-md border border-border/40 bg-muted/30 p-2 transition hover:border-border/70"
                      >
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border", 
                           isUrgent ? "border-red-200 text-red-600 dark:border-red-900/30 dark:text-red-400" : 
                           isSoon ? "border-orange-200 text-orange-600 dark:border-orange-900/30 dark:text-orange-400" : 
                           "border-blue-200 text-blue-600 dark:border-blue-900/30 dark:text-blue-400"
                        )}>
                           <CalendarClock className="h-3.5 w-3.5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h5 className="truncate text-xs font-medium text-foreground" title={item.name}>
                              {item.name}
                            </h5>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider",
                              isUrgent ? "text-red-600 dark:text-red-400" : 
                              isSoon ? "text-orange-600 dark:text-orange-400" : 
                              "text-blue-600 dark:text-blue-400"
                            )}>
                              {item.daysRemaining <= 0 ? `${Math.abs(item.daysRemaining)}d Overdue` : `${item.daysRemaining}d Left`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="truncate">{item.propertyName}</span>
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
                  <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/20 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">All contracts are up to date</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-sm">Connect Supabase to enable tracking</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
