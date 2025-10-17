import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, Building2, FileBarChart, ClipboardCheck, QrCode, Settings, Users, Ticket, ShieldCheck, ScanLine, Menu, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserPreferences } from '@/services/userPreferences';
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from '@/services/permissions';
import { isDemoMode } from '@/lib/demo';
import { isAuditActive } from '@/services/audit';

interface TopNavBarProps {
  onMenuToggle?: () => void;
}

export function TopNavBar({ onMenuToggle }: TopNavBarProps) {
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [role, setRole] = useState('');
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
      } catch {}
      try {
        const raw = localStorage.getItem('auth_user');
        if (raw) { const r = (JSON.parse(raw).role || '').toLowerCase(); setRole(r); }
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
      const newsletterItem = { label: 'Newsletter', href: '/newsletter', icon: FileBarChart };
      if (idx >= 0) working.splice(idx + 1, 0, newsletterItem);
      else working.push(newsletterItem);
    }

    const filtered = working
      .filter((item) => !item.roles || item.roles.includes(roleLower))
      .filter((item) => {
        if (demo && (item.label === 'Audit' || item.label === 'License')) return false;
        if (item.label === 'Dashboard' || item.label === 'Scan' || item.label === 'Tickets') return true;
        if (item.label === 'Newsletter') return showNewsletter;
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
            className={({ isActive }) => cn(
              'group flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <item.icon className={cn('h-4 w-4')} />
            <span className="hidden lg:inline-block">{item.label}</span>
            <span className="inline-block lg:hidden">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* Right side placeholder */}
      <div className="flex items-center gap-2 pl-2">
        {/* Future actions */}
      </div>
    </div>
  );
}
