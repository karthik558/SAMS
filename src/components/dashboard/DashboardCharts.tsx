import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  LabelList,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode, getDemoAssets, getDemoProperties } from "@/lib/demo";
import { listAssets, type Asset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";

const palette = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 15%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(271, 81%, 56%)",
];

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "short" });
}

export function DashboardCharts() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [role, setRole] = useState<string>("");
  const [accessibleProps, setAccessibleProps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isDemoMode()) {
      setAssets(getDemoAssets());
      setProperties(getDemoProperties());
      return;
    }
    if (!hasSupabaseEnv) return;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          listAssets().catch(() => [] as Asset[]),
          listProperties().catch(() => [] as Property[]),
        ]);
        setAssets(a as Asset[]);
        setProperties(p as Property[]);
      } catch (e) {
        // fall back to empty
        setAssets([]);
        setProperties([]);
      }
    })();
  }, []);

  // Load role and accessible property IDs for current user
  useEffect(() => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setRole(String(r || '').toLowerCase());
    } catch {
      // ignore role parsing errors
    }
    (async () => {
      try {
        const ids = await getAccessiblePropertyIdsForCurrentUser();
        setAccessibleProps(ids);
      } catch {
        setAccessibleProps(new Set());
      }
    })();
  }, []);

  // Scope visible properties and assets for non-admins
  const visibleProperties = useMemo(() => {
    if (role === 'admin') return properties;
    if (accessibleProps && accessibleProps.size) return properties.filter(p => accessibleProps.has(String(p.id)));
    return properties;
  }, [role, properties, accessibleProps]);

  const scopedAssets = useMemo(() => {
    if (role === 'admin') return assets;
    if (accessibleProps && accessibleProps.size) {
      return assets.filter((a: any) => {
        const pid = String(a?.property_id || a?.property || "");
        return pid ? accessibleProps.has(pid) : false;
      });
    }
    return assets;
  }, [role, assets, accessibleProps]);

  const activePropertyIds = useMemo(() => {
    const list = visibleProperties || [];
    return new Set(list.filter(p => (p.status || '').toLowerCase() !== 'disabled').map(p => p.id));
  }, [visibleProperties]);

  // Asset Distribution by Type
  const chartAssetsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of scopedAssets) {
      const pid = String((a as any).property_id || (a as any).property || "");
      if (activePropertyIds.size && pid && !activePropertyIds.has(pid)) continue;
      const key = a.type || "Other";
      map.set(key, (map.get(key) || 0) + 1);
    }
    const entries = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const TOP = 6;
    let list = entries;
    if (entries.length > TOP) {
      const top = entries.slice(0, TOP);
      const other = entries.slice(TOP).reduce((sum, e) => sum + e.value, 0);
      list = [...top, { name: 'Other', value: other }];
    }
    return list.map((item, idx) => ({ ...item, color: palette[idx % palette.length] }));
  }, [scopedAssets, activePropertyIds]);

  // Purchase Trends (last 6 months purchases count)
  const chartPurchaseTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({ key: monthLabel(d), start, end });
    }
    return months.map(m => {
      const purchases = scopedAssets.filter(a => a.purchaseDate && new Date(a.purchaseDate) >= m.start && new Date(a.purchaseDate) < m.end).length;
      return { month: m.key, purchases };
    });
  }, [scopedAssets]);

  const chartPurchaseTrendExtended = useMemo(() => {
    let runningTotal = 0;
    return chartPurchaseTrend.map((point) => {
      runningTotal += point.purchases;
      return { ...point, runningTotal };
    });
  }, [chartPurchaseTrend]);

  // Assets by Property
  const propsById = useMemo(() => Object.fromEntries(visibleProperties.map(p => [p.id, p])), [visibleProperties]);
  const chartPropertyAssets = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of scopedAssets) {
      const pid = String((a as any).property_id || (a as any).property || "");
      if (activePropertyIds.size && pid && !activePropertyIds.has(pid)) continue;
      const key = pid || "Unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    // Sort by count desc and take top N, grouping the rest as "Other"
    const entries = Array.from(map.entries())
      .map(([pid, count]) => ({ pid, name: propsById[pid]?.name || pid, assets: count }))
      .sort((a, b) => b.assets - a.assets);
    const TOP = 8;
    if (entries.length <= TOP) return entries;
    const top = entries.slice(0, TOP);
    const otherTotal = entries.slice(TOP).reduce((sum, e) => sum + e.assets, 0);
    return [...top, { pid: "__OTHER__", name: "Other", assets: otherTotal }];
  }, [scopedAssets, activePropertyIds, propsById]);

  // Asset Expiry Tracking (last 6 months: expired vs expiring counts per month)
  const chartExpiryData = useMemo(() => {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      months.push({ label: monthLabel(d), start, end });
    }
    return months.map(m => {
      let expired = 0;
      let expiring = 0;
      for (const a of scopedAssets) {
        if (!a.expiryDate) continue;
        const ed = new Date(a.expiryDate);
        if (ed >= m.start && ed <= m.end) {
          if (ed < now) expired += 1; else expiring += 1;
        }
      }
      return { month: m.label, expired, expiring };
    });
  }, [scopedAssets]);

  const hasData = (scopedAssets.length > 0);

  const totalAssetsCount = useMemo(() => {
    return chartAssetsByType.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [chartAssetsByType]);

  const topAssetType = useMemo(() => {
    if (!chartAssetsByType.length) return null;
    return chartAssetsByType.reduce((best, item) => (item.value > (best?.value ?? -1) ? item : best), chartAssetsByType[0]);
  }, [chartAssetsByType]);

  const purchaseSummary = useMemo(() => {
    const total = chartPurchaseTrend.reduce((sum, item) => sum + (item.purchases || 0), 0);
    const current = chartPurchaseTrend.length ? chartPurchaseTrend[chartPurchaseTrend.length - 1].purchases : 0;
    return { total, current };
  }, [chartPurchaseTrend]);

  const topProperty = useMemo(() => {
    if (!chartPropertyAssets.length) return null;
    return chartPropertyAssets.reduce((best, item) => (item.assets > (best?.assets ?? -1) ? item : best), chartPropertyAssets[0]);
  }, [chartPropertyAssets]);

  const expirySummary = useMemo(() => {
    return chartExpiryData.reduce(
      (acc, item) => ({ expiring: acc.expiring + (item.expiring || 0), expired: acc.expired + (item.expired || 0) }),
      { expiring: 0, expired: 0 }
    );
  }, [chartExpiryData]);

  return (
    <div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-2 min-w-0">
      {/* Asset Distribution Pie Chart */}
      <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-foreground">Asset Distribution by Type</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 sm:flex-shrink-0"
              onClick={() => window.location.assign('/assets')}
            >
              View assets
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-muted/30 font-medium">
              Total assets
              <span className="ml-1 text-foreground">{totalAssetsCount.toLocaleString()}</span>
            </Badge>
            {topAssetType && totalAssetsCount ? (
              <Badge variant="outline" className="bg-muted/30 font-medium">
                Top type
                <span className="ml-1 text-foreground">
                  {topAssetType.name} ({Math.round(((topAssetType.value || 0) / totalAssetsCount) * 100)}%)
                </span>
              </Badge>
            ) : null}
            <Badge variant="outline" className="bg-muted/30 font-medium">
              Types
              <span className="ml-1 text-foreground">{chartAssetsByType.length}</span>
            </Badge>
          </div>
          <div className="relative h-[240px] sm:h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hasData ? chartAssetsByType : []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(hasData ? chartAssetsByType : []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(var(--background))" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 1000 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  formatter={(value: any, name: any) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            {hasData && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {chartAssetsByType.reduce((sum, it) => sum + (it.value || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total assets</div>
                </div>
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {(hasData ? chartAssetsByType : []).map((item, index, arr) => {
              const total = arr.reduce((s, x) => s + (x.value || 0), 0) || 1;
              const pct = Math.round(((item.value || 0) / total) * 100);
              return (
                <div key={index} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground truncate">
                    {item.name}: {item.value} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
      </CardContent>
      </Card>

      {/* Purchase Trend Line Chart */}
  <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-foreground">Purchase Trends</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 sm:flex-shrink-0"
              onClick={() => window.location.assign('/reports')}
            >
              View reports
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-muted/30 font-medium">
              6‑month total
              <span className="ml-1 text-foreground">{purchaseSummary.total.toLocaleString()}</span>
            </Badge>
            <Badge variant="outline" className="bg-muted/30 font-medium">
              Latest month
              <span className="ml-1 text-foreground">{purchaseSummary.current.toLocaleString()}</span>
            </Badge>
          </div>
          <div className="h-[240px] sm:h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hasData ? chartPurchaseTrendExtended : []} margin={{ top: 16, right: 20, left: 12, bottom: 12 }}>
              <defs>
                <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                formatter={(value: number, name: string) => {
                  return name === 'runningTotal'
                    ? [value.toLocaleString(), 'Cumulative']
                    : [value.toLocaleString(), 'Purchases'];
                }}
              />
              {/* Legend removed to avoid runtime errors and per request to hide 'Monthly purchases' label */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="purchases"
                stroke="hsl(199, 89%, 48%)"
                strokeWidth={2}
                fill="url(#purchaseGrad)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="runningTotal"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Property Assets Bar Chart (horizontal, top-N with gradient) */}
  <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-foreground">Assets by Property</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 sm:flex-shrink-0"
              onClick={() => window.location.assign('/properties')}
            >
              Manage properties
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {topProperty && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-muted/30 font-medium">
                Top property
                <span className="ml-1 text-foreground">{topProperty.name}</span>
              </Badge>
              <Badge variant="outline" className="bg-muted/30 font-medium">
                Assets
                <span className="ml-1 text-foreground">{topProperty.assets.toLocaleString()}</span>
              </Badge>
            </div>
          )}
          <div className="h-[260px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hasData ? chartPropertyAssets.map(x => ({ property: x.name, assets: x.assets })) : []}
              layout="vertical"
              margin={{ top: 10, right: 12, left: 12, bottom: 10 }}
            >
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                type="category"
                dataKey="property"
                width={120}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                formatter={(v: any) => [v, 'Assets']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="assets" fill="url(#barGradient)" radius={[4, 4, 4, 4]} maxBarSize={18}>
                <LabelList dataKey="assets" position="right" className="text-[10px] fill-foreground" />
              </Bar>
            </BarChart>
            </ResponsiveContainer>
          </div>
      </CardContent>
      </Card>

      {/* Expiry Tracking (stacked area with gradients) */}
  <Card className="rounded-2xl border border-border/60 bg-card shadow-sm min-w-0">
        <CardHeader className="flex flex-col gap-3 pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base text-foreground">Asset Expiry Tracking</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 sm:flex-shrink-0"
              onClick={() => window.location.assign('/assets')}
            >
              View expiring list
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-muted/30 font-medium">
              Expiring soon
              <span className="ml-1 text-foreground">{expirySummary.expiring.toLocaleString()}</span>
            </Badge>
            <Badge variant="outline" className="bg-muted/30 font-medium">
              Already expired
              <span className="ml-1 text-foreground">{expirySummary.expired.toLocaleString()}</span>
            </Badge>
          </div>
          <div className="h-[240px] sm:h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hasData ? chartExpiryData : []} margin={{ top: 10, right: 12, left: 12, bottom: 10 }}>
              <defs>
                <linearGradient id="expiringGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="expiredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value: any, name: any) => [value, name === 'expiring' ? 'Expiring' : 'Expired']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="expiring" stackId="1" stroke="hsl(38, 92%, 50%)" fill="url(#expiringGrad)" />
              <Area type="monotone" dataKey="expired" stackId="1" stroke="hsl(0, 72%, 51%)" fill="url(#expiredGrad)" />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
