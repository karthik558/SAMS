import NotFound from "@/pages/NotFound";
import { usePermissions } from "@/hooks/use-permissions";
export function RequireView({ page, children }: { page: string; children: React.ReactNode }) {
  const permissions = usePermissions();
  if (permissions.isPending) return null;
  return permissions.can(page) ? <>{children}</> : <NotFound />;
}
export default RequireView;
