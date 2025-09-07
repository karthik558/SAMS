import { useEffect, useMemo, useState } from "react";
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role?: string | null;
};

export default function CommandPalette({ open, onOpenChange, role }: Props) {
  const navigate = useNavigate();
  const roleLower = (role || '').toLowerCase();
  const prefix = isDemoMode() ? '/demo' : '';

  const pages = useMemo(() => ([
    { label: 'Dashboard', path: `${prefix}/` === '/demo/' ? '/demo' : '/' , roles: ['admin','manager','user'] },
    { label: 'Assets', path: `${prefix}/assets`, roles: ['admin','manager','user'] },
    { label: 'Properties', path: `${prefix}/properties`, roles: ['admin','manager','user'] },
    { label: 'QR Codes', path: `${prefix}/qr-codes`, roles: ['admin','manager','user'] },
    { label: 'Tickets', path: `${prefix}/tickets`, roles: ['admin','manager','user'] },
    { label: 'Reports', path: `${prefix}/reports`, roles: ['admin','manager'] },
    { label: 'Users', path: `${prefix}/users`, roles: ['admin'] },
    { label: 'Settings', path: `${prefix}/settings`, roles: ['admin'] },
    { label: 'Scan', path: `${prefix}/scan`, roles: ['admin','manager','user'] },
  ]).filter(i => i.roles.includes(roleLower || 'user')),
  [prefix, roleLower]);

  const actions = useMemo(() => ([
    { label: 'Add Asset', path: `${prefix}/assets?new=1` },
    { label: 'Bulk Import Assets', path: `${prefix}/` === '/demo/' ? '/demo' : '/' },
    { label: 'Generate QR Codes', path: `${prefix}/qr-codes` },
    { label: 'New Ticket', path: `${prefix}/tickets` },
    { label: 'Open Scanner', path: `${prefix}/scan` },
  ]), [prefix]);

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
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map(i => (
            <CommandItem key={i.path} value={i.label} onSelect={() => go(i.path)}>
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actions.map(a => (
            <CommandItem key={a.label} value={a.label} onSelect={() => go(a.path)}>
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

