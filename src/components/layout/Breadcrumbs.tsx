import { Link } from "react-router-dom";
import { isDemoMode } from "@/lib/demo";

type Crumb = { label: string; to?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span>›</span>}
            {c.to ? (
              <Link
                className="hover:text-foreground underline-offset-4 hover:underline"
                to={(() => {
                  if (!isDemoMode()) return c.to as string;
                  if (!c.to) return "#";
                  if (c.to === "/") return "/demo";
                  if (c.to.startsWith("/demo") || c.to.startsWith("/scan")) return c.to;
                  if (c.to.startsWith("/")) return `/demo${c.to}`;
                  return c.to;
                })()}
              >
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
