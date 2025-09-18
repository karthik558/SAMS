import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { getCurrentUserId } from "@/services/permissions";

export type AuditScan = {
  id: string;
  session_id: string;
  asset_id: string;
  property_id?: string | null;
  department: string;
  status: "verified" | "damaged";
  scanned_by: string;
  scanned_by_name?: string | null;
  scanned_by_email?: string | null;
  scanned_at: string;
};

export async function verifyAssetViaScan(params: {
  sessionId: string; // text id to match audit_sessions.id type
  assetId: string;
  status: "verified" | "damaged";
  comment?: string | null;
}): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase.rpc("verify_asset_via_scan_v1", {
    p_session_id: params.sessionId,
    p_asset_id: params.assetId,
    p_status: params.status,
    p_scanned_by: userId,
    p_comment: params.comment ?? null,
  } as any);
  if (error) throw error;
}

export async function listMyScansForSession(sessionId: string): Promise<AuditScan[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const userId = getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("audit_scans")
    .select("*")
    .eq("session_id", sessionId)
    .eq("scanned_by", userId)
    .order("scanned_at", { ascending: false });
  if (error) throw error;
  const scans = (data as any[]) as AuditScan[];
  return scans.map((scan) => ({
    ...scan,
    scanned_by_name: scan.scanned_by_name ?? null,
    scanned_by_email: scan.scanned_by_email ?? null,
  }));
}
