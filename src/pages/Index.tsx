import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MyAudits } from "@/components/dashboard/MyAudits";
import MetricCard from "@/components/ui/metric-card";
import {
  Package,
  Building2,
  Users,
  AlertTriangle,
  TrendingUp,
  QrCode,
  Ticket as TicketIcon,
  CheckCircle2,
  UserCheck,
  Clock as ClockIcon,
  Utensils,
  Plus,
  Download,
  FileText,
  Upload,
  Megaphone,
  Copy,
  Calendar,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode, demoStats } from "@/lib/demo";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUserPreferences } from "@/services/userPreferences";
import { listAssets } from "@/services/assets";
import type { Asset } from "@/services/assets";
import { listProperties } from "@/services/properties";
import type { Property } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { listUsers } from "@/services/users";
import type { AppUser } from "@/services/users";
import { listQRCodes } from "@/services/qrcodes";
import type { QRCode } from "@/services/qrcodes";
import { downloadAssetTemplate, importAssetsFromFile } from "@/services/bulkImport";
import { listTickets, type Ticket } from "@/services/tickets";
import { listNewsletterPosts, type NewsletterPost } from "@/services/newsletter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TicketSummary = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  assignedToMe: number;
  awaitingAssignment: number;
  slaRisk: number;
  byPriority: Record<"low" | "medium" | "high" | "urgent", number>;
  topAssignees: Array<{ id: string; label: string; count: number }>;
  averageResolutionHours: number | null;
};

const emptyTicketSummary: TicketSummary = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0,
  assignedToMe: 0,
  awaitingAssignment: 0,
  slaRisk: 0,
  byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
  topAssignees: [],
  averageResolutionHours: null,
};

const defaultCounts = { assets: 1247, properties: 8, users: 24, expiring: 15 };
const defaultMetrics = { totalQuantity: 20, monthlyPurchases: 0, monthlyPurchasesPrev: 0, codesTotal: 156, codesReady: 0, assetTypes: 0 };

type DashboardSnapshot = {
  counts: typeof defaultCounts;
  metrics: typeof defaultMetrics;
  ticketSummary: TicketSummary;
  ticketMonthlyTrend: Array<{ month: string; created: number; resolved: number }>;
  scopedAssets: Asset[];
  scopedProperties: Property[];
  storedAt: number;
};

const DASHBOARD_SNAPSHOT_KEY = "dashboard_snapshot_v1";

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
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
              {formatter ? formatter(entry.value, entry.name, entry)[0] : entry.value}
            </span>
            <span className="text-muted-foreground">
              {formatter ? formatter(entry.value, entry.name, entry)[1] : entry.name}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const announcementHueClasses: Record<string, string> = {
  red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800',
  emerald: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800',
  sky: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800',
  zinc: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
  default: 'bg-muted text-foreground border-border/60',
};

const announcementCategoryMeta: Record<string, { label: string; hue: string }> = {
  bug: { label: 'Bug', hue: 'red' },
  api_down: { label: 'API Down', hue: 'red' },
  fixed: { label: 'Fixed', hue: 'emerald' },
  resolved: { label: 'Resolved', hue: 'emerald' },
  maintenance: { label: 'Maintenance', hue: 'amber' },
  update: { label: 'Update', hue: 'blue' },
};

const getAnnouncementBadge = (category?: string) => {
  const key = (category || 'update').toLowerCase();
  const meta = announcementCategoryMeta[key] ?? announcementCategoryMeta.update;
  const className = announcementHueClasses[meta.hue] ?? announcementHueClasses.default;
  return {
    label: meta.label,
    className,
  };
};

const monthLabel = (date: Date) => date.toLocaleString(undefined, { month: "short" });

const describeMonthlyChange = (current: number, previous: number) => {
  if (previous === 0 && current === 0) {
    return { label: "Flat vs last month", percent: 0, isPositive: false };
  }
  if (previous === 0) {
    return { label: "+100% vs last month", percent: 100, isPositive: true };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${percent >= 0 ? "+" : ""}${percent}% vs last month`,
    percent,
    isPositive: percent >= 0,
  };
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const WATCHLIST_DISPLAY_LIMIT = 2;

type AmcAlertItem = {
  id: string;
  name: string;
  propertyName: string;
  startDate: Date | null;
  endDate: Date;
  daysRemaining: number;
  severity: "urgent" | "soon" | "info";
};

type FoodExpiryItem = {
  id: string;
  name: string;
  propertyName: string;
  departmentName: string | null;
  endDate: Date;
  daysRemaining: number;
  severity: "urgent" | "soon" | "info";
  quantity: number;
  typeLabel: string;
};

const Index = () => {
  const navigate = useNavigate();
  const initialSnapshot = useMemo<DashboardSnapshot | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage?.getItem(DASHBOARD_SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DashboardSnapshot;
    } catch {
      return null;
    }
  }, []);
  const [counts, setCounts] = useState(() => initialSnapshot?.counts ?? { ...defaultCounts });
  const [metrics, setMetrics] = useState(() => initialSnapshot?.metrics ?? { ...defaultMetrics });
  const [firstName, setFirstName] = useState<string>("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [role, setRole] = useState<string>("");
  const [ticketSummary, setTicketSummary] = useState<TicketSummary>(() => initialSnapshot?.ticketSummary ?? emptyTicketSummary);
  const [ticketMonthlyTrend, setTicketMonthlyTrend] = useState<Array<{ month: string; created: number; resolved: number }>>(() => initialSnapshot?.ticketMonthlyTrend ?? []);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<string>("");
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const progressResetRef = useRef<number | null>(null);
  const [loadingUI, setLoadingUI] = useState(!initialSnapshot);
  const [announcements, setAnnouncements] = useState<NewsletterPost[]>([]);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const [scopedAssets, setScopedAssets] = useState<Asset[]>(() => initialSnapshot?.scopedAssets ?? []);
  const [scopedProperties, setScopedProperties] = useState<Property[]>(() => initialSnapshot?.scopedProperties ?? []);
  const [showAllWatchlist, setShowAllWatchlist] = useState(false);
  const [showAllFoodExpiry, setShowAllFoodExpiry] = useState(false);

  useEffect(() => {
    return () => {
      if (progressResetRef.current != null) {
        window.clearTimeout(progressResetRef.current);
      }
    };
  }, []);

  const isAdmin = role === 'admin';
  const resolvedTotal = ticketSummary.resolved + ticketSummary.closed;
  const completionRate = ticketSummary.total ? Math.round((resolvedTotal / ticketSummary.total) * 100) : 0;
  const assignmentShare = ticketSummary.total ? Math.round((ticketSummary.assignedToMe / ticketSummary.total) * 100) : 0;
  const backlogActive = ticketSummary.open + ticketSummary.inProgress;
  const monthlyChange = describeMonthlyChange(metrics.monthlyPurchases, metrics.monthlyPurchasesPrev);
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good Morning' : hour >= 18 ? 'Good Evening' : 'Good Afternoon';
  const greeting = `${salutation}${firstName ? `, ${firstName}` : ''}`;

  const handleImportFile = async (file: File) => {
    if (!file) return;
    if (progressResetRef.current != null) {
      window.clearTimeout(progressResetRef.current);
      progressResetRef.current = null;
    }
    setImportErrors([]);
    setLastImportSummary("");
    setImportProgress(15);
    setImporting(true);
    try {
      const res = await importAssetsFromFile(file);
      setImportProgress(70);
      const summary = `Inserted: ${res.inserted}, Skipped: ${res.skipped}${res.errors.length ? `, Errors: ${res.errors.length}` : ''}`;
      setLastImportSummary(summary);
      setImportErrors(res.errors ?? []);
      if (res.errors.length) {
        toast.info(`Imported ${res.inserted} asset${res.inserted === 1 ? '' : 's'}. ${res.errors.length} row${res.errors.length === 1 ? '' : 's'} need review.`);
      } else {
        toast.success(`Imported ${res.inserted} asset${res.inserted === 1 ? '' : 's'}`);
      }
      if (hasSupabaseEnv) {
        try {
          const assets = await listAssets();
          setCounts((c) => ({ ...c, assets: assets.length }));
          const totalQuantity = assets.reduce<number>((sum, a) => sum + (Number(a.quantity) || 0), 0);
          setMetrics((m) => ({ ...m, totalQuantity }));
        } catch {}
      }
      setImportProgress(90);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
      setImportErrors([]);
      setLastImportSummary("");
    } finally {
      setImportProgress(100);
      if (progressResetRef.current != null) {
        window.clearTimeout(progressResetRef.current);
      }
      progressResetRef.current = window.setTimeout(() => {
        setImportProgress(0);
        progressResetRef.current = null;
      }, 600);
      setImporting(false);
      setIsDragActive(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const copyErrorsToClipboard = async () => {
    if (!importErrors.length) return;
    const payload = importErrors.map((err) => `Row ${err.row}: ${err.message}`).join('\n');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Error details copied to clipboard');
    } catch {
      toast.error('Unable to copy error details');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (importing) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDragActive) setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (importing) return;
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleImportFile(file);
    }
  };

  const handleDropZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (importing) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileRef.current?.click();
    }
  };

  const propertyTotal = Math.max(0, counts.properties ?? 0);
  const propertyLabel = propertyTotal === 1 ? 'property' : 'properties';

  // Load announcement visibility preference (separate effect to obey hook rules)
  useEffect(() => {
    (async () => {
      try {
        const uid = localStorage.getItem('current_user_id');
        if (!uid) return;
        const prefs = await getUserPreferences(uid);
        if (typeof prefs.show_announcements === 'boolean') setShowAnnouncements(prefs.show_announcements);
      } catch {}
    })();
  }, []);

  const heroHighlights = useMemo(() => {
    const readyDelta = Math.max(metrics.codesTotal - metrics.codesReady, 0);
    return [
      {
        key: 'assets',
        title: 'Assets Online',
        value: counts.assets,
        caption: `${metrics.totalQuantity.toLocaleString()} items tracked`,
        icon: Package,
        iconClass: 'text-primary h-4 w-4',
      },
      {
        key: 'properties',
        title: 'Properties',
        value: counts.properties,
        caption: `${counts.expiring.toLocaleString()} expiring assets soon`,
        icon: Building2,
        iconClass: 'text-primary h-4 w-4',
      },
      {
        key: 'purchases',
        title: 'Purchases (MTD)',
        value: metrics.monthlyPurchases,
        caption: monthlyChange.label,
        icon: TrendingUp,
        iconClass: 'text-primary h-4 w-4',
      },
      {
        key: 'qr',
        title: 'QR Codes Ready',
        value: metrics.codesReady,
        caption: `${metrics.codesTotal.toLocaleString()} generated • ${readyDelta.toLocaleString()} in circulation`,
        icon: QrCode,
        iconClass: 'text-primary h-4 w-4',
      },
    ];
  }, [counts.assets, counts.properties, counts.expiring, metrics.totalQuantity, metrics.monthlyPurchases, metrics.codesReady, metrics.codesTotal, monthlyChange.label, monthlyChange.isPositive]);

  const ticketChartData = useMemo(() => {
    let backlog = 0;
    return ticketMonthlyTrend.map((point) => {
      backlog = Math.max(0, backlog + point.created - point.resolved);
      return { ...point, backlog };
    });
  }, [ticketMonthlyTrend]);

  const priorityBreakdown = useMemo(() => {
    const order: Array<{ key: keyof TicketSummary['byPriority']; label: string; barClass: string }> = [
      { key: 'urgent', label: 'Urgent', barClass: 'bg-[hsl(339,90%,51%)]' },
      { key: 'high', label: 'High', barClass: 'bg-[hsl(31,97%,55%)]' },
      { key: 'medium', label: 'Medium', barClass: 'bg-[hsl(221,83%,53%)]' },
      { key: 'low', label: 'Low', barClass: 'bg-[hsl(191,91%,46%)]' },
    ];
    const total = order.reduce((sum, item) => sum + (ticketSummary.byPriority[item.key] || 0), 0);
    return order.map((item) => {
      const count = ticketSummary.byPriority[item.key] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return { ...item, count, percent };
    });
  }, [ticketSummary.byPriority]);

  const ticketCardData = useMemo(() => {
    const shared = [
      {
        key: 'assigned',
        title: isAdmin ? 'Assigned To Me' : 'My Active Tickets',
        value: ticketSummary.assignedToMe,
        hint: ticketSummary.assignedToMe
          ? `${assignmentShare}% of current workload`
          : 'Nothing assigned right now',
        icon: UserCheck,
        iconClass: 'text-primary h-4 w-4',
      },
      {
        key: 'resolved',
        title: isAdmin ? 'Resolved This Cycle' : 'Team Resolved',
        value: resolvedTotal,
        hint: ticketSummary.total ? `${completionRate}% of ${ticketSummary.total.toLocaleString()} tickets` : 'No tickets resolved yet',
        icon: CheckCircle2,
        iconClass: 'text-primary h-4 w-4',
      },
    ];

    if (isAdmin) {
      return [
        {
          key: 'all',
          title: 'All Tickets',
          value: ticketSummary.total,
          hint: `${backlogActive.toLocaleString()} in flight • ${ticketSummary.awaitingAssignment.toLocaleString()} awaiting owner`,
          icon: TicketIcon,
          iconClass: 'text-primary h-4 w-4',
        },
        ...shared,
        {
          key: 'sla',
          title: 'SLA Watch',
          value: ticketSummary.slaRisk,
          hint: ticketSummary.slaRisk ? 'Needs attention' : 'All clear',
          icon: ClockIcon,
          iconClass: 'text-primary h-4 w-4',
        },
      ];
    }

    return shared;
  }, [assignmentShare, backlogActive, completionRate, isAdmin, resolvedTotal, ticketSummary.awaitingAssignment, ticketSummary.assignedToMe, ticketSummary.slaRisk, ticketSummary.total]);

  const severityBadgeClasses: Record<AmcAlertItem["severity"], string> = {
    urgent: "bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    soon: "bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    info: "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  };

  const amcTracker = useMemo(() => {
    if (!scopedAssets.length) {
      return { upcoming: [] as AmcAlertItem[], tracked: 0, overdue: 0 };
    }
    const propertyNames = new Map<string, string>();
    scopedProperties.forEach((property) => {
      const idKey = String(property.id);
      propertyNames.set(idKey, property.name || idKey);
      if (property.name) {
        propertyNames.set(property.name, property.name);
      }
    });
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const cutoff = new Date(startOfToday);
    cutoff.setMonth(cutoff.getMonth() + 2);
    const tracked = scopedAssets.filter((asset) => Boolean(asset.amcEnabled)).length;
    const normalized = scopedAssets
      .filter((asset) => asset.amcEnabled && asset.amcEndDate)
      .map((asset) => {
        if (!asset.amcEndDate) return null;
        const endDateRaw = new Date(asset.amcEndDate);
        if (Number.isNaN(endDateRaw.getTime())) return null;
        const normalizedEnd = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
        const diffMs = normalizedEnd.getTime() - startOfToday.getTime();
        const daysRemaining = Math.ceil(diffMs / MS_IN_DAY);
        const startDateRaw = asset.amcStartDate ? new Date(asset.amcStartDate) : null;
        const normalizedStart =
          startDateRaw && !Number.isNaN(startDateRaw.getTime())
            ? new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate())
            : null;
        const propertyKey = asset.property_id ?? asset.property;
        const propertyName =
          propertyNames.get(String(propertyKey)) ||
          propertyNames.get(String(asset.property)) ||
          String(asset.property || "Unassigned");
        const severity: AmcAlertItem["severity"] =
          daysRemaining <= 7 ? "urgent" : daysRemaining <= 30 ? "soon" : "info";
        return {
          id: asset.id,
          name: asset.name,
          propertyName,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          daysRemaining,
          severity,
        } as AmcAlertItem;
      })
      .filter((item): item is AmcAlertItem => Boolean(item));
    const overdueItems = normalized
      .filter((item) => item.daysRemaining < 0)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const upcoming = normalized
      .filter((item) => item.daysRemaining >= 0 && item.endDate.getTime() <= cutoff.getTime())
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const overdue = overdueItems.length;
    return { upcoming, overdueItems, tracked, overdue };
  }, [scopedAssets, scopedProperties]);

  const foodExpiryTracker = useMemo(() => {
    if (!scopedAssets.length) {
      return { items: [] as FoodExpiryItem[], tracked: 0, overdue: 0 };
    }
    const propertyNames = new Map<string, string>();
    scopedProperties.forEach((property) => {
      const idKey = String(property.id);
      propertyNames.set(idKey, property.name || idKey);
      if (property.name) {
        propertyNames.set(property.name, property.name);
      }
    });
    const foodAssets = scopedAssets.filter((asset) => {
      const typeLabel = String(asset.type || "").toLowerCase();
      const deptLabel = String(asset.department || "").toLowerCase();
      return typeLabel.includes("food") || deptLabel.includes("food");
    });
    if (!foodAssets.length) {
      return { items: [] as FoodExpiryItem[], tracked: 0, overdue: 0 };
    }
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const windowStart = new Date(startOfToday);
    windowStart.setDate(windowStart.getDate() - 60);
    const windowEnd = new Date(startOfToday);
    windowEnd.setDate(windowEnd.getDate() + 60);
    const normalized = foodAssets
      .map((asset) => {
        if (!asset.expiryDate) return null;
        const rawEnd = new Date(asset.expiryDate);
        if (Number.isNaN(rawEnd.getTime())) return null;
        const endDate = new Date(rawEnd.getFullYear(), rawEnd.getMonth(), rawEnd.getDate());
        const diffMs = endDate.getTime() - startOfToday.getTime();
        const daysRemaining = Math.ceil(diffMs / MS_IN_DAY);
        const propertyKey = asset.property_id ?? asset.property;
        const propertyName =
          propertyNames.get(String(propertyKey)) ||
          propertyNames.get(String(asset.property)) ||
          String(asset.property || "Unassigned");
        const severity: FoodExpiryItem["severity"] =
          daysRemaining <= 7 ? "urgent" : daysRemaining <= 30 ? "soon" : "info";
        return {
          id: asset.id,
          name: asset.name,
          propertyName,
          departmentName: asset.department ?? null,
          endDate,
          daysRemaining,
          severity,
          quantity: Number(asset.quantity) || 0,
          typeLabel: asset.type || "Food",
        } as FoodExpiryItem;
      })
      .filter((item): item is FoodExpiryItem => Boolean(item));
    if (!normalized.length) {
      return { items: [] as FoodExpiryItem[], tracked: 0, overdue: 0 };
    }
    const withinWindow = normalized.filter(
      (item) =>
        item.endDate.getTime() >= windowStart.getTime() && item.endDate.getTime() <= windowEnd.getTime()
    );
    if (!withinWindow.length) {
      return { items: [] as FoodExpiryItem[], tracked: normalized.length, overdue: 0 };
    }
    const overdueItems = withinWindow
      .filter((item) => item.daysRemaining < 0)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const upcoming = withinWindow
      .filter((item) => item.daysRemaining >= 0)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    return {
      items: overdueItems.concat(upcoming),
      tracked: normalized.length,
      overdue: overdueItems.length,
    };
  }, [scopedAssets, scopedProperties]);

  const upcomingAmc = amcTracker.upcoming;
  const trackedAmc = amcTracker.tracked;
  const overdueAmcItems = amcTracker.overdueItems ?? [];
  const overdueAmc = amcTracker.overdue;
  const amcWatchList = overdueAmcItems.concat(upcomingAmc);
  const displayedAmcWatchList = showAllWatchlist ? amcWatchList : amcWatchList.slice(0, WATCHLIST_DISPLAY_LIMIT);
  const remainingAmcCount = Math.max(0, amcWatchList.length - displayedAmcWatchList.length);
  const foodExpiryList = foodExpiryTracker.items ?? [];
  const foodExpiryTracked = foodExpiryTracker.tracked ?? 0;
  const foodExpiryOverdue = foodExpiryTracker.overdue ?? 0;
  const displayedFoodExpiryList = showAllFoodExpiry ? foodExpiryList : foodExpiryList.slice(0, WATCHLIST_DISPLAY_LIMIT);
  const remainingFoodExpiryCount = Math.max(0, foodExpiryList.length - displayedFoodExpiryList.length);

  const averageResolutionLabel = ticketSummary.averageResolutionHours !== null
    ? `${ticketSummary.averageResolutionHours.toFixed(1)}h`
    : 'Collecting data';
  const backlogLabel = `${ticketSummary.open.toLocaleString()} open • ${ticketSummary.inProgress.toLocaleString()} in progress`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const posts = await listNewsletterPosts(3);
        if (!cancelled) setAnnouncements(posts);
      } catch {
        if (!cancelled) setAnnouncements([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hydrateTicketInsights = (tickets: Ticket[], users: AppUser[]) => {
      const userLabelLookup = new Map<string, string>();
      users.forEach((u) => {
        if (!u) return;
        const label = (u.name || u.email || u.id || "User").toString();
        if (u.id) userLabelLookup.set(String(u.id), label);
        if (u.email) userLabelLookup.set(String(u.email), label);
      });

      let assignedToMe = 0;
      let awaitingAssignment = 0;
      let slaRisk = 0;
      let resolvedCount = 0;
      let totalResolutionHours = 0;
      const statusTally = { open: 0, inProgress: 0, resolved: 0, closed: 0 };
      const byPriority: Record<"low" | "medium" | "high" | "urgent", number> = { low: 0, medium: 0, high: 0, urgent: 0 };
      const assigneeCounts = new Map<string, number>();

      const nowTs = Date.now();
      tickets.forEach((ticket) => {
        switch (ticket.status) {
          case "open":
            statusTally.open += 1;
            break;
          case "in_progress":
            statusTally.inProgress += 1;
            break;
          case "resolved":
            statusTally.resolved += 1;
            break;
          case "closed":
            statusTally.closed += 1;
            break;
        }

        const priorityKey = (ticket.priority || "medium") as keyof typeof byPriority;
        if (byPriority[priorityKey] !== undefined) {
          byPriority[priorityKey] += 1;
        }

        if (!ticket.assignee && (ticket.status === "open" || ticket.status === "in_progress")) {
          awaitingAssignment += 1;
        }

        if (ticket.assignee) {
          const key = String(ticket.assignee);
          assigneeCounts.set(key, (assigneeCounts.get(key) || 0) + 1);
        }

        if (ticket.slaDueAt) {
          const dueTs = new Date(ticket.slaDueAt).getTime();
          if (!Number.isNaN(dueTs) && dueTs < nowTs && ticket.status !== "closed" && ticket.status !== "resolved") {
            slaRisk += 1;
          }
        }

        if (ticket.status === "resolved" || ticket.status === "closed") {
          const createdAt = new Date(ticket.createdAt).getTime();
          const resolvedAt = new Date(ticket.updatedAt || ticket.createdAt).getTime();
          if (!Number.isNaN(createdAt) && !Number.isNaN(resolvedAt) && resolvedAt >= createdAt) {
            totalResolutionHours += (resolvedAt - createdAt) / (1000 * 60 * 60);
            resolvedCount += 1;
          }
        }
      });

      const currentIdentifiers = (() => {
        try {
          const raw = (isDemoMode()
            ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
            : null) || localStorage.getItem("auth_user");
          if (!raw) return new Set<string>();
          const u = JSON.parse(raw);
          const ids = [u?.id, u?.email].filter(Boolean).map((v: string) => String(v));
          return new Set(ids);
        } catch {
          return new Set<string>();
        }
      })();

      if (currentIdentifiers.size) {
        assignedToMe = tickets.filter((t) => t.assignee && currentIdentifiers.has(String(t.assignee))).length;
      }

      const topAssignees = Array.from(assigneeCounts.entries())
        .map(([id, count]) => ({
          id,
          count,
          label: userLabelLookup.get(id) || (id.includes("@") ? id : `User ${id}`),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const averageResolutionHours = resolvedCount ? totalResolutionHours / resolvedCount : null;

      const now = new Date();
      const buckets = new Map<number, { month: string; start: number; end: number; created: number; resolved: number }>();
      for (let i = 5; i >= 0; i--) {
        const base = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = base.getFullYear() * 12 + base.getMonth();
        buckets.set(key, {
          month: monthLabel(base),
          start: base.getTime(),
          end: new Date(base.getFullYear(), base.getMonth() + 1, 1).getTime(),
          created: 0,
          resolved: 0,
        });
      }

      tickets.forEach((ticket) => {
        const createdTs = new Date(ticket.createdAt).getTime();
        buckets.forEach((bucket) => {
          if (createdTs >= bucket.start && createdTs < bucket.end) {
            bucket.created += 1;
          }
        });

        if (ticket.status === "resolved" || ticket.status === "closed") {
          const resolvedTs = new Date(ticket.updatedAt || ticket.createdAt).getTime();
          buckets.forEach((bucket) => {
            if (resolvedTs >= bucket.start && resolvedTs < bucket.end) {
              bucket.resolved += 1;
            }
          });
        }
      });

      const summary: TicketSummary = {
        total: tickets.length,
        open: statusTally.open,
        inProgress: statusTally.inProgress,
        resolved: statusTally.resolved,
        closed: statusTally.closed,
        assignedToMe,
        awaitingAssignment,
        slaRisk,
        byPriority,
        topAssignees,
        averageResolutionHours,
      };
      const trend = Array.from(buckets.values())
        .sort((a, b) => a.start - b.start)
        .map((bucket) => ({ month: bucket.month, created: bucket.created, resolved: bucket.resolved }));

      setTicketSummary(summary);
      setTicketMonthlyTrend(trend);
      return { summary, trend };
    };

    const seedDemo = async () => {
      let seededStats: ReturnType<typeof demoStats> | null = null;
      try {
        seededStats = demoStats();
        setCounts(seededStats.counts);
        setMetrics(seededStats.metrics);
      } catch {
        setCounts({ ...defaultCounts });
        setMetrics({ ...defaultMetrics });
      }
      try {
        const [demoAssets, demoProperties, demoUsers, demoTickets] = await Promise.all([
          listAssets().catch(() => [] as Asset[]),
          listProperties().catch(() => [] as Property[]),
          listUsers().catch(() => [] as AppUser[]),
          listTickets().catch(() => [] as Ticket[]),
        ]);
        setScopedAssets(demoAssets);
        setScopedProperties(demoProperties);
        const { summary, trend } = hydrateTicketInsights(demoTickets, demoUsers);
        try {
          const snapshotData: DashboardSnapshot = {
            counts: seededStats?.counts ?? defaultCounts,
            metrics: seededStats?.metrics ?? defaultMetrics,
            ticketSummary: summary,
            ticketMonthlyTrend: trend,
            scopedAssets: demoAssets,
            scopedProperties: demoProperties,
            storedAt: Date.now(),
          };
          sessionStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify(snapshotData));
        } catch {}
      } catch {
        setScopedAssets([]);
        setScopedProperties([]);
        setTicketSummary(emptyTicketSummary);
        setTicketMonthlyTrend([]);
      } finally {
        setLoadingUI(false);
      }
    };

    if (isDemoMode()) {
      seedDemo();
      return;
    }

    if (!hasSupabaseEnv) {
      setScopedAssets([]);
      setScopedProperties([]);
      setLoadingUI(false);
      return;
    }

    (async () => {
      try {
        const uiTimer = !initialSnapshot ? setTimeout(() => setLoadingUI(true), 100) : undefined; // ensure skeleton visible if slow
        const [assetsRaw, propertiesRaw, users, qrs, ticketsRaw] = await Promise.all([
          listAssets().catch(() => [] as Asset[]),
          listProperties().catch(() => [] as Property[]),
          listUsers().catch(() => [] as AppUser[]),
          listQRCodes().catch(() => [] as QRCode[]),
          listTickets().catch(() => [] as Ticket[]),
        ]);

        let assets: Asset[] = assetsRaw;
        let properties: Property[] = propertiesRaw;
        let qrsScoped: QRCode[] = qrs;
        let ticketsScoped: Ticket[] = ticketsRaw;

        try {
          const raw = (isDemoMode()
            ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
            : null) || localStorage.getItem("auth_user");
          const u = raw ? JSON.parse(raw) : null;
          const isAdmin = String(u?.role || "").toLowerCase() === "admin";
          if (!isAdmin) {
            const allowed = await getAccessiblePropertyIdsForCurrentUser();
            if (allowed && allowed.size) {
              const allowedIds = new Set(Array.from(allowed).map((v) => String(v)));
              properties = properties.filter((p) => allowedIds.has(String(p.id)));
              assets = assets.filter((a) => allowedIds.has(String(a.property_id || a.property)));
              qrsScoped = qrs.filter((q) => (q.property ? allowedIds.has(String(q.property)) : false));
              ticketsScoped = ticketsScoped.filter((ticket) => {
                if (!ticket.propertyId) return true;
                return allowedIds.has(String(ticket.propertyId));
              });
            }
          }
        } catch {}

        setScopedAssets(assets);
        setScopedProperties(properties);

        const expiringSoon = assets.filter((a) => {
          if (!a.expiryDate) return false;
          const d = new Date(a.expiryDate);
          const now = new Date();
          const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diff >= 0 && diff <= 30;
        }).length;
        const countsPayload = { assets: assets.length, properties: properties.length, users: users.length, expiring: expiringSoon };
        setCounts(countsPayload);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const startThisMonth = new Date(year, month, 1);
        const startNextMonth = new Date(year, month + 1, 1);
        const startPrevMonth = new Date(year, month - 1, 1);
        const endPrevMonth = new Date(year, month, 1);

        const totalQuantity = assets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        const assetTypes = (() => {
          try {
            const set = new Set<string>();
            assets.forEach((a) => {
              const t = String((a.type ?? "")).trim();
              if (t) set.add(t);
            });
            return set.size;
          } catch {
            return 0;
          }
        })();
        const monthlyPurchases = assets.filter(
          (a) => a.purchaseDate && new Date(a.purchaseDate) >= startThisMonth && new Date(a.purchaseDate) < startNextMonth
        ).length;
        const monthlyPurchasesPrev = assets.filter(
          (a) => a.purchaseDate && new Date(a.purchaseDate) >= startPrevMonth && new Date(a.purchaseDate) < endPrevMonth
        ).length;
        const codesTotal = qrsScoped.length;
        const codesReady = qrsScoped.filter((q) => !q.printed).length;
        const metricsPayload = { totalQuantity, monthlyPurchases, monthlyPurchasesPrev, codesTotal, codesReady, assetTypes };
        setMetrics(metricsPayload);

        const { summary, trend } = hydrateTicketInsights(ticketsScoped, users);

        try {
          const snapshotData: DashboardSnapshot = {
            counts: countsPayload,
            metrics: metricsPayload,
            ticketSummary: summary,
            ticketMonthlyTrend: trend,
            scopedAssets: assets,
            scopedProperties: properties,
            storedAt: Date.now(),
          };
          sessionStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify(snapshotData));
        } catch {}

        if (uiTimer) clearTimeout(uiTimer);
        setLoadingUI(false);
      } catch (e) {
        console.error(e);
        setTicketSummary(emptyTicketSummary);
        setTicketMonthlyTrend([]);
        setScopedAssets([]);
        setScopedProperties([]);
        setLoadingUI(false);
      }
    })();
  }, [initialSnapshot]);

  // Load current user's first name for greeting
  useEffect(() => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
      if (raw) {
        const u = JSON.parse(raw) as { name?: string; role?: string };
        const fn = String(u?.name || "").trim().split(/\s+/)[0] || "";
        setFirstName(fn);
        setRole(String(u?.role || "").toLowerCase());
      }
    } catch {
      // ignore
    }
  }, []);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "Add Asset":
  navigate(isDemoMode() ? "/demo/assets?new=1" : "/assets?new=1");
        break;
      case "Generate QR Codes":
  navigate(isDemoMode() ? "/demo/qr-codes" : "/qr-codes");
        break;
      case "Property Report":
      case "Generate Report":
  navigate(isDemoMode() ? "/demo/reports" : "/reports");
        if (!hasSupabaseEnv) {
          toast.info("Reports may be limited without Supabase configured");
        }
        break;
      case "User Management":
  navigate(isDemoMode() ? "/demo/users" : "/users");
        break;
      case "Bulk Import":
        setBulkOpen(true);
        break;
      default:
  navigate(isDemoMode() ? "/demo" : "/");
    }
  };

  if (loadingUI) {
    return <DashboardSkeleton />;
  }

  const chartColors = {
    created: "hsl(221, 83%, 53%)",
    resolved: "hsl(142, 71%, 45%)",
    backlog: "hsl(339, 90%, 51%)",
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-background p-6 md:p-10 shadow-sm border border-primary/10">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
               <Calendar className="h-4 w-4" />
               {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              {greeting}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Here's what's happening with your assets today.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => handleQuickAction("Add Asset")} 
                className="group flex h-12 w-12 items-center justify-center gap-0 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:w-36 hover:shadow-xl overflow-hidden p-0"
              >
                <Plus className="h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-2 font-medium">
                  Add Asset
                </span>
              </Button>
          </div>
        </div>
        
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {heroHighlights.map((item) => (
            <MetricCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              value={item.value.toLocaleString()}
              caption={item.caption}
              iconClassName={item.iconClass}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {/* AMC Watchlist */}
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-orange-500/5 shadow-sm">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">AMC Watchlist</CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground">Renewals within 60 days</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-muted/50 font-medium text-muted-foreground">
                  {trackedAmc.toLocaleString()} Tracked
                </Badge>
                {overdueAmc > 0 && (
                  <Badge variant="destructive" className="shadow-sm">
                    {overdueAmc} Overdue
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {hasSupabaseEnv ? (
              amcWatchList.length ? (
                <div className="space-y-3">
                  {displayedAmcWatchList.map((item) => {
                    const dueLabel = (() => {
                      if (item.daysRemaining === 0) return "Due today";
                      if (item.daysRemaining === 1) return "Due tomorrow";
                      if (item.daysRemaining > 1) return `Due in ${item.daysRemaining} days`;
                      const overdueBy = Math.abs(item.daysRemaining);
                      return overdueBy === 1 ? "Overdue by 1 day" : `Overdue by ${overdueBy} days`;
                    })();
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className={cn("h-2 w-2 rounded-full shrink-0", 
                              item.severity === 'urgent' ? "bg-destructive" : 
                              item.severity === 'soon' ? "bg-orange-500" : "bg-yellow-500"
                           )} />
                           <div className="space-y-0.5 overflow-hidden">
                              <h4 className="truncate text-sm font-medium text-foreground" title={item.name}>{item.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">{item.propertyName}</span>
                                <span>•</span>
                                <span>{item.id}</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("text-[10px] font-medium", 
                              item.severity === 'urgent' ? "text-red-600 dark:text-red-400" : 
                              item.severity === 'soon' ? "text-orange-600 dark:text-orange-400" : "text-yellow-600 dark:text-yellow-400"
                          )}>
                            {dueLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {amcWatchList.length > WATCHLIST_DISPLAY_LIMIT && (
                    <div className="col-span-full flex justify-center pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowAllWatchlist((prev) => !prev)}
                      >
                        {showAllWatchlist ? "Show less" : `Show ${remainingAmcCount} more`}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                  <div className="rounded-full bg-muted/50 p-3">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground/80">No AMC renewals due in the next 60 days.</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <div className="rounded-full bg-muted/50 p-3">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm">Connect Supabase to enable tracking</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Food Expiry Tracker */}
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-emerald-500/5 shadow-sm">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Food Expiry Tracker</CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground">Items expiring within 60 days</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-muted/50 font-medium text-muted-foreground">
                  {foodExpiryTracked.toLocaleString()} Tracked
                </Badge>
                {foodExpiryOverdue > 0 ? (
                  <Badge variant="destructive" className="shadow-sm">
                    {foodExpiryOverdue} Overdue
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-200/50 bg-emerald-500/5 text-emerald-700 dark:border-emerald-800/50 dark:text-emerald-400">
                    All Fresh
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {hasSupabaseEnv ? (
              foodExpiryList.length ? (
                <div className="space-y-3">
                  {displayedFoodExpiryList.map((item) => {
                    const dueLabel = (() => {
                      if (item.daysRemaining === 0) return "Expires today";
                      if (item.daysRemaining === 1) return "Expires tomorrow";
                      if (item.daysRemaining > 1) return `Expires in ${item.daysRemaining} days`;
                      const overdueBy = Math.abs(item.daysRemaining);
                      return overdueBy === 1 ? "Expired 1 day ago" : `Expired ${overdueBy} days ago`;
                    })();
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className={cn("h-2 w-2 rounded-full shrink-0", 
                              item.severity === 'urgent' ? "bg-destructive" : 
                              item.severity === 'soon' ? "bg-orange-500" : "bg-yellow-500"
                           )} />
                           <div className="space-y-0.5 overflow-hidden">
                              <h4 className="truncate text-sm font-medium text-foreground" title={item.name}>{item.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">{item.propertyName}</span>
                                {item.quantity && (
                                  <>
                                    <span>•</span>
                                    <span>Qty: {item.quantity}</span>
                                  </>
                                )}
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("text-[10px] font-medium", 
                              item.severity === 'urgent' ? "text-red-600 dark:text-red-400" : 
                              item.severity === 'soon' ? "text-orange-600 dark:text-orange-400" : "text-yellow-600 dark:text-yellow-400"
                          )}>
                            {dueLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {foodExpiryList.length > WATCHLIST_DISPLAY_LIMIT && (
                    <div className="col-span-full flex justify-center pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowAllFoodExpiry((prev) => !prev)}
                      >
                        {showAllFoodExpiry ? "Show less" : `Show ${remainingFoodExpiryCount} more`}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Everything looks good!</p>
                    <p className="text-xs text-muted-foreground/80">No food items expiring soon.</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/20">
                  <Utensils className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm">Connect Supabase to enable tracking</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3 min-w-0">
        <div className="space-y-4 xl:col-span-2 min-w-0">
          <DashboardCharts />
        </div>
        <div className="space-y-4 min-w-0">
          <Card className="rounded-xl border border-border/60 bg-card shadow-sm min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">Announcements</CardTitle>
                  <CardDescription>Latest from the SAMS team</CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => navigate(isDemoMode() ? "/demo/newsletter" : "/newsletter")}
              >
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground">No announcements yet. Check back soon.</p>
              ) : (
                announcements.slice(0, 3).map((post) => {
                  const badge = getAnnouncementBadge(post.category);
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(isDemoMode() ? "/demo/newsletter" : "/newsletter")}
                      className="w-full rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-left transition hover:border-border hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        {post.author && <span className="text-muted-foreground">• {post.author}</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground line-clamp-1">{post.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.body}</p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
          <RecentActivity />
          {!isDemoMode() && <MyAudits />}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Ticket Pulse</h2>
            <p className="text-sm text-muted-foreground">
              Service velocity across your locations
            </p>
          </div>
          <Badge variant="outline" className="border-transparent bg-muted/60 text-muted-foreground">
            {backlogLabel}
          </Badge>
        </div>
        <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
          {ticketCardData.map((item) => (
            <MetricCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              value={item.value.toLocaleString()}
              caption={item.hint}
              iconClassName={item.iconClass}
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
          <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Ticket Flow</CardTitle>
              <CardDescription>Created vs resolved over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ticketCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.created} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.created} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ticketResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.resolved} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColors.resolved} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    content={<CustomTooltip formatter={(value: any, name: any) => [value, name]} />}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="created" 
                    name="Created" 
                    stroke={chartColors.created} 
                    fill="url(#ticketCreated)" 
                    strokeWidth={2} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="resolved" 
                    name="Resolved" 
                    stroke={chartColors.resolved} 
                    fill="url(#ticketResolved)" 
                    strokeWidth={2} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="backlog" 
                    name="Backlog" 
                    stroke={chartColors.backlog} 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Team Signals</CardTitle>
              <CardDescription>Average resolution {averageResolutionLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Priority mix
                  </p>
                </div>
                <div className="space-y-3">
                  {priorityBreakdown.map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.count.toLocaleString()} <span className="mx-1 opacity-50">•</span> {item.percent}%</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${item.barClass} transition-all duration-500`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && ticketSummary.topAssignees.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Top responders
                  </p>
                  <div className="space-y-2">
                    {ticketSummary.topAssignees.slice(0, 4).map((assignee, i) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-2 pr-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-border/50">
                            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                              {assignee.label.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground leading-none">{assignee.label}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-muted/50 font-normal">
                          {assignee.count.toLocaleString()} tickets
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/50 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                  {ticketSummary.assignedToMe
                    ? `You currently own ${ticketSummary.assignedToMe.toLocaleString()} ticket${ticketSummary.assignedToMe === 1 ? "" : "s"}. Close them before SLA to stay ahead.`
                    : "Grab the next ticket in the queue to keep the board flowing."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Shortcuts your team hits daily
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Button
              variant="outline"
              className="h-full w-full items-center justify-start gap-3 rounded-lg border-border/60 bg-background/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => handleQuickAction("Bulk Import")}
            >
              <Download className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Bulk Import</span>
            </Button>
            <Button
              variant="outline"
              className="h-full w-full items-center justify-start gap-3 rounded-lg border-border/60 bg-background/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => handleQuickAction("Generate QR Codes")}
            >
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Generate QR Codes</span>
            </Button>
            <Button
              variant="outline"
              className="h-full w-full items-center justify-start gap-3 rounded-lg border-border/60 bg-background/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => handleQuickAction("Property Report")}
            >
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Property Reports</span>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="h-full w-full items-center justify-start gap-3 rounded-lg border-border/60 bg-background/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => handleQuickAction("User Management")}
              >
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Manage Users</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden border-0 bg-background p-0 shadow-2xl md:rounded-2xl">
          <div className="relative flex flex-col">
            {/* Header Section with Gradient */}
            <div className="relative overflow-hidden bg-muted/30 px-6 pb-6 pt-8 text-center border-b border-border/50">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-bold tracking-tight">Bulk Import Assets</DialogTitle>
                  <DialogDescription className="mx-auto max-w-xs text-muted-foreground">
                    Upload your asset inventory in bulk using our standardized Excel template.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 px-6 py-6">
              {/* Step 1: Template */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Need the template?</p>
                      <p className="text-xs text-muted-foreground">Start with a fresh Excel file</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAssetTemplate()}
                    className="h-9 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              </div>

              {/* Step 2: Upload Dropzone */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Upload File</label>
                  <span className="text-xs text-muted-foreground">.xlsx or .xls up to 10MB</span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!importing) fileRef.current?.click();
                  }}
                  onKeyDown={handleDropZoneKeyDown}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    importing
                      ? "cursor-not-allowed border-muted bg-muted/30 opacity-70"
                      : isDragActive
                        ? "border-primary bg-primary/5 scale-[0.99]"
                        : "border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition-transform duration-200 group-hover:scale-110",
                    isDragActive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground ring-1 ring-border"
                  )}>
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {isDragActive ? "Drop file to upload" : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excel files only
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || importing) return;
                    void handleImportFile(file);
                  }}
                />
              </div>

              {/* Info / Status */}
              {(importing || importProgress > 0) ? (
                 /* Progress UI */
                 <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-foreground">{importing ? "Processing..." : "Completed"}</span>
                       <span className="text-muted-foreground">{Math.min(importProgress, 100)}%</span>
                    </div>
                    <Progress value={Math.min(importProgress, 100)} className="h-2 w-full bg-muted" />
                 </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                   <Building2 className="h-4 w-4 text-muted-foreground" />
                   <div className="flex-1 text-xs text-muted-foreground">
                      Importing to <span className="font-medium text-foreground">{propertyTotal.toLocaleString()} {propertyLabel}</span>
                   </div>
                </div>
              )}

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                   <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">Import Errors:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyErrorsToClipboard()}
                        className="h-6 gap-1 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                   </div>
                   <ul className="list-inside list-disc space-y-1">
                      {importErrors.map((err, i) => (
                        <li key={i}>Row {err.row}: {err.message}</li>
                      ))}
                   </ul>
                </div>
              )}

              {lastImportSummary && (
                <div className="rounded-lg border border-emerald-400/40 bg-emerald-100/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
                  Last import: {lastImportSummary}
                </div>
              )}
            </div>
            <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
               <Button variant="ghost" onClick={() => setBulkOpen(false)}>
                  Close
               </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {!hasSupabaseEnv && (
        <Card className="rounded-2xl border-warning/40 bg-warning/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-6 w-6 text-warning" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Connect to Supabase for Full Functionality</h3>
                <p className="text-sm text-muted-foreground">
                  This asset management system requires a backend database for user authentication, asset storage, and full functionality. Add your Supabase keys to .env.local to enable features like:
                </p>
                <ul className="ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>• User authentication and role-based access</li>
                  <li>• Asset and property data storage</li>
                  <li>• Real-time updates and audit logs</li>
                  <li>• Report generation and data export</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
