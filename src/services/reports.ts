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
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data as Report;
}
