import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  LogOut,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Moon,
  Sun,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { listTickets } from "@/services/tickets";
import { listApprovals } from "@/services/approvals";
import { listAssets, type Asset } from "@/services/assets";
import { isAuditActive, getActiveSession, getAssignment } from "@/services/audit";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from "@/services/permissions";
import { getUserPreferences, peekCachedUserPreferences, upsertUserPreferences } from "@/services/userPreferences";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { playNotificationSound } from "@/lib/sound";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { useSystemStatus } from "@/hooks/useSystemStatus";

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
  "System Status": null,
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
  const navigate = useNavigate();
  const cachedPrefs = useMemo(() => {
    try {
      const uid = getCurrentUserId();
      return peekCachedUserPreferences(uid);
    } catch {
      return null;
    }
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    } else {
      root.classList.remove("dark");
      try { localStorage.setItem("theme", "light"); } catch {}
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = stored ? stored === "dark" : prefersDark;
      setIsDark(dark);
      // Sync with class in case it changed elsewhere
      const root = document.documentElement;
      if (root.classList.contains('dark') !== dark) {
         if (dark) root.classList.add('dark'); else root.classList.remove('dark');
      }
    } catch {}
  }, []);

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
  const [showNewsletter, setShowNewsletter] = useState<boolean>(() => Boolean(cachedPrefs?.show_newsletter));
  const [showHelpCenter, setShowHelpCenter] = useState<boolean>(() => cachedPrefs?.show_help_center !== false);
  const allowedPropertyIdsRef = useRef<Set<string> | null>(null);
  const assetsByIdRef = useRef<Map<string, Asset> | null>(null);
  const homeHref = isDemoMode() ? "/demo" : "/";
  const { overallStatus } = useSystemStatus();
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
      if (opts?.force) {
        assetsByIdRef.current = null;
      }
      try {
        if (roleValue === "admin") {
          const [pendingMgr, pendingAdmin] = await Promise.all([
            listApprovals("pending_manager", undefined, undefined, undefined, { force: opts?.force }),
            listApprovals("pending_admin", undefined, undefined, undefined, { force: opts?.force }),
          ]);
          const seen = new Set<string>();
          pendingMgr.forEach((ap) => {
            if (ap?.id) seen.add(String(ap.id));
          });
          pendingAdmin.forEach((ap) => {
            if (ap?.id) seen.add(String(ap.id));
          });
          setPendingApprovals(seen.size);
        } else if (roleValue === "manager") {
          if (!deptValue) {
            setPendingApprovals(0);
            return;
          }
          const list = await listApprovals("pending_manager", deptValue, undefined, undefined, { force: opts?.force });
          let scoped = Array.isArray(list) ? [...list] : [];
          const deptLower = deptValue.toLowerCase();

          let allowed = allowedPropertyIdsRef.current;
          if (!allowed) {
            try {
              allowed = await getAccessiblePropertyIdsForCurrentUser();
            } catch {
              allowed = new Set<string>();
            }
            allowedPropertyIdsRef.current = allowed;
          }
          const normalizedAllowed = allowed ? new Set(Array.from(allowed).map((id) => String(id))) : new Set<string>();

          if (normalizedAllowed.size > 0) {
            let assetsById = assetsByIdRef.current;
            if (!assetsById) {
              try {
                const assets = await listAssets();
                const map = new Map<string, Asset>();
                for (const asset of assets as Asset[]) {
                  map.set(String(asset.id), asset);
                }
                assetsById = map;
                assetsByIdRef.current = map;
              } catch {
                assetsById = null;
              }
            }
            if (assetsById) {
              scoped = scoped.filter((ap) => {
                const asset = ap?.assetId ? assetsById?.get(String(ap.assetId)) : null;
                if (!asset) return false;
                const propId = String((asset as any).property_id || "").trim();
                if (propId) {
                  return normalizedAllowed.has(propId);
                }
                const propName = String((asset as any).property || "").toLowerCase();
                if (!propName) return false;
                for (const id of normalizedAllowed) {
                  if (String(id).toLowerCase() === propName) {
                    return true;
                  }
                }
                return false;
              });
            }
          }

          const count = scoped.filter((a) => (a.department || "").toLowerCase() === deptLower).length;
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
        allowedPropertyIdsRef.current = null;
        assetsByIdRef.current = null;
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
  const handleSignOut = () => {
    try {
      localStorage.removeItem('current_user_id');
      localStorage.removeItem('auth_user');
      if (isDemoMode()) {
        sessionStorage.removeItem('demo_current_user_id');
        sessionStorage.removeItem('demo_auth_user');
        localStorage.removeItem('demo_current_user_id');
        localStorage.removeItem('demo_auth_user');
      }
    } catch {}
    navigate(isDemoMode() ? '/demo/login' : '/login', { replace: true });
  };

  if (isMobile) {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground", className)}>
        <div className="relative overflow-hidden border-b border-sidebar-border bg-sidebar-accent/20">
          <div className="relative px-5 pt-6 pb-5 text-sidebar-foreground">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link
                  to={homeHref}
                  className="inline-flex items-center justify-center"
                  aria-label="Go to dashboard"
                >
                  <div 
                    className="h-10 w-32 bg-sidebar-primary transition-colors" 
                    style={{
                      maskImage: 'url("/sams_logo.png")',
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'left center',
                      WebkitMaskImage: 'url("/sams_logo.png")',
                      WebkitMaskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'left center'
                    }}
                  />
                </Link>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-sm transition hover:bg-sidebar-accent/80"
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
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/60">
                {group.title}
              </p>
              <div className="overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar-accent/10 shadow-sm">
                {group.items.map((entry, idx) => (
                  <NavLink
                    key={entry.name}
                    to={entry.href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200",
                      entry.isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      idx !== group.items.length - 1 ? "border-b border-sidebar-border/50" : ""
                    )}
                  >
                    <span className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors",
                      entry.isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-accent/50 text-sidebar-foreground"
                    )}>
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
                        <ChevronRight className="h-4 w-4 text-sidebar-foreground/40" />
                      </span>
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-sidebar-border px-4 py-5">
          <div className="mb-3">
            <Link to="/status" className="flex items-center justify-center gap-2 rounded-full bg-sidebar-accent/30 border border-sidebar-border py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <div className={cn("h-2 w-2 rounded-full animate-pulse", 
                overallStatus === 'operational' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : 
                overallStatus === 'degraded' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              )} />
              <span>System {overallStatus === 'operational' ? 'Normal' : overallStatus === 'degraded' ? 'Degraded' : 'Outage'}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="group flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2 transition-colors hover:bg-sidebar-accent/50">
                  {(role || '').toLowerCase() === 'admin' ? (
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary p-0.5 shadow-sm">
                        <span className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-accent p-[1.5px]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">
                            <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                          </div>
                        </span>
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-sm ring-2 ring-sidebar">
                        <ShieldCheck className="h-2 w-2" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary ring-1 ring-sidebar-primary/20">
                      <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-xs font-semibold text-sidebar-foreground">{userName || 'User'}</span>
                    <span className="truncate text-[10px] text-sidebar-foreground/60 capitalize">{role || 'Guest'}</span>
                  </div>
                  <SettingsIcon className="ml-auto h-4 w-4 text-sidebar-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-56 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
              >
                <div className="p-1">
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-[50px] w-[50px] shrink-0 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
          <p className="text-xs text-center text-sidebar-foreground/50">
            © 2025 SAMS. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/sidebar relative h-full overflow-hidden border-r border-sidebar-border transition-[width] duration-300 ease-in-out",
        "bg-sidebar text-sidebar-foreground",
        isMobile ? "w-full" : collapsed ? "w-[70px]" : "w-72",
        className
      )}
    >
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 pt-2">
          {!collapsed && (
            <Link
              to={homeHref}
              className="inline-flex items-center pl-2"
              aria-label="Go to dashboard"
            >
              <div 
                className="h-10 w-40 bg-sidebar-primary transition-colors" 
                style={{
                  maskImage: 'url("/sams_logo.png")',
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'left center',
                  WebkitMaskImage: 'url("/sams_logo.png")',
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'left center'
                }}
              />
            </Link>
          )}
          {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newState = !collapsed;
              setCollapsed(newState);
              const uid = getCurrentUserId();
              if (uid) {
                upsertUserPreferences(uid, { sidebar_collapsed: newState });
              }
            }}
            className={cn(
              "h-8 w-8 rounded-lg p-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "mx-auto"
            )}
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
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6 scrollbar-none">
          {collapsed ? (
            // Collapsed View: Flat list of icons
            <div className="space-y-2">
              {navEntries.map((entry) => (
                <NavLink
                  key={entry.name}
                  to={entry.href}
                  className={cn(
                    "group/nav relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg transition-all duration-200",
                    entry.isActive
                      ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  onClick={onNavigate}
                  title={entry.name}
                >
                  <entry.icon className="h-5 w-5" strokeWidth={2} />
                  {entry.badges.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive ring-2 ring-sidebar">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ) : (
            // Expanded View: Grouped list
            groupedNav.map((group) => (
              <div key={group.key} className="space-y-1">
                <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
                  {group.title}
                </h4>
                <div className="space-y-1">
                  {group.items.map((entry) => (
                    <NavLink
                      key={entry.name}
                      to={entry.href}
                      className={cn(
                        "group/nav flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        entry.isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      onClick={onNavigate}
                    >
                      <entry.icon className={cn("h-4 w-4 shrink-0 transition-colors", entry.isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-foreground")} strokeWidth={2} />
                      <span className="flex flex-1 items-center justify-between truncate">
                        <span>{entry.name}</span>
                        {entry.badges.map((badge) => (
                          <span
                            key={`${entry.name}-${badge.value}-${badge.tone}`}
                            className={cn(
                              "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] font-bold ring-1 ring-inset",
                              badge.tone === 'destructive' ? "bg-red-500/10 text-red-600 ring-red-500/20 dark:bg-red-500/20 dark:text-red-400" :
                              badge.tone === 'warning' ? "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400" :
                              "bg-sidebar-accent text-sidebar-foreground ring-sidebar-border"
                            )}
                          >
                            {badge.value}
                          </span>
                        ))}
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Footer */}
        <div className={cn("p-4", collapsed ? "flex flex-col items-center gap-4" : "")}>
          {collapsed ? (
            <>
              <Link to="/status" className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent/30 border border-sidebar-border hover:bg-sidebar-accent transition-colors" title={`System ${overallStatus}`}>
                <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse", 
                  overallStatus === 'operational' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : 
                  overallStatus === 'degraded' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                  "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                )} />
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="cursor-pointer">
                    {(role || '').toLowerCase() === 'admin' ? (
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary p-0.5 shadow-sm">
                          <span className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-accent p-[1.5px]">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">
                              <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                            </div>
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary ring-1 ring-sidebar-primary/20">
                        <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-xl">
                  <div className="p-1">
                    <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-destructive focus:text-destructive">
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </>
          ) : (
            <>
            <div className="mb-3">
              <Link to="/status" className="flex items-center justify-center gap-2 rounded-full bg-sidebar-accent/30 border border-sidebar-border py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                <div className={cn("h-2 w-2 rounded-full animate-pulse", 
                  overallStatus === 'operational' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : 
                  overallStatus === 'degraded' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                  "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                )} />
                <span>System {overallStatus === 'operational' ? 'Normal' : overallStatus === 'degraded' ? 'Degraded' : 'Outage'}</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="group flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 transition-colors hover:bg-sidebar-accent/50">
                    {(role || '').toLowerCase() === 'admin' ? (
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary p-0.5 shadow-sm">
                          <span className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-accent p-[1.5px]">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary">
                              <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                            </div>
                          </span>
                        </span>
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-sm ring-2 ring-sidebar">
                          <ShieldCheck className="h-2 w-2" />
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary ring-1 ring-sidebar-primary/20">
                        <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-xs font-semibold text-sidebar-foreground">{userName || 'User'}</span>
                      <span className="truncate text-[10px] text-sidebar-foreground/60 capitalize">{role || 'Guest'}</span>
                    </div>
                    <SettingsIcon className="ml-auto h-4 w-4 text-sidebar-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  className="w-56 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
                >
                  <div className="p-1">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-[58px] w-[58px] shrink-0 rounded-xl border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
            <p className="mt-4 text-xs text-center text-sidebar-foreground/50">
              © 2025 SAMS. All rights reserved.
            </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
