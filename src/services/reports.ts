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
  filter_department?: string | null;
  filter_property?: string | null;
  filter_asset_type?: string | null;
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
  return data ?? [];
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
  // Attempt insert with all fields; if columns are missing in DB, retry without filter_* fields
  let result = await supabase.from(table).insert(payload).select().single();
  if (result.error) {
    const msg = (result.error.message || '').toString();
    const code = (result.error as any).code || '';
    const looksLikeMissingColumn = /column .* does not exist/i.test(msg) || /filter_(department|property|asset_type)/i.test(msg) || code === '42703';
    if (looksLikeMissingColumn) {
      const cleaned: any = { ...payload };
      delete cleaned.filter_department;
      delete cleaned.filter_property;
      delete cleaned.filter_asset_type;
      const retry = await supabase.from(table).insert(cleaned).select().single();
      if (retry.error) throw retry.error;
      return retry.data as Report;
    }
    throw result.error;
  }
  return result.data as Report;
}
