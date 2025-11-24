import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  iconClassName?: string;
  valueClassName?: string;
  className?: string;
  contentClassName?: string;
};

export function MetricCard({
  icon: Icon,
  title,
  value,
  caption,
  iconClassName,
  valueClassName,
  className,
  contentClassName,
}: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md", className)}>
      <CardContent className={cn("p-6", contentClassName)}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className={cn("text-2xl font-bold tracking-tight text-foreground", valueClassName)}>
              {value}
            </div>
            {caption && <p className="text-xs text-muted-foreground/80">{caption}</p>}
          </div>
          <div className="rounded-xl bg-primary/5 p-2.5 ring-1 ring-inset ring-primary/10">
            <Icon className={cn("h-5 w-5 text-primary", iconClassName)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
