import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { emptyGrant, validPermissionKey, type PermissionAction, type PermissionGrant, type PermissionOverrides, type PageKey } from "@/lib/permission-model";
export { roleDefaults, mergeDefaultsWithOverrides, PERMISSION_RESOURCES } from "@/lib/permission-model";
export type { PageKey, PermissionGrant, PermissionAction } from "@/lib/permission-model";
export type UserPermission = { id?: string; user_id: string; page: PageKey; can_view: boolean; can_edit: boolean; can_create?: boolean; can_delete?: boolean; can_export?: boolean };
export function getCurrentUserId(): string | null {
  return localStorage.getItem(isDemoMode() ? "demo_current_user_id" : "current_user_id");
}
export async function listUserPermissions(userId: string): Promise<Record<string, PermissionGrant>> {
  if (isDemoMode()) return JSON.parse(localStorage.getItem("demo_user_permissions") || "{}")[userId] || {};
  if (!hasSupabaseEnv) throw new Error("Authentication required");
  const { data, error } = await supabase.from("user_permissions").select("page,can_view,can_create,can_edit,can_delete,can_export").eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [row.page, { v: !!row.can_view, c: !!row.can_create, e: !!row.can_edit, d: !!row.can_delete, x: !!row.can_export }]));
}
export async function setUserPermissions(userId: string, permissions: PermissionOverrides): Promise<void> {
  if (!Object.keys(permissions).every(validPermissionKey)) throw new Error("Invalid permission key");
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("Authentication required");
  const previous = await listUserPermissions(userId);
  const rows = Object.entries(permissions).map(([page, patch]) => {
    const value = { ...emptyGrant(), ...previous[page], ...patch };
    return { user_id: userId, page, can_view: value.v, can_create: value.c, can_edit: value.e, can_delete: value.d, can_export: value.x };
  });
  if (!rows.length) return;
  const { error } = await supabase.from("user_permissions").upsert(rows, { onConflict: "user_id,page" });
  if (error) throw error;
}
export async function requirePermission(resource: PageKey, action: PermissionAction): Promise<void> {
  if (isDemoMode()) return;
  if (!hasSupabaseEnv) throw new Error("Authentication required");
  const { data, error } = await supabase.rpc("app_user_can", { p_resource: resource, p_action: action });
  if (error) throw error;
  if (data !== true) throw new Error(`You do not have ${action} permission for ${resource.replace(/_/g, " ")}.`);
}
export async function canUserView(userId: string, page: PageKey): Promise<boolean | null> {
  const permissions = await listUserPermissions(userId);
  return page in permissions ? permissions[page].v : null;
}
export async function canUserEdit(userId: string, page: PageKey): Promise<boolean | null> {
  const permissions = await listUserPermissions(userId);
  return page in permissions ? permissions[page].v && permissions[page].e : null;
}

export type UserAccessDraft = { permissions: PermissionOverrides; propertyIds: string[]; departments: string[] };
export async function saveUserAccess(userId: string, access: UserAccessDraft): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  const { error } = await supabase.rpc("app_save_user_access", {
    p_user_id: userId, p_permissions: access.permissions, p_property_ids: access.propertyIds, p_departments: access.departments,
  });
  if (error) throw error;
}
