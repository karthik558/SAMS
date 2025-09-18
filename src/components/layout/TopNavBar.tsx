import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, Building2, FileBarChart, ClipboardCheck, QrCode, Settings, Users, Ticket, ShieldCheck, ScanLine, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserPreferences } from '@/services/userPreferences';
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from '@/services/permissions';
import { isDemoMode } from '@/lib/demo';
import { Button } from '@/components/ui/button';

interface TopNavBarProps {
  onMenuToggle?: () => void;
}

export function TopNavBar({ onMenuToggle }: TopNavBarProps) {
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [role, setRole] = useState('');
  const navigate = useNavigate();
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }>>({} as any);

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

  const items = navItemsBase.filter(i => !i.roles || i.roles.includes(role));
  if (showNewsletter) {
    const idx = items.findIndex(i => i.label === 'Reports');
    const newsletterItem = { label: 'Newsletter', href: '/newsletter', icon: FileBarChart };
    if (!items.find(i => i.href === '/newsletter')) {
      if (idx >= 0) items.splice(idx + 1, 0, newsletterItem);
      else items.push(newsletterItem);
    }
  }

  return (
    <div className="flex w-full items-center gap-4 border-b border-border/60 bg-background/90 backdrop-blur px-4 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onMenuToggle} className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold">SAMS</span>
      </div>
      <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
        {items.map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {/* Placeholder for future quick actions / user menu duplication if needed */}
      </div>
    </div>
  );
}
