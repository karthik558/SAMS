import { requirePermission } from "@/services/permissions";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type Report = {
  id: string;
  name: string;
  type: string;
  format: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  file_url: string | null;
  // Optional filter metadata to support correct downloads
  filter_session_id?: string | null;
  filter_department?: string | null;
  filter_property?: string | null;
  filter_asset_type?: string | null;
  created_by?: string | null;
  created_by_id?: string | null;
  created_at?: string;
};

const table = "reports";

export async function listReports(): Promise<Report[]> {
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_reports");
      const list: Report[] = raw ? JSON.parse(raw) : [];
      // ensure sorted desc by created_at
      return list.sort((a, b) => (a.created_at || "") < (b.created_at || "") ? 1 : -1);
    } catch {
      return [];
    }
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as Report[];
  // Enrich with local meta if DB lacks columns
  try {
    const raw = localStorage.getItem('report_meta');
    const meta = raw ? JSON.parse(raw) as Record<string, { created_by?: string|null; created_by_id?: string|null }> : {};
    return list.map(r => {
      if (r && !r.created_by && (meta as any)[r.id]) {
        const m = (meta as any)[r.id];
        return { ...r, created_by: m.created_by ?? null, created_by_id: m.created_by_id ?? null } as Report;
      }
      return r;
    });
  } catch {
    return list;
  }
}

export async function createReport(payload: Omit<Report, "id" | "created_at">): Promise<Report> {
  if (isDemoMode()) {
    const report: Report = {
      id: `RPT-${Math.floor(Math.random()*900000+100000)}`,
      name: payload.name,
      type: payload.type,
      format: payload.format,
      status: payload.status ?? "Completed",
      date_from: payload.date_from ?? null,
      date_to: payload.date_to ?? null,
      file_url: payload.file_url ?? null,
  filter_department: (payload as any).filter_department ?? null,
  filter_property: (payload as any).filter_property ?? null,
  filter_asset_type: (payload as any).filter_asset_type ?? null,
  created_by: (payload as any).created_by ?? null,
  created_by_id: (payload as any).created_by_id ?? null,
      created_at: new Date().toISOString(),
    } as Report;
    try {
      const raw = localStorage.getItem("demo_reports");
      const list: Report[] = raw ? JSON.parse(raw) : [];
      const updated = [report, ...list];
      localStorage.setItem("demo_reports", JSON.stringify(updated));
    } catch {}
    return report;
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  await requirePermission("reports", "create");
  const row = { ...payload };
  if (!row.filter_property || row.filter_property === "all") {
    const { data: allProperties, error: permissionError } = await supabase.rpc("app_user_can", { p_resource: "all_properties", p_action: "view" });
    if (permissionError) throw permissionError;
    if (!allProperties) {
      if (row.filter_session_id) {
        const { data, error } = await supabase.from("audit_sessions").select("property_id").eq("id", row.filter_session_id).single();
        if (error) throw error;
        row.filter_property = data.property_id;
      } else {
        const { data: identity } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("user_property_access").select("property_id").eq("user_id", identity.user?.id);
        if (error) throw error;
        if (data?.length !== 1) throw new Error("Choose a property for this report");
        row.filter_property = data[0].property_id;
      }
    }
  }
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data as Report;

}

export async function clearReports(): Promise<void> {
  await requirePermission("reports", "delete");
  if (isDemoMode()) {
    try { localStorage.setItem('demo_reports', JSON.stringify([])); } catch {}
    return;
  }
  if (!hasSupabaseEnv) {
    // No backend configured; treat as no-op so UI can proceed without an error
    try { localStorage.removeItem('report_meta'); } catch {}
    return;
  }
  let { error } = await supabase.from(table).delete().neq('id', '');
  if (error) {
    // Try RPC with SECURITY DEFINER function as a fallback
    const rpc = await supabase.rpc('delete_all_reports');
    if (rpc.error) throw rpc.error;
  }
  try { localStorage.removeItem('report_meta'); } catch {}
}
