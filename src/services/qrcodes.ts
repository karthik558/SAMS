import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type QRCode = {
  id: string;
  assetId: string;
  assetName?: string | null;
  property: string | null;
  generatedDate: string; // YYYY-MM-DD
  status: string;
  printed: boolean;
  imageUrl: string | null;
  created_at?: string;
};

const table = "qr_codes";

function toCamel(row: any): QRCode {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.assets?.name ?? null,
    property: row.property ?? null,
    generatedDate: row.generated_date,
    status: row.status,
    printed: row.printed,
    imageUrl: row.image_url ?? null,
    created_at: row.created_at,
  };
}

function toSnake(qr: Partial<QRCode>) {
  return {
    id: qr.id,
    asset_id: qr.assetId,
    property: qr.property ?? null,
    generated_date: qr.generatedDate,
    status: qr.status,
    printed: qr.printed,
    image_url: qr.imageUrl ?? null,
  };
}

export async function listQRCodes(): Promise<QRCode[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase
    .from(table)
    .select("id, asset_id, property, generated_date, status, printed, image_url, created_at, assets(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCamel);
}

export async function createQRCode(qr: QRCode): Promise<QRCode> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(qr);
  const { data, error } = await supabase.from(table).insert(payload).select("id, asset_id, property, generated_date, status, printed, image_url, created_at").single();
  if (error) throw error;
  return toCamel(data);
}

export async function updateQRCode(id: string, patch: Partial<QRCode>): Promise<QRCode> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select("id, asset_id, property, generated_date, status, printed, image_url, created_at").single();
  if (error) throw error;
  return toCamel(data);
}

export async function deleteAllQRCodes(): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) throw error;
}
