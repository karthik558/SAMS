import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type Asset = {
  id: string; // e.g., AST-001
  name: string;
  type: string;
  property: string; // storing property code for display/filter
  property_id?: string | null;
  quantity: number;
  purchaseDate: string | null;
  expiryDate: string | null;
  poNumber: string | null;
  condition: string | null;
  status: string;
  location?: string | null;
  created_at?: string;
};

const table = "assets";

// Helpers to convert between DB (snake_case) and app (camelCase)
function toCamel(row: any): Asset {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    property: row.property,
  property_id: row.property_id ?? null,
    quantity: row.quantity,
    purchaseDate: row.purchase_date ?? null,
    expiryDate: row.expiry_date ?? null,
    poNumber: row.po_number ?? null,
    condition: row.condition ?? null,
    status: row.status,
  location: row.location ?? null,
    created_at: row.created_at,
  };
}

function toSnake(asset: Partial<Asset>) {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    property: asset.property,
  property_id: asset.property_id ?? null,
    quantity: asset.quantity,
    purchase_date: asset.purchaseDate ?? null,
    expiry_date: asset.expiryDate ?? null,
    po_number: asset.poNumber ?? null,
    condition: asset.condition ?? null,
    status: asset.status,
  location: asset.location ?? null,
  };
}

export async function listAssets(): Promise<Asset[]> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").order("id");
  if (error) throw error;
  return (data ?? []).map(toCamel);
}

export async function createAsset(asset: Asset): Promise<Asset> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(asset);
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return toCamel(data);
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return toCamel(data);
}

export async function deleteAsset(id: string): Promise<void> {
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
