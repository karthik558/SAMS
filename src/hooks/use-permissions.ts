import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId } from "@/services/permissions";
import { grantAllows, roleDefaults, type PermissionAction, type PermissionGrant } from "@/lib/permission-model";
export function usePermissions() {
  const query = useQuery({ queryKey: ["current-permissions", getCurrentUserId()], queryFn: async () => {
    if (isDemoMode()) return roleDefaults("admin");
    const { data, error } = await supabase.rpc("app_current_permissions");
    if (error) throw error;
    return data as Record<string, PermissionGrant>;
  }, staleTime: 5_000, refetchInterval: 30_000, retry: false });
  return { ...query, can: (resource: string, action: PermissionAction = "view") => grantAllows(query.data?.[resource], action) };
}
