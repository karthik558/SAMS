import { Bell, Search, Menu, Settings as SettingsIcon, Users as UsersIcon, LogOut, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { listNotifications, addNotification, markAllRead, clearAllNotifications, type Notification } from "@/services/notifications";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import CommandPalette from "@/components/layout/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authUser, setAuthUser] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [globalResults, setGlobalResults] = useState<{ nav: any[]; assets: any[]; properties: any[]; users: any[]; qrcodes: any[]; tickets: any[]; approvals: any[] }>({ nav: [], assets: [], properties: [], users: [], qrcodes: [], tickets: [], approvals: [] });
  const [searching, setSearching] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("");

  const roleLower = (authUser?.role || "").toLowerCase();
  const isAdminRole = roleLower === "admin";
  const userEmail = authUser?.email || "";
  const userInitials = (authUser?.name || "User")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const firstName = (authUser?.name || "").split(" ").filter(Boolean)[0] || null;

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

  useEffect(() => {
    try {
      const navObj = typeof navigator !== "undefined" ? navigator : undefined;
      if (!navObj) return;
      const ua = (navObj.userAgent || "").toLowerCase();
      const platform = (navObj.platform || "").toLowerCase();
      const uaDataPlatform = ((navObj as any).userAgentData?.platform || "").toLowerCase();
      const platformInfo = `${platform} ${uaDataPlatform}`;

      if (ua.includes("android")) {
        setShortcutHint("");
        return;
      }

      if (/mac|iphone|ipad|ipod/.test(platformInfo) || /mac|iphone|ipad|ipod/.test(ua)) {
        setShortcutHint("⌘K");
        return;
      }

      if (/win/.test(platformInfo) || ua.includes("windows")) {
        setShortcutHint("Ctrl+K");
        return;
      }

      setShortcutHint("Ctrl+K");
    } catch {
      setShortcutHint("");
    }
  }, []);

  useEffect(() => {
    try {
      if (isDemoMode()) {
        const raw = sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user');
        setAuthUser(raw ? JSON.parse(raw) : null);
      } else {
        const raw = localStorage.getItem("auth_user");
        setAuthUser(raw ? JSON.parse(raw) : null);
      }
    } catch { setAuthUser(null); }
  }, []);

  // Notifications: load from service (Supabase or localStorage). In demo, seed fake ones each load.
  useEffect(() => {
    (async () => {
      try {
        // In demo, show a fixed set on every load
        if (isDemoMode()) {
          // If user cleared them, keep empty just for this session; after hard reload we re-seed.
          const cleared = sessionStorage.getItem('demo_notifs_cleared') === '1';
          if (!cleared) {
            // Seed 3 notifications; store to local service storage
            await clearAllNotifications();
            await addNotification({ title: 'Welcome to the SAMS Demo', message: 'Explore the app with sample data. Changes are not saved.', type: 'system' }, { silent: true });
            await addNotification({ title: 'QR generated', message: 'QR for AST-005 is ready to download.', type: 'qr' }, { silent: true });
            await addNotification({ title: 'Report ready', message: 'Monthly Asset Report has been generated.', type: 'report' }, { silent: true });
          }
        }
        const data = await listNotifications(50);
        setNotifications(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // (Removed context chips near search per request)

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount || "");

  const prefix = isDemoMode() ? '/demo' : '';
  const navItems = [
    { label: 'Dashboard', path: `${prefix}/` === '/demo/' ? '/demo' : '/', roles: ['admin','manager','user'] },
    { label: 'Assets', path: `${prefix}/assets`, roles: ['admin','manager','user'] },
    { label: 'Properties', path: `${prefix}/properties`, roles: ['admin','manager','user'] },
    { label: 'QR Codes', path: `${prefix}/qr-codes`, roles: ['admin','manager','user'] },
    { label: 'Reports', path: `${prefix}/reports`, roles: ['admin','manager'] },
    { label: 'Users', path: `${prefix}/users`, roles: ['admin'] },
    { label: 'Settings', path: `${prefix}/settings`, roles: ['admin'] },
  ].filter(i => i.roles.includes(roleLower as any) || roleLower === '');

  // Resolve a navigation target for a notification (component scope)
  function getNotificationTarget(n: Notification): string {
    const type = (n.type || '').toLowerCase();
    const getTicketId = () => {
      const m1 = (n.title || '').match(/TCK-\d+/);
      const m2 = (n.message || '').match(/TCK-\d+/);
      return (m1?.[0] || m2?.[0]) || null;
    };
    if (type.startsWith('ticket')) {
      const id = getTicketId();
      const path = id ? `/tickets?id=${encodeURIComponent(id)}` : '/tickets';
      return isDemoMode() ? `/demo${path}` : path;
    }
    if (type === 'qr') {
      // Try to navigate to the specific asset if ID present like "AST-001"
      const m = (n.message || '').match(/\b([A-Z]+-\d+)\b/);
      const assetId = m?.[1];
      const path = assetId ? `/assets/${assetId}` : '/qr-codes';
      // Asset details route is global (no /demo prefix)
      return assetId ? path : (isDemoMode() ? `/demo${path}` : path);
    }
    if (type === 'report') { return isDemoMode() ? '/demo/reports' : '/reports'; }
    if (type === 'system') { return isDemoMode() ? '/demo' : '/'; }
    // Fallback
    return isDemoMode() ? '/demo' : '/';
  }

  // Build unified list for keyboard navigation
  const unifiedResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Array<{ key: string; label: string; sub?: string; path: string; group: string }> = [];
    // Nav: auto-match label and path (no manual keywords)
    const synonyms: Array<{ terms: string[]; label: string; path: string }> = [
      { terms: ['dashboard','home','main'], label: 'Dashboard', path: navItems.find(i=>i.label==='Dashboard')?.path || '/' },
      { terms: ['assets','asset','inventory'], label: 'Assets', path: navItems.find(i=>i.label==='Assets')?.path || '/assets' },
      { terms: ['properties','property','location','site'], label: 'Properties', path: navItems.find(i=>i.label==='Properties')?.path || '/properties' },
      { terms: ['qr','qrcodes','qr codes','scan'], label: 'QR Codes', path: navItems.find(i=>i.label==='QR Codes')?.path || '/qr-codes' },
      { terms: ['reports','report','export'], label: 'Reports', path: navItems.find(i=>i.label==='Reports')?.path || '/reports' },
      { terms: ['users','user','accounts'], label: 'Users', path: navItems.find(i=>i.label==='Users')?.path || '/users' },
      { terms: ['settings','config','preferences'], label: 'Settings', path: navItems.find(i=>i.label==='Settings')?.path || '/settings' },
      { terms: ['tickets','ticket','maintenance'], label: 'Tickets', path: navItems.find(i=>i.label==='Tickets')?.path || '/tickets' },
      { terms: ['approvals','approval','requests'], label: 'Approvals', path: navItems.find(i=>i.label==='Approvals')?.path || '/approvals' },
  ];
  // In demo mode, do not suggest Audit via synonyms
  if (!isDemoMode()) {
    synonyms.push({ terms: ['audit','audits'], label: 'Audit', path: navItems.find(i=>i.label==='Audit')?.path || '/audit' });
  }
  
  
    const synMatches = q
      ? synonyms.filter(s => s.terms.some(t => q.includes(t)))
      : [];
    const nav = q
      ? [
          ...navItems.filter(i => i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)),
          ...synMatches.map(m => ({ label: m.label, path: m.path }))
        ]
      : [];
    out.push(
      ...nav.slice(0, 6).map(i => ({ key: `nav:${i.path}` , label: i.label, sub: i.path, path: i.path, group: 'Pages' }))
    );
    // Entities (supabase only)
    const add = (arr: any[], group: string, toItem: (x:any)=>{label:string; sub?:string; path:string; key?:string}) => {
      for (const x of arr.slice(0, 5)) {
        const t = toItem(x);
        out.push({ key: t.key || `${group}:${t.path}:${t.label}`, label: t.label, sub: t.sub, path: t.path, group });
      }
    };
  add(globalResults.assets, 'Assets', (a:any) => ({ label: `${a.id} — ${a.name || ''}`.trim(), sub: `${a.type || ''} @ ${a.property || ''}${a.serial_number?` · ${a.serial_number}`:''}`.trim(), path: `${prefix}/assets/${a.id}` }));
  add(globalResults.properties, 'Properties', (p:any) => ({ label: `${p.id} — ${p.name}`.trim(), sub: `${p.type || ''} · ${p.status || ''}`.trim(), path: `${prefix}/properties` }));
  add(globalResults.users, 'Users', (u:any) => ({ label: u.name || u.email, sub: `${u.email} · ${u.role}${u.department ? ' · ' + u.department : ''}`, path: `${prefix}/users` }));
  add(globalResults.qrcodes, 'QR Codes', (q:any) => ({ label: q.id, sub: `${q.asset_id || q.assetId || ''} · ${q.property || ''}`, path: `${prefix}/qr-codes` }));
  add(globalResults.tickets, 'Tickets', (t:any) => ({ label: `${t.id} — ${t.title || ''}`.trim(), sub: `${t.status || ''}${t.assignee?` · ${t.assignee}`:''}${t.created_by?` · ${t.created_by}`:''}`, path: `${prefix}/tickets` }));
  add(globalResults.approvals, 'Approvals', (a:any) => ({ label: `${a.id} — ${a.asset_id || ''}`.trim(), sub: `${a.status || ''}${a.department?` · ${a.department}`:''}`, path: `${prefix}/approvals` }));
    return out;
  }, [search, navItems, globalResults, prefix]);

  const goTo = (path: string) => {
    setSearch("");
    setSearchOpen(false);
    setHighlight(0);
  navigate(path);
  };

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const iconBase = isMobile
    ? (isAdminRole ? "relative h-10 w-10 rounded-full bg-muted/70 p-0 shadow-sm" : "h-8 w-8 rounded-full bg-muted/70 p-0 shadow-sm")
    : (isAdminRole ? "relative h-10 w-10 p-0" : "h-8 w-8 p-0");

  const notificationsDropdown = (
    <DropdownMenu
      onOpenChange={async (open) => {
        setNotifOpen(open);
        if (open) {
          await markAllRead();
          const data = await listNotifications(50);
          setNotifications(data);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Open notifications"
          variant="ghost"
          size="sm"
          className={cn(
            "relative flex items-center justify-center p-0 transition-colors",
            isMobile 
              ? "h-9 w-9 rounded-full bg-muted/70 shadow-sm" 
              : "h-8 w-8"
          )}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-[14px] text-destructive-foreground shadow-sm">
              {badgeLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 overflow-hidden rounded-xl border border-border/60 bg-popover p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount ? `${unreadCount} new` : 'You are all caught up'}
            </p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={async () => {
                await clearAllNotifications();
                setNotifications([]);
                if (isDemoMode()) {
                  try { sessionStorage.setItem('demo_notifs_cleared', '1'); } catch {}
                }
              }}
              className="text-xs font-semibold text-primary hover:text-primary/80"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
              <span className="text-sm font-medium text-muted-foreground">No notifications</span>
              <span className="text-xs text-muted-foreground">Updates will appear here as you work.</span>
            </div>
          ) : (
            notifications.slice(0, 12).map((n) => {
              const to = getNotificationTarget(n);
              const isUnread = !n.read;
              const typeLabel = (n.type || '').replace(/_/g, ' ');
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="group mx-1 my-1 rounded-lg px-0 py-0 focus:bg-transparent"
                >
                  <Link
                    to={to}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/70"
                    onClick={() => setNotifOpen(false)}
                  >
                    <span
                      className={`mt-1 inline-flex h-2 w-2 rounded-full ${isUnread ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {n.title || typeLabel || 'Notification'}
                        </p>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {n.message && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.message}
                        </p>
                      )}
                      {typeLabel && (
                        <Badge
                          variant="outline"
                          className="w-fit border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                        >
                          {typeLabel}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const triggerAvatar = (
    <Avatar className="h-full w-full">
      <AvatarImage src="/placeholder-avatar.jpg" />
      <AvatarFallback className="bg-primary text-primary-foreground">
        {userInitials}
      </AvatarFallback>
    </Avatar>
  );

  const decoratedTriggerAvatar = isAdminRole ? (
    <span className="relative flex h-full w-full items-center justify-center">
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full bg-primary p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-background p-[2px]">
          {triggerAvatar}
        </span>
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background">
        <ShieldCheck className="h-2.5 w-2.5" />
      </span>
    </span>
  ) : (
    triggerAvatar
  );

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("rounded-full p-0 overflow-visible", iconBase)}>
          {decoratedTriggerAvatar}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 overflow-hidden rounded-xl border border-border/60 bg-popover p-0 shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {authUser?.name || "Guest User"}
            </p>
            {userEmail && (
              <p className="max-w-[12rem] truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            )}
            {roleLower && !isDemoMode() && (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
              >
                {roleLower}
              </Badge>
            )}
          </div>
        </div>
        <div className="py-2">
          {isAdminRole && (
            <>
              <DropdownMenuItem
                onClick={() => navigate(isDemoMode() ? '/demo/users' : '/users')}
                className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <UsersIcon className="h-4 w-4" />
                <span>Users</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(isDemoMode() ? '/demo/settings' : '/settings')}
                className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
            </>
          )}
          <DropdownMenuItem
            onClick={handleSignOut}
            className="mx-2 flex items-center gap-2 rounded-lg px-3 py-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="app-header h-14 md:h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {isMobile ? (
        <div className="relative flex h-full w-full items-center px-3">
          <div className="flex items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 shadow-sm"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-xs text-muted-foreground shadow-sm"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
          <Link
            to={prefix || "/"}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-label="Go to dashboard"
          >
            <div 
              className="h-8 w-32 bg-primary transition-colors" 
              style={{
                maskImage: 'url("/sams_logo.png")',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: 'url("/sams_logo.png")',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center'
              }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            {notificationsDropdown}
            <div className="md:hidden">
              {userMenu}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-between gap-3 px-3 md:px-6">
          <div className="flex flex-1 items-center gap-2 max-w-md">
            <button
              aria-label="Open menu"
              onClick={onMenuClick}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search"
                placeholder="Search pages and actions…"
                className="h-10 pl-10 pr-12 rounded-full border border-border/60 bg-muted/60 text-sm placeholder:text-muted-foreground/70 shadow-sm transition-colors hover:bg-muted/70 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                readOnly
                onFocus={() => setPaletteOpen(true)}
                onClick={() => setPaletteOpen(true)}
              />
              {shortcutHint && (
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
                  {shortcutHint}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {notificationsDropdown}
            <div className="md:hidden">
              {userMenu}
            </div>
          </div>
        </div>
      )}
      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={authUser?.role || null} />
    </header>
  );
}
