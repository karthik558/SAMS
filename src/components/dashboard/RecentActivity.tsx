import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listActivity, logActivity, subscribeActivity, type Activity } from "@/services/activity";

const mockActivities = [
  { id: 1, type: "seed", message: "Welcome to SAMS", user_name: "System", created_at: new Date().toISOString() },
];

export function RecentActivity() {
  const [items, setItems] = useState<Activity[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (hasSupabaseEnv) {
        try {
          const data = await listActivity(25);
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
  const rows = useMemo(() => {
    if (showAll) return sorted;
    return sorted.slice(0, 8);
  }, [sorted, showAll]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates and changes in your asset management system
          </CardDescription>
        </div>
        {sorted.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setShowAll(v => !v)}
            className="shrink-0 h-8 px-2 text-xs"
          >
            {showAll ? "Show less" : "Show all"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 animate-slide-in"
            >
              <Avatar className="h-8 w-8">
                {/* optional avatar url if you add it later */}
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {(activity.user_name || "System").split(" ").map((n) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground break-words">
                  {activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    by {activity.user_name || "System"}
                  </p>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              <Badge variant="secondary" className="text-xs">
                {activity.type.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}