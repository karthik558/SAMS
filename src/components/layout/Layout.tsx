import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Package, QrCode, ScanLine, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const mobileNavItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Assets", path: "/assets", icon: Package },
    { label: "Scan", path: "/scan", icon: ScanLine },
    { label: "QR", path: "/qr-codes", icon: QrCode },
    { label: "Tickets", path: "/tickets", icon: Ticket },
  ] as const;

  return (
    <div className="flex h-dvh bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[85vw] sm:max-w-sm">
      <Sidebar isMobile onNavigate={() => setSidebarOpen(false)} className="w-full" />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/30">
          {children}
        </main>
        {/* Mobile bottom tab bar */}
        {isMobile && (
          <nav className="sticky bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex max-w-2xl items-center px-2">
              {mobileNavItems.map((item) => {
                const active = pathname === item.path || pathname.startsWith(item.path + "/");
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={cn(
                      "relative flex flex-1 select-none flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                      "text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-background",
                      active
                        ? "text-primary"
                        : "hover:text-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={cn("h-5 w-5 transition", active ? "text-primary" : "text-muted-foreground/80")} />
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "pointer-events-none absolute -bottom-[2px] left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-primary transition-all duration-200",
                        active ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
