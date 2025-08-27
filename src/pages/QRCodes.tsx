import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
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
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listQRCodes, createQRCode, updateQRCode, type QRCode as SbQRCode } from "@/services/qrcodes";
import { logActivity } from "@/services/activity";
import { addNotification } from "@/services/notifications";
import { listProperties, type Property } from "@/services/properties";
import { Calendar } from "@/components/ui/calendar";
import { listAssets, type Asset } from "@/services/assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [role, setRole] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date-newest");
  const [codes, setCodes] = useState<any[]>(mockQRCodes);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propsById, setPropsById] = useState<Record<string, Property>>({});
  const [propsByName, setPropsByName] = useState<Record<string, Property>>({});
  const [computedImages, setComputedImages] = useState<Record<string, string>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<'none' | 'yesterday' | '7days' | 'custom'>("none");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>();
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);

  // Active property ids set (exclude disabled properties from UI everywhere)
  const activePropertyIds = useMemo(() => {
    const list = Object.values(propsById);
    if (!list.length) return new Set<string>();
    return new Set(list.filter(p => (p.status || '').toLowerCase() !== 'disabled').map(p => p.id));
  }, [propsById]);

  // Load QR codes and properties (when Supabase is configured)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setRole((r || "").toLowerCase());
    } catch {}
    (async () => {
      try {
        if (hasSupabaseEnv) {
          const [data, props, allAssets] = await Promise.all([
            listQRCodes(),
            listProperties().catch(() => [] as Property[]),
            listAssets().catch(() => [] as Asset[]),
          ]);
          const mapped = data.map(d => ({
            id: d.id,
            assetId: d.assetId,
            assetName: d.assetName || d.assetId,
            property: d.property || "",
            imageUrl: d.imageUrl || null,
            generatedDate: d.generatedDate,
            status: d.status,
            printed: d.printed,
          }));
          setCodes(mapped.sort((a,b) => (a.generatedDate < b.generatedDate ? 1 : -1)));
          if (props?.length) {
            setProperties(props);
            setPropsById(Object.fromEntries(props.map(p => [p.id, p])));
            setPropsByName(Object.fromEntries(props.map(p => [p.name, p])));
          }
          if (allAssets?.length) setAssets(allAssets);
        } else {
          // Fallback properties for local mode
          const fallback: Property[] = [
            { id: "PROP-001", name: "Main Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-002", name: "Warehouse", type: "Storage", status: "Active", address: null, manager: null } as any,
            { id: "PROP-003", name: "Branch Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-004", name: "Factory", type: "Manufacturing", status: "Active", address: null, manager: null } as any,
          ];
          setProperties(fallback);
          setPropsById(Object.fromEntries(fallback.map(p => [p.id, p])));
          setPropsByName(Object.fromEntries(fallback.map(p => [p.name, p])));
        }
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load data; using local fallbacks");
      }
    })();
  }, []);

  // Helpers to reconcile property codes vs names
  const propertyCodeOf = (val: string) => {
    if (!val) return val;
    if (propsById[val]) return val; // already a code
    const p = propsByName[val];
    return p ? p.id : val; // fallback to given value
  };
  const propertyLabel = (val: string) => {
    if (propsById[val]) return propsById[val].name;
    return val;
  };

  // (moved below filteredQRCodes)

  const handleGenerateNew = () => {
  setAssetPickerOpen(true);
  };

  const handleGenerateForAsset = (asset: any) => {
    setSelectedAsset(asset);
    setShowGenerator(true);
  };

  const handleBulkPrint = () => {
    const unprintedCodes = codes.filter(qr => !qr.printed);
    toast.success(`Printing ${unprintedCodes.length} QR codes`);
    (async () => {
      await logActivity("qr_bulk_print", `Bulk printed ${unprintedCodes.length} QR codes`);
    })();
  };

  const handleDownloadAll = async () => {
    try {
      const zip = new JSZip();
  for (const qr of sortedQRCodes) {
        let dataUrl = qr.imageUrl;
        if (!dataUrl) dataUrl = await generateQrPng(qr);
        const base64 = (dataUrl as string).split(',')[1];
        zip.file(`qr-${qr.assetId}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-codes-${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloading all QR codes");
  await logActivity("qr_download_all", `Downloaded ${sortedQRCodes.length} QR codes`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to download all QR codes");
    }
  };

  // Assets without QR helper
  const assetIdsWithQR = useMemo(() => new Set(codes.map(c => c.assetId)), [codes]);
  const availableAssets = useMemo(() => {
    let list = assets.filter(a => !assetIdsWithQR.has(a.id));
    // Exclude disabled properties if we know them
    if (activePropertyIds.size) list = list.filter(a => !a.property || activePropertyIds.has(a.property));
    // Basic search by name or id
    if (assetSearch.trim()) {
      const q = assetSearch.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    }
    return list;
  }, [assets, assetIdsWithQR, activePropertyIds, assetSearch]);

  const generateFromAsset = async (asset: Asset) => {
    try {
      if (assetIdsWithQR.has(asset.id)) {
        toast.info("QR already exists for this asset");
        return;
      }
      const today = new Date().toISOString().slice(0,10);
      const png = await generateQrPng({
        assetId: asset.id,
        assetName: asset.name,
        property: asset.property,
        generatedDate: today,
      });
      const id = `QR-${Math.floor(Math.random()*900+100)}`;
      if (hasSupabaseEnv) {
        const payload: SbQRCode = {
          id,
          assetId: asset.id,
          property: asset.property,
          generatedDate: today,
          status: "Generated",
          printed: false,
          imageUrl: png,
        } as any;
        await createQRCode(payload);
        const data = await listQRCodes();
        const mapped = data.map(d => ({
          id: d.id,
          assetId: d.assetId,
          assetName: d.assetName || d.assetId,
          property: d.property || "",
          generatedDate: d.generatedDate,
          status: d.status,
          printed: d.printed,
          imageUrl: d.imageUrl || null,
        }));
        setCodes(mapped.sort((a,b) => (a.generatedDate < b.generatedDate ? 1 : -1)));
      } else {
        setCodes(prev => [
          ...prev,
          { id, assetId: asset.id, assetName: asset.name, property: asset.property, generatedDate: today, status: 'Generated', printed: false, imageUrl: png }
        ]);
      }
      await logActivity("qr_generated", `QR generated for ${asset.name} (${asset.id})`);
      await addNotification({ title: "QR generated", message: `${asset.name} (${asset.id}) QR is ready`, type: "qr" });
      setAssetPickerOpen(false);
      setSearchTerm(asset.id);
      const created = (id);
      setHighlightId(created);
      setTimeout(() => setHighlightId(null), 3500);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate QR");
    }
  };

  const getStatusBadge = (status: string, printed: boolean) => {
    if (status === "Generated") {
      return printed ? 
        <Badge variant="secondary">Printed</Badge> : 
        <Badge variant="outline">Ready to Print</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // Deduplicate by assetId (pick most recent entry) then filter
  const uniqueCodes = useMemo(() => {
    // Keep first occurrence by assetId, assuming codes is already roughly newest-first
    const seen = new Set<string>();
    const out: any[] = [];
    for (const qr of codes) {
      const key = (qr.assetId || '').toString();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(qr);
    }
    return out;
  }, [codes]);

  const filteredQRCodes = uniqueCodes.filter(qr => {
    const matchesSearch = qr.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.assetId.toLowerCase().includes(searchTerm.toLowerCase());
    const qrPropCode = propertyCodeOf(qr.property);
    // Exclude disabled properties if we know properties
    const isActiveProperty = activePropertyIds.size === 0 || activePropertyIds.has(qrPropCode);
    const matchesProperty = (filterProperty === "all" || qrPropCode === filterProperty) && isActiveProperty;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "printed" && qr.printed) ||
                         (filterStatus === "ready" && !qr.printed);
    // Date filter
    const toStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const toEndOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    let matchesDate = true;
    if (datePreset !== 'none') {
      const today = new Date();
      let start: Date | null = null;
      let end: Date | null = null;
      if (datePreset === 'yesterday') {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        start = toStartOfDay(y);
        end = toEndOfDay(y);
      } else if (datePreset === '7days') {
        const y = new Date(today);
        const s = new Date(today);
        s.setDate(y.getDate() - 6); // include today
        start = toStartOfDay(s);
        end = toEndOfDay(y);
      } else if (datePreset === 'custom') {
        if (customRange?.from) {
          start = toStartOfDay(customRange.from);
          end = toEndOfDay(customRange.to ?? customRange.from);
        }
      }
      if (start && end) {
        const t = new Date(qr.generatedDate).getTime();
        matchesDate = t >= start.getTime() && t <= end.getTime();
      }
    }
    
    return matchesSearch && matchesProperty && matchesStatus && matchesDate;
  });

  // Sorting
  const sortedQRCodes = useMemo(() => {
    const arr = [...filteredQRCodes];
    if (sortBy === 'date-oldest') {
      arr.sort((a, b) => new Date(a.generatedDate).getTime() - new Date(b.generatedDate).getTime());
    } else {
      // date-newest default
      arr.sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime());
    }
    return arr;
  }, [filteredQRCodes, sortBy]);

  // Precompute images for visible codes missing imageUrl
  useEffect(() => {
    (async () => {
      const missing = filteredQRCodes.filter(q => !q.imageUrl && !computedImages[q.id]);
      if (!missing.length) return;
      const entries: Array<[string, string]> = [];
      for (const q of missing) {
        try {
          const url = await generateQrPng(q);
          entries.push([q.id, url]);
          // Persist to DB for consistency
          if (hasSupabaseEnv) {
            try { await updateQRCode(q.id, { imageUrl: url } as any); } catch {}
          }
        } catch (e) {
          console.warn("Failed to generate QR preview for", q.id, e);
        }
      }
      if (entries.length) {
        setComputedImages(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
  }, [filteredQRCodes]);

  const propertyOptions = useMemo(() => {
    if (properties.length) {
      const active = properties.filter(p => (p.status || '').toLowerCase() !== 'disabled');
      return active.map(p => ({ value: p.id, label: p.name }));
    }
    // derive from codes list as last resort
    const uniq = Array.from(new Set(codes.map(c => propertyCodeOf(c.property)).filter(Boolean))) as string[];
    const filtered = activePropertyIds.size ? uniq.filter(id => activePropertyIds.has(id)) : uniq;
    return filtered.map(v => ({ value: v, label: propertyLabel(v) }));
  }, [properties, codes, propsById, propsByName, activePropertyIds]);

  // Download helpers
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const generateQrPng = async (qr: any) => {
    const payload = {
      assetId: qr.assetId,
      assetName: qr.assetName,
      property: qr.property,
      generatedDate: qr.generatedDate,
      url: `${window.location.origin}/assets/${qr.assetId}`,
    };
    return await QRCode.toDataURL(JSON.stringify(payload), {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
  };

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
              // Prevent duplicates: if QR for this asset already exists, do not create new
              const existing = selectedAsset?.id ? codes.find(c => c.assetId === selectedAsset.id) : null;
              if (existing) {
                toast.info("QR already generated for this asset. Showing it now.");
                setSearchTerm(selectedAsset.id);
                setShowGenerator(false);
                setHighlightId(existing.id);
                setTimeout(() => setHighlightId(null), 4000);
                return;
              }
              toast.success("QR Code generated successfully!");
              if (hasSupabaseEnv && selectedAsset?.id) {
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
        createQRCode(payload).then(async () => {
                  const data = await listQRCodes();
                  const mapped = data.map(d => ({
                    id: d.id,
                    assetId: d.assetId,
                    assetName: d.assetName || d.assetId,
                    property: d.property || "",
                    generatedDate: d.generatedDate,
                    status: d.status,
                    printed: d.printed,
          imageUrl: d.imageUrl || null,
                  }));
                  setCodes(mapped.sort((a,b) => (a.generatedDate < b.generatedDate ? 1 : -1)));
                  await logActivity("qr_generated", `QR generated for ${selectedAsset.name} (${selectedAsset.id})`);
                  await addNotification({
                    title: "QR generated",
                    message: `${selectedAsset.name} (${selectedAsset.id}) QR is ready`,
                    type: "qr",
                  });
                }).catch((e) => console.error(e));
              } else {
                setCodes(prev => [...prev, {
                  id: `QR-${Math.floor(Math.random()*900+100)}`,
                  assetId: selectedAsset?.id,
                  assetName: selectedAsset?.name,
                  property: selectedAsset?.property,
                  generatedDate: new Date().toISOString().slice(0,10),
                  status: "Generated",
                  printed: false,
                }]);
                (async ()=>{ await logActivity("qr_generated", `QR generated for ${selectedAsset?.name} (${selectedAsset?.id}) (local)`, "Local"); })();
              }
            }}
          />
        </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Asset Picker Dialog */}
        <Dialog open={assetPickerOpen} onOpenChange={setAssetPickerOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Select an asset to generate a QR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Search assets by name or ID..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Showing assets without an existing QR{activePropertyIds.size ? ' at active properties' : ''}.
              </div>
              <ScrollArea className="h-72 border rounded-md">
                <div className="p-2 space-y-2">
                  {availableAssets.length === 0 && (
                    <div className="text-sm text-muted-foreground px-1 py-4 text-center">No assets available</div>
                  )}
                  {availableAssets.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-background">
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.id} • {a.property}</div>
                      </div>
                      <Button size="sm" onClick={() => generateFromAsset(a)}>Select</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>

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
            <Button onClick={handleGenerateNew} className="gap-2" disabled={!(role==='admin' || role==='manager' || role==='user')}>
              <QrCode className="h-4 w-4" />
              Generate New QR Code
            </Button>
            <Button onClick={handleBulkPrint} variant="outline" className="gap-2" disabled={!(role==='admin' || role==='manager' || role==='user')}>
              <Printer className="h-4 w-4" />
              Bulk Print
            </Button>
          </div>
        </div>

        {/* Stats */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total QR Codes</p>
                  <p className="text-2xl font-bold">{codes.length}</p>
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
                    {codes.filter(qr => qr.printed).length}
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
                    {codes.filter(qr => !qr.printed).length}
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
                    {new Set(codes.map(qr => qr.property)).size}
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
                  {propertyOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
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

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-newest">Newest first</SelectItem>
                  <SelectItem value="date-oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleDownloadAll} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download All
              </Button>
            </div>

            {/* Quick date filters */}
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button
                variant={datePreset === 'yesterday' ? 'default' : 'outline'}
                onClick={() => setDatePreset('yesterday')}
              >
                Yesterday
              </Button>
              <Button
                variant={datePreset === '7days' ? 'default' : 'outline'}
                onClick={() => setDatePreset('7days')}
              >
                Last 7 days
              </Button>
              <Button
                variant={datePreset === 'custom' ? 'default' : 'outline'}
                onClick={() => setDatePreset('custom')}
              >
                Custom date
              </Button>
              {datePreset !== 'none' && (
                <Button variant="ghost" onClick={() => { setDatePreset('none'); setCustomRange(undefined); }}>
                  Clear
                </Button>
              )}
            </div>

            {datePreset === 'custom' && (
              <div className="mt-3 border rounded-md p-3 bg-muted/30">
                <Calendar
                  mode="range"
                  selected={customRange as any}
                  onSelect={setCustomRange as any}
                  numberOfMonths={2}
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  {customRange?.from
                    ? `Selected: ${customRange.from.toLocaleDateString()}${customRange?.to ? ` – ${customRange.to.toLocaleDateString()}` : ''}`
                    : 'Pick a date or range'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick hint when we auto-filter to an existing item */}
        {highlightId && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-3 text-sm">
              Already generated. Filter applied to locate this QR quickly.
            </CardContent>
          </Card>
        )}

        {/* QR Codes Grid */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedQRCodes.map((qrCode) => (
            <Card
              key={qrCode.id}
              className={`hover:shadow-medium transition-shadow ${highlightId === qrCode.id ? "ring-2 ring-primary" : ""}`}
            >
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
                  <div className="w-28 h-28 bg-background border-2 border-border rounded flex items-center justify-center overflow-hidden">
                    { (qrCode.imageUrl || computedImages[qrCode.id]) ? (
                      <img
                        src={qrCode.imageUrl || computedImages[qrCode.id]}
                        alt={`QR ${qrCode.assetId}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                    ) }
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {(role==='admin') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateForAsset(qrCode)}
                    className="flex-1 gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    Regenerate
                  </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        let dataUrl = qrCode.imageUrl;
                        if (!dataUrl) dataUrl = await generateQrPng(qrCode);
                        if (dataUrl) {
                          downloadDataUrl(dataUrl, `qr-${qrCode.assetId}.png`);
                        }
                        toast.success(`Downloaded QR for ${qrCode.assetName}`);
                        await logActivity("qr_download", `Downloaded QR for ${qrCode.assetName} (${qrCode.assetId})`);
                        await addNotification({
                          title: "QR downloaded",
                          message: `${qrCode.assetName} (${qrCode.assetId}) QR downloaded`,
                          type: "qr",
                        });
                      } catch (e) {
                        console.error(e);
                        toast.error("Failed to download QR");
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      try {
                        if (hasSupabaseEnv) {
                          await updateQRCode(qrCode.id, { printed: true } as any);
                        }
                        setCodes(prev => prev.map(c => c.id === qrCode.id ? { ...c, printed: true } : c));
                        toast.success(`Printed QR for ${qrCode.assetName}`);
                        await logActivity("qr_printed", `Printed QR for ${qrCode.assetName} (${qrCode.assetId})`);
                        await addNotification({
                          title: "QR printed",
                          message: `${qrCode.assetName} (${qrCode.assetId}) QR sent to printer`,
                          type: "qr",
                        });
                      } catch (e) {
                        console.error(e);
                        toast.error("Failed to mark as printed");
                      }
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!hasSupabaseEnv && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <QrCode className="h-6 w-6 text-warning shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">QR Code Management Features</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect Supabase to persist generated QR codes and enable bulk operations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}