import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { TopNavBar } from "./TopNavBar";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserPreferences } from "@/services/userPreferences";
import { Home, Package, QrCode, ScanLine, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpGuideProvider } from "@/components/help/HelpGuideProvider";

interface LayoutProps {
  children: React.ReactNode;
}

const BASE_TITLE = "SAMS";
const ROUTE_TITLE_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/assets": "Assets",
  "/properties": "Properties",
  "/qr-codes": "QR Codes",
  "/approvals": "Approvals",
  "/tickets": "Tickets",
  "/newsletter": "Newsletter",
  "/help": "Help Center",
  "/reports": "Reports",
  "/audit": "Audit",
  "/users": "Users",
  "/settings": "Settings",
  "/license": "License",
};

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topNavMode, setTopNavMode] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const redirectedRef = useRef(false);

  // Load navigation layout preference & reactive updates when settings page toggles it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = localStorage.getItem("current_user_id");
        if (!uid) return;
        const prefs = await getUserPreferences(uid);
        if (!cancelled) setTopNavMode(!!prefs.top_nav_mode);
        // Apply some immediate UI classes on initial load
        try {
          const root = document.documentElement;
          if (prefs.sticky_header) root.classList.add('sticky-header'); else root.classList.remove('sticky-header');
          root.classList.remove('compact-ui');
          root.classList.remove('ultra-ui');
          if (prefs.density === 'compact') root.classList.add('compact-ui');
          else if (prefs.density === 'ultra') { root.classList.add('compact-ui'); root.classList.add('ultra-ui'); }
          if (prefs.auto_theme) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const apply = () => { if (mq.matches) root.classList.add('dark'); else root.classList.remove('dark'); };
            apply();
          }
        } catch {}
      } catch {}
    })();
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'user_preferences_patch') { // lightweight broadcast channel via localStorage event
        try {
          const data = JSON.parse(e.newValue || '{}');
          if (typeof data.top_nav_mode === 'boolean') setTopNavMode(data.top_nav_mode);
          // Apply classes dynamically
          const root = document.documentElement;
          if (typeof data.sticky_header === 'boolean') {
            if (data.sticky_header) root.classList.add('sticky-header'); else root.classList.remove('sticky-header');
          }
          if (typeof data.density === 'string') {
            root.classList.remove('compact-ui');
            root.classList.remove('ultra-ui');
            if (data.density === 'compact') root.classList.add('compact-ui');
            else if (data.density === 'ultra') { root.classList.add('compact-ui'); root.classList.add('ultra-ui'); }
          }
          if (typeof data.auto_theme === 'boolean' && data.auto_theme) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq.matches) root.classList.add('dark'); else root.classList.remove('dark');
          }
        } catch {}
      }
    };
    const sameTabHandler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail || {};
        if (typeof detail.top_nav_mode === 'boolean') setTopNavMode(detail.top_nav_mode);
        const root = document.documentElement;
        if (typeof detail.sticky_header === 'boolean') {
          if (detail.sticky_header) root.classList.add('sticky-header'); else root.classList.remove('sticky-header');
        }
        if (typeof detail.density === 'string') {
          root.classList.remove('compact-ui');
          root.classList.remove('ultra-ui');
          if (detail.density === 'compact') root.classList.add('compact-ui');
          else if (detail.density === 'ultra') { root.classList.add('compact-ui'); root.classList.add('ultra-ui'); }
        }
        if (typeof detail.auto_theme === 'boolean' && detail.auto_theme) {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          if (mq.matches) root.classList.add('dark'); else root.classList.remove('dark');
        }
      } catch {}
    };
    window.addEventListener('storage', storageHandler);
    window.addEventListener('user-preferences-changed', sameTabHandler as any);
    return () => { cancelled = true; window.removeEventListener('storage', storageHandler); window.removeEventListener('user-preferences-changed', sameTabHandler as any); };
  }, []);

  // Detect tablet viewport (>=768px and <1024px) so TopNav applies only on desktop
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023.98px)');
    const apply = () => setIsTablet(mql.matches);
    try { mql.addEventListener('change', apply); } catch { mql.addListener(apply); }
    apply();
    return () => { try { mql.removeEventListener('change', apply); } catch { mql.removeListener(apply); } };
  }, []);

  const effectiveTopNavMode = topNavMode && !isMobile && !isTablet;

  // Hard refresh default landing redirect
  useEffect(() => {
    if (redirectedRef.current) return; // run only once
    if (pathname !== "/") return; // only if we're at root/dashboard
    let authed = false;
    try { authed = Boolean(localStorage.getItem("current_user_id")); } catch {}
    if (!authed) return;
    (async () => {
      try {
        const uid = localStorage.getItem("current_user_id");
        if (!uid) return;
        const prefs = await getUserPreferences(uid);
        const rawTarget = prefs?.default_landing_page || "/";
        // Apply sticky header & auto theme early if preference set
        try {
          const root = document.documentElement;
            if (prefs.sticky_header) root.classList.add('sticky-header'); else root.classList.remove('sticky-header');
            if (prefs.auto_theme) {
              const mq = window.matchMedia('(prefers-color-scheme: dark)');
              const apply = () => { if (mq.matches) root.classList.add('dark'); else root.classList.remove('dark'); };
              apply();
              try { mq.addEventListener('change', apply); } catch { mq.addListener(apply); }
            }
        } catch {}
        if (!rawTarget || rawTarget === "/") return; // dashboard already
        // Validate and role gate approvals
        const allowed = new Set(["/","/assets","/properties","/tickets","/reports","/newsletter","/settings","/approvals"]);
        if (!allowed.has(rawTarget)) return;
        if (rawTarget === "/approvals") {
          let role = ""; try { const authRaw = localStorage.getItem("auth_user"); role = authRaw ? (JSON.parse(authRaw).role || '').toLowerCase() : ''; } catch {}
          if (!['admin','manager'].includes(role)) return; // not allowed, stay on dashboard
        }
        redirectedRef.current = true;
        navigate(rawTarget, { replace: true });
      } catch {
        // ignore failures silently
      }
    })();
  }, [pathname, navigate]);

  const mobileNavItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Assets", path: "/assets", icon: Package },
    { label: "Scan", path: "/scan", icon: ScanLine },
    { label: "QR", path: "/qr-codes", icon: QrCode },
    { label: "Tickets", path: "/tickets", icon: Ticket },
  ] as const;

  useEffect(() => {
    const rawPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";
    const segments = rawPath === "/" ? [] : rawPath.split("/").filter(Boolean);
    const baseKey = segments.length === 0 ? "/" : `/${segments[0]}`;
    const knownTitle = ROUTE_TITLE_MAP[baseKey];
    const fallbackTitle = segments
      .map((segment) =>
        segment
          .replace(/[-_]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      )
      .join(" / ");
    const suffix =
      knownTitle ||
      (fallbackTitle ? fallbackTitle : ROUTE_TITLE_MAP["/"] || "Dashboard");
    const nextTitle = `${BASE_TITLE} - ${suffix}`;
    try {
      document.title = nextTitle;
    } catch {
      // ignore if document unavailable (e.g., server rendering)
    }
  }, [pathname]);

  return (
    <HelpGuideProvider>
      <div className="flex h-dvh bg-background">
      {/* Desktop Primary Navigation (Sidebar or TopNav) */}
      {!effectiveTopNavMode && (
        <div className="hidden md:block">
          <Sidebar />
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[320px] max-w-[90vw] border-0 bg-transparent p-0 shadow-[0_18px_40px_rgba(11,12,16,0.35)] [&>button]:hidden"
          >
            <Sidebar
              isMobile
              onNavigate={() => setSidebarOpen(false)}
              className="w-full rounded-r-3xl shadow-[0_18px_40px_rgba(11,12,16,0.35)]"
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {effectiveTopNavMode ? (
          <TopNavBar onMenuToggle={() => setSidebarOpen(true)} />
        ) : (
          <Header onMenuClick={() => setSidebarOpen(true)} />
        )}
        <main className="flex-1 overflow-auto overscroll-contain p-4 md:p-6 bg-muted/30">
          {children}
        </main>
        {/* Mobile bottom tab bar */}
        {isMobile && (
          <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
            <nav className="pointer-events-auto flex h-16 w-full max-w-md items-center justify-around rounded-full border border-border/40 bg-background/80 px-2 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
              {mobileNavItems.map((item) => {
                const active = pathname === item.path || pathname.startsWith(item.path + "/");
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={cn(
                      "group relative flex items-center justify-center rounded-full transition-all duration-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active 
                        ? "h-10 w-16 bg-primary text-primary-foreground shadow-lg" 
                        : "h-12 w-12 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon 
                      className={cn(
                        "h-5 w-5 transition-transform duration-300",
                        active ? "scale-100" : "group-hover:scale-110"
                      )} 
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>
      </div>
    </HelpGuideProvider>
  );
}
