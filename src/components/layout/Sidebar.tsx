import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Building2,
  FileBarChart,
  QrCode,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const baseNav = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "QR Codes", href: "/qr-codes", icon: QrCode },
  { name: "Reports", href: "/reports", icon: FileBarChart },
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
              <span className="text-xl font-bold text-foreground">SAMS</span>
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
              const raw = localStorage.getItem("auth_user");
              role = raw ? (JSON.parse(raw).role || "") : "";
            } catch {}
            const r = role.toLowerCase();
            let nav: typeof baseNav extends ReadonlyArray<infer T> ? T[] : any[] = [...baseNav];
            if (r === "admin") {
              nav = [...baseNav];
            } else if (r === "manager") {
              nav = baseNav.filter(n => ["Dashboard","Assets","Properties","QR Codes","Reports","Settings"].includes(n.name));
            } else {
              // user
              nav = baseNav.filter(n => ["Dashboard","Assets","QR Codes","Settings"].includes(n.name));
            }
            return nav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={onNavigate}
              >
                <item.icon className="h-4 w-4 shrink-0" />
    {!collapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          }); })()}
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