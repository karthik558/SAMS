import { useState } from "react";
import { AssetForm } from "@/components/assets/AssetForm";
import { QRCodeGenerator } from "@/components/qr/QRCodeGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  QrCode,
  Calendar,
  Building2,
  AlertTriangle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Mock data for demonstration
const mockAssets = [
  {
    id: "AST-001",
    name: "Dell Laptop XPS 13",
    type: "Electronics",
    property: "Main Office",
    quantity: 5,
    purchaseDate: "2024-01-15",
    expiryDate: "2027-01-15",
    poNumber: "PO-2024-001",
    condition: "Excellent",
    status: "Active"
  },
  {
    id: "AST-002", 
    name: "Office Chair Ergonomic",
    type: "Furniture",
    property: "Branch Office",
    quantity: 12,
    purchaseDate: "2023-08-20",
    expiryDate: "2028-08-20",
    poNumber: "PO-2023-045",
    condition: "Good",
    status: "Active"
  },
  {
    id: "AST-003",
    name: "Industrial Printer HP",
    type: "Electronics", 
    property: "Warehouse",
    quantity: 2,
    purchaseDate: "2023-12-10",
    expiryDate: "2025-12-10",
    poNumber: "PO-2023-078",
    condition: "Fair",
    status: "Expiring Soon"
  },
  {
    id: "AST-004",
    name: "Forklift Toyota",
    type: "Machinery",
    property: "Factory",
    quantity: 1,
    purchaseDate: "2022-05-30",
    expiryDate: "2027-05-30",
    poNumber: "PO-2022-023",
    condition: "Good",
    status: "Active"
  }
];

export default function Assets() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");

  const handleAddAsset = (assetData: any) => {
    console.log("Adding asset:", assetData);
    toast.success("Asset added successfully! Connect Supabase to save to database.");
    setShowAddForm(false);
  };

  const handleEditAsset = (asset: any) => {
    setSelectedAsset(asset);
    setShowAddForm(true);
  };

  const handleDeleteAsset = (assetId: string) => {
    toast.success(`Asset ${assetId} deleted! Connect Supabase for persistent storage.`);
  };

  const handleGenerateQR = (asset: any) => {
    setSelectedAsset(asset);
    setShowQRGenerator(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge variant="secondary">Active</Badge>;
      case "Expiring Soon":
        return <Badge variant="destructive">Expiring Soon</Badge>;
      case "Expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredAssets = mockAssets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || asset.type.toLowerCase() === filterType;
    const matchesProperty = filterProperty === "all" || asset.property.toLowerCase().replace(" ", "-") === filterProperty;
    
    return matchesSearch && matchesType && matchesProperty;
  });

  if (showAddForm) {
    return (
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              ← Back to Assets
            </Button>
            <h1 className="text-3xl font-bold">
              {selectedAsset ? "Edit Asset" : "Add New Asset"}
            </h1>
          </div>
          <AssetForm 
            onSubmit={handleAddAsset} 
            initialData={selectedAsset}
          />
        </div>
    );
  }

  if (showQRGenerator && selectedAsset) {
    return (
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setShowQRGenerator(false)}>
              ← Back to Assets
            </Button>
            <h1 className="text-3xl font-bold">Generate QR Code</h1>
          </div>
          <QRCodeGenerator
            assetId={selectedAsset.id}
            assetName={selectedAsset.name}
            propertyName={selectedAsset.property}
            onGenerated={(qrCodeUrl) => {
              console.log("QR Code generated:", qrCodeUrl);
            }}
          />
        </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
  <div className="flex items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Asset Management
            </h1>
            <p className="text-muted-foreground">
              Track and manage all your organization's assets
            </p>
          </div>
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Asset
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{mockAssets.length}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-success">
                    {mockAssets.filter(a => a.status === "Active").length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                  <p className="text-2xl font-bold text-warning">
                    {mockAssets.filter(a => a.status === "Expiring Soon").length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Quantity</p>
                  <p className="text-2xl font-bold">
                    {mockAssets.reduce((sum, asset) => sum + asset.quantity, 0)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Inventory</CardTitle>
            <CardDescription>
              Search and filter your asset inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search assets by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="machinery">Machinery</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                </SelectContent>
              </Select>
              
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
            </div>
          </CardContent>
        </Card>

        {/* Assets Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                    <TableHead className="whitespace-nowrap">Asset ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Property</TableHead>
                    <TableHead className="hidden lg:table-cell">Quantity</TableHead>
                    <TableHead className="hidden xl:table-cell">Purchase Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.id}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{asset.type}</TableCell>
                      <TableCell className="hidden md:table-cell">{asset.property}</TableCell>
                      <TableCell className="hidden lg:table-cell">{asset.quantity}</TableCell>
                      <TableCell className="hidden xl:table-cell">{asset.purchaseDate}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getStatusBadge(asset.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAsset(asset)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateQR(asset)}
                          className="h-8 w-8 p-0"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
      </Card>
    </div>
  );
}