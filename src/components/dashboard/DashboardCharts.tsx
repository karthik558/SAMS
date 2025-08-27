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

const assetsByType = [
  { name: "Furniture", value: 45, color: "hsl(217, 91%, 60%)" },
  { name: "Electronics", value: 32, color: "hsl(142, 76%, 36%)" },
  { name: "Vehicles", value: 12, color: "hsl(38, 92%, 50%)" },
  { name: "Machinery", value: 8, color: "hsl(0, 72%, 51%)" },
  { name: "Other", value: 3, color: "hsl(220, 15%, 60%)" },
];

const purchaseTrend = [
  { month: "Jan", purchases: 12, value: 45000 },
  { month: "Feb", purchases: 19, value: 67000 },
  { month: "Mar", purchases: 8, value: 23000 },
  { month: "Apr", purchases: 15, value: 52000 },
  { month: "May", purchases: 22, value: 78000 },
  { month: "Jun", purchases: 18, value: 61000 },
];

const propertyAssets = [
  { property: "Main Office", assets: 78 },
  { property: "Warehouse", assets: 45 },
  { property: "Branch Office", assets: 32 },
  { property: "Factory", assets: 28 },
  { property: "Remote Site", assets: 15 },
];

const expiryData = [
  { month: "Jan", expired: 2, expiring: 5 },
  { month: "Feb", expired: 1, expiring: 3 },
  { month: "Mar", expired: 4, expiring: 7 },
  { month: "Apr", expired: 3, expiring: 6 },
  { month: "May", expired: 2, expiring: 4 },
  { month: "Jun", expired: 1, expiring: 8 },
];

export function DashboardCharts() {
  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-2">
      {/* Asset Distribution Pie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Asset Distribution by Type</CardTitle>
          <CardDescription className="text-sm">
            Current breakdown of assets across different categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={assetsByType}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {assetsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            {assetsByType.map((item, index) => (
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
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={purchaseTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={propertyAssets} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
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
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={expiryData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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