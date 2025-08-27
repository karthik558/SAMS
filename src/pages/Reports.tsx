import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  FileBarChart, 
  Download, 
  CalendarIcon, 
  Filter, 
  BarChart3,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listProperties, type Property } from "@/services/properties";
import { listItemTypes } from "@/services/itemTypes";
import { listReports, createReport, type Report } from "@/services/reports";
import { addNotification } from "@/services/notifications";
import { listAssets, type Asset } from "@/services/assets";

const reportTypes = [
  {
    id: "asset-summary",
    name: "Asset Summary Report",
    description: "Complete overview of all assets by property and type",
    icon: BarChart3
  },
  {
    id: "property-wise",
    name: "Property-wise Asset Report", 
    description: "Detailed breakdown of assets for each property",
    icon: FileText
  },
  {
    id: "expiry-tracking",
    name: "Expiry Tracking Report",
    description: "Assets approaching expiry dates with timeline",
    icon: CalendarIcon
  }
];

export default function Reports() {
  const [selectedReportType, setSelectedReportType] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [selectedAssetType, setSelectedAssetType] = useState("all");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [emailReport, setEmailReport] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [recentReports, setRecentReports] = useState<Report[] | null>(null);
  const [assetsCache, setAssetsCache] = useState<Asset[] | null>(null);

  // Load properties, item types, and recent reports
  // When Supabase is enabled, pull live data; else use light fallbacks
  useEffect(() => {
    (async () => {
      try {
        if (hasSupabaseEnv) {
          const [props, types] = await Promise.all([
            listProperties().catch(() => []),
            listItemTypes().catch(() => []),
          ]);
          setProperties(props as Property[]);
          setItemTypes((types as any[]).map(t => t.name));
          // Preload assets for downloads/export
          try {
            const assets = await listAssets();
            setAssetsCache(assets as Asset[]);
          } catch { /* ignore */ }
        } else {
          setProperties([
            { id: "PROP-001", name: "Main Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-002", name: "Warehouse", type: "Storage", status: "Active", address: null, manager: null } as any,
            { id: "PROP-003", name: "Branch Office", type: "Office", status: "Active", address: null, manager: null } as any,
          ]);
          setItemTypes(["Electronics","Furniture","Machinery","Vehicles","Office Supplies"]);
        }
      } catch (e) {
        console.error(e);
      }
      try {
        if (hasSupabaseEnv) {
          const reports = await listReports();
          setRecentReports(reports);
        } else {
          setRecentReports(null);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast.error("Please select a report type");
      return;
    }

    const reportData = {
      type: selectedReportType,
      dateFrom,
      dateTo,
      property: selectedProperty,
      assetType: selectedAssetType,
      format: reportFormat,
      email: emailReport
    };

    try {
      if (hasSupabaseEnv) {
        await createReport({
          name: `${reportTypes.find(r => r.id === selectedReportType)?.name} - ${new Date().toISOString().slice(0,10)}`,
          type: selectedReportType,
          format: reportFormat.toUpperCase(),
          status: "Completed",
          date_from: dateFrom ? new Date(dateFrom).toISOString().slice(0,10) : null,
          date_to: dateTo ? new Date(dateTo).toISOString().slice(0,10) : null,
          file_url: null,
        } as any);
        const reports = await listReports();
        setRecentReports(reports);
        await addNotification({
          title: "Report generated",
          message: `${reportTypes.find(r => r.id === selectedReportType)?.name} is ready for download`,
          type: "report",
        });
      }
      toast.success(`${reportTypes.find(r => r.id === selectedReportType)?.name} generated${hasSupabaseEnv ? "" : " (local)"}.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    }
  };

  const handleQuickReport = (reportType: string) => {
  const report = reportTypes.find(r => r.id === reportType);
  toast.info(`Generating ${report?.name}${hasSupabaseEnv ? "" : " (local)"}.`);
  };

  // Download a CSV for a given recent report (client-side export snapshot)
  const downloadReport = async (report: any) => {
    try {
      // Prepare data set
      let rows: any[] = [];
      if (hasSupabaseEnv && !assetsCache) {
        try { setAssetsCache(await listAssets()); } catch {}
      }
      const assets = assetsCache ?? [];
      const from = report.date_from ? new Date(report.date_from) : null;
      const to = report.date_to ? new Date(report.date_to) : null;
      const inRange = (d: string | null) => {
        if (!d) return true;
        const dt = new Date(d);
        if (from && dt < from) return false;
        if (to && dt > to) return false;
        return true;
      };

      switch ((report.type || "").toString()) {
        case "asset-summary":
          rows = assets.filter(a => inRange(a.purchaseDate)).map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            property: a.property,
            quantity: a.quantity,
            purchaseDate: a.purchaseDate,
            expiryDate: a.expiryDate,
            status: a.status,
          }));
          break;
        case "property-wise":
          rows = assets.filter(a => inRange(a.purchaseDate)).map(a => ({
            property: a.property,
            id: a.id,
            name: a.name,
            type: a.type,
            quantity: a.quantity,
            status: a.status,
          }));
          break;
        case "expiry-tracking":
          rows = assets.filter(a => a.expiryDate && inRange(a.expiryDate)).map(a => ({
            id: a.id,
            name: a.name,
            property: a.property,
            expiryDate: a.expiryDate,
            status: a.status,
          }));
          break;
        default:
          rows = [];
      }

      const toCsv = (data: any[]) => {
        if (!data.length) return "";
        const cols = Object.keys(data[0]);
        const header = cols.join(",");
        const lines = data.map(r => cols.map(c => {
          const v = (r[c] ?? "").toString().replaceAll('"', '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        }).join(","));
        return [header, ...lines].join("\n");
      };

      const csv = toCsv(rows);
      if (!csv) {
        toast.info("No data to download for this report");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(report.name || 'report').toString().replaceAll(' ', '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download report");
    }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileBarChart className="h-8 w-8" />
              Reports & Analytics
            </h1>
            <p className="text-muted-foreground">
              Generate comprehensive reports for audit and analysis
            </p>
          </div>
          <Button onClick={handleGenerateReport} className="gap-2">
            <Download className="h-4 w-4" />
            Generate Report
          </Button>
        </div>

        {/* Quick Report Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:shadow-medium transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <report.icon className="h-5 w-5" />
                      {report.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleQuickReport(report.id)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Quick Generate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custom Report Generator */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Report Generator</CardTitle>
            <CardDescription>
              Configure and generate custom reports with specific filters and date ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      {report.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property Filter</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asset Type Filter</Label>
                <Select value={selectedAssetType} onValueChange={setSelectedAssetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {itemTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Output Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Report Format</Label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Delivery Options</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="email-report"
                    checked={emailReport}
                    onChange={(e) => setEmailReport(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="email-report" className="text-sm">
                    Email report to administrators
                  </label>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <Button onClick={handleGenerateReport} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Generate Custom Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>
              Previously generated reports and scheduled reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(recentReports ?? [
                { name: "Asset Summary Report - Sample", type: "Sample", date_from: null, date_to: null, format: "PDF", status: "Completed" }
              ] as any[]).map((report: any, index: number) => (
                <div key={report.id ?? index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.type} • {report.created_at?.slice(0,10) ?? "-"} • {report.format}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      (report.status || "Completed") === "Completed" 
                        ? "bg-success/10 text-success" 
                        : "bg-warning/10 text-warning"
                    )}>
                      {report.status || "Completed"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => downloadReport(report)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {(!hasSupabaseEnv) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <FileBarChart className="h-6 w-6 text-warning shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Advanced Reporting Features</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect Supabase to enable persisted reports, scheduling, and email delivery.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}