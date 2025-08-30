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
      <div>
        <h1 className="heading-xl flex items-center gap-2">
          {Icon ? <Icon className="h-7 w-7" /> : null}
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
