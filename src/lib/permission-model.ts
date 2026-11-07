export type PageKey = string;
export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";
export type PermissionGrant = { v: boolean; c: boolean; e: boolean; d: boolean; x: boolean };
export type PermissionOverrides = Record<string, Partial<PermissionGrant>>;
export const PERMISSION_ACTIONS = [
  { action: "view", key: "v", label: "View" }, { action: "create", key: "c", label: "Create" },
  { action: "edit", key: "e", label: "Edit" }, { action: "delete", key: "d", label: "Delete" },
  { action: "export", key: "x", label: "Export / print" },
] as const;
export const PERMISSION_RESOURCES = ["dashboard", "assets", "properties", "qrcodes", "scan", "approvals", "tickets", "reports", "audit", "newsletter", "help", "users", "settings", "status", "license", "asset_import", "asset_compare", "amc_tracker", "food_expiry_tracker", "approval_review", "asset_types", "departments", "all_properties", "all_departments"];
export const emptyGrant = (): PermissionGrant => ({ v: false, c: false, e: false, d: false, x: false });
export function roleDefaults(roleRaw?: string): Record<string, PermissionGrant> {
  const role = roleRaw?.toLowerCase();
  const out = Object.fromEntries(PERMISSION_RESOURCES.map(key => [key, emptyGrant()]));
  if (role === "admin") return Object.fromEntries(PERMISSION_RESOURCES.map(key => [key, { v: true, c: true, e: true, d: true, x: true }]));
  for (const key of ["dashboard", "properties", "scan", "tickets", "newsletter", "help", "settings", "status"]) out[key].v = true;
  for (const key of ["assets", "qrcodes"]) out[key] = { v: true, c: true, e: true, d: false, x: false };
  out.tickets.c = true;
  if (role === "manager") {
    out.properties.c = true; out.properties.e = true;
    out.approvals.v = true; out.approvals.e = true;
    out.tickets.e = true; out.reports.v = true;
  }
  return out;
}
export function mergeDefaultsWithOverrides(role: string | undefined, overrides: PermissionOverrides): Record<string, PermissionGrant> {
  const defaults = roleDefaults(role);
  if (role?.toLowerCase() === "admin") return defaults;
  for (const [key, value] of Object.entries(overrides)) defaults[key] = { ...emptyGrant(), ...defaults[key], ...value };
  return defaults;
}
export function grantAllows(grant: Partial<PermissionGrant> | undefined, action: PermissionAction): boolean {
  if (!grant?.v) return false;
  const key = PERMISSION_ACTIONS.find(item => item.action === action)!.key;
  return !!grant[key];
}
export const validPermissionKey = (key: string) => /^[a-z][a-z0-9_.-]{0,63}$/.test(key);
