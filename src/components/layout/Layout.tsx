import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Package, QrCode, ScanLine, Ticket } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
          <nav className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="grid grid-cols-5 h-14">
              {[
                { label: 'Home', path: '/', icon: Home },
                { label: 'Assets', path: '/assets', icon: Package },
                { label: 'Scan', path: '/scan', icon: ScanLine },
                { label: 'QR', path: '/qr-codes', icon: QrCode },
                { label: 'Tickets', path: '/tickets', icon: Ticket },
              ].map((item) => {
                const active = pathname === item.path || pathname.startsWith(item.path + '/');
                return (
                  <button
                    key={item.path}
                    className={`flex flex-col items-center justify-center text-xs gap-1 ${active ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
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
