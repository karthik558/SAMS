import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  FileText,
  Table2,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  },
  {
    id: "purchase-analysis",
    name: "Purchase Analysis Report",
    description: "Purchase trends and spending analysis over time",
    icon: Table2
  },
  {
    id: "audit-trail",
    name: "Audit Trail Report",
    description: "Complete audit log of all system activities",
    icon: FileBarChart
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

  const handleGenerateReport = () => {
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

    console.log("Generating report:", reportData);
    toast.success(`${reportTypes.find(r => r.id === selectedReportType)?.name} generated successfully! Connect Supabase for full functionality.`);
  };

  const handleQuickReport = (reportType: string) => {
    const report = reportTypes.find(r => r.id === reportType);
    toast.info(`Generating ${report?.name}. Connect Supabase for full functionality.`);
  };

  return (
    <Layout>
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
                    <SelectItem value="main-office">Main Office</SelectItem>
                    <SelectItem value="branch-office">Branch Office</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="factory">Factory</SelectItem>
                    <SelectItem value="remote-site">Remote Site</SelectItem>
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
                    <SelectItem value="electronics">Electronics</SelectItem>
                    <SelectItem value="furniture">Furniture</SelectItem>
                    <SelectItem value="machinery">Machinery</SelectItem>
                    <SelectItem value="vehicles">Vehicles</SelectItem>
                    <SelectItem value="office-supplies">Office Supplies</SelectItem>
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
              {[
                {
                  name: "Asset Summary Report - April 2024",
                  type: "Monthly Summary",
                  date: "2024-04-30",
                  format: "PDF",
                  status: "Completed"
                },
                {
                  name: "Property-wise Asset Report - Q1 2024",
                  type: "Quarterly Report",
                  date: "2024-03-31",
                  format: "Excel",
                  status: "Completed"
                },
                {
                  name: "Expiry Tracking Report - May 2024",
                  type: "Monthly Alert",
                  date: "2024-05-01",
                  format: "PDF",
                  status: "Scheduled"
                }
              ].map((report, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.type} • {report.date} • {report.format}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      report.status === "Completed" 
                        ? "bg-success/10 text-success" 
                        : "bg-warning/10 text-warning"
                    )}>
                      {report.status}
                    </span>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Backend Connection Notice */}
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <FileBarChart className="h-6 w-6 text-warning shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Advanced Reporting Features</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Full reporting functionality requires Supabase connection for data aggregation, 
                  scheduled reports, email delivery, and audit trail generation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}