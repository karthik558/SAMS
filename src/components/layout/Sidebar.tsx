import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
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
  LifeBuoy,
  Megaphone,
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
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { playNotificationSound } from "@/lib/sound";

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
  { name: "Help Center", href: "/help", icon: LifeBuoy },
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
  destructive: "border border-destructive/60 bg-destructive text-destructive-foreground shadow-sm dark:bg-destructive/80",
  warning: "border border-warning/60 bg-warning text-warning-foreground shadow-sm dark:bg-warning/80",
  primary: "border border-primary/50 bg-primary text-primary-foreground shadow-sm dark:bg-primary/80",
  muted: "border border-border/60 bg-muted/70 text-foreground shadow-sm dark:bg-sidebar-accent dark:text-foreground",
};

const navGroupBlueprint: Array<{ key: string; title: string; items: string[] }> = [
  { key: "workspace", title: "Workspace", items: ["Dashboard", "Properties", "Assets", "Scan QR"] },
  { key: "operations", title: "Operations", items: ["Approvals", "Tickets", "Help Center", "QR Codes", "Newsletter"] },
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
  "Help Center": null,
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
  const [showHelpCenter, setShowHelpCenter] = useState<boolean>(true);
  const homeHref = isDemoMode() ? "/demo" : "/";
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const pref = await getUserPreferences(uid);
        setShowNewsletter(!!pref.show_newsletter);
        setShowHelpCenter(pref.show_help_center !== false);
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
      working.splice(insertAt, 0, { name: "Newsletter", href: "/newsletter", icon: Megaphone });
    }
    if (!showHelpCenter) {
      const idx = working.findIndex((item) => item.name === "Help Center");
      if (idx >= 0) working.splice(idx, 1);
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
    showHelpCenter,
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
      if (detail && typeof detail.show_help_center === "boolean") {
        setShowHelpCenter(detail.show_help_center);
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

  const loadPendingApprovals = useCallback(
    async (opts?: { force?: boolean; roleOverride?: string; deptOverride?: string | null }) => {
      const roleRaw = opts?.roleOverride ?? (role || "");
      const roleValue = roleRaw.toLowerCase();
      const deptRaw = opts?.deptOverride ?? userDept;
      const deptValue = (deptRaw || "").toString().trim();
      try {
        if (roleValue === "admin") {
          const list = await listApprovals("pending_admin", undefined, undefined, undefined, { force: opts?.force });
          setPendingApprovals(list.length);
        } else if (roleValue === "manager") {
          if (!deptValue) {
            setPendingApprovals(0);
            return;
          }
          const list = await listApprovals("pending_manager", deptValue, undefined, undefined, { force: opts?.force });
          const deptLower = deptValue.toLowerCase();
          const count = list.filter(a => (a.department || '').toLowerCase() === deptLower).length;
          setPendingApprovals(count);
        } else {
          setPendingApprovals(0);
        }
      } catch {
        setPendingApprovals(0);
      }
    },
    [role, userDept]
  );

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
        let roleValue: string = '';
        if (raw) {
          const u = JSON.parse(raw);
          dept = u?.department || null;
          roleValue = (u?.role || '').toLowerCase();
          setUserName((u?.name || u?.email || "User") as string);
        } else {
          setUserName("User");
        }
        setRole(roleValue);
        setUserDept((dept || '').toLowerCase());
        await loadPendingApprovals({ roleOverride: roleValue, deptOverride: dept, force: true });
      } catch {
        setPendingApprovals(0);
      }
    })();
  }, [location.pathname, loadPendingApprovals]);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const roleValue = (role || "").toLowerCase();
    if (roleValue !== "admin" && roleValue !== "manager") return;
    const deptLower = (userDept || "").toLowerCase();
    if (roleValue === "manager" && !deptLower) return;

    const channel = supabase
      .channel(`approvals_sidebar_${roleValue}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, (payload) => {
        const relevant = (record: any) => {
          if (!record) return false;
          const status = String(record.status || "").toLowerCase();
          if (roleValue === "admin") {
            return status === "pending_admin";
          }
          if (roleValue === "manager") {
            const recDept = String(record.department || "").toLowerCase();
            return status === "pending_manager" && recDept === deptLower;
          }
          return false;
        };
        const before = relevant(payload?.old);
        const after = relevant(payload?.new);
        if (before === after) return;
        if (!before && after) {
          try { playNotificationSound(); } catch {}
        }
        loadPendingApprovals({ force: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, userDept, loadPendingApprovals]);

  
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
  if (isMobile) {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground", className)}>
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-background via-background to-primary/10">
          <div className="relative px-5 pt-6 pb-5 text-foreground">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link
                  to={homeHref}
                  className="inline-flex items-center justify-center"
                  aria-label="Go to dashboard"
                >
                  <img src="/sams_logo.png" alt="SAMS" className="h-10 w-auto" />
                </Link>
                <div className="flex flex-col max-w-[128px] leading-tight">
                  {firstName ? (
                    <>
                      <span className="text-sm font-semibold text-foreground">{firstName},</span>
                      <span className="text-xs font-medium text-muted-foreground">welcome back</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground">Welcome back</span>
                      <span className="text-xs font-medium text-muted-foreground">to SAMS</span>
                    </>
                  )}
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
            <Link
              to={homeHref}
              className="inline-flex items-center"
              aria-label="Go to dashboard"
            >
              <img src="/sams_logo.png" alt="SAMS" className="h-9 w-auto" />
            </Link>
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
