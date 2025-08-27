import { Bell, Search, User, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Menu } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { listNotifications, addNotification, markAllRead, clearAllNotifications, type Notification } from "@/services/notifications";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authUser, setAuthUser] = useState<{ id: string; name: string; email: string } | null>(null);

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
      const raw = localStorage.getItem("auth_user");
      if (raw) setAuthUser(JSON.parse(raw));
    } catch {}
  }, []);

  // Notifications: load from service (Supabase or localStorage)
  useEffect(() => {
    (async () => {
      try {
        const data = await listNotifications(50);
        setNotifications(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount || "");

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
              placeholder="Search assets, properties, or users..."
              className="pl-10 bg-muted/50 h-9"
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
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  try {
                    localStorage.removeItem("current_user_id");
                    localStorage.removeItem("auth_user");
                  } catch {}
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}