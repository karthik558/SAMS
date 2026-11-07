import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({ icon: Icon, title, description, actions, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="heading-xl flex items-center gap-2">
          {Icon ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span> : null}
          {title}
        </h1>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground mt-2">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
