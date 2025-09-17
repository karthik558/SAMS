import { useEffect, useState } from "react";
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
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { listTickets } from "@/services/tickets";
import { listApprovals } from "@/services/approvals";
import { listNewsletterPosts, type NewsletterPost } from "@/services/newsletter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isAuditActive, getActiveSession, getAssignment } from "@/services/audit";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from "@/services/permissions";

const baseNav = [
  // Requested order
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { name: "QR Codes", href: "/qr-codes", icon: QrCode },
  { name: "Scan QR", href: "/scan", icon: ScanLine }, // distinct icon from QR Codes
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Audit", href: "/audit", icon: ClipboardCheck },
  { name: "Tickets", href: "/tickets", icon: Ticket },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
] as const;

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ className, isMobile, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }>>({} as any);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [userDept, setUserDept] = useState<string>("");
  const [auditActive, setAuditActive] = useState<boolean>(false);
  const [hasAuditReports, setHasAuditReports] = useState<boolean>(false);
  const [auditPendingCount, setAuditPendingCount] = useState<number>(0);
  const [ticketNewCount, setTicketNewCount] = useState<number>(0);
  const [ticketPendingCount, setTicketPendingCount] = useState<number>(0);
  const [news, setNews] = useState<NewsletterPost[]>([]);
  const [newsOpen, setNewsOpen] = useState(false);
  // Category badge helpers (match defaults in service/SQL seed)
  const categoryLabel: Record<string, string> = {
    bug: 'Bug',
    api_down: 'API Down',
    fixed: 'Fixed',
    resolved: 'Resolved',
    maintenance: 'Maintenance',
    update: 'Update',
  };
  const hueBadge = (hue: string) => {
    switch ((hue||'').toLowerCase()) {
      case 'red': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800';
      case 'emerald': return 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800';
      case 'amber': return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800';
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800';
      case 'sky': return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800';
      case 'zinc': return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';
      default: return 'bg-muted text-foreground';
    }
  };
  const hueForCategory: Record<string, string> = {
    bug: 'red', api_down: 'red', fixed: 'emerald', resolved: 'emerald', maintenance: 'amber', update: 'blue'
  };
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

  // Load latest newsletter post (visible to all)
  useEffect(() => {
    (async () => {
      try {
        const posts = await listNewsletterPosts(1);
        setNews(posts);
      } catch { setNews([]); }
    })();
  }, [location.pathname]);

  // Load current user's pending approvals count
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem('auth_user');
        let dept: string | null = null;
        let role: string = '';
        if (raw) { const u = JSON.parse(raw); dept = u?.department || null; role = (u?.role || '').toLowerCase(); }
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
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">SAMS{isDemoMode() ? ' • Demo' : ''}</span>
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
          {(() => {
            let role: string = "";
            try {
              if (isDemoMode()) {
                const raw = sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user');
                role = raw ? (JSON.parse(raw).role || "") : "";
              } else {
                const raw = localStorage.getItem("auth_user");
                role = raw ? (JSON.parse(raw).role || "") : "";
              }
            } catch {}
            const r = isDemoMode() ? (role ? role.toLowerCase() : 'admin') : role.toLowerCase();
            // Merge role defaults with any stored overrides for this user
            const effective = mergeDefaultsWithOverrides(r, (perm || {}) as any);
            const pageNameToKey: Record<string, PageKey | null> = {
              Dashboard: null,
              Assets: "assets",
              Properties: "properties",
              "QR Codes": "qrcodes",
              Approvals: null, // gated by role below
              "Scan QR": null, // always visible per requirement
              Tickets: null, // visible to all roles
              Reports: "reports",
              Audit: "audit",
              Users: "users",
              Settings: "settings",
            } as const;
            const nav = baseNav.filter((item) => {
              // Always visible
              if (item.name === "Dashboard" || item.name === "Scan QR" || item.name === "Tickets") return true;
              // Approvals visible only to admin/manager
              if (item.name === "Approvals") return r === "admin" || r === "manager";
              // Audit: admins always see (control page); managers see when an audit is active OR if there are reports; anyone with explicit permission sees
              if (item.name === "Audit") {
                const rule = (effective as any)['audit'];
                return r === 'admin' || ((auditActive || hasAuditReports) && r === 'manager') || !!rule?.v;
              }
              // Items governed by permissions
              const key = pageNameToKey[item.name];
              if (!key) return true;
              const rule = (effective as any)[key as PageKey];
              return !!rule?.v;
            });
            return nav.map((item) => {
              const href = (() => {
                if (!isDemoMode()) return item.href;
                if (item.href === "/") return "/demo";
                // Keep Scan QR as public route
                if (item.href === "/scan") return "/scan";
                return `/demo${item.href}`;
              })();
              const isActive = location.pathname === href || location.pathname.startsWith(href + "/");
              return (
                <NavLink
                  key={item.name}
                  to={href}
                  className={cn(
                    "group/nav flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                    collapsed ? "justify-center" : "justify-start",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-ring/30 dark:bg-sidebar-primary/25 dark:text-foreground dark:ring-sidebar-ring/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70 hover:shadow-sm hover:ring-1 hover:ring-sidebar-ring/20 dark:hover:bg-sidebar-accent/60"
                  )}
                  onClick={onNavigate}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {!collapsed && (
                    <span className="truncate flex items-center gap-2">
                      {item.name}
                      {item.name === "Approvals" && pendingApprovals > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                          {pendingApprovals}
                        </span>
                      )}
                      {item.name === "Audit" && auditPendingCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                          {auditPendingCount}
                        </span>
                      )}
                      {item.name === "Tickets" && ticketNewCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                          {ticketNewCount}
                        </span>
                      )}
                      {item.name === "Tickets" && ticketPendingCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                          {ticketPendingCount}
                        </span>
                      )}
                    </span>
                  )}
                </NavLink>
              );
            });
          })()}
        </nav>

        {/* Newsletter / Announcements */}
        <div className="border-t border-border/60 bg-sidebar p-4 dark:border-border dark:bg-transparent">
          {!collapsed && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Announcement</div>
              {news.length === 0 ? (
                <div className="text-xs text-muted-foreground">No announcements</div>
              ) : (
                (() => {
                  const n = news[0];
                  return (
                    <div
                      className="group block rounded-xl border border-sidebar-border/60 bg-card p-3 shadow-sm transition hover:border-sidebar-border hover:shadow-md dark:border-border/60 dark:bg-card/60"
                      onClick={() => setNewsOpen(true)}
                      role="button"
                      aria-label="Open latest announcement"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-md bg-primary/10 p-1 text-primary">
                          <Megaphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${hueBadge(hueForCategory[(n as any).category || 'update'] || 'blue')}`}>
                              {categoryLabel[(n as any).category || 'update'] || 'Update'}
                            </span>
                            <div className="text-[12px] font-medium text-foreground truncate" title={n.title}>{n.title}</div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                            {n.body}
                          </div>
                          <div className="mt-0.5 text-[11px] text-primary group-hover:underline">Read more →</div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
              <div className="flex justify-end">
                <NavLink
                  to={isDemoMode() ? "/demo/newsletter" : "/newsletter"}
                  className="text-[11px] text-primary hover:underline"
                  onClick={onNavigate}
                >
                  View all updates
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* Full announcement modal */}
        <Dialog open={newsOpen} onOpenChange={setNewsOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${hueBadge(hueForCategory[(news[0] as any)?.category || 'update'] || 'blue')}`}>
                  {categoryLabel[(news[0] as any)?.category || 'update'] || 'Update'}
                </span>
                <DialogTitle className="leading-tight">{news[0]?.title || 'Announcement'}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{news[0] ? new Date(news[0].created_at).toLocaleString() : ''} {news[0]?.author ? `• ${news[0]?.author}` : ''}</div>
              <div className="text-sm whitespace-pre-wrap">{news[0]?.body || ''}</div>
              <div className="pt-1 text-right">
                <NavLink to={isDemoMode() ? '/demo/newsletter' : '/newsletter'} className="text-xs text-primary hover:underline" onClick={() => setNewsOpen(false)}>Open updates page →</NavLink>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
