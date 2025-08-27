import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

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
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createReport(payload: Omit<Report, "id" | "created_at">): Promise<Report> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data as Report;
}
