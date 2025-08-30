import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoAssets } from "@/lib/demo";

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
  const row: any = {};
  if ("id" in asset) row.id = asset.id;
  if ("name" in asset) row.name = asset.name;
  if ("type" in asset) row.type = asset.type;
  if ("property" in asset) row.property = asset.property;
  if ("property_id" in asset) row.property_id = asset.property_id ?? null;
  if ("quantity" in asset) row.quantity = asset.quantity;
  if ("purchaseDate" in asset) row.purchase_date = asset.purchaseDate ?? null;
  if ("expiryDate" in asset) row.expiry_date = asset.expiryDate ?? null;
  if ("poNumber" in asset) row.po_number = asset.poNumber ?? null;
  if ("condition" in asset) row.condition = asset.condition ?? null;
  if ("status" in asset) row.status = asset.status;
  if ("location" in asset) row.location = asset.location ?? null;
  return row;
}

export async function listAssets(): Promise<Asset[]> {
  if (isDemoMode()) return getDemoAssets();
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").order("id");
  if (error) throw error;
  return (data ?? []).map(toCamel);
}

export async function createAsset(asset: Asset): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(asset);
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return toCamel(data);
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return toCamel(data);
}

export async function deleteAsset(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (isDemoMode()) {
    const list = getDemoAssets();
    return list.find(a => a.id === id) || null;
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCamel(data) : null;
}
