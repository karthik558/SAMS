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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { listApprovals } from "@/services/approvals";
import { isAuditActive } from "@/services/audit";
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

  // Check whether an audit session is active
  useEffect(() => {
    (async () => {
      try { setAuditActive(await isAuditActive()); } catch { setAuditActive(false); }
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

  return (
    <div
      className={cn(
        "bg-background border-r border-border h-full transition-all duration-300 ease-in-out",
        isMobile ? "w-full" : collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-14 md:h-16 items-center justify-between px-4 border-b border-border">
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
            className="h-8 w-8 p-0"
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
        <nav className="flex-1 space-y-1 p-2">
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
              Users: "users",
              Settings: "settings",
            } as const;
            const nav = baseNav.filter((item) => {
              // Always visible
              if (item.name === "Dashboard" || item.name === "Scan QR" || item.name === "Tickets") return true;
              // Approvals visible only to admin/manager
              if (item.name === "Approvals") return r === "admin" || r === "manager";
              // Audit: admins always see (control page); managers see only when an audit is active
              if (item.name === "Audit") return r === 'admin' || (auditActive && r === 'manager');
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
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
                    </span>
                  )}
                </NavLink>
              );
            });
          })()}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
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