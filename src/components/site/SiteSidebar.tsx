import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Package, Home, Sparkles, Boxes, BadgeCheck, Users, Printer } from "lucide-react";

interface SiteSidebarProps {
  className?: string;
  isMobile?: boolean;
  onNavigate?: (href: string) => void;
}

const navItems = [
  { name: "Overview", href: "#overview", icon: Home },
  { name: "Key Capabilities", href: "#capabilities", icon: Sparkles },
  { name: "Modules", href: "#modules", icon: Boxes },
  { name: "Benefits", href: "#benefits", icon: BadgeCheck },
  { name: "Who It’s For", href: "#audience", icon: Users },
  { name: "Printing & Offline", href: "#printing-offline", icon: Printer },
] as const;

export function SiteSidebar({ className, isMobile, onNavigate }: SiteSidebarProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [activeHash, setActiveHash] = useState<string>(typeof window !== 'undefined' ? window.location.hash : "#overview");

  useEffect(() => {
    const handler = () => setActiveHash(window.location.hash || "#overview");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Intercept default to support smooth scroll inside the main container
    e.preventDefault();
    setActiveHash(href);
  onNavigate?.(href);
  };

  return (
    <aside
      ref={(el) => (rootRef.current = el)}
      className={cn(
  "bg-background border-border",
  isMobile ? "w-full border-b" : "h-dvh w-64 border-r",
        className
      )}
    >
      <div className={cn("flex flex-col", isMobile ? "" : "h-full")}>
        {/* Brand */}
        <div className={cn(
          "flex items-center gap-2 px-4 border-border",
          isMobile ? "h-12" : "h-14 md:h-16 border-b"
        )}>
          {isMobile ? (
            <img src="/favicon.png" alt="SAMS" className="h-6 w-6" />
          ) : (
            <>
              <Package className="h-6 w-6 text-primary" />
              <span className="text-base md:text-lg font-bold text-foreground">SAMS</span>
            </>
          )}
        </div>

        {/* Nav: hidden on mobile for minimal look */}
        {!isMobile && (
          <nav className={cn("p-2", "flex-1 overflow-auto")} aria-label="Site sections">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeHash === item.href || (!activeHash && item.href === "#overview");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={(e) => handleClick(e, item.href)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {!isMobile && (
          <div className="border-t border-border p-4 text-xs text-muted-foreground">
            <p>
              © 2025{" "}
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
    </aside>
  );
}
