import React from "react";
import { Link } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

type Crumb = { label: string; to?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items?.length) return null;

  const resolvePath = (path?: string) => {
    if (!isDemoMode()) return path as string;
    if (!path) return "#";
    if (path === "/") return "/demo";
    if (path.startsWith("/demo") || path.startsWith("/scan")) return path;
    if (path.startsWith("/")) return `/demo${path}`;
    return path;
  };

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList className="bg-muted/40 px-4 py-2 rounded-full border border-border/50 inline-flex">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          const isHome = i === 0 && (c.to === "/" || c.label.toLowerCase() === "dashboard");

          return (
            <React.Fragment key={i}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-semibold text-foreground flex items-center gap-1.5">
                    {isHome && <Home className="h-3.5 w-3.5" />}
                    {c.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={resolvePath(c.to)}
                      className="flex items-center gap-1.5 transition-colors hover:text-primary"
                    >
                      {isHome && <Home className="h-3.5 w-3.5" />}
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
