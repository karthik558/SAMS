import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MyAudits } from "@/components/dashboard/MyAudits";
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
  Plus,
  Download,
  FileText,
  Upload,
  Megaphone,
  Copy,
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
import MetricCard from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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

type AmcAlertItem = {
  id: string;
  name: string;
  propertyName: string;
  startDate: Date | null;
  endDate: Date;
  daysRemaining: number;
  severity: "urgent" | "soon" | "info";
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
        iconClass: 'text-primary',
      },
      {
        key: 'properties',
        title: 'Properties',
        value: counts.properties,
        caption: `${counts.expiring.toLocaleString()} expiring assets soon`,
        icon: Building2,
        iconClass: 'text-primary',
      },
      {
        key: 'purchases',
        title: 'Purchases (MTD)',
        value: metrics.monthlyPurchases,
        caption: monthlyChange.label,
        icon: TrendingUp,
        iconClass: monthlyChange.isPositive ? 'text-primary' : 'text-destructive',
      },
      {
        key: 'qr',
        title: 'QR Codes Ready',
        value: metrics.codesReady,
        caption: `${metrics.codesTotal.toLocaleString()} generated • ${readyDelta.toLocaleString()} in circulation`,
        icon: QrCode,
        iconClass: 'text-primary',
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
      { key: 'urgent', label: 'Urgent', barClass: 'bg-red-500 dark:bg-red-400' },
      { key: 'high', label: 'High', barClass: 'bg-amber-500 dark:bg-amber-400' },
      { key: 'medium', label: 'Medium', barClass: 'bg-sky-500 dark:bg-sky-400' },
      { key: 'low', label: 'Low', barClass: 'bg-slate-500 dark:bg-slate-400' },
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
        iconClass: 'text-primary',
      },
      {
        key: 'resolved',
        title: isAdmin ? 'Resolved This Cycle' : 'Team Resolved',
        value: resolvedTotal,
        hint: ticketSummary.total ? `${completionRate}% of ${ticketSummary.total.toLocaleString()} tickets` : 'No tickets resolved yet',
        icon: CheckCircle2,
        iconClass: 'text-primary',
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
          iconClass: 'text-primary',
        },
        ...shared,
        {
          key: 'sla',
          title: 'SLA Watch',
          value: ticketSummary.slaRisk,
          hint: ticketSummary.slaRisk ? 'Needs attention' : 'All clear',
          icon: ClockIcon,
          iconClass: ticketSummary.slaRisk ? 'text-destructive' : 'text-primary',
        },
      ];
    }

    return shared;
  }, [assignmentShare, backlogActive, completionRate, isAdmin, resolvedTotal, ticketSummary.awaitingAssignment, ticketSummary.assignedToMe, ticketSummary.slaRisk, ticketSummary.total]);

  const severityBadgeClasses: Record<AmcAlertItem["severity"], string> = {
    urgent: "badge-pill border-[#8f2d1f]/55 bg-[#c65947] text-white shadow-sm dark:border-[#ff9a8f]/60 dark:bg-[#a63d2c] dark:text-white",
    soon: "badge-pill border-[#b98a3b]/50 bg-[#ffe3a3] text-[#3a1f12] shadow-sm dark:border-[#ffd470]/55 dark:bg-[#b8861b] dark:text-[#1b0f05]",
    info: "badge-pill border-[#2e7d32]/55 bg-[#d4f5e3] text-[#1c4927] shadow-sm dark:border-[#69d5a1]/55 dark:bg-[#2c7a4c] dark:text-white",
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
    const overdue = normalized.filter((item) => item.daysRemaining < 0).length;
    const upcoming = normalized
      .filter((item) => item.daysRemaining >= 0 && item.endDate.getTime() <= cutoff.getTime())
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    return { upcoming, tracked, overdue };
  }, [scopedAssets, scopedProperties]);

  const upcomingAmc = amcTracker.upcoming;
  const trackedAmc = amcTracker.tracked;
  const overdueAmc = amcTracker.overdue;

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
    created: "hsl(var(--chart-created))",
    resolved: "hsl(var(--chart-resolved))",
    backlog: "hsl(var(--chart-backlog))",
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="surface-card-soft space-y-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {greeting}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button onClick={() => handleQuickAction("Add Asset")} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Asset
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="rounded-xl border border-transparent bg-gradient-to-br from-[#c17e62] to-[#dda88f] p-6 shadow-soft text-[#3a1f12] dark:from-[#7f432c] dark:to-[#a46348] dark:text-white">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/75 p-2 text-[#8a472d] shadow-sm dark:bg-white/15 dark:text-white">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#2f160b] dark:text-white">AMC Watchlist</h2>
                <p className="text-xs text-[#4d2715] dark:text-white/80">
                  Renewals scheduled within the next 60 days
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge-pill border-[#8f462c]/40 bg-[#f4c9b0] text-[#3a1f12] shadow-sm dark:border-[#f5cbb1]/45 dark:bg-[#a46348] dark:text-white">
                {trackedAmc.toLocaleString()} {trackedAmc === 1 ? "AMC tracked" : "AMCs tracked"}
              </span>
              <span
                className={cn(
                  "badge-pill shadow-sm",
                  overdueAmc > 0
                    ? "border-[#8f2d1f]/55 bg-[#c65947] text-white dark:border-[#ff9a8f]/60 dark:bg-[#a63d2c] dark:text-white"
                    : "border-[#2e7d32]/55 bg-[#3ca370] text-white dark:border-[#69d5a1]/55 dark:bg-[#2c7a4c] dark:text-white"
                )}
              >
                {overdueAmc > 0 ? `${overdueAmc} overdue` : "No overdue AMC"}
              </span>
            </div>
          </div>
          {hasSupabaseEnv ? (
            upcomingAmc.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {upcomingAmc.slice(0, 6).map((item) => {
                    const dueLabel =
                      item.daysRemaining === 0
                        ? "Due today"
                        : item.daysRemaining === 1
                          ? "Due tomorrow"
                          : `Due in ${item.daysRemaining} days`;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/40 bg-white p-4 text-[#2f160b] shadow-sm dark:border-white/15 dark:bg-zinc-900/80 dark:text-white"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-inherit">{item.name}</p>
                          <p className="text-[11px] uppercase tracking-wide text-[#704029] dark:text-white/65">
                            Asset ID: <span className="font-medium">{item.id}</span>
                          </p>
                          <p className="text-xs text-[#51301b] dark:text-white/85">
                            {item.propertyName} • Ends{" "}
                            {item.endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {item.startDate && (
                            <p className="text-[11px] text-[#704029] dark:text-white/70">
                              Started {item.startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        <span className={cn("whitespace-nowrap", severityBadgeClasses[item.severity])}>
                          {dueLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {upcomingAmc.length > 6 && (
                  <p className="text-[11px] text-[#55301b] dark:text-white/80">
                    {upcomingAmc.length - 6} more renewal{upcomingAmc.length - 6 === 1 ? "" : "s"} fall outside this window.
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 rounded-xl border border-dashed border-white/70 bg-white/85 p-4 text-xs text-[#3a1f12] shadow-sm dark:border-white/35 dark:bg-white/10 dark:text-white/90">
                <span>No AMC renewals are due in the next 60 days.</span>
                {trackedAmc > 0 && (
                  <span className="text-[11px] text-[#55301b] dark:text-white/80">
                    We’ll surface them here as they approach their end date.
                  </span>
                )}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-warning/40 bg-background/75 p-4 text-xs text-warning">
              Connect Supabase to enable AMC tracking and renewal reminders.
            </div>
          )}
        </div>
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
            <Card key={item.key} className="rounded-xl border border-border/60 bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.title}
                </CardTitle>
                <item.icon className={`h-5 w-5 ${item.iconClass}`} />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight">
                  {item.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </CardContent>
            </Card>
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
                <AreaChart data={ticketChartData}>
                  <defs>
                    <linearGradient id="ticketCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.created} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={chartColors.created} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="ticketResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.resolved} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={chartColors.resolved} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Area type="monotone" dataKey="created" name="Created" stroke={chartColors.created} fill="url(#ticketCreated)" strokeWidth={2} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke={chartColors.resolved} fill="url(#ticketResolved)" strokeWidth={2} />
                  <Line type="monotone" dataKey="backlog" name="Backlog" stroke={chartColors.backlog} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Team Signals</CardTitle>
              <CardDescription>Average resolution {averageResolutionLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Priority mix
                </p>
                <div className="space-y-3">
                  {priorityBreakdown.map((item) => (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span>{item.count.toLocaleString()} • {item.percent}%</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${item.barClass}`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && ticketSummary.topAssignees.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Top responders
                  </p>
                  <div className="space-y-2">
                    {ticketSummary.topAssignees.slice(0, 4).map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{assignee.label}</span>
                        <span className="text-xs text-muted-foreground">{assignee.count.toLocaleString()} tickets</span>
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
        <DialogContent className="sm:max-w-xl overflow-hidden border border-border/70 bg-card/95 p-0 shadow-xl">
          <div className="flex flex-col">
            <DialogHeader className="px-6 pb-0 pt-6 text-left">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Upload className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <DialogTitle className="text-lg sm:text-xl">Bulk Import Assets</DialogTitle>
                  <DialogDescription>
                    Download the Excel template, fill it with your asset data, then upload to import. Asset IDs are generated automatically based on Item Type and Property.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-6 px-6 pb-6 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  onClick={async () => {
                    await downloadAssetTemplate();
                  }}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl text-base font-semibold"
                >
                  <Download className="h-6 w-6" />
                  <span>Download Template</span>
                </Button>
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
                    "flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-background/80 p-4 text-center text-base transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    importing
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
                    isDragActive && !importing ? "border-primary bg-primary/10 shadow-inner" : ""
                  )}
                >
                  <Upload className={cn("h-6 w-6", isDragActive ? "text-primary" : "text-foreground")}
                    strokeWidth={1.8}
                  />
                  <span className="font-semibold text-foreground">
                    {isDragActive ? "Drop the file to start import" : "Drag & drop your Excel file"}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Or click to browse (.xlsx, .xls)
                  </span>
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

              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="uppercase tracking-wide">Import access</span>
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">
                      {propertyTotal.toLocaleString()} {propertyLabel}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Up to 1,000 rows per file</span>
                  </div>
                </div>
              </div>

              {(importing || importProgress > 0) && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 px-4 py-4">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{importing ? "Importing file..." : "Import complete"}</span>
                    <span>{Math.min(importProgress, 100)}%</span>
                  </div>
                  <Progress value={Math.min(importProgress, 100)} className="h-2" />
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-destructive">Some rows need a quick review</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyErrorsToClipboard()}
                      className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                    >
                      <Copy className="h-4 w-4" />
                      Copy all
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {importErrors.slice(0, 5).map((err, idx) => (
                      <li
                        key={`${err.row}-${idx}`}
                        className="rounded-lg border border-destructive/20 bg-background/90 px-3 py-2 text-sm text-destructive"
                      >
                        <span className="font-semibold">Row {err.row}</span>
                        <span className="ml-2 text-destructive/90">{err.message}</span>
                      </li>
                    ))}
                  </ul>
                  {importErrors.length > 5 && (
                    <p className="text-xs text-destructive/80">
                      + {importErrors.length - 5} more row{importErrors.length - 5 === 1 ? '' : 's'} detailed in the copied report.
                    </p>
                  )}
                </div>
              )}

              {lastImportSummary && (
                <div className="rounded-lg border border-emerald-400/40 bg-emerald-100/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
                  Last import: {lastImportSummary}
                </div>
              )}

              {!hasSupabaseEnv && (
                <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                  Backend not connected. Connect Supabase before uploading to store imported assets.
                </div>
              )}
            </div>
            <DialogFooter className="!flex !flex-col gap-3 border-t border-border/70 bg-background/60 px-6 py-4 text-sm text-muted-foreground sm:!flex-row sm:items-center sm:!justify-between sm:!space-x-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Download className="h-4 w-4" />
                </span>
                <span>Keep your asset register up to date in minutes.</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Button variant="outline" onClick={() => setBulkOpen(false)}>
                  Close
                </Button>
                <Button disabled className="gap-2" variant="secondary">
                  {importing ? "Importing..." : "Ready"}
                </Button>
              </div>
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
