import NotFound from "@/pages/NotFound";
import { usePermissions } from "@/hooks/use-permissions";
import StartupReady from "@/components/common/StartupReady";

export function RequireView({ page, standalone, children }: { page: string; standalone?: boolean; children: React.ReactNode }) {
  const permissions = usePermissions();
  if (permissions.isPending) return null;
  return (
    <>
      {standalone && <StartupReady />}
      {permissions.can(page) ? children : <NotFound />}
    </>
  );
}
export default RequireView;
