import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, parseISO, isToday } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { listActivity, subscribeActivity, type Activity } from "@/services/activity";
import { History } from "lucide-react";

const mockActivities = [
  { id: 1, type: "seed", message: "Welcome to SAMS", user_name: "System", created_at: new Date().toISOString() },
];

export function RecentActivity() {
  const [items, setItems] = useState<Activity[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (isDemoMode()) {
        try {
          const data = await listActivity(100);
          setItems(data);
        } catch (e) {
          console.error(e);
          setItems(mockActivities as any);
        }
      } else if (hasSupabaseEnv) {
        try {
          // fetch a bigger window, then filter to today client-side
          const data = await listActivity(100);
          setItems(data);
          unsub = subscribeActivity((a) => {
            setItems((prev) => [a, ...prev].slice(0, 25));
          });
        } catch (e) {
          console.error(e);
          setItems(mockActivities as any);
        }
      } else {
        setItems(mockActivities as any);
      }
    })();
    return () => unsub();
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [items]);
  const todays = useMemo(() => {
    return sorted.filter((a) => {
      try {
        return isToday(parseISO(a.created_at));
      } catch {
        return false;
      }
    });
  }, [sorted]);
  const rows = useMemo(() => {
    if (showAll) return todays;
    return todays.slice(0, 8);
  }, [todays, showAll]);

  return (
    <Card className="rounded-xl border border-border/60 bg-card shadow-sm min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-2">
          <span className="rounded-full bg-primary/10 p-2 text-primary">
            <History className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
            <CardDescription className="text-xs text-muted-foreground sm:text-sm">
              Latest updates and changes in your asset management system
            </CardDescription>
          </div>
        </div>
        {todays.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="h-8 px-2 text-xs"
          >
            {showAll ? "Show less" : "Show all"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity today yet.</p>
          )}
          {rows.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 transition hover:border-border/70"
            >
              <Avatar className="h-8 w-8">
                {/* optional avatar url if you add it later */}
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {(activity.user_name || "System").split(" ").map((n) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" title={activity.message}>
                  {activity.message}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    by {activity.user_name || (() => { try { const raw = (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user') || localStorage.getItem('auth_user')); if (!raw) return 'System'; const u = JSON.parse(raw); return u?.name || u?.email || 'System'; } catch { return 'System'; } })()}
                  </p>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              <Badge variant="secondary" className="shrink-0 text-xs">
                {activity.type.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
