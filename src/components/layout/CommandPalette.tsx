import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getUserPreferences, peekCachedUserPreferences } from "@/services/userPreferences";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from "@/services/permissions";
import { isAuditActive } from "@/services/audit";
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
  ClipboardCheck,
  ShieldCheck,
  LifeBuoy,
  Megaphone,
} from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role?: string | null;
};

type PageItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

type ActionItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

const PAGE_LABEL_TO_KEY: Record<string, PageKey | null> = {
  Dashboard: null,
  Assets: "assets",
  Properties: "properties",
  "QR Codes": "qrcodes",
  Reports: "reports",
  Users: "users",
  Settings: "settings",
  Audit: "audit",
  Newsletter: null,
  "Help Center": null,
};

export default function CommandPalette({ open, onOpenChange, role }: Props) {
  const navigate = useNavigate();
  const roleLower = (role || '').toLowerCase();
  const prefix = isDemoMode() ? '/demo' : '';
  const cachedPrefs = useMemo(() => {
    try {
      const uid = getCurrentUserId();
      return peekCachedUserPreferences(uid);
    } catch {
      return null;
    }
  }, []);
  const [showNewsletter, setShowNewsletter] = useState(() => Boolean(cachedPrefs?.show_newsletter));
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }>>({} as any);
  const [auditActive, setAuditActive] = useState(false);
  const [hasAuditReports, setHasAuditReports] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
        if (!uid) return;
        const prefs = await getUserPreferences(uid);
        setShowNewsletter(Boolean(prefs.show_newsletter));
      } catch {
        setShowNewsletter(false);
      }
      try {
        const uid = getCurrentUserId();
        if (uid) {
          const permissions = await listUserPermissions(uid);
          setPerm(permissions as any);
        }
      } catch {
        setPerm({} as any);
      }
      try {
        const active = await isAuditActive();
        setAuditActive(Boolean(active));
      } catch {
        setAuditActive(false);
      }
      try {
        setHasAuditReports(localStorage.getItem("has_audit_reports") === "1");
      } catch {
        setHasAuditReports(false);
      }
    })();
  }, []);

  const demo = isDemoMode();
  const normalizedRole = roleLower || "user";
  const roleForPerm = demo ? roleLower || "admin" : normalizedRole;
  const effectivePerm = mergeDefaultsWithOverrides(roleForPerm, (perm || {}) as any);

  const applyPrefix = useCallback(
    (route: string) => {
      if (!prefix) return route;
      if (route === "/") return prefix || "/";
      return `${prefix}${route}`;
    },
    [prefix]
  );

  const pages = useMemo<PageItem[]>(() => {
    const base = [
      { label: "Dashboard", route: "/", icon: LayoutDashboard },
      { label: "Assets", route: "/assets", icon: Package },
      { label: "Properties", route: "/properties", icon: Building2 },
      { label: "QR Codes", route: "/qr-codes", icon: QrCode },
      { label: "Tickets", route: "/tickets", icon: Ticket },
      { label: "Help Center", route: "/help", icon: LifeBuoy },
      { label: "Reports", route: "/reports", icon: FileBarChart },
      { label: "Users", route: "/users", icon: Users, roles: ["admin"] },
      { label: "Settings", route: "/settings", icon: Settings, roles: ["admin"] },
      { label: "Scan", route: "/scan", icon: ScanLine },
      { label: "Approvals", route: "/approvals", icon: ClipboardCheck, roles: ["admin", "manager"] },
      { label: "Audit", route: "/audit", icon: ClipboardCheck, roles: ["admin", "manager"] },
      { label: "License", route: "/license", icon: ShieldCheck, roles: ["admin"] },
    ] as Array<{ label: string; route: string; icon: LucideIcon; roles?: string[] }>;

    if (showNewsletter && !base.find((item) => item.label === "Newsletter")) {
      const insertAt = base.findIndex((item) => item.label === "Reports");
      const newsletterItem = { label: "Newsletter", route: "/newsletter", icon: Megaphone };
      if (insertAt >= 0) base.splice(insertAt + 1, 0, newsletterItem as any);
      else base.push(newsletterItem as any);
    }

    const filtered = base
      .filter((item) => !item.roles || item.roles.includes(normalizedRole))
      .map((item) => ({ ...item, path: applyPrefix(item.route) }))
      .filter((item) => {
        if (demo && (item.label === "Audit" || item.label === "License")) return false;
        if (item.label === "Dashboard" || item.label === "Scan" || item.label === "Tickets") return true;
        if (item.label === "Newsletter") return showNewsletter;
        if (item.label === "Approvals") return roleForPerm === "admin" || roleForPerm === "manager";
        if (item.label === "License") return roleForPerm === "admin";
        if (item.label === "Audit") {
          const rule = (effectivePerm as any)["audit"];
          return (
            roleForPerm === "admin" ||
            ((auditActive || hasAuditReports) && roleForPerm === "manager") ||
            !!rule?.v
          );
        }
        const key = PAGE_LABEL_TO_KEY[item.label];
        if (!key) return true;
        const rule = (effectivePerm as any)[key];
        return !!rule?.v;
      });

    return filtered;
  }, [
    applyPrefix,
    auditActive,
    demo,
    effectivePerm,
    hasAuditReports,
    normalizedRole,
    roleForPerm,
    showNewsletter,
  ]);

  const actions = useMemo<ActionItem[]>(() => {
    const assetsRule = (effectivePerm as any)?.assets;
    const qrRule = (effectivePerm as any)?.qrcodes;
    const allowAssetEdit = roleForPerm === "admin" || !!assetsRule?.e;
    const allowQrView = roleForPerm === "admin" || !!qrRule?.v;

    const defs = [
      { label: "Add Asset", route: "/assets?new=1", icon: PlusCircle, allowed: allowAssetEdit },
      { label: "Bulk Import Assets", route: "/", icon: UploadCloud, allowed: allowAssetEdit },
      { label: "Generate QR Codes", route: "/qr-codes", icon: QrCode, allowed: allowQrView },
      { label: "New Ticket", route: "/tickets", icon: Ticket, allowed: true },
      { label: "Open Scanner", route: "/scan", icon: ScanLine, allowed: true },
    ];

    return defs
      .filter((item) => item.allowed)
      .map(({ route, allowed, ...rest }) => ({
        ...rest,
        path: applyPrefix(route),
      }));
  }, [applyPrefix, effectivePerm, roleForPerm]);

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
      <CommandList className="mt-3 space-y-3 px-3 pb-5">
        <CommandEmpty className="py-10 text-center text-sm text-muted-foreground/70">
          No results found.
        </CommandEmpty>
        <CommandGroup heading="Pages" className="px-2 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/70">
          {pages.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => go(item.path)}
                className="gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/10 transition-colors group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:ring-primary/20">
                  <Icon className="h-4 w-4 text-primary/70 group-data-[selected=true]:text-primary" />
                </div>
                <div className="flex flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium text-foreground group-data-[selected=true]:text-primary">{item.label}</span>
                  <span className="text-xs text-muted-foreground/80">
                    {item.path}
                  </span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator className="my-2 bg-border/60" />
        <CommandGroup heading="Actions" className="px-2 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/70">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.label}
                value={action.label}
                onSelect={() => go(action.path)}
                className="gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/10 transition-colors group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:ring-primary/20">
                  <Icon className="h-4 w-4 text-primary/70 group-data-[selected=true]:text-primary" />
                </div>
                <div className="flex flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium text-foreground group-data-[selected=true]:text-primary">{action.label}</span>
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
