import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Package, Building2, FileBarChart, ClipboardCheck, QrCode, Settings, Users, Ticket, ShieldCheck, ScanLine, Menu, Box, LifeBuoy, Megaphone, LogOut, Search, Bell, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserPreferences, peekCachedUserPreferences } from '@/services/userPreferences';
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from '@/services/permissions';
import { isDemoMode } from '@/lib/demo';
import { isAuditActive, getActiveSession, getAssignment } from '@/services/audit';
import { listNotifications, addNotification, markAllRead, clearAllNotifications, type Notification } from "@/services/notifications";
import CommandPalette from "@/components/layout/CommandPalette";
import { formatDistanceToNow, parseISO } from "date-fns";

interface TopNavBarProps {
  onMenuToggle?: () => void;
}

export function TopNavBar({ onMenuToggle }: TopNavBarProps) {
  const cachedPrefs = useMemo(() => {
    try {
      const uid = getCurrentUserId();
      return peekCachedUserPreferences(uid);
    } catch {
      return null;
    }
  }, []);
  const [showNewsletter, setShowNewsletter] = useState(() => Boolean(cachedPrefs?.show_newsletter));
  const [showHelpCenter, setShowHelpCenter] = useState(() => cachedPrefs?.show_help_center !== false);
  const [role, setRole] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }>>({} as any);
  const [auditActive, setAuditActive] = useState(false);
  const [hasAuditReports, setHasAuditReports] = useState(false);
  
  // Header-like state
  const [isDark, setIsDark] = useState(false);
  const [, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("");

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
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const navObj = typeof navigator !== "undefined" ? navigator : undefined;
      if (!navObj) return;
      const ua = (navObj.userAgent || "").toLowerCase();
      const platform = (navObj.platform || "").toLowerCase();
      const uaDataPlatform = ((navObj as any).userAgentData?.platform || "").toLowerCase();
      const platformInfo = `${platform} ${uaDataPlatform}`;
      if (ua.includes("android")) { setShortcutHint(""); return; }
      if (/mac|iphone|ipad|ipod/.test(platformInfo) || /mac|iphone|ipad|ipod/.test(ua)) { setShortcutHint("⌘K"); return; }
      if (/win/.test(platformInfo) || ua.includes("windows")) { setShortcutHint("Ctrl+K"); return; }
      setShortcutHint("Ctrl+K");
    } catch { setShortcutHint(""); }
  }, []);

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

  // Notifications
  useEffect(() => {
    (async () => {
      try {
        if (isDemoMode()) {
          const cleared = sessionStorage.getItem('demo_notifs_cleared') === '1';
          if (!cleared) {
            await clearAllNotifications();
            await addNotification({ title: 'Welcome to the SAMS Demo', message: 'Explore the app with sample data. Changes are not saved.', type: 'system' }, { silent: true });
            await addNotification({ title: 'QR generated', message: 'QR for AST-005 is ready to download.', type: 'qr' }, { silent: true });
            await addNotification({ title: 'Report ready', message: 'Monthly Asset Report has been generated.', type: 'report' }, { silent: true });
          }
        }
        const data = await listNotifications(50);
        setNotifications(data);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount || "");

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
      const m = (n.message || '').match(/\b([A-Z]+-\d+)\b/);
      const assetId = m?.[1];
      const path = assetId ? `/assets/${assetId}` : '/qr-codes';
      return assetId ? path : (isDemoMode() ? `/demo${path}` : path);
    }
    if (type === 'report') { return isDemoMode() ? '/demo/reports' : '/reports'; }
    if (type === 'system') { return isDemoMode() ? '/demo' : '/'; }
    return isDemoMode() ? '/demo' : '/';
  }

  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const pref = await getUserPreferences(uid);
        setShowNewsletter(!!pref.show_newsletter);
        setShowHelpCenter(pref.show_help_center !== false);
      } catch {}
      try {
        const raw = localStorage.getItem('auth_user');
        if (raw) { 
          const parsed = JSON.parse(raw);
          setRole((parsed.role || '').toLowerCase());
          setUserName(parsed.name || parsed.email || 'User');
        }
      } catch {}
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const p = await listUserPermissions(uid);
        setPerm(p as any);
      } catch {}
      try {
        const active = await isAuditActive();
        setAuditActive(Boolean(active));
      } catch {
        setAuditActive(false);
      }
      try {
        setHasAuditReports(localStorage.getItem('has_audit_reports') === '1');
      } catch {
        setHasAuditReports(false);
      }
    })();
  }, []);

  useEffect(() => {
    const applyPatch = (detail: any) => {
      if (detail && typeof detail.show_newsletter === 'boolean') {
        setShowNewsletter(detail.show_newsletter);
      }
      if (detail && typeof detail.show_help_center === 'boolean') {
        setShowHelpCenter(detail.show_help_center);
      }
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'user_preferences_patch') {
        try {
          const payload = JSON.parse(event.newValue || '{}') || {};
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
    window.addEventListener('storage', storageHandler);
    window.addEventListener('user-preferences-changed', customHandler as any);
    return () => {
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('user-preferences-changed', customHandler as any);
    };
  }, []);

  const firstName = useMemo(() => {
    if (!userName) return "";
    const parts = userName.trim().split(/\s+/);
    return parts[0] || userName;
  }, [userName]);

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

  const navItemsBase = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Properties', href: '/properties', icon: Building2 },
    { label: 'Assets', href: '/assets', icon: Package },
    { label: 'Approvals', href: '/approvals', icon: ClipboardCheck, roles: ['admin','manager'] },
    { label: 'QR Codes', href: '/qr-codes', icon: QrCode },
    { label: 'Scan', href: '/scan', icon: ScanLine },
    { label: 'Reports', href: '/reports', icon: FileBarChart },
    { label: 'Audit', href: '/audit', icon: ClipboardCheck, roles: ['admin','manager'] },
    { label: 'Tickets', href: '/tickets', icon: Ticket },
    { label: 'Help Center', href: '/help', icon: LifeBuoy },
    { label: 'Users', href: '/users', icon: Users, roles: ['admin'] },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'License', href: '/license', icon: ShieldCheck, roles: ['admin'] },
  ];

  const demo = isDemoMode();
  const labelToKey: Record<string, PageKey | null> = {
    Dashboard: null,
    Properties: 'properties',
    Assets: 'assets',
    Approvals: null,
    'QR Codes': 'qrcodes',
    Scan: null,
    Reports: 'reports',
    Audit: 'audit',
    Tickets: null,
    'Help Center': null,
    Users: 'users',
    Settings: 'settings',
    License: null,
    Newsletter: null,
  };

  const roleLower = role?.toLowerCase() || '';
  const roleForPerm = demo ? roleLower || 'admin' : roleLower;
  const effectivePerm = mergeDefaultsWithOverrides(roleForPerm, (perm || {}) as any);

  const computedItems = (() => {
    const working = [...navItemsBase];
    if (showNewsletter && !working.find((item) => item.label === 'Newsletter')) {
      const idx = working.findIndex((item) => item.label === 'Reports');
      const newsletterItem = { label: 'Newsletter', href: '/newsletter', icon: Megaphone };
      if (idx >= 0) working.splice(idx + 1, 0, newsletterItem);
      else working.push(newsletterItem);
    }
    if (!showHelpCenter) {
      const idx = working.findIndex((item) => item.label === 'Help Center');
      if (idx >= 0) working.splice(idx, 1);
    }

    const filtered = working
      .filter((item) => !item.roles || item.roles.includes(roleLower))
      .filter((item) => {
        if (demo && (item.label === 'Audit' || item.label === 'License')) return false;
        if (item.label === 'Dashboard' || item.label === 'Scan' || item.label === 'Tickets') return true;
        if (item.label === 'Newsletter') return showNewsletter;
        if (item.label === 'Help Center') return showHelpCenter;
        if (item.label === 'Approvals') return roleForPerm === 'admin' || roleForPerm === 'manager';
        if (item.label === 'License') return roleForPerm === 'admin';
        if (item.label === 'Audit') {
          const rule = (effectivePerm as any)['audit'];
          return (
            roleForPerm === 'admin' ||
            ((auditActive || hasAuditReports) && roleForPerm === 'manager') ||
            !!rule?.v
          );
        }
        const key = labelToKey[item.label];
        if (!key) return true;
        const rule = (effectivePerm as any)[key];
        return !!rule?.v;
      });

    return filtered;
  })();

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2 h-14">
      {/* Left brand + mobile toggle + Search */}
      <div className="flex items-center gap-2 justify-start">
        <button
          type="button"
          onClick={onMenuToggle}
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="hidden md:inline-flex items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Dashboard"
        >
          <div 
            className="h-8 w-24 bg-primary transition-colors" 
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
        </button>
        
        {/* Search */}
        <div className="relative hidden md:block w-32 lg:w-48 ml-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            placeholder="Search..."
            className="h-8 pl-8 pr-10 rounded-full border border-border/60 bg-muted/50 text-xs placeholder:text-muted-foreground/70 shadow-sm transition-colors hover:bg-muted/70 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            readOnly
            onFocus={() => setPaletteOpen(true)}
            onClick={() => setPaletteOpen(true)}
          />
          {shortcutHint && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/60 bg-muted px-1 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground">
              {shortcutHint}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-xs text-muted-foreground shadow-sm"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      {/* Center nav – wraps on smaller widths */}
      <nav className="flex items-center justify-center gap-0.5 overflow-x-auto no-scrollbar py-1">
        {computedItems.map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            title={item.label}
            className={({ isActive }) => cn(
              'group flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <item.icon className={cn('h-4 w-4')} />

          </NavLink>
        ))}
      </nav>
      {/* Right side actions */}
      <div className="flex items-center justify-end gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
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
              className="relative flex h-8 w-8 items-center justify-center rounded-full p-0 transition-colors hover:bg-muted/60"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] leading-none text-destructive-foreground shadow-sm">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="outline-none">
              {(role || '').toLowerCase() === 'admin' ? (
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                  <span className="relative flex h-full w-full items-center justify-center rounded-full bg-primary p-0.5 shadow-sm">
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-background p-[1.5px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                      </div>
                    </span>
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background">
                    <ShieldCheck className="h-2 w-2" />
                  </span>
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                  <span className="text-xs font-bold">{firstName.charAt(0)}</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            className="w-56 overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
          >
            <div className="flex items-center gap-3 p-3 border-b border-border/40 mb-1 bg-muted/30">
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-semibold text-foreground">{userName || 'User'}</span>
                <span className="truncate text-[10px] text-muted-foreground capitalize">{role || 'Guest'}</span>
              </div>
            </div>
            <div className="p-1">
              {(role === 'admin') && (
                <>
                  <DropdownMenuItem
                    onClick={() => navigate(isDemoMode() ? '/demo/users' : '/users')}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Users</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate(isDemoMode() ? '/demo/settings' : '/settings')}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                </>
              )}
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
      </div>
      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={role || null} />
    </div>
  );
}
