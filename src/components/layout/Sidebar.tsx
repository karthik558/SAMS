import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Building2,
  FileBarChart,
  ClipboardCheck,
  QrCode,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Ticket,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { listTickets } from "@/services/tickets";
import { listApprovals } from "@/services/approvals";
import { isAuditActive, getActiveSession, getAssignment } from "@/services/audit";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from "@/services/permissions";
import { getUserPreferences } from "@/services/userPreferences";

// Use a non-const assertion for dynamic injection (e.g., Newsletter)
type NavItem = { name: string; href: string; icon: any };
const baseNav: NavItem[] = [
  // Requested order
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { name: "QR Codes", href: "/qr-codes", icon: QrCode },
  { name: "Scan QR", href: "/scan", icon: ScanLine }, // distinct icon from QR Codes
  { name: "Reports", href: "/reports", icon: FileBarChart },
  // Newsletter is injected conditionally later based on user preferences
  { name: "Audit", href: "/audit", icon: ClipboardCheck },
  { name: "Tickets", href: "/tickets", icon: Ticket },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "License", href: "/license", icon: ShieldCheck },
];

type BadgeTone = "destructive" | "warning" | "primary" | "muted";

type SidebarEntry = NavItem & {
  href: string;
  isActive: boolean;
  badges: Array<{ value: string; tone: BadgeTone }>;
};

const badgeToneClasses: Record<BadgeTone, string> = {
  destructive: "border border-destructive/35 bg-destructive/10 text-destructive",
  warning: "border border-warning/40 bg-warning/10 text-warning",
  primary: "border border-primary/35 bg-primary/10 text-primary",
  muted: "border border-border/50 bg-muted/40 text-muted-foreground",
};

const navGroupBlueprint: Array<{ key: string; title: string; items: string[] }> = [
  { key: "workspace", title: "Workspace", items: ["Dashboard", "Properties", "Assets", "Scan QR"] },
  { key: "operations", title: "Operations", items: ["Approvals", "Tickets", "QR Codes", "Newsletter"] },
  { key: "insights", title: "Insights", items: ["Reports", "Audit"] },
  { key: "administration", title: "Administration", items: ["Users", "Settings", "License"] },
];

const pageNameToKey: Record<string, PageKey | null> = {
  Dashboard: null,
  Assets: "assets",
  Properties: "properties",
  "QR Codes": "qrcodes",
  Approvals: null,
  "Scan QR": null,
  Tickets: null,
  Reports: "reports",
  Audit: "audit",
  Users: "users",
  Settings: "settings",
  License: null,
  Newsletter: null,
} as const;

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ className, isMobile, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const location = useLocation();
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }>>({} as any);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [userDept, setUserDept] = useState<string>("");
  const [auditActive, setAuditActive] = useState<boolean>(false);
  const [hasAuditReports, setHasAuditReports] = useState<boolean>(false);
  const [auditPendingCount, setAuditPendingCount] = useState<number>(0);
  const [ticketNewCount, setTicketNewCount] = useState<number>(0);
  const [ticketPendingCount, setTicketPendingCount] = useState<number>(0);
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showNewsletter, setShowNewsletter] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const pref = await getUserPreferences(uid);
        setShowNewsletter(!!pref.show_newsletter);
        if (pref.compact_mode || pref.density === 'compact' || pref.density === 'ultra') {
          try { document.documentElement.classList.add('compact-ui'); if (pref.density === 'ultra') document.documentElement.classList.add('ultra-ui'); } catch {}
        }
        if (pref.sidebar_collapsed && !isMobile) setCollapsed(true);
      } catch {}
    })();
  }, [isMobile]);

  // Detect tablet viewport and collapse by default when entering tablet range
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023.98px)');
    const apply = () => {
      const tablet = mql.matches;
      // When entering tablet range, default to collapsed (but allow manual expand afterward)
      if (tablet && !isTablet) {
        setCollapsed(true);
      }
      setIsTablet(tablet);
    };
    try { mql.addEventListener('change', apply); } catch { mql.addListener(apply); }
    // Initialize on mount
    apply();
    return () => { try { mql.removeEventListener('change', apply); } catch { mql.removeListener(apply); } };
  }, [isTablet]);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const p = await listUserPermissions(uid);
        setPerm(p as any);
      } catch {}
    })();
  }, []);

  // Check whether an audit session is active and if the current user needs to act
  useEffect(() => {
    (async () => {
      let active = false;
      try { active = await isAuditActive(); setAuditActive(active); } catch { active = false; setAuditActive(false); }
      try { setHasAuditReports(localStorage.getItem('has_audit_reports') === '1'); } catch {}
      // Determine if the user (manager) has a pending assignment for the active session
      try {
        if (!active) { setAuditPendingCount(0); return; }
        let role = ""; let dept = "";
        try {
          const raw = localStorage.getItem('auth_user');
          if (raw) { const u = JSON.parse(raw); role = (u?.role || '').toLowerCase(); dept = (u?.department || '') || ''; }
        } catch {}
        if (role !== 'manager' || !dept) { setAuditPendingCount(0); return; }
        const sess = await getActiveSession();
        if (!sess?.id) { setAuditPendingCount(0); return; }
        const asg = await getAssignment(sess.id, dept);
        const pending = (((asg as any)?.status || 'pending') !== 'submitted');
        setAuditPendingCount(pending ? 1 : 0);
      } catch {
        setAuditPendingCount(0);
      }
    })();
  }, [location.pathname]);

  const navEntries = useMemo<SidebarEntry[]>(() => {
    const demo = isDemoMode();
    let resolvedRole = (role || "").toLowerCase();
    if (!resolvedRole) {
      try {
        const raw = demo
          ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user")
          : localStorage.getItem("auth_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          resolvedRole = (parsed?.role || "").toLowerCase();
        }
      } catch {
        resolvedRole = "";
      }
    }
    const roleForPerm = demo ? resolvedRole || "admin" : resolvedRole;
    const effective = mergeDefaultsWithOverrides(roleForPerm, (perm || {}) as any);

    const working = [...baseNav];
    if (showNewsletter && !working.find((item) => item.name === "Newsletter")) {
      const idx = working.findIndex((item) => item.name === "Reports");
      const insertAt = idx >= 0 ? idx : working.length - 1;
      working.splice(insertAt, 0, { name: "Newsletter", href: "/newsletter", icon: FileBarChart });
    }

    const filtered = working.filter((item) => {
      // Demo mode hides certain routes
      if (demo && (item.name === "Audit" || item.name === "License")) return false;
      if (item.name === "Dashboard" || item.name === "Scan QR" || item.name === "Tickets") return true;
      if (item.name === "Newsletter") return showNewsletter;
      if (item.name === "Approvals") return roleForPerm === "admin" || roleForPerm === "manager";
      if (item.name === "License") return roleForPerm === "admin";
      if (item.name === "Audit") {
        const rule = (effective as any)["audit"];
        return (
          roleForPerm === "admin" ||
          ((auditActive || hasAuditReports) && roleForPerm === "manager") ||
          !!rule?.v
        );
      }
      const key = pageNameToKey[item.name];
      if (!key) return true;
      const rule = (effective as any)[key as PageKey];
      return !!rule?.v;
    });

    return filtered.map<SidebarEntry>((item) => {
      const href = (() => {
        if (!demo) return item.href;
        if (item.href === "/") return "/demo";
        if (item.href === "/scan") return "/scan";
        return `/demo${item.href}`;
      })();

      const isActive =
        location.pathname === href ||
        (href !== "/" && location.pathname.startsWith(`${href}/`));

      const badges: SidebarEntry["badges"] = [];
      if (item.name === "Approvals" && pendingApprovals > 0) {
        badges.push({ value: String(pendingApprovals), tone: "destructive" });
      }
      if (item.name === "Audit" && auditPendingCount > 0) {
        badges.push({ value: String(auditPendingCount), tone: "destructive" });
      }
      if (item.name === "Tickets") {
        if (ticketNewCount > 0) badges.push({ value: String(ticketNewCount), tone: "destructive" });
        if (ticketPendingCount > 0) badges.push({ value: String(ticketPendingCount), tone: "warning" });
      }

      return { ...item, href, isActive, badges };
    });
  }, [
    role,
    perm,
    showNewsletter,
    auditActive,
    hasAuditReports,
    pendingApprovals,
    auditPendingCount,
    ticketNewCount,
    ticketPendingCount,
    location.pathname,
  ]);

  const groupedNav = useMemo(() => {
    const used = new Set<string>();
    const groups = navGroupBlueprint
      .map((group) => {
        const items = navEntries.filter((entry) => group.items.includes(entry.name));
        items.forEach((item) => used.add(item.name));
        return items.length ? { ...group, items } : null;
      })
      .filter((group): group is { key: string; title: string; items: SidebarEntry[] } => Boolean(group));

    const leftovers = navEntries.filter((entry) => !used.has(entry.name));
    if (leftovers.length) {
      groups.push({ key: "more", title: "More", items: leftovers });
    }
    return groups;
  }, [navEntries]);

  useEffect(() => {
    const applyPatch = (detail: any) => {
      if (detail && typeof detail.show_newsletter === "boolean") {
        setShowNewsletter(detail.show_newsletter);
      }
      if (detail && typeof detail.sidebar_collapsed === "boolean" && !isMobile) {
        setCollapsed(detail.sidebar_collapsed);
      }
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key === "user_preferences_patch") {
        try {
          const payload = JSON.parse(event.newValue || "{}") || {};
          applyPatch(payload);
        } catch {}
      }
    };
    const customHandler = (event: Event) => {
      try {
        const payload = (event as CustomEvent).detail || {};
        applyPatch(payload);
      } catch {}
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("user-preferences-changed", customHandler as any);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("user-preferences-changed", customHandler as any);
    };
  }, [isMobile]);

  const firstName = useMemo(() => {
    if (!userName) return "";
    const parts = userName.trim().split(/\s+/);
    return parts[0] || userName;
  }, [userName]);

  if (isMobile) {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground", className)}>
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-background to-primary/10">
          <div className="relative px-5 pt-6 pb-5 text-foreground">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-soft">
                  <img src="/favicon.png" alt="SAMS" className="h-8 w-8 object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold uppercase tracking-[0.28em] text-muted-foreground/80">
                    SAMS{isDemoMode() ? " • Demo" : ""}
                  </span>
                  <span className="text-base font-semibold leading-tight">
                    {firstName ? `${firstName}, welcome back` : "Welcome back"}
                  </span>
                </div>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm transition hover:bg-background"
                  aria-label="Close navigation"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </SheetClose>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {groupedNav.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                {group.title}
              </p>
              <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-soft">
                {group.items.map((entry, idx) => (
                  <NavLink
                    key={entry.name}
                    to={entry.href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200",
                      entry.isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-primary/5 hover:text-primary",
                      idx !== group.items.length - 1 ? "border-b border-border/60" : ""
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/40 text-primary">
                      <entry.icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="flex items-center gap-2">
                        {entry.badges.map((badge) => (
                          <span
                            key={`${entry.name}-${badge.value}-${badge.tone}`}
                            className={cn(
                              "inline-flex min-w-[26px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                              badgeToneClasses[badge.tone]
                            )}
                          >
                            {badge.value}
                          </span>
                        ))}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                      </span>
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60 px-4 py-5">
          <p className="text-xs text-muted-foreground">
            © 2025 SAMS. All rights reserved.
          </p>
        </div>
      </div>
    );
  }


  // Load current user's pending approvals count
  useEffect(() => {
    (async () => {
      try {
        let raw: string | null = null;
        if (isDemoMode()) {
          raw = sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user');
        }
        if (!raw) {
          raw = localStorage.getItem('auth_user');
        }
        let dept: string | null = null;
        let role: string = '';
        if (raw) {
          const u = JSON.parse(raw);
          dept = u?.department || null;
          role = (u?.role || '').toLowerCase();
          setUserName((u?.name || u?.email || "User") as string);
        } else {
          setUserName("User");
        }
        setRole(role);
        setUserDept((dept || '').toLowerCase());
        if (role === 'admin') {
          // Admin sees all pending_admin approvals
          const list = await listApprovals();
          setPendingApprovals(list.filter(a => a.status === 'pending_admin').length);
        } else if (role === 'manager') {
          // Manager sees pending_manager for their department
          if (dept && String(dept).trim().length) {
            const list = await listApprovals(undefined, dept);
            setPendingApprovals(list.filter(a => a.status === 'pending_manager').length);
          } else {
            setPendingApprovals(0);
          }
        } else {
          // Users: no global badge
          setPendingApprovals(0);
        }
      } catch {}
    })();
  }, [location.pathname]);

  // Load ticket badges: red = new open for my role; yellow = assigned to me and in progress/resolved
  useEffect(() => {
    (async () => {
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        const u = raw ? JSON.parse(raw) : null;
        const role = ((u?.role || '') as string).toLowerCase();
        const meId = u?.id as string | undefined;
        const meEmail = u?.email as string | undefined;
        // Red badge: open tickets for my role
        if (role === 'admin' || role === 'manager') {
          try {
            const roleTickets = await listTickets({ targetRole: role as any });
            const openCount = (roleTickets || []).filter(t => t.status === 'open').length;
            setTicketNewCount(openCount);
          } catch { setTicketNewCount(0); }
        } else {
          setTicketNewCount(0);
        }
        // Yellow badge: tickets assigned to me that are not closed and not open (i.e., in progress or awaiting resolution)
        const assignedLists: any[][] = [];
        try { if (meId) assignedLists.push(await listTickets({ assignee: meId })); } catch {}
        try { if (meEmail && meEmail !== meId) assignedLists.push(await listTickets({ assignee: meEmail })); } catch {}
        const seen = new Set<string>();
        const mine = assignedLists.flat().filter((t) => {
          if (!t?.id) return false;
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        const pendingMine = mine.filter(t => t.status === 'in_progress' || t.status === 'resolved');
        setTicketPendingCount(pendingMine.length);
      } catch {
        setTicketNewCount(0);
        setTicketPendingCount(0);
      }
    })();
  }, [location.pathname]);

  return (
    <div
      className={cn(
        "group/sidebar relative h-full overflow-hidden border-r border-border transition-[width] duration-300 ease-in-out",
        "bg-sidebar",
        isMobile ? "w-full" : collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <div className="flex h-14 md:h-16 items-center justify-between border-b border-border/60 bg-sidebar px-4">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <Package className="h-8 w-8 text-primary" />
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">SAMS{isDemoMode() ? ' • Demo' : ''}</span>
              </div>
            </div>
          )}
          {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 rounded-full border border-sidebar-border/60 bg-sidebar-accent p-0 text-muted-foreground shadow-sm transition hover:bg-sidebar-accent/80 hover:text-foreground dark:border-border/60 dark:bg-sidebar-accent/70"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navEntries.map((entry) => (
            <NavLink
              key={entry.name}
              to={entry.href}
              className={cn(
                "group/nav flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center" : "justify-start",
                entry.isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-ring/30 dark:bg-sidebar-primary/25 dark:text-foreground dark:ring-sidebar-ring/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 hover:shadow-sm hover:ring-1 hover:ring-sidebar-ring/20 dark:hover:bg-sidebar-accent/60"
              )}
              onClick={onNavigate}
            >
              <entry.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && (
                <span className="flex flex-1 items-center gap-2 truncate">
                  <span className="truncate">{entry.name}</span>
                  {entry.badges.map((badge) => (
                    <span
                      key={`${entry.name}-${badge.value}-${badge.tone}`}
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        badgeToneClasses[badge.tone]
                      )}
                    >
                      {badge.value}
                    </span>
                  ))}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {/* Footer */}
        <div className="border-t border-border/60 p-4">
          {!collapsed && (
            <div className="text-xs text-muted-foreground">
              <p>© 2025{" "}
                <a 
                  href="https://karthiklal.in" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  SAMS
                </a>
                . All rights reserved.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
