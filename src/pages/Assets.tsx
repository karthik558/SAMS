import { useEffect, useMemo, useState, useCallback } from "react";
import { isDemoMode } from "@/lib/demo";
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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { createQRCode, updateQRCode, type QRCode as SbQRCode } from "@/services/qrcodes";
import { submitApproval, listApprovals, type ApprovalRequest } from "@/services/approvals";
import RequestEditModal from "@/components/assets/RequestEditModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { composeQrWithLabel, composeQrGridSheet, composeQrA4Sheet, LABEL_PRESETS, printImagesAsLabels } from "@/lib/qr";
import QRCode from "qrcode";
import { logActivity } from "@/services/activity";
import { getCurrentUserId } from "@/services/permissions";
import { canUserEdit } from "@/services/permissions";
import { Checkbox } from "@/components/ui/checkbox";
import DateRangePicker, { type DateRange } from "@/components/ui/date-range-picker";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useTablePreferences } from "@/components/table/useTablePreferences";
import ColumnChooser, { type ColumnDef } from "@/components/table/ColumnChooser";

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
  const [exportFmt, setExportFmt] = useState<'png' | 'pdf' | 'label'>('png');
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [labelPresetId, setLabelPresetId] = useState<string>('4x6in');
  const [labelUseCustom, setLabelUseCustom] = useState<boolean>(false);
  const [labelCustomWidth, setLabelCustomWidth] = useState<string>('4');
  const [labelCustomHeight, setLabelCustomHeight] = useState<string>('6');
  const [labelUnits, setLabelUnits] = useState<'in' | 'mm'>('in');
  const [approvalsByAsset, setApprovalsByAsset] = useState<Record<string, ApprovalRequest | undefined>>({});
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [requestEditAsset, setRequestEditAsset] = useState<any | null>(null);
  const [range, setRange] = useState<DateRange>();
  const prefs = useTablePreferences("assets");
  const columnDefs: ColumnDef[] = [
    { key: "select", label: "Select", always: true },
    { key: "id", label: "Asset ID", always: true },
    { key: "name", label: "Name", always: true },
    { key: "type", label: "Type" },
    { key: "property", label: "Property" },
    { key: "qty", label: "Quantity" },
    { key: "location", label: "Location" },
    { key: "purchaseDate", label: "Purchase Date" },
    { key: "status", label: "Status" },
    { key: "approval", label: "Approval" },
    { key: "actions", label: "Actions", always: true },
  ];
  // Always-on columns set (cannot be hidden)
  const ALWAYS_COLS = useMemo(() => new Set(columnDefs.filter(c => c.always).map(c => c.key)), []);
  const isVisible = useCallback((key: string) => ALWAYS_COLS.has(key) || prefs.visibleCols.includes(key), [ALWAYS_COLS, prefs.visibleCols]);
  // initialize defaults for visible columns once
  useEffect(() => {
    // Only set defaults if nothing was loaded from storage
    if (!prefs.visibleCols.length) {
      const defaults = columnDefs
        .filter(c => c.always || ["type","property","qty","status","actions"].includes(c.key))
        .map(c => c.key);
      // Merge with ALWAYS_COLS to be safe
      const merged = Array.from(new Set([...
        Array.from(ALWAYS_COLS),
        ...defaults,
      ]));
      prefs.setVisibleCols(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
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

  // Sanitize a code by removing non-alphanumeric and uppercasing
  const sanitizeCode = (s: string) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const handleAddAsset = async (assetData: any) => {
  const canCreate = canEditPage;
    if (!canCreate) {
      toast.error("You don't have permission to create assets");
      return;
    }
    try {
  if (isSupabase) {
  const propertyCodeRaw = assetData.property; // Select provides property id/code
  const prefix = typePrefix(assetData.itemType) + sanitizeCode(propertyCodeRaw);
        const quantity = Math.max(1, Number(assetData.quantity) || 1);
        const baseSeq = nextSequence(assets, prefix);
        const ids = selectedAsset ? [selectedAsset.id] : Array.from({ length: quantity }, (_, i) => `${prefix}${String(baseSeq + i).padStart(4,'0')}`);
        const common: Omit<SbAsset,'id'> = {
          name: assetData.itemName,
          type: assetData.itemType,
          property: propertyCodeRaw,
          property_id: propertyCodeRaw as any,
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
          await logActivity("asset_updated", `Asset ${id} (${common.name}) updated at ${propertyCodeRaw}`);
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
  const propertyCode = sanitizeCode(assetData.property);
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
    // If quantity > 1, offer to split into unique asset IDs first
    const qty = Number(asset.quantity) || 1;
    if (qty > 1) {
      const ok = window.confirm(`This asset has quantity ${qty}. To generate unique QR codes, we'll split it into ${qty} separate asset IDs (one per unit). Continue?`);
      if (!ok) return;
      (async () => {
        try {
          const splitList = await splitAssetIntoUnits(asset);
          const first = splitList.find(a => a.id === asset.id) || splitList[0] || null;
          if (first) {
            setSelectedAsset(first);
            setShowQRGenerator(true);
          }
        } catch (e:any) {
          console.error(e);
          toast.error(e?.message || 'Failed to split asset into units');
        }
      })();
      return;
    }
    setSelectedAsset(asset);
    setShowQRGenerator(true);
  };
  // Utility to parse prefix + numeric suffix from an asset id (e.g., AST-001 -> prefix 'AST-', num 1, width 3)
  const parseId = (id: string): { prefix: string; num: number; width: number } | null => {
    const m = String(id).match(/^(.*?)(\d+)$/);
    if (!m) return null;
    return { prefix: m[1], num: Number(m[2]), width: m[2].length };
  };

  const pad = (n: number, width: number) => String(n).padStart(width, '0');

  // Split an asset with quantity>1 into N separate asset rows with distinct IDs (DB or local)
  const splitAssetIntoUnits = async (asset: any): Promise<any[]> => {
    const qty = Number(asset.quantity) || 1;
    if (qty <= 1) return [asset];
    const currentIds = new Set<string>(assets.map(a => String(a.id)));
    const parsed = parseId(asset.id);
    const created: any[] = [];
    const baseList: { id: string; copyOf: any }[] = [];
    // Keep existing id as unit #1
    baseList.push({ id: asset.id, copyOf: asset });
    // Determine additional ids
    if (parsed) {
      let n = parsed.num;
      for (let i = 1; i < qty; i++) {
        // find next available numeric id
        do { n += 1; } while (currentIds.has(parsed.prefix + pad(n, parsed.width)));
        baseList.push({ id: parsed.prefix + pad(n, parsed.width), copyOf: asset });
        currentIds.add(parsed.prefix + pad(n, parsed.width));
      }
    } else {
      // Fallback to type+property based prefix
  const propertyCode = sanitizeCode(String(asset.property || ''));
  const prefix = typePrefix(asset.type || '') + propertyCode;
      let start = nextSequence(assets, prefix);
      for (let i = 1; i < qty; i++) {
        const id = `${prefix}${String(start++).padStart(4,'0')}`;
        if (currentIds.has(id)) { i--; continue; }
        baseList.push({ id, copyOf: asset });
        currentIds.add(id);
      }
    }

  if (hasSupabaseEnv) {
      // Update existing asset to quantity=1
      try { await updateAsset(asset.id, { quantity: 1 } as any); } catch {}
      // Create remaining units (skip the first which is existing id)
      for (let i = 1; i < baseList.length; i++) {
        const id = baseList[i].id;
        const copy = baseList[i].copyOf;
        await createAsset({
          id,
          name: copy.name,
          type: copy.type,
          property: copy.property,
          property_id: copy.property_id ?? (copy.property as any),
          quantity: 1,
          purchaseDate: copy.purchaseDate ?? null,
          expiryDate: copy.expiryDate ?? null,
          poNumber: copy.poNumber ?? null,
          condition: copy.condition ?? null,
          status: copy.status || 'Active',
          location: copy.location ?? null,
        } as any);
      }
  // Refresh list from DB and return only the unit assets we created/updated
  const unitIds = baseList.map(b => b.id);
  const fresh = await listAssets().catch(() => [] as any[]);
  setAssets(fresh as any[]);
  try { setSortBy('id-asc'); } catch {}
  return (fresh as any[]).filter((a: any) => unitIds.includes(String(a.id)));
    } else {
      // Local only: mutate state
  setAssets(prev => {
        const updated = prev.map(a => a.id === asset.id ? { ...a, quantity: 1 } : a);
        for (let i = 1; i < baseList.length; i++) {
          const id = baseList[i].id;
          updated.push({ ...asset, id, quantity: 1 });
        }
        return updated;
      });
  try { setSortBy('id-asc'); } catch {}
      return baseList.map(b => ({ ...asset, id: b.id, quantity: 1 }));
    }
  };

  const getStatusBadge = (status: string) => <StatusChip status={status} />;

  // Natural ID comparator to keep IDs like AST-001, AST-002 adjacent
  const compareById = (a: any, b: any) => {
    const pa = parseId(String(a.id));
    const pb = parseId(String(b.id));
    if (pa && pb) {
      const prefCmp = pa.prefix.localeCompare(pb.prefix);
      if (prefCmp !== 0) return prefCmp;
      return pa.num - pb.num;
    }
    return String(a.id).localeCompare(String(b.id));
  };

  const filteredAssets = assets.filter(asset => {
    // hide assets tied to disabled properties if we know properties
    if (activePropertyIds.size && asset.property && !activePropertyIds.has(asset.property)) return false;
    // enforce user access if any set exists
    if (accessibleProps.size && !(accessibleProps.has(String(asset.property_id || asset.property)))) return false;
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || (asset.type || "").toLowerCase() === filterType.toLowerCase();
    const matchesProperty = filterProperty === "all" || (asset.property || "").toLowerCase() === filterProperty.toLowerCase();
    // Date range filter: use purchaseDate when available, else fallback to created_at
    const toStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const toEndOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    let matchesDate = true;
    if (range?.from) {
      const start = toStartOfDay(range.from);
      const end = toEndOfDay(range.to ?? range.from);
      const dateStr: string | undefined = (asset.purchaseDate as any) || (asset.created_at as any);
      if (dateStr) {
        const t = new Date(dateStr).getTime();
        matchesDate = t >= start.getTime() && t <= end.getTime();
      } else {
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesType && matchesProperty && matchesDate;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case "id-asc": return compareById(a, b);
      case "id-desc": return -compareById(a, b);
      case "name": return (a.name || "").localeCompare(b.name || "");
      case "qty": return (b.quantity || 0) - (a.quantity || 0);
      case "newest":
      default: {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        const dt = bt - at;
        if (dt !== 0) return dt;
        // tie-break by natural id to keep units close when created_at is equal/empty
        return compareById(a, b);
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
        {/* Header with breadcrumbs */}
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Assets" }]} />
        <PageHeader
          icon={Package}
          title="Asset Management"
          description="Track and manage all your organization's assets"
          actions={
            <div className="flex gap-2">
              <Button variant={prefs.dense ? "secondary" : "outline"} size="sm" onClick={() => prefs.setDense(d => !d)}>
                {prefs.dense ? "Comfortable" : "Compact"}
              </Button>
              <ColumnChooser
                columns={columnDefs}
                visible={prefs.visibleCols}
                onChange={prefs.setVisibleCols}
              />
              <Button onClick={() => setShowAddForm(true)} className="gap-2" size="sm" disabled={role !== 'admin' && role !== 'manager' && role !== 'user'}>
                <Plus className="h-4 w-4" />
                Add Asset
              </Button>
            </div>
          }
        />

  {/* Stats Cards (derived from current assets state) */}
  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-4">
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:flex-wrap">
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

              {/* Quick toggle for sorting by Asset ID */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSortBy((s) => (s === 'id-asc' ? 'id-desc' : 'id-asc'))}
                className="shrink-0"
                aria-label="Toggle sort by Asset ID"
                title="Sort by Asset ID"
              >
                <span className="mr-2">Asset ID</span>
                {sortBy === 'id-asc' ? <ArrowUp className="h-4 w-4" /> : sortBy === 'id-desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
              </Button>

              <DateRangePicker className="w-full sm:w-auto min-w-[16rem] shrink-0" value={range} onChange={setRange} />
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
              <Table dense={prefs.dense} stickyHeader stickyFirstCol>
              <TableHeader>
                <TableRow>
                    {isVisible('select') && (
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all"
                        checked={selectedIds.size > 0 && selectedIds.size === sortedAssets.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(new Set(sortedAssets.map(a => a.id)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </TableHead>)}
                    {isVisible('id') && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSortBy((s) => (s === 'id-asc' ? 'id-desc' : 'id-asc'))}
                          className="inline-flex items-center gap-1 hover:text-foreground/80"
                          aria-label="Sort by Asset ID"
                          title="Sort by Asset ID"
                        >
                          Asset ID
                          {sortBy === 'id-asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : sortBy === 'id-desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {isVisible('name') && <TableHead>Name</TableHead>}
                    {isVisible('type') && <TableHead>Type</TableHead>}
                    {isVisible('property') && <TableHead>Property</TableHead>}
                    {isVisible('qty') && <TableHead>Quantity</TableHead>}
                    {isVisible('location') && <TableHead>Location</TableHead>}
                    {isVisible('purchaseDate') && <TableHead>Purchase Date</TableHead>}
                    {isVisible('status') && <TableHead>Status</TableHead>}
                    {isVisible('approval') && <TableHead>Approval</TableHead>}
                    {isVisible('actions') && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
        {sortedAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    {isVisible('select') && (
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
                    </TableCell>)}
                    {isVisible('id') && <TableCell className="font-medium">{asset.id}</TableCell>}
                    {isVisible('name') && <TableCell>{asset.name}</TableCell>}
                    {isVisible('type') && <TableCell>{asset.type}</TableCell>}
                    {isVisible('property') && <TableCell>{displayPropertyCode(asset.property)}</TableCell>}
                    {isVisible('qty') && <TableCell>{asset.quantity}</TableCell>}
                    {isVisible('location') && <TableCell>{asset.location || '-'}</TableCell>}
                    {isVisible('purchaseDate') && <TableCell>{asset.purchaseDate}</TableCell>}
                    {isVisible('status') && <TableCell>{getStatusBadge(asset.status)}</TableCell>}
                    {isVisible('approval') && (
                      <TableCell>
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
                    )}
                    {isVisible('actions') && (
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
                    )}
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
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="fmt" checked={exportFmt==='label'} onChange={() => setExportFmt('label')} /> Label (roll printer)
                      </label>
                    </div>
                  </div>
                  {exportFmt !== 'label' && (
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
                  )}
                  {exportFmt === 'label' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Label size</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <label className="inline-flex items-center gap-1 text-sm">
                          <input type="radio" name="labelMode" checked={!labelUseCustom} onChange={() => setLabelUseCustom(false)} /> Preset
                        </label>
                        <label className="inline-flex items-center gap-1 text-sm">
                          <input type="radio" name="labelMode" checked={labelUseCustom} onChange={() => setLabelUseCustom(true)} /> Custom
                        </label>
                      </div>
                      {!labelUseCustom ? (
                        <Select value={labelPresetId} onValueChange={(v) => { setLabelPresetId(v); }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select label size" />
                          </SelectTrigger>
                          <SelectContent>
                            {LABEL_PRESETS.map(lp => (
                              <SelectItem key={lp.id} value={lp.id}>{lp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Width</label>
                            <Input value={labelCustomWidth} onChange={(e) => setLabelCustomWidth(e.target.value)} placeholder={labelUnits==='in'?'inches':'mm'} />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Height</label>
                            <Input value={labelCustomHeight} onChange={(e) => setLabelCustomHeight(e.target.value)} placeholder={labelUnits==='in'?'inches':'mm'} />
                          </div>
                          <div className="flex items-end">
                            <div className="flex gap-3">
                              <label className="inline-flex items-center gap-1 text-sm">
                                <input type="radio" name="labelUnits" checked={labelUnits==='in'} onChange={() => setLabelUnits('in')} /> in
                              </label>
                              <label className="inline-flex items-center gap-1 text-sm">
                                <input type="radio" name="labelUnits" checked={labelUnits==='mm'} onChange={() => setLabelUnits('mm')} /> mm
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Prints one label per page sized exactly to your label. Use your printer options for material and density.</p>
                  </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
                    <Button
                      onClick={async () => {
                        try {
                          const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                          const normalizedBase = (base || '').replace(/\/$/, '');
                          const selected = assets.filter(a => selectedIds.has(a.id));
                          const images: string[] = [];
                          // Expand assets with quantity>1 by splitting first (DB/local as configured)
                          const expanded: any[] = [];
                          for (const a of selected) {
                            if ((Number(a.quantity)||1) > 1) {
                              try {
                                const units = await splitAssetIntoUnits(a);
                                expanded.push(...units);
                              } catch {
                                expanded.push(a);
                              }
                            } else {
                              expanded.push(a);
                            }
                          }
                          let createdCount = 0;
                          const createdIds: string[] = [];
                          for (let i = 0; i < expanded.length; i++) {
                            const a = expanded[i];
                            const url = `${normalizedBase}/assets/${a.id}`;
                            const raw = await QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000', light: '#FFF' }, errorCorrectionLevel: 'M' });
                            const labeled = await composeQrWithLabel(raw, { assetId: a.id, topText: a.name || 'Scan to view asset' });
                            images.push(labeled);
                            // Persist QR record so it appears in QR Codes page
                            try {
                              if (hasSupabaseEnv) {
                                const payload: SbQRCode = {
                                  id: `QR-${a.id}-${Date.now()}-${i}`,
                                  assetId: a.id,
                                  property: a.property ?? null,
                                  generatedDate: new Date().toISOString().slice(0,10),
                                  status: 'Generated',
                                  printed: false,
                                  imageUrl: labeled,
                                } as any;
                                await createQRCode(payload);
                                createdIds.push(payload.id);
                                createdCount++;
                              }
                            } catch (e) {
                              console.error('Failed to create QR record for', a.id, e);
                            }
                          }
                          // Log bulk activity summary
                          try { await logActivity('qr_bulk_generated', `Generated ${expanded.length} QR code(s) for export`); } catch {}
                          if (exportFmt === 'png') {
                            const { dataUrl } = await composeQrA4Sheet(images, { orientation: exportOrientation });
                            const aEl = document.createElement('a');
                            aEl.href = dataUrl;
                            aEl.download = `qr-selected-${new Date().toISOString().slice(0,10)}.png`;
                            aEl.click();
                          } else if (exportFmt === 'pdf') {
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
                            // Mark printed in history for PDF path
                            try {
                              if (hasSupabaseEnv && createdIds.length) {
                                await Promise.all(createdIds.map(id => updateQRCode(id, { printed: true, status: 'Printed' } as any)));
                              }
                            } catch {}
                          } else if (exportFmt === 'label') {
                            let widthIn = 4, heightIn = 6;
                            if (!labelUseCustom) {
                              const preset = LABEL_PRESETS.find(p => p.id === labelPresetId) || LABEL_PRESETS[0];
                              widthIn = preset.widthIn; heightIn = preset.heightIn;
                            } else {
                              const w = parseFloat(labelCustomWidth) || 1;
                              const h = parseFloat(labelCustomHeight) || 1;
                              if (labelUnits === 'mm') { widthIn = w / 25.4; heightIn = h / 25.4; } else { widthIn = w; heightIn = h; }
                            }
                            await printImagesAsLabels(images, { widthIn, heightIn, orientation: 'portrait', fit: 'contain' });
                            // Mark printed in history for Label path
                            try {
                              if (hasSupabaseEnv && createdIds.length) {
                                await Promise.all(createdIds.map(id => updateQRCode(id, { printed: true, status: 'Printed' } as any)));
                              }
                            } catch {}
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