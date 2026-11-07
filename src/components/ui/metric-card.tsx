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
    <Card className={cn("relative min-w-0 overflow-hidden", className)}>
      <CardContent className={cn("p-4", contentClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <div className={cn("cq-metric-value truncate text-2xl font-semibold tabular-nums tracking-tight text-foreground", valueClassName)}>
              {value}
            </div>
            {caption ? <p className="cq-caption truncate text-xs text-muted-foreground">{caption}</p> : null}
          </div>
          <div className="shrink-0 rounded-lg bg-primary/10 p-2 ring-1 ring-inset ring-primary/15">
            <Icon className={cn("h-4 w-4 text-primary @min-[1100px]:h-5 @min-[1100px]:w-5", iconClassName)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
