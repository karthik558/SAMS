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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode, demoStats } from "@/lib/demo";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";

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

const Index = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ assets: 1247, properties: 8, users: 24, expiring: 15 });
  const [metrics, setMetrics] = useState({ totalQuantity: 20, monthlyPurchases: 0, monthlyPurchasesPrev: 0, codesTotal: 156, codesReady: 0, assetTypes: 0 });
  const [firstName, setFirstName] = useState<string>("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [role, setRole] = useState<string>("");
  const [ticketSummary, setTicketSummary] = useState<TicketSummary>(emptyTicketSummary);
  const [ticketMonthlyTrend, setTicketMonthlyTrend] = useState<Array<{ month: string; created: number; resolved: number }>>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<string>("");
  const [loadingUI, setLoadingUI] = useState(true);

  const isAdmin = role === 'admin';
  const resolvedTotal = ticketSummary.resolved + ticketSummary.closed;
  const completionRate = ticketSummary.total ? Math.round((resolvedTotal / ticketSummary.total) * 100) : 0;
  const assignmentShare = ticketSummary.total ? Math.round((ticketSummary.assignedToMe / ticketSummary.total) * 100) : 0;
  const backlogActive = ticketSummary.open + ticketSummary.inProgress;
  const monthlyChange = describeMonthlyChange(metrics.monthlyPurchases, metrics.monthlyPurchasesPrev);

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

  const averageResolutionLabel = ticketSummary.averageResolutionHours !== null
    ? `${ticketSummary.averageResolutionHours.toFixed(1)}h`
    : 'Collecting data';
  const backlogLabel = `${ticketSummary.open.toLocaleString()} open • ${ticketSummary.inProgress.toLocaleString()} in progress`;

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

      setTicketSummary({
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
      });
      setTicketMonthlyTrend(
        Array.from(buckets.values())
          .sort((a, b) => a.start - b.start)
          .map((bucket) => ({ month: bucket.month, created: bucket.created, resolved: bucket.resolved }))
      );
    };

    const seedDemo = async () => {
      try {
        const s = demoStats();
        setCounts(s.counts);
        setMetrics(s.metrics);
      } catch {
        setCounts({ assets: 0, properties: 0, users: 0, expiring: 0 });
      }
      try {
        const [demoUsers, demoTickets] = await Promise.all([
          listUsers().catch(() => [] as AppUser[]),
          listTickets().catch(() => [] as Ticket[]),
        ]);
        hydrateTicketInsights(demoTickets, demoUsers);
      } catch {
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
      setLoadingUI(false);
      return;
    }

    (async () => {
      try {
        const uiTimer = setTimeout(() => setLoadingUI(true), 100); // ensure skeleton visible if slow
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

        const expiringSoon = assets.filter((a) => {
          if (!a.expiryDate) return false;
          const d = new Date(a.expiryDate);
          const now = new Date();
          const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return diff >= 0 && diff <= 30;
        }).length;
        setCounts({ assets: assets.length, properties: properties.length, users: users.length, expiring: expiringSoon });

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
        setMetrics({ totalQuantity, monthlyPurchases, monthlyPurchasesPrev, codesTotal, codesReady, assetTypes });

        hydrateTicketInsights(ticketsScoped, users);

        clearTimeout(uiTimer);
        setLoadingUI(false);
      } catch (e) {
        console.error(e);
        setTicketSummary(emptyTicketSummary);
        setTicketMonthlyTrend([]);
        setLoadingUI(false);
      }
    })();
  }, []);

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
    created: "hsl(217 91% 60%)",
    resolved: "hsl(142 76% 40%)",
    backlog: "hsl(38 92% 50%)",
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="space-y-6 rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {`Welcome back${firstName ? `, ${firstName}` : ""}`}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Monitor portfolio health, triage tickets, and keep assets up to date from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleQuickAction("Add Asset")} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction("Generate Report")} className="gap-2">
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
            <Button variant="ghost" onClick={() => handleQuickAction("Bulk Import")} className="hidden gap-2 px-3 sm:inline-flex">
              <Download className="h-4 w-4" />
              Bulk Import
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {heroHighlights.map((item) => (
            <Card key={item.key} className="border border-border/50 bg-background/90 shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <item.icon className={`h-4 w-4 ${item.iconClass}`} />
                  <span>{item.title}</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight">{item.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{item.caption}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Asset Quantity
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight">
              {metrics.totalQuantity.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {counts.assets.toLocaleString()} assets
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Purchases
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold tracking-tight">
              {metrics.monthlyPurchases.toLocaleString()}
            </div>
            <Badge
              variant="outline"
              className={`w-fit border-transparent ${monthlyChange.isPositive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-200"}`}
            >
              {monthlyChange.label}
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              QR Codes Generated
            </CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight">
              {metrics.codesTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for print: {metrics.codesReady.toLocaleString()}
            </p>
          </CardContent>
        </Card>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(148, 163, 184, 0.6)" tickLine={false} />
                  <YAxis allowDecimals={false} stroke="rgba(148, 163, 184, 0.6)" tickLine={false} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
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

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <DashboardCharts />
        </div>
        <div className="space-y-4">
          <RecentActivity />
          <MyAudits />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Assets</DialogTitle>
            <DialogDescription>
              Download the Excel template, fill in asset rows, then upload to import. IDs are generated automatically based on Item Type + Property code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => { await downloadAssetTemplate(); }} className="gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                Select File
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImporting(true);
                try {
                    const res = await importAssetsFromFile(file);
                    setLastImportSummary(`Inserted: ${res.inserted}, Skipped: ${res.skipped}${res.errors.length ? `, Errors: ${res.errors.length}` : ''}`);
                    if (res.errors.length) {
                      console.warn("Import errors", res.errors);
                    }
                    toast.success(`Imported ${res.inserted} asset(s)`);
                    if (hasSupabaseEnv) {
                      try {
                        const assets = await listAssets();
                        setCounts((c) => ({ ...c, assets: assets.length }));
                        const totalQuantity = assets.reduce<number>((sum, a) => sum + (Number(a.quantity) || 0), 0);
                        setMetrics((m) => ({ ...m, totalQuantity }));
                      } catch {}
                    }
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Import failed";
                    toast.error(message);
                  } finally {
                    setImporting(false);
                  }
                }} />
            </div>
            {lastImportSummary && (
              <p className="text-xs text-muted-foreground">Last import: {lastImportSummary}</p>
            )}
            {!hasSupabaseEnv && (
              <p className="text-xs text-warning-foreground">Backend not connected. Import requires Supabase.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Close</Button>
            <Button disabled className="gap-2" variant="secondary">
              {importing ? "Importing..." : "Ready"}
            </Button>
          </DialogFooter>
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
