import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { isDemoMode } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Building2,
  QrCode,
  Ticket,
  FileBarChart,
  Users,
  Settings,
  ScanLine,
  PlusCircle,
  UploadCloud,
} from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role?: string | null;
};

type PageItem = {
  label: string;
  path: string;
  roles: string[];
  icon: LucideIcon;
};

type ActionItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export default function CommandPalette({ open, onOpenChange, role }: Props) {
  const navigate = useNavigate();
  const roleLower = (role || '').toLowerCase();
  const prefix = isDemoMode() ? '/demo' : '';

  const pages = useMemo<PageItem[]>(() => {
    const rootPath = prefix ? prefix : '/';
    const list: PageItem[] = (
      [
        { label: 'Dashboard', path: rootPath, roles: ['admin', 'manager', 'user'], icon: LayoutDashboard },
        { label: 'Assets', path: `${prefix}/assets`, roles: ['admin', 'manager', 'user'], icon: Package },
        { label: 'Properties', path: `${prefix}/properties`, roles: ['admin', 'manager', 'user'], icon: Building2 },
        { label: 'QR Codes', path: `${prefix}/qr-codes`, roles: ['admin', 'manager', 'user'], icon: QrCode },
        { label: 'Tickets', path: `${prefix}/tickets`, roles: ['admin', 'manager', 'user'], icon: Ticket },
        { label: 'Reports', path: `${prefix}/reports`, roles: ['admin', 'manager'], icon: FileBarChart },
        { label: 'Users', path: `${prefix}/users`, roles: ['admin'], icon: Users },
        { label: 'Settings', path: `${prefix}/settings`, roles: ['admin'], icon: Settings },
        { label: 'Scan', path: `${prefix}/scan`, roles: ['admin', 'manager', 'user'], icon: ScanLine },
      ]
    ).filter((item) => item.roles.includes(roleLower || 'user'));
    // In demo mode, ensure Audit and License are not present (they aren't explicitly listed here,
    // but if added later, this guard will filter them out by label/path)
    return list.filter((i) => !isDemoMode() || (!/\baudit\b/i.test(i.label) && !/\/license$/.test(i.path)));
  }, [prefix, roleLower]);

  const actions = useMemo<ActionItem[]>(() => {
    const rootPath = prefix ? prefix : '/';
    return [
      { label: 'Add Asset', path: `${prefix}/assets?new=1`, icon: PlusCircle },
      { label: 'Bulk Import Assets', path: rootPath, icon: UploadCloud },
      { label: 'Generate QR Codes', path: `${prefix}/qr-codes`, icon: QrCode },
      { label: 'New Ticket', path: `${prefix}/tickets`, icon: Ticket },
      { label: 'Open Scanner', path: `${prefix}/scan`, icon: ScanLine },
    ]
  }, [prefix]);

  // Keyboard shortcut: Cmd/Ctrl+K handled in parent, but also keep here as safety
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`Search pages and actions${hasSupabaseEnv ? '…' : ''}`} />
      <CommandList className="mt-2 space-y-3 px-2 pb-5">
        <CommandEmpty className="py-10 text-center text-sm text-muted-foreground/80">No results.</CommandEmpty>
        <CommandGroup heading="Pages" className="space-y-1 [&_[cmdk-group-heading]]:text-muted-foreground/70">
          {pages.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => go(item.path)}
                className="gap-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground transition-colors group-data-[selected=true]:border-transparent group-data-[selected=true]:bg-sidebar-accent-foreground/15 group-data-[selected=true]:text-sidebar-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium text-foreground group-data-[selected=true]:text-sidebar-accent-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground/80">{item.path}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator className="my-2 bg-border/60" />
        <CommandGroup heading="Actions" className="space-y-1 [&_[cmdk-group-heading]]:text-muted-foreground/70">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.label}
                value={action.label}
                onSelect={() => go(action.path)}
                className="gap-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground transition-colors group-data-[selected=true]:border-transparent group-data-[selected=true]:bg-sidebar-accent-foreground/15 group-data-[selected=true]:text-sidebar-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium text-foreground group-data-[selected=true]:text-sidebar-accent-foreground">{action.label}</span>
                  <span className="text-xs text-muted-foreground/80">{action.path}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
