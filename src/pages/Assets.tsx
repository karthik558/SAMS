import { useEffect, useMemo, useState } from "react";
import { PageSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { AssetForm } from "@/components/assets/AssetForm";
import { QRCodeGenerator } from "@/components/qr/QRCodeGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
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
  AlertTriangle,
  ShieldCheck
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
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { listItemTypes } from "@/services/itemTypes";
import { createQRCode, type QRCode as SbQRCode } from "@/services/qrcodes";
import { submitApproval, listApprovals, type ApprovalRequest } from "@/services/approvals";
import RequestEditModal from "@/components/assets/RequestEditModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { composeQrWithLabel, composeQrGridSheet, composeQrA4Sheet } from "@/lib/qr";
import QRCode from "qrcode";
import { logActivity } from "@/services/activity";
import { getCurrentUserId } from "@/services/permissions";
import { canUserEdit } from "@/services/permissions";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [accessibleProps, setAccessibleProps] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFmt, setExportFmt] = useState<'png' | 'pdf'>('png');
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [approvalsByAsset, setApprovalsByAsset] = useState<Record<string, ApprovalRequest | undefined>>({});
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [requestEditAsset, setRequestEditAsset] = useState<any | null>(null);
  const activePropertyIds = useMemo(() => {
    const list = Object.values(propsById);
    if (!list.length) return new Set<string>();
    return new Set(list.filter(p => (p.status || '').toLowerCase() !== 'disabled').map(p => p.id));
  }, [propsById]);

  // Open Add form if navigated with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") setShowAddForm(true);
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const ids = await getAccessiblePropertyIdsForCurrentUser();
      setAccessibleProps(ids);
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setRole((r || "").toLowerCase());
    } catch {}
  }, []);

  const [canEditPage, setCanEditPage] = useState<boolean>(true);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) { setCanEditPage(role === 'admin' || role === 'manager' || role === 'user'); return; }
  const allowed = await canUserEdit(uid, 'assets');
  // Baseline: role can create/edit; if override exists (true/false), respect it; if null, keep baseline
  const baseline = role === 'admin' || role === 'manager' || role === 'user';
  setCanEditPage(allowed === null ? baseline : allowed);
      } catch { setCanEditPage(true); }
    })();
  }, [role]);

  // Simple UI loading flag
  const [loadingUI, setLoadingUI] = useState(true);

  // Load from Supabase when configured
  useEffect(() => {
    if (!isSupabase) return;
    (async () => {
      try {
  const data = await listAssets();
  setAssets(data as any);
  setLoadingUI(false);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load assets from Supabase; using local data");
        setLoadingUI(false);
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
            const active = props.filter((p: any) => (p.status || '').toLowerCase() !== 'disabled');
            setPropertyOptions(active.map((p: any) => p.id)); // use codes/ids
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
      const filtered = activePropertyIds.size ? props.filter(id => activePropertyIds.has(id)) : props;
      if (filtered.length) setPropertyOptions(filtered);
    }
    if (!typeOptions.length) {
      const types = Array.from(new Set(assets.map(a => a.type))).filter(Boolean) as string[];
      if (types.length) setTypeOptions(types);
    }
  }, [assets]);

  // Load pending approvals per asset for indicator
  useEffect(() => {
    (async () => {
      try {
        const list = await listApprovals();
        const pending = list
          .filter(a => a.status === 'pending_manager' || a.status === 'pending_admin')
          .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        const map: Record<string, ApprovalRequest> = {} as any;
        for (const a of pending) { if (!map[a.assetId]) map[a.assetId] = a; }
        setApprovalsByAsset(map);
      } catch {
        // ignore
      }
    })();
  }, [assets.length]);

  if (loadingUI && isSupabase) {
    return <PageSkeleton />;
  }

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
  const canCreate = canEditPage;
    if (!canCreate) {
      toast.error("You don't have permission to create assets");
      return;
    }
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
          location: assetData.location || null,
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
            location: assetData.location || null,
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
    if (role !== 'admin') return; // only admin can edit
    setSelectedAsset(asset);
    setShowAddForm(true);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (role !== 'admin') return; // only admin can delete
  const ok = window.confirm(`Are you sure you want to delete asset ${assetId}? This action cannot be undone.`);
  if (!ok) return;
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

  const getStatusBadge = (status: string) => <StatusChip status={status} />;

  const filteredAssets = assets.filter(asset => {
    // hide assets tied to disabled properties if we know properties
    if (activePropertyIds.size && asset.property && !activePropertyIds.has(asset.property)) return false;
    // enforce user access if any set exists
    if (accessibleProps.size && !(accessibleProps.has(String(asset.property_id || asset.property)))) return false;
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
          <div className="flex gap-2">
          <Button onClick={() => setShowAddForm(true)} className="gap-2" disabled={role !== 'admin' && role !== 'manager' && role !== 'user'}>
            <Plus className="h-4 w-4" />
            Add New Asset
          </Button>
          {/* Request Edit button moved to bulk actions bar below */}
          </div>
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

        {/* Bulk actions bar (visible when any selected) */}
  {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 border rounded-md">
            <div className="text-sm">{selectedIds.size} selected</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
    onClick={() => setExportOpen(true)}
              >
    Generate & Download QR Sheet
              </Button>
              {role !== 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedIds.size !== 1) { toast.info('Select exactly one asset'); return; }
                    const id = Array.from(selectedIds)[0];
                    const target = assets.find(a => a.id === id);
                    if (!target) { toast.error('Asset not found'); return; }
                    setRequestEditAsset(target);
                    setRequestEditOpen(true);
                  }}
                  disabled={selectedIds.size !== 1}
                >
                  Request Edit (with Approval)
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          </div>
        )}

        {/* Assets Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all"
                        checked={selectedIds.size > 0 && selectedIds.size === sortedAssets.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(new Set(sortedAssets.map(a => a.id)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Asset ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Property</TableHead>
                    <TableHead className="hidden lg:table-cell">Quantity</TableHead>
                    <TableHead className="hidden xl:table-cell">Location</TableHead>
                    <TableHead className="hidden xl:table-cell">Purchase Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Approval</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
        {sortedAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="w-10">
                      <Checkbox
                        aria-label={`Select ${asset.id}`}
                        checked={selectedIds.has(asset.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(asset.id); else next.delete(asset.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{asset.id}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{asset.type}</TableCell>
          <TableCell className="hidden md:table-cell">{displayPropertyCode(asset.property)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{asset.quantity}</TableCell>
                      <TableCell className="hidden xl:table-cell">{asset.location || '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell">{asset.purchaseDate}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getStatusBadge(asset.status)}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {approvalsByAsset[asset.id] ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1 text-primary">
                                  <ShieldCheck className="h-4 w-4" />
                                  <span className="text-xs">{approvalsByAsset[asset.id]?.status === 'pending_manager' ? 'Mgr' : 'Admin'}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                Pending {approvalsByAsset[asset.id]?.status === 'pending_manager' ? 'Manager' : 'Admin'} approval
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {role === 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAsset(asset)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateQR(asset)}
                          className="h-8 w-8 p-0"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
      </Card>

          {/* Export modal */}
          {exportOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setExportOpen(false)}>
              <div className="bg-background border rounded-lg w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-2">Export QR Sheet</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Format</label>
          <div className="mt-1 flex gap-3">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="fmt" checked={exportFmt==='png'} onChange={() => setExportFmt('png')} /> PNG
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="fmt" checked={exportFmt==='pdf'} onChange={() => setExportFmt('pdf')} /> PDF
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Orientation</label>
                    <div className="mt-1 flex gap-3">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="orient" checked={exportOrientation==='portrait'} onChange={() => setExportOrientation('portrait')} /> Portrait
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="orient" checked={exportOrientation==='landscape'} onChange={() => setExportOrientation('landscape')} /> Landscape
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
                    <Button
                      onClick={async () => {
                        try {
                          const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                          const normalizedBase = (base || '').replace(/\/$/, '');
                          const selected = assets.filter(a => selectedIds.has(a.id));
                          const images: string[] = [];
                          for (const a of selected) {
                            const url = `${normalizedBase}/assets/${a.id}`;
                            const raw = await QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000', light: '#FFF' }, errorCorrectionLevel: 'M' });
                            const labeled = await composeQrWithLabel(raw, { assetId: a.id, topText: a.name || 'Scan to view asset' });
                            images.push(labeled);
                          }
                          if (exportFmt === 'png') {
                            const { dataUrl } = await composeQrA4Sheet(images, { orientation: exportOrientation });
                            const aEl = document.createElement('a');
                            aEl.href = dataUrl;
                            aEl.download = `qr-selected-${new Date().toISOString().slice(0,10)}.png`;
                            aEl.click();
                          } else {
                            // Print-to-PDF via hidden iframe to avoid popup blockers
                            const { dataUrl } = await composeQrA4Sheet(images, { orientation: exportOrientation });
                            const pageCss = exportOrientation==='portrait' ? '@page { size: A4 portrait; margin: 0; }' : '@page { size: A4 landscape; margin: 0; }';
                            const iframe = document.createElement('iframe');
                            iframe.style.position = 'fixed';
                            iframe.style.right = '0';
                            iframe.style.bottom = '0';
                            iframe.style.width = '0';
                            iframe.style.height = '0';
                            iframe.style.border = '0';
                            document.body.appendChild(iframe);
                            const doc = iframe.contentWindow?.document;
                            doc?.open();
                            const pageDims = exportOrientation==='portrait' ? 'width:210mm;height:297mm;' : 'width:297mm;height:210mm;';
                            const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>QR Sheet</title>
    <style>
      ${pageCss}
      html, body { margin: 0; padding: 0; }
      .page { ${pageDims} margin: 0; display: flex; align-items: center; justify-content: center; }
      .page img { width: 100%; height: 100%; object-fit: contain; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body>
    <div class="page"><img id="sheet" src="${dataUrl}" /></div>
  </body>
</html>`;
                            doc?.write(html);
                            doc?.close();
                            const imgEl = doc?.getElementById('sheet') as HTMLImageElement | null;
                            const triggerPrint = () => {
                              try {
                                iframe.contentWindow?.focus();
                                // slight delay ensures layout sizes are applied before printing
                                setTimeout(() => iframe.contentWindow?.print(), 50);
                              } finally {
                                // remove iframe after a short delay
                                setTimeout(() => {
                                  try { document.body.removeChild(iframe); } catch {}
                                }, 1000);
                              }
                            };
                            if (imgEl && !imgEl.complete) {
                              imgEl.onload = () => setTimeout(triggerPrint, 50);
                            } else {
                              setTimeout(triggerPrint, 300);
                            }
                          }
                        } finally {
                          setExportOpen(false);
                        }
                      }}
                    >
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
    <RequestEditModal
      open={requestEditOpen}
      asset={requestEditAsset}
      onClose={() => setRequestEditOpen(false)}
      onSubmitted={async ({ patch, notes }) => {
        try {
          const raw = localStorage.getItem('auth_user');
          let me = 'user';
          try { const u = raw ? JSON.parse(raw) : null; me = u?.email || u?.id || 'user'; } catch {}
          if (!requestEditAsset) { toast.error('No asset selected'); return; }
          await submitApproval({ assetId: requestEditAsset.id, action: 'edit', requestedBy: me, notes, patch });
          toast.success('Edit request submitted for manager approval');
          setRequestEditOpen(false);
          // refresh approval indicators
          try {
            let dept: string | undefined;
            try { const au = raw ? JSON.parse(raw) : null; dept = au?.department || undefined; } catch {}
            const list = await listApprovals(undefined, dept || undefined);
            const pending = list
              .filter(a => a.status === 'pending_manager' || a.status === 'pending_admin')
              .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
            const map: Record<string, ApprovalRequest> = {} as any;
            for (const a of pending) { if (!map[a.assetId]) map[a.assetId] = a; }
            setApprovalsByAsset(map);
          } catch {}
        } catch (e:any) {
          console.error(e);
          toast.error(e?.message || 'Failed to submit edit request');
        }
      }}
    />
    </div>
  );
}