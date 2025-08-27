import { useState } from "react";
import { QRCodeGenerator } from "@/components/qr/QRCodeGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QrCode, Search, Download, Printer, Package, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Mock data for QR codes
const mockQRCodes = [
  {
    id: "QR-001",
    assetId: "AST-001",
    assetName: "Dell Laptop XPS 13",
    property: "Main Office",
    generatedDate: "2024-01-20",
    status: "Generated",
    printed: true
  },
  {
    id: "QR-002",
    assetId: "AST-002", 
    assetName: "Office Chair Ergonomic",
    property: "Branch Office",
    generatedDate: "2024-01-18",
    status: "Generated",
    printed: false
  },
  {
    id: "QR-003",
    assetId: "AST-003",
    assetName: "Industrial Printer HP",
    property: "Warehouse",
    generatedDate: "2024-01-15",
    status: "Generated",
    printed: true
  },
  {
    id: "QR-004",
    assetId: "AST-004",
    assetName: "Forklift Toyota",
    property: "Factory",
    generatedDate: "2024-01-12",
    status: "Generated",
    printed: false
  }
];

export default function QRCodes() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleGenerateNew = () => {
    setSelectedAsset({
      id: "AST-NEW",
      name: "New Asset",
      property: "Main Office"
    });
    setShowGenerator(true);
  };

  const handleGenerateForAsset = (asset: any) => {
    setSelectedAsset(asset);
    setShowGenerator(true);
  };

  const handleBulkPrint = () => {
    const unprintedCodes = mockQRCodes.filter(qr => !qr.printed);
    toast.success(`Printing ${unprintedCodes.length} QR codes. Connect Supabase for full functionality.`);
  };

  const handleDownloadAll = () => {
    toast.success("Downloading all QR codes as ZIP. Connect Supabase for full functionality.");
  };

  const getStatusBadge = (status: string, printed: boolean) => {
    if (status === "Generated") {
      return printed ? 
        <Badge variant="secondary">Printed</Badge> : 
        <Badge variant="outline">Ready to Print</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const filteredQRCodes = mockQRCodes.filter(qr => {
    const matchesSearch = qr.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.assetId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProperty = filterProperty === "all" || qr.property.toLowerCase().replace(" ", "-") === filterProperty;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "printed" && qr.printed) ||
                         (filterStatus === "ready" && !qr.printed);
    
    return matchesSearch && matchesProperty && matchesStatus;
  });

  if (showGenerator) {
    return (
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setShowGenerator(false)}>
              ← Back to QR Codes
            </Button>
            <h1 className="text-3xl font-bold">Generate QR Code</h1>
          </div>
          <QRCodeGenerator
            assetId={selectedAsset?.id}
            assetName={selectedAsset?.name}
            propertyName={selectedAsset?.property}
            onGenerated={(qrCodeUrl) => {
              console.log("QR Code generated:", qrCodeUrl);
              toast.success("QR Code generated successfully!");
            }}
          />
        </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <QrCode className="h-8 w-8" />
              QR Code Management
            </h1>
            <p className="text-muted-foreground">
              Generate, manage, and print QR codes for asset tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerateNew} className="gap-2">
              <QrCode className="h-4 w-4" />
              Generate New QR Code
            </Button>
            <Button onClick={handleBulkPrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Bulk Print
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total QR Codes</p>
                  <p className="text-2xl font-bold">{mockQRCodes.length}</p>
                </div>
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Printed</p>
                  <p className="text-2xl font-bold text-success">
                    {mockQRCodes.filter(qr => qr.printed).length}
                  </p>
                </div>
                <Printer className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ready to Print</p>
                  <p className="text-2xl font-bold text-warning">
                    {mockQRCodes.filter(qr => !qr.printed).length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Properties</p>
                  <p className="text-2xl font-bold">
                    {new Set(mockQRCodes.map(qr => qr.property)).size}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code Inventory</CardTitle>
            <CardDescription>
              Search and filter your generated QR codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by asset name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  <SelectItem value="main-office">Main Office</SelectItem>
                  <SelectItem value="branch-office">Branch Office</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="factory">Factory</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="printed">Printed</SelectItem>
                  <SelectItem value="ready">Ready to Print</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleDownloadAll} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Codes Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredQRCodes.map((qrCode) => (
            <Card key={qrCode.id} className="hover:shadow-medium transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{qrCode.assetName}</CardTitle>
                    <CardDescription>{qrCode.assetId}</CardDescription>
                  </div>
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Property and Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{qrCode.property}</span>
                  </div>
                  {getStatusBadge(qrCode.status, qrCode.printed)}
                </div>

                {/* Generated Date */}
                <div className="text-sm text-muted-foreground">
                  Generated: {qrCode.generatedDate}
                </div>

                {/* QR Code Preview */}
                <div className="flex justify-center p-4 bg-muted/30 rounded-lg">
                  <div className="w-24 h-24 bg-background border-2 border-border rounded flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-muted-foreground" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateForAsset(qrCode)}
                    className="flex-1 gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Backend Connection Notice */}
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <QrCode className="h-6 w-6 text-warning shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">QR Code Management Features</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Full QR code management requires Supabase connection for persistent storage, 
                  bulk operations, and integration with asset data.
                </p>
              </div>
            </div>
          </CardContent>
      </Card>
    </div>
  );
}