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
    <Card className={cn("surface-card-soft", className)}>
      <CardContent className={cn("space-y-3 p-5", contentClassName)}>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className={cn("h-4 w-4 text-primary", iconClassName)} />
          <span>{title}</span>
        </div>
        <div className={cn("text-3xl font-semibold tracking-tight text-foreground", valueClassName)}>
          {value}
        </div>
        {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
      </CardContent>
    </Card>
  );
}

export default MetricCard;
