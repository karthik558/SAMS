import { Bell, Search, Moon, Sun, Menu, Settings as SettingsIcon, Users as UsersIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authUser, setAuthUser] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [globalResults, setGlobalResults] = useState<{ nav: any[]; assets: any[]; properties: any[]; users: any[]; qrcodes: any[]; tickets: any[]; approvals: any[] }>({ nav: [], assets: [], properties: [], users: [], qrcodes: [], tickets: [], approvals: [] });
  const [searching, setSearching] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      const root = document.documentElement;
      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
    } catch {
      // no-op if storage unavailable
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

  const roleLower = (authUser?.role || "").toLowerCase();
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
      { terms: ['audit','audits'], label: 'Audit', path: navItems.find(i=>i.label==='Audit')?.path || '/audit' },
    ];
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
  }, [search, navItems, globalResults]);

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

  return (
    <header className="h-14 md:h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-3 md:px-6 gap-3">
        {/* Left: menu + search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <button
            aria-label="Open menu"
            onClick={onMenuClick}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pages and actions… (⌘K)"
              className="pl-10 bg-muted/50 h-9"
              readOnly
              onFocus={() => setPaletteOpen(true)}
              onClick={() => setPaletteOpen(true)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <DropdownMenu onOpenChange={async (open) => {
            setNotifOpen(open);
            if (open) {
              await markAllRead();
              const data = await listNotifications(50);
              setNotifications(data);
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Open notifications" variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 flex items-center justify-center"
                  >
                    {badgeLabel}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={async () => {
                      await clearAllNotifications();
                      setNotifications([]);
                      if (isDemoMode()) {
                        try { sessionStorage.setItem('demo_notifs_cleared', '1'); } catch {}
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 12).map((n) => (
                  <DropdownMenuItem key={n.id} className="py-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium break-words">{n.title || n.type}</p>
                      <p className="text-xs text-muted-foreground break-words">{n.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.type.replace(/_/g, " ")} • {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-avatar.jpg" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {(authUser?.name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{authUser?.name || "User"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(authUser?.role || "").toLowerCase() === 'admin' ? (
                <>
                  <DropdownMenuItem onClick={() => navigate('/users')}>
                    <UsersIcon className="mr-2 h-4 w-4" />
                    Users
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
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
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
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
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={authUser?.role || null} />
    </header>
  );
}
