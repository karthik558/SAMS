import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center", className)}>
      {Icon ? (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4" role="status" aria-live="polite">
      <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted/80" />
      <div className="h-20 animate-pulse rounded-lg bg-muted/60" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ title, description, onRetry, className }: { title: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={AlertTriangle}
      title={title}
      description={description}
      action={onRetry ? <Button type="button" size="sm" variant="outline" onClick={onRetry}>Try again</Button> : undefined}
    />
  );
}
