import { useEffect, useMemo, useState } from "react";
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
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listAssets, createAsset, updateAsset, deleteAsset as sbDeleteAsset, type Asset as SbAsset } from "@/services/assets";
import { listProperties, type Property } from "@/services/properties";
import { listItemTypes } from "@/services/itemTypes";
import { createQRCode, type QRCode as SbQRCode } from "@/services/qrcodes";
import { logActivity } from "@/services/activity";

// Mock data fallback
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
  const isSupabase = hasSupabaseEnv;
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [assets, setAssets] = useState<any[]>(mockAssets);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<string[]>([]);
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const [propsByName, setPropsByName] = useState<Record<string, Property>>({});
  const [sortBy, setSortBy] = useState("newest");

  // Open Add form if navigated with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") setShowAddForm(true);
  }, [searchParams]);

  // Load from Supabase when configured
  useEffect(() => {
    if (!isSupabase) return;
    (async () => {
      try {
  const data = await listAssets();
  setAssets(data as any);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load assets from Supabase; using local data");
      }
    })();
  }, [isSupabase]);

  // Load dynamic filter options
  useEffect(() => {
    (async () => {
      try {
        if (isSupabase) {
          const [props, types] = await Promise.all([
            listProperties().catch(() => [] as any[]),
            listItemTypes().catch(() => [] as any[]),
          ]);
          if (props?.length) {
            setPropertyOptions(props.map((p: any) => p.id)); // use codes/ids
            setPropsById(Object.fromEntries(props.map((p: any) => [p.id, p])));
            setPropsByName(Object.fromEntries(props.map((p: any) => [p.name, p])));
          }
          if (types?.length) setTypeOptions(types.map((t: any) => t.name));
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [isSupabase]);

  // Fallback options from current assets
  useEffect(() => {
    if (!propertyOptions.length) {
      const props = Array.from(new Set(assets.map(a => a.property))).filter(Boolean) as string[];
      if (props.length) setPropertyOptions(props);
    }
    if (!typeOptions.length) {
      const types = Array.from(new Set(assets.map(a => a.type))).filter(Boolean) as string[];
      if (types.length) setTypeOptions(types);
    }
  }, [assets]);

  // Helpers for ID generation and display
  const typePrefix = (t: string) => {
    const key = (t || "").toLowerCase();
    if (key.startsWith("elec")) return "ET"; // Electronics
    if (key.startsWith("furn")) return "FR"; // Furniture
    if (key.startsWith("mach")) return "MC"; // Machinery
    if (key.startsWith("veh")) return "VH"; // Vehicles
    if (key.startsWith("office")) return "OS"; // Office Supplies
    return (t?.slice(0,2) || "AS").toUpperCase();
  };

  const nextSequence = (existing: any[], prefix: string) => {
    const seqs = existing
      .map(a => a.id)
      .filter((id: string) => typeof id === 'string' && id.startsWith(prefix))
      .map((id: string) => Number(id.slice(prefix.length)) || 0);
    const max = seqs.length ? Math.max(...seqs) : 0;
    return max + 1;
  };

  const displayPropertyCode = (val: string) => {
    if (propsById[val]) return val; // already a code
    const p = propsByName[val];
    return p ? p.id : val;
  };

  const handleAddAsset = async (assetData: any) => {
    try {
  if (isSupabase) {
        const propertyCode = assetData.property; // Select provides property id/code
        const prefix = typePrefix(assetData.itemType) + propertyCode;
        const quantity = Math.max(1, Number(assetData.quantity) || 1);
        const baseSeq = nextSequence(assets, prefix);
        const ids = selectedAsset ? [selectedAsset.id] : Array.from({ length: quantity }, (_, i) => `${prefix}${String(baseSeq + i).padStart(4,'0')}`);
        const common: Omit<SbAsset,'id'> = {
          name: assetData.itemName,
          type: assetData.itemType,
          property: propertyCode,
          property_id: propertyCode as any,
          quantity: selectedAsset ? Number(assetData.quantity || 1) : 1,
          purchaseDate: assetData.purchaseDate ? new Date(assetData.purchaseDate).toISOString().slice(0,10) : null,
          expiryDate: assetData.expiryDate ? new Date(assetData.expiryDate).toISOString().slice(0,10) : null,
          poNumber: assetData.poNumber || null,
          condition: assetData.condition || null,
          status: selectedAsset?.status || 'Active',
        } as any;
        if (selectedAsset) {
          const id = ids[0];
          await updateAsset(id, { ...common, id } as any);
          await logActivity("asset_updated", `Asset ${id} (${common.name}) updated at ${propertyCode}`);
        } else {
          for (const id of ids) {
            await createAsset({ ...common, id } as any);
          }
          await logActivity("asset_created", `Assets created: ${ids.join(", ")}`);
        }
        const data = await listAssets();
        setAssets(data as any);
        toast.success(selectedAsset ? "Asset updated" : `Asset(s) saved: ${ids.slice(0,3).join(", ")}${ids.length>3?"...":""}`);
  } else {
        toast.info("Supabase not configured; using local data only");
        const propertyCode = assetData.property;
        const prefix = typePrefix(assetData.itemType) + propertyCode;
        const quantity = Math.max(1, Number(assetData.quantity) || 1);
        const baseSeq = nextSequence(assets, prefix);
        const ids = Array.from({ length: quantity }, (_, i) => `${prefix}${String(baseSeq + i).padStart(4,'0')}`);
        setAssets((prev) => ([
          ...prev,
          ...ids.map((id) => ({
            id,
            name: assetData.itemName,
            type: assetData.itemType,
            property: propertyCode,
            quantity: 1,
            purchaseDate: assetData.purchaseDate || null,
            expiryDate: assetData.expiryDate || null,
            poNumber: assetData.poNumber || null,
            condition: assetData.condition || null,
            status: 'Active',
          }))
        ]));
        await logActivity("asset_created", `Asset ${assetData.itemName} created (local)`, "Local");
      }
      setShowAddForm(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save asset");
    }
  };

  const handleEditAsset = (asset: any) => {
    setSelectedAsset(asset);
    setShowAddForm(true);
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      if (hasSupabaseEnv) {
        await sbDeleteAsset(assetId);
        setAssets((prev) => prev.filter(a => a.id !== assetId));
        toast.success(`Asset ${assetId} deleted`);
  await logActivity("asset_deleted", `Asset ${assetId} deleted`);
      } else {
        setAssets((prev) => prev.filter(a => a.id !== assetId));
        toast.info("Supabase not configured; deleted locally only");
  await logActivity("asset_deleted", `Asset ${assetId} deleted (local)`, "Local");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete asset");
    }
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

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || (asset.type || "").toLowerCase() === filterType.toLowerCase();
    const matchesProperty = filterProperty === "all" || (asset.property || "").toLowerCase() === filterProperty.toLowerCase();
    
    return matchesSearch && matchesType && matchesProperty;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case "id-asc": return a.id.localeCompare(b.id);
      case "id-desc": return b.id.localeCompare(a.id);
      case "name": return (a.name || "").localeCompare(b.name || "");
      case "qty": return (b.quantity || 0) - (a.quantity || 0);
      case "newest":
      default: {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      }
    }
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
              toast.success("QR Code generated");
              // Persist QR code record and log activity
              (async () => {
                try {
                  const id = `QR-${Math.floor(Math.random()*900+100)}`;
                  const payload: SbQRCode = {
                    id,
                    assetId: selectedAsset.id,
                    property: selectedAsset.property,
                    generatedDate: new Date().toISOString().slice(0,10),
                    status: "Generated",
                    printed: false,
                    imageUrl: qrCodeUrl,
                  } as any;
                  if (hasSupabaseEnv) {
                    await createQRCode(payload);
                  }
                  await logActivity("qr_generated", `QR generated for ${selectedAsset.name} (${selectedAsset.id})`);
                } catch (e) {
                  console.error(e);
                }
              })();
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

        {/* Stats Cards (derived from current assets state) */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{assets.length}</p>
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
                    {assets.filter(a => a.status === "Active").length}
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
                    {assets.filter(a => a.status === "Expiring Soon").length}
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
                    {assets.reduce((sum, asset) => sum + Number(asset.quantity || 0), 0)}
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
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {propertyOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="id-asc">ID ↑</SelectItem>
                  <SelectItem value="id-desc">ID ↓</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="qty">Quantity</SelectItem>
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
        {sortedAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.id}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{asset.type}</TableCell>
          <TableCell className="hidden md:table-cell">{displayPropertyCode(asset.property)}</TableCell>
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