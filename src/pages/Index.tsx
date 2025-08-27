import { StatCard } from "@/components/ui/stat-card";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Package, Building2, Users, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, FileText } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const handleQuickAction = (action: string) => {
    toast.info(`${action} feature requires Supabase connection for full functionality`);
  };

  return (
  <div className="space-y-4 md:space-y-6 p-3 md:p-0">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">SAMS Dashboard</h1>
            <p className="text-muted-foreground">
              Smart Asset Management System - Monitor and manage your organization's assets
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => handleQuickAction("Add Asset")} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
            <Button onClick={() => handleQuickAction("Generate Report")} variant="outline" className="gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Assets"
            value="1,247"
            description="Active assets"
            icon={Package}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Properties"
            value="8"
            description="Managed locations"
            icon={Building2}
            trend={{ value: 2, isPositive: true }}
          />
          <StatCard
            title="Users"
            value="24"
            description="Active users"
            icon={Users}
          />
          <StatCard
            title="Expiring Soon"
            value="15"
            description="Within 30 days"
            icon={AlertTriangle}
            trend={{ value: 5, isPositive: false }}
          />
        </div>

        {/* Value Overview */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Asset Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$2,847,320</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-success font-medium">+8.2%</span> from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Purchases
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$78,540</div>
              <p className="text-xs text-muted-foreground">
                22 new assets this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                QR Codes Generated
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">156</div>
              <p className="text-xs text-muted-foreground">
                Ready for printing
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Activity */}
  <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardCharts />
          </div>
          <div className="min-h-0">
            <RecentActivity />
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts for efficient asset management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Bulk Import")}
              >
                <Download className="h-6 w-6" />
                <span className="text-sm">Bulk Import Assets</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Generate QR Codes")}
              >
                <Package className="h-6 w-6" />
                <span className="text-sm">Generate QR Codes</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("Property Report")}
              >
                <Building2 className="h-6 w-6" />
                <span className="text-sm">Property Reports</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 p-4"
                onClick={() => handleQuickAction("User Management")}
              >
                <Users className="h-6 w-6" />
                <span className="text-sm">Manage Users</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backend Connection Notice */}
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-warning shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Connect to Supabase for Full Functionality</h3>
                <p className="text-sm text-muted-foreground">
                  This asset management system requires a backend database for user authentication, 
                  asset storage, and full functionality. Click the green Supabase button in the top right 
                  to connect your project to Supabase and enable features like:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• User authentication and role-based access</li>
                  <li>• Asset and property data storage</li>
                  <li>• Real-time updates and audit logs</li>
                  <li>• Report generation and data export</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
};

export default Index;
