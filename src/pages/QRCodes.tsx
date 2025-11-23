import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { composeQrWithLabel, generateQrPng, downloadDataUrl, printImagesAsLabels } from "@/lib/qr";
import JSZip from "jszip";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import StatusChip from "@/components/ui/status-chip";
import MetricCard from "@/components/ui/metric-card";
import { QrCode, Search, Download, Printer, Package, Building2, LayoutGrid, List as ListIcon, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { listQRCodes, createQRCode, updateQRCode, deleteAllQRCodes, type QRCode as SbQRCode } from "@/services/qrcodes";
import { logActivity } from "@/services/activity";
import { addNotification } from "@/services/notifications";
import { listProperties, type Property } from "@/services/properties";
import { listAssets, type Asset } from "@/services/assets";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import DateRangePicker, { type DateRange } from "@/components/ui/date-range-picker";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";

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
  const [loadingUI, setLoadingUI] = useState(true);
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
  const [range, setRange] = useState<DateRange>();
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allowedProps, setAllowedProps] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    assetId: string;
    assetName: string;
    property?: string;
    status?: string;
    printed?: boolean;
    generatedDate?: string;
  } | null>(null);
  const [canEditPage, setCanEditPage] = useState<boolean>(true);
  // Download selection state
  const [dlSingleOpen, setDlSingleOpen] = useState(false);
  const [dlSingleTarget, setDlSingleTarget] = useState<any | null>(null);
  const [dlSingleFmt, setDlSingleFmt] = useState<'png' | 'pdf'>('png');
  const [dlAllOpen, setDlAllOpen] = useState(false);
  const [dlAllFmt, setDlAllFmt] = useState<'zip' | 'pdf'>('zip');
  // Current user label for activity logs/notifications
  const actor: string | null = (() => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      if (raw) { const u = JSON.parse(raw); return u?.name || u?.email || u?.id || null; }
    } catch {}
    return null;
  })();

  // Active property ids set (exclude disabled properties from UI everywhere)
  const activePropertyIds = useMemo(() => {
    const list = Object.values(propsById);
    if (!list.length) return new Set<string>();
    return new Set(list.filter(p => (p.status || '').toLowerCase() !== 'disabled').map(p => p.id));
  }, [propsById]);

  // Load QR codes and properties
  useEffect(() => {
    try {
  const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setRole((r || "").toLowerCase());
    } catch {}
    (async () => {
      try {
  const uid = getCurrentUserId();
  const allowed = uid ? await canUserEdit(uid, 'qrcodes') : null;
  const baseline = true; // all roles can generate by default per prior logic
  setCanEditPage(allowed === null ? baseline : allowed);
      } catch { setCanEditPage(true); }
    })();
    (async () => {
      try {
        // Determine role and allowed properties
        let isAdmin = false;
        try {
          const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
          const u = raw ? JSON.parse(raw) : null;
          isAdmin = String(u?.role || '').toLowerCase() === 'admin';
        } catch {}
        let allowed = new Set<string>();
        try { if (!isAdmin) allowed = await getAccessiblePropertyIdsForCurrentUser(); } catch {}
        setAllowedProps(allowed);

        if (isDemoMode() || hasSupabaseEnv) {
          const [data, props, allAssets] = await Promise.all([
            listQRCodes(),
            listProperties().catch(() => [] as Property[]),
            listAssets().catch(() => [] as Asset[]),
          ]);
          // Scope QR codes to allowed properties for non-admins
          const mappedAll = data.map(d => ({
            id: d.id,
            assetId: d.assetId,
            assetName: d.assetName || d.assetId,
            property: d.property || "",
            imageUrl: d.imageUrl || null,
            generatedDate: d.generatedDate,
            status: d.status,
            printed: d.printed,
          }));
          const mapped = (isAdmin || !allowed.size)
            ? mappedAll
            : mappedAll.filter(q => q.property && allowed.has(String(q.property)));
          setCodes(mapped.sort((a,b) => (a.generatedDate < b.generatedDate ? 1 : -1)));
          if (props?.length) {
            const propsScoped = (isAdmin || !allowed.size) ? props : props.filter(p => allowed.has(String(p.id)));
            setProperties(propsScoped);
            setPropsById(Object.fromEntries(propsScoped.map(p => [p.id, p])));
            setPropsByName(Object.fromEntries(propsScoped.map(p => [p.name, p])));
          }
          if (allAssets?.length) {
            const assetsScoped = (isAdmin || !allowed.size) ? allAssets : allAssets.filter(a => allowed.has(String((a as any).property || (a as any).property_id)));
            setAssets(assetsScoped);
          }
        } else {
          // Fallback properties for local mode
          const fallback: Property[] = [
            { id: "PROP-001", name: "Main Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-002", name: "Warehouse", type: "Storage", status: "Active", address: null, manager: null } as any,
            { id: "PROP-003", name: "Branch Office", type: "Office", status: "Active", address: null, manager: null } as any,
            { id: "PROP-004", name: "Factory", type: "Manufacturing", status: "Active", address: null, manager: null } as any,
          ];
          // In local mode, also scope by allowed if present
          const localAllowed = allowed.size ? fallback.filter(p => allowed.has(String(p.id))) : fallback;
          setProperties(localAllowed);
          setPropsById(Object.fromEntries(localAllowed.map(p => [p.id, p])));
          setPropsByName(Object.fromEntries(localAllowed.map(p => [p.name, p])));
        }
    // Data load complete
    setLoadingUI(false);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load data; using local fallbacks");
  setLoadingUI(false);
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

  const handleGenerateForAsset = (item: any) => {
    // Normalize: if a QR record is passed (has assetId), convert to an Asset-like object
    const assetLike = item && typeof item === 'object' && 'assetId' in item
      ? { id: item.assetId, name: item.assetName || item.assetId, property: item.property }
      : item;
    setSelectedAsset(assetLike);
    setShowGenerator(true);
  };

  const handleBulkPrint = () => {
    const unprintedCodes = codes.filter(qr => !qr.printed);
    toast.success(`Printing ${unprintedCodes.length} QR codes`);
       let actor: string | null = null;
       try {
         const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
         if (raw) {
           const u = JSON.parse(raw);
           actor = u?.name || u?.email || u?.id || null;
         }
       } catch {}
    (async () => {
          await logActivity("qr_bulk_print", `Bulk printed ${unprintedCodes.length} QR codes`, actor);
    })();
  };

  const handleClearAll = async () => {
    if (role !== 'admin') return;
    const supabaseReady = isDemoMode() || hasSupabaseEnv;
    if (!supabaseReady) {
      toast.warning('Supabase connection is not configured, nothing to clear.');
      return;
    }
    const ok = window.confirm("This will permanently delete every stored QR code. Continue?");
    if (!ok) return;
    try {
      setPurging(true);
      await deleteAllQRCodes();
      setCodes([]);
      setComputedImages({});
      setHighlightId(null);
      toast.success("All QR codes have been cleared.");
      await logActivity("qr_cleared_all", "All QR history cleared", actor);
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear QR codes");
    } finally {
      setPurging(false);
    }
  };

  const handleDownloadAll = () => setDlAllOpen(true);

  const confirmSingleDownload = async () => {
    if (!dlSingleTarget) return;
    try {
      let dataUrl = dlSingleTarget.imageUrl;
      if (!dataUrl) dataUrl = await generateQrPng(dlSingleTarget);
      if (!dataUrl) throw new Error('No image');
      if (dlSingleFmt === 'png') {
        downloadDataUrl(dataUrl, `qr-${dlSingleTarget.assetId}.png`);
        toast.success(`Downloaded QR for ${dlSingleTarget.assetName}`);
        await logActivity('qr_download', `Downloaded QR (PNG) for ${dlSingleTarget.assetName} (${dlSingleTarget.assetId})`);
  await logActivity('qr_download', `Downloaded QR (PNG) for ${dlSingleTarget.assetName} (${dlSingleTarget.assetId})`, actor);
      } else {
        // PDF via print dialog on A4 page
        await printImagesAsLabels([dataUrl], { widthIn: 8.27, heightIn: 11.69, orientation: 'portrait', fit: 'contain' });
        toast.success(`Opened PDF print for ${dlSingleTarget.assetName}`);
        await logActivity('qr_download_pdf', `Prepared PDF for ${dlSingleTarget.assetName} (${dlSingleTarget.assetId})`);
  await logActivity('qr_download_pdf', `Prepared PDF for ${dlSingleTarget.assetName} (${dlSingleTarget.assetId})`, actor);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to download');
    } finally {
      setDlSingleOpen(false);
      setDlSingleTarget(null);
      setDlSingleFmt('png');
    }
  };

  const confirmDownloadAll = async () => {
    try {
      const images: string[] = [];
      for (const qr of sortedQRCodes) {
        let dataUrl = qr.imageUrl;
        if (!dataUrl) dataUrl = await generateQrPng(qr);
        if (dataUrl) images.push(dataUrl);
      }
      if (!images.length) throw new Error('No images');
      if (dlAllFmt === 'zip') {
        const zip = new JSZip();
        for (let i = 0; i < sortedQRCodes.length; i++) {
          const qr = sortedQRCodes[i];
          const dataUrl = images[i];
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
        toast.success('Downloading all QR codes (PNG)');
        await logActivity('qr_download_all', `Downloaded ${sortedQRCodes.length} QR codes (PNG zip)`);
  await logActivity('qr_download_all', `Downloaded ${sortedQRCodes.length} QR codes (PNG zip)`, actor);
      } else {
        // PDF via print dialog: one QR per A4 page
        await printImagesAsLabels(images, { widthIn: 8.27, heightIn: 11.69, orientation: 'portrait', fit: 'contain' });
        toast.success('Opened PDF print for all');
        await logActivity('qr_download_all_pdf', `Prepared PDF for ${sortedQRCodes.length} QR codes`);
  await logActivity('qr_download_all_pdf', `Prepared PDF for ${sortedQRCodes.length} QR codes`, actor);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to process download all');
    } finally {
      setDlAllOpen(false);
      setDlAllFmt('zip');
    }
  };

  const openPreview = async (qr: any) => {
    try {
      let dataUrl = qr.imageUrl || computedImages[qr.id];
      if (!dataUrl) dataUrl = await generateQrPng(qr);
      setPreviewImg(dataUrl || null);
      setPreviewMeta({
        assetId: qr.assetId,
        assetName: qr.assetName,
        property: qr.property,
        status: qr.status,
        printed: qr.printed,
        generatedDate: qr.generatedDate,
      });
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Failed to open preview");
    }
  };

  // Assets without QR helper
  const assetIdsWithQR = useMemo(() => new Set(codes.map(c => c.assetId)), [codes]);
  const availableAssets = useMemo(() => {
    let list = assets.filter(a => !assetIdsWithQR.has(a.id));
    // Exclude disabled properties if we know them
    if (activePropertyIds.size) list = list.filter(a => !a.property || activePropertyIds.has(a.property));
    // Scope by allowed properties if present (non-admins)
    if (allowedProps.size) list = list.filter(a => !a.property || allowedProps.has(String(a.property)));
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
  const png = await generateQrPng({ assetId: asset.id, assetName: asset.name, property: asset.property });
      const id = `QR-${Math.floor(Math.random()*900+100)}`;
      if (isDemoMode() || hasSupabaseEnv) {
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
      // Capture actor label for logs/notifications
      let actor: string | null = null;
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        if (raw) { const u = JSON.parse(raw); actor = u?.name || u?.email || u?.id || null; }
      } catch {}
      await logActivity("qr_generated", `QR generated for ${asset.name} (${asset.id})`, actor);
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
      return (
        <StatusChip
          status={printed ? "Printed" : "Ready"}
          size="sm"
          className="px-2"
        />
      );
    }
    return <StatusChip status={status} size="sm" className="px-2" />;
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
    // Only exclude when we definitively know the property is disabled.
    // If property is missing or unknown, keep it visible.
    const isActiveProperty = (
      activePropertyIds.size === 0 ||
      !qrPropCode ||
      !propsById[qrPropCode] ||
      activePropertyIds.has(qrPropCode)
    );
    const matchesProperty = (filterProperty === "all" || qrPropCode === filterProperty) && isActiveProperty;
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "printed" && qr.printed) ||
                         (filterStatus === "ready" && !qr.printed);
    // Date filter via unified DateRangePicker
    const toStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const toEndOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    let matchesDate = true;
    if (range?.from) {
      const start = toStartOfDay(range.from);
      const end = toEndOfDay(range.to ?? range.from);
      const t = new Date(qr.generatedDate).getTime();
      matchesDate = t >= start.getTime() && t <= end.getTime();
    }
    
    return matchesSearch && matchesProperty && matchesStatus && matchesDate;
  });

  const qrHighlights = useMemo(() => {
    const total = filteredQRCodes.length;
    const printedCount = filteredQRCodes.filter((qr) => qr.printed).length;
    const readyCount = filteredQRCodes.filter((qr) => !qr.printed).length;
    const propertyCount = new Set(
      filteredQRCodes
        .map((qr) => propertyCodeOf(qr.property) || qr.property)
        .filter(Boolean)
    ).size;

    return [
      {
        key: 'total',
        title: 'Total QR Codes',
        icon: QrCode,
        value: total.toLocaleString(),
        caption: 'Codes in current view',
        iconClassName: 'text-primary',
      },
      {
        key: 'printed',
        title: 'Printed',
        icon: Printer,
        value: printedCount.toLocaleString(),
        caption: 'Already deployed',
        iconClassName: 'text-emerald-500 dark:text-emerald-400',
        valueClassName: printedCount ? 'text-success' : undefined,
      },
      {
        key: 'ready',
        title: 'Ready to Print',
        icon: Package,
        value: readyCount.toLocaleString(),
        caption: 'Waiting for labels',
        iconClassName: 'text-amber-500 dark:text-amber-400',
        valueClassName: readyCount ? 'text-warning' : undefined,
      },
      {
        key: 'properties',
        title: 'Properties Covered',
        icon: Building2,
        value: propertyCount.toLocaleString(),
        caption: 'Locations with QR codes',
        iconClassName: 'text-sky-500 dark:text-sky-400',
      },
    ];
  }, [filteredQRCodes, propsById, propsByName]);

  const qrMonthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; generated: number; sort: number }>();
    filteredQRCodes.forEach((qr) => {
      const generatedAt = qr.generatedDate ? new Date(qr.generatedDate) : null;
      if (!generatedAt || Number.isNaN(generatedAt.getTime())) return;
      const key = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          label: generatedAt.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
          generated: 0,
          sort: generatedAt.getFullYear() * 100 + generatedAt.getMonth(),
        });
      }
      map.get(key)!.generated += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => a.sort - b.sort)
      .slice(-6);
  }, [filteredQRCodes]);

  const qrStatusChart = useMemo(() => {
    const printed = filteredQRCodes.filter((qr) => qr.printed).length;
    const ready = filteredQRCodes.length - printed;
    return [
      {
        key: 'printed',
        label: 'Printed',
        value: printed,
        fill: 'hsl(142, 71%, 45%)',
      },
      {
        key: 'ready',
        label: 'Ready to Print',
        value: ready,
        fill: 'hsl(31, 97%, 55%)',
      },
    ];
  }, [filteredQRCodes]);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-sm">
          {label && <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="h-2 w-2 rounded-full" 
                style={{ backgroundColor: entry.color || entry.fill || entry.stroke }} 
              />
              <span className="font-medium text-foreground">
                {entry.value}
              </span>
              <span className="text-muted-foreground">
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

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
          if (isDemoMode() || hasSupabaseEnv) {
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
 

  // Show skeleton while initial data loads (when Supabase is enabled)
  if (loadingUI && hasSupabaseEnv) {
    return <PageSkeleton />;
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

    <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "QR Codes" }]} />
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
      <PageHeader
        icon={QrCode}
        title="QR Code Management"
        description="Generate, manage, and print QR codes for asset tracking"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGenerateNew} className="gap-2 w-full sm:w-auto" disabled={!canEditPage}>
              <QrCode className="h-4 w-4" />
              Generate New QR Code
            </Button>
            <Button onClick={handleBulkPrint} variant="outline" className="gap-2 w-full sm:w-auto" disabled={!canEditPage}>
              <Printer className="h-4 w-4" />
              Bulk Print
            </Button>
            {role === 'admin' && (
              <Button
                onClick={handleClearAll}
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                disabled={purging || (!isDemoMode() && !hasSupabaseEnv)}
              >
                {purging ? (
                  'Clearing…'
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    
                  </>
                )}
              </Button>
            )}
          </div>
        }
      />
    </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-4">
          {qrHighlights.map((item) => (
            <MetricCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              value={item.value}
              caption={item.caption}
              iconClassName={item.iconClassName}
              valueClassName={item.valueClassName}
            />
          ))}
        </div>

        <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle>QR Code Insights</CardTitle>
            <CardDescription>Recent trends and status breakdowns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Monthly generation trend</h3>
                <div className="h-48 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={qrMonthlyTrend} margin={{ top: 12, right: 16, left: 8, bottom: 12 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" strokeOpacity={0.35} vertical={false} horizontal={true} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                      />
                      <YAxis 
                        allowDecimals={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                      <Bar dataKey="generated" radius={[4, 4, 0, 0]} fill="hsl(221, 83%, 53%)" barSize={32}>
                        <LabelList dataKey="generated" position="top" className="text-[10px] font-medium" fill="hsl(var(--foreground))" offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Status mix</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={qrStatusChart} 
                        dataKey="value" 
                        innerRadius={55} 
                        outerRadius={80} 
                        paddingAngle={4}
                        cornerRadius={4}
                        stroke="none"
                      >
                        {qrStatusChart.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill} 
                            className="stroke-background hover:opacity-80 transition-opacity"
                            strokeWidth={2}
                          />
                        ))}
                        <LabelList dataKey="value" position="outside" className="text-[10px] font-medium" fill="hsl(var(--foreground))" />
                      </Pie>
                      <RechartsTooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {qrStatusChart.map((entry) => (
                    <span key={entry.key} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span>{entry.label}</span>
                      <span className="font-semibold text-foreground">{entry.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>QR Code Inventory</CardTitle>
                <CardDescription>
                  Search and filter your generated QR codes
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by asset name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-full">
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="printed">Printed</SelectItem>
                  <SelectItem value="ready">Ready to Print</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-newest">Newest first</SelectItem>
                  <SelectItem value="date-oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>

              <DateRangePicker className="w-full" value={range} onChange={setRange} />

              <Button onClick={handleDownloadAll} variant="outline" className="gap-2 w-full">
                <Download className="h-4 w-4" />
                Download All
              </Button>
            </div>
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

        {/* QR Codes Grid/List */}
        {filteredQRCodes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">No QR codes match your filters. Clear filters or generate new codes.</CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sortedQRCodes.map((qrCode) => (
            <Card
              key={qrCode.id}
              className={`hover:shadow-medium transition-shadow ${highlightId === qrCode.id ? "ring-2 ring-primary" : ""}`}
            >
      <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
        <CardTitle className="text-sm sm:text-base">{qrCode.assetName}</CardTitle>
        <CardDescription className="text-[11px] sm:text-xs">{qrCode.assetId}</CardDescription>
                  </div>
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Property and Status */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{qrCode.property}</span>
                  </div>
                  <div className="shrink-0">{getStatusBadge(qrCode.status, qrCode.printed)}</div>
                </div>

                {/* Generated Date */}
                <div className="text-xs text-muted-foreground">
                  Generated: {qrCode.generatedDate}
                </div>

                {/* QR Code Preview */}
          <div className="flex justify-center p-4 bg-muted/30 rounded-lg relative z-0">
                    <div
            className="group w-32 h-32 bg-background border-2 border-border rounded flex items-center justify-center overflow-hidden cursor-zoom-in"
                      onClick={() => openPreview(qrCode)}
                    >
                      { (qrCode.imageUrl || computedImages[qrCode.id]) ? (
                        <img
                          src={qrCode.imageUrl || computedImages[qrCode.id]}
                          alt={`QR ${qrCode.assetId}`}
                          className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-110"
                        />
                      ) : (
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                      ) }
                    </div>
                  </div>

                {/* Actions */}
          <div className="relative z-10 mt-1 grid grid-cols-1 sm:grid-cols-2 items-stretch gap-2">
            {(role==='admin') && (
       <Button
                  size="sm"
                  variant="outline"
      onClick={() => handleGenerateForAsset({ id: qrCode.assetId, name: qrCode.assetName || qrCode.assetId, property: qrCode.property })}
      className="gap-2 w-full justify-center"
                >
                  <QrCode className="h-4 w-4" />
                  Regenerate
                </Button>
                )}
                      <Button
                  size="sm"
                  variant="outline"
      className="gap-2 w-full justify-center"
                  onClick={() => { setDlSingleTarget(qrCode); setDlSingleFmt('png'); setDlSingleOpen(true); }}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
       <Button
                  size="sm"
                  variant="outline"
      className="gap-2 w-full justify-center"
                  onClick={async () => {
                      try {
                        let dataUrl = qrCode.imageUrl;
                        if (!dataUrl) dataUrl = await generateQrPng(qrCode);
                        if (!dataUrl) throw new Error('No image');
                        // Print one per A4 page
                        await printImagesAsLabels([dataUrl], { widthIn: 8.27, heightIn: 11.69, orientation: 'portrait', fit: 'contain' });
                        if (hasSupabaseEnv) { await updateQRCode(qrCode.id, { printed: true } as any); }
                        setCodes(prev => prev.map(c => c.id === qrCode.id ? { ...c, printed: true } : c));
                        toast.success(`Opened print for ${qrCode.assetName}`);
                        await logActivity('qr_printed', `Printed QR for ${qrCode.assetName} (${qrCode.assetId})`);
                        await logActivity('qr_printed', `Printed QR for ${qrCode.assetName} (${qrCode.assetId})`, actor);
                        await addNotification({ title: 'QR printed', message: `${qrCode.assetName} (${qrCode.assetId}) QR sent to printer`, type: 'qr' });
                      } catch (e) {
                        console.error(e);
                        toast.error('Failed to print');
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
        ) : (
    <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
      <TableHead className="min-w-[160px]">Asset</TableHead>
                  <TableHead>Asset ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
      <TableHead className="min-w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedQRCodes.map((qrCode) => (
                  <TableRow key={qrCode.id}>
                    <TableCell className="font-medium flex items-center gap-3">
                      <div
                        className="w-12 h-12 bg-muted/40 rounded border flex items-center justify-center cursor-zoom-in overflow-hidden"
                        onClick={() => openPreview(qrCode)}
                      >
                        {(qrCode.imageUrl || computedImages[qrCode.id]) ? (
                          <img src={qrCode.imageUrl || computedImages[qrCode.id]} alt="QR" className="w-full h-full object-contain" />
                        ) : (
                          <QrCode className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      {qrCode.assetName}
                    </TableCell>
                    <TableCell>{qrCode.assetId}</TableCell>
                    <TableCell>{qrCode.property}</TableCell>
                    <TableCell>{qrCode.generatedDate}</TableCell>
                    <TableCell>{getStatusBadge(qrCode.status, qrCode.printed)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {(role==='admin') && (
                          <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" onClick={() => handleGenerateForAsset({ id: qrCode.assetId, name: qrCode.assetName || qrCode.assetId, property: qrCode.property })}>
                            Regenerate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" onClick={() => openPreview(qrCode)}>Preview</Button>
                        <Button size="sm" variant="outline" className="w-full sm:w-auto justify-center" onClick={() => { setDlSingleTarget(qrCode); setDlSingleFmt('png'); setDlSingleOpen(true); }}>Download</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

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

        {/* QR Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl">
            <DialogHeader className="px-6 pt-6 pb-4 text-left">
              <DialogTitle className="text-lg font-semibold text-foreground">
                QR Preview
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {previewMeta
                  ? `Preview the code for ${previewMeta.assetName} (${previewMeta.assetId})`
                  : 'Preview this QR code before sharing or printing.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 px-6 pb-6 md:grid-cols-[minmax(0,240px),1fr]">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full max-w-[220px] rounded-2xl border border-dashed border-border/70 bg-card/80 p-4 shadow-inner">
                  <div className="relative flex h-[200px] items-center justify-center rounded-xl bg-background">
                    {previewImg ? (
                      <img
                        src={previewImg}
                        alt={previewMeta ? `QR for ${previewMeta.assetId}` : 'QR'}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20">
                        <QrCode className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                {previewMeta && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${previewMeta.printed ? 'bg-emerald-500' : 'bg-primary'}`} aria-hidden="true" />
                    {previewMeta.printed ? 'Printed' : 'Ready to print'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-5">
                {previewMeta && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Asset</p>
                      <p className="text-base font-semibold text-foreground">{previewMeta.assetName}</p>
                      <p className="text-sm text-muted-foreground">{previewMeta.assetId}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {previewMeta.property && (
                        <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Location</p>
                          <p className="text-sm font-medium text-foreground">{previewMeta.property}</p>
                        </div>
                      )}
                      <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                        <div className="mt-1">
                          {getStatusBadge(previewMeta.status || 'Generated', !!previewMeta.printed)}
                        </div>
                      </div>
                      {previewMeta.generatedDate && (
                        <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Generated</p>
                          <p className="text-sm font-medium text-foreground">{previewMeta.generatedDate}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Download single format chooser */}
        <Dialog open={dlSingleOpen} onOpenChange={setDlSingleOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Download format</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="dlsingle" checked={dlSingleFmt==='png'} onChange={() => setDlSingleFmt('png')} /> PNG
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="dlsingle" checked={dlSingleFmt==='pdf'} onChange={() => setDlSingleFmt('pdf')} /> PDF
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDlSingleOpen(false)}>Cancel</Button>
                <Button onClick={confirmSingleDownload}>Continue</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Download all format chooser */}
        <Dialog open={dlAllOpen} onOpenChange={setDlAllOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Download all</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="dlall" checked={dlAllFmt==='zip'} onChange={() => setDlAllFmt('zip')} /> ZIP (PNGs)
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name="dlall" checked={dlAllFmt==='pdf'} onChange={() => setDlAllFmt('pdf')} /> PDF (print)
                </label>
              </div>
              <div className="text-xs text-muted-foreground">PDF opens a print dialog with one QR per A4 page.</div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDlAllOpen(false)}>Cancel</Button>
                <Button onClick={confirmDownloadAll}>Continue</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
