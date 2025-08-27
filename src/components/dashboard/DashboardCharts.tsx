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
      // Exclude assets tied to disabled properties (when known)
      if (activePropertyIds.size && a.property && !activePropertyIds.has(a.property)) continue;
      const key = a.type || "Other";
      map.set(key, (map.get(key) || 0) + 1);
    }
    const entries = Array.from(map.entries());
    return entries.map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }));
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
    return Array.from(map.entries()).map(([pid, count]) => ({ property: propsById[pid]?.name || pid, assets: count }));
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
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={hasData ? chartAssetsByType : []}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {(hasData ? chartAssetsByType : []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            {(hasData ? chartAssetsByType : []).map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground truncate">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
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
            <AreaChart data={hasData ? chartPurchaseTrend : []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(225, 10%, 50%)"
                fontSize={11}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="hsl(225, 10%, 50%)" fontSize={11} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
              />
              <Area
                type="monotone"
                dataKey="purchases"
                stroke="hsl(199, 89%, 48%)"
                fill="hsl(199, 89%, 48%)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Property Assets Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Assets by Property</CardTitle>
          <CardDescription className="text-sm">
            Asset distribution across different properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hasData ? chartPropertyAssets : []} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis 
                dataKey="property" 
                stroke="hsl(225, 10%, 50%)"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis stroke="hsl(225, 10%, 50%)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
              />
              <Bar 
                dataKey="assets" 
                fill="hsl(142, 76%, 36%)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Expiry Tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Asset Expiry Tracking</CardTitle>
          <CardDescription className="text-sm">
            Monthly view of expired and expiring assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hasData ? chartExpiryData : []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(225, 10%, 50%)"
                fontSize={11}
              />
              <YAxis stroke="hsl(225, 10%, 50%)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
              />
              <Line
                type="monotone"
                dataKey="expired"
                stroke="hsl(0, 72%, 51%)"
                strokeWidth={2}
                dot={{ fill: "hsl(0, 72%, 51%)", strokeWidth: 2, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="expiring"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2}
                dot={{ fill: "hsl(38, 92%, 50%)", strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}