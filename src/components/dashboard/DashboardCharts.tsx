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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listAssets, type Asset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";

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

  useEffect(() => {
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

  const activePropertyIds = useMemo(() => {
    const list = properties || [];
    return new Set(list.filter(p => (p.status || '').toLowerCase() !== 'disabled').map(p => p.id));
  }, [properties]);

  // Asset Distribution by Type
  const chartAssetsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      if (activePropertyIds.size && a.property && !activePropertyIds.has(a.property)) continue;
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
  }, [assets, activePropertyIds]);

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
      const purchases = assets.filter(a => a.purchaseDate && new Date(a.purchaseDate) >= m.start && new Date(a.purchaseDate) < m.end).length;
      return { month: m.key, purchases };
    });
  }, [assets]);

  // Assets by Property
  const propsById = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p])), [properties]);
  const chartPropertyAssets = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      if (activePropertyIds.size && a.property && !activePropertyIds.has(a.property)) continue;
      const key = a.property || "Unknown";
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
  }, [assets, activePropertyIds, propsById]);

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
      for (const a of assets) {
        if (!a.expiryDate) continue;
        const ed = new Date(a.expiryDate);
        if (ed >= m.start && ed <= m.end) {
          if (ed < now) expired += 1; else expiring += 1;
        }
      }
      return { month: m.label, expired, expiring };
    });
  }, [assets]);

  const hasData = hasSupabaseEnv && assets.length > 0;

  return (
    <div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-2">
      {/* Asset Distribution Pie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Asset Distribution by Type</CardTitle>
          <CardDescription className="text-sm">
            Current breakdown of assets across different categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <ResponsiveContainer width="100%" height={240}>
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
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Purchase Trends</CardTitle>
          <CardDescription className="text-sm">
            Monthly asset purchases and their total value
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hasData ? chartPurchaseTrend : []} margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
              <defs>
                <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.06} />
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
                formatter={(value: any) => [value, 'Purchases']}
              />
              <Area
                type="monotone"
                dataKey="purchases"
                stroke="hsl(199, 89%, 48%)"
                fill="url(#purchaseGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Property Assets Bar Chart (horizontal, top-N with gradient) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Assets by Property</CardTitle>
          <CardDescription className="text-sm">
            Asset distribution across different properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
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
        </CardContent>
      </Card>

      {/* Expiry Tracking (stacked area with gradients) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Asset Expiry Tracking</CardTitle>
          <CardDescription className="text-sm">
            Monthly view of expired and expiring assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
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
        </CardContent>
      </Card>
    </div>
  );
}