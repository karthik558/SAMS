import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Package, Building2, FileBarChart, ClipboardCheck, QrCode, Settings, Users, Ticket, ShieldCheck, ScanLine, Menu, Box, LifeBuoy, Megaphone, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { isAuditActive } from '@/services/audit';

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
    <div className="flex w-full items-stretch border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2">
      {/* Left brand + mobile toggle */}
      <div className="flex items-center gap-1 pr-2">
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
          className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-md text-primary hover:bg-accent/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Dashboard"
        >
          <Box className="h-5 w-5" />
        </button>
      </div>
      {/* Center nav – wraps on smaller widths */}
      <nav className="flex flex-1 items-center justify-center gap-0.5 overflow-x-auto no-scrollbar py-1">
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
      {/* Right side placeholder */}
      <div className="flex items-center gap-2 pl-2">
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
    </div>
  );
}
