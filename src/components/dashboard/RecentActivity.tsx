import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const activities = [
  {
    id: 1,
    type: "asset_added",
    message: "New asset 'Dell Laptop' added to Main Office",
    user: "John Doe",
    userAvatar: "/placeholder-avatar.jpg",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    badge: "New",
    badgeVariant: "secondary" as const,
  },
  {
    id: 2,
    type: "qr_generated",
    message: "QR codes generated for 15 office chairs",
    user: "Sarah Wilson",
    userAvatar: "/placeholder-avatar.jpg",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    badge: "QR",
    badgeVariant: "default" as const,
  },
  {
    id: 3,
    type: "expiry_warning",
    message: "5 assets expiring within 30 days",
    user: "System",
    userAvatar: null,
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    badge: "Alert",
    badgeVariant: "destructive" as const,
  },
  {
    id: 4,
    type: "property_assigned",
    message: "Warehouse property assigned to Mike Johnson",
    user: "Admin",
    userAvatar: "/placeholder-avatar.jpg",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    badge: "Assignment",
    badgeVariant: "secondary" as const,
  },
  {
    id: 5,
    type: "report_generated",
    message: "Monthly asset report generated for April",
    user: "Emma Davis",
    userAvatar: "/placeholder-avatar.jpg",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    badge: "Report",
    badgeVariant: "outline" as const,
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest updates and changes in your asset management system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 animate-slide-in"
            >
              <Avatar className="h-8 w-8">
                {activity.userAvatar ? (
                  <AvatarImage src={activity.userAvatar} />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {activity.user
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground break-words">
                  {activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    by {activity.user}
                  </p>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              <Badge variant={activity.badgeVariant} className="text-xs">
                {activity.badge}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}