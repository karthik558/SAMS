import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoAssets } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";

export type Asset = {
  id: string; // e.g., AST-001
  name: string;
  type: string;
  property: string; // storing property code for display/filter
  property_id?: string | null;
  department?: string | null;
  quantity: number;
  purchaseDate: string | null;
  expiryDate: string | null;
  poNumber: string | null;
  condition: string | null;
  status: string;
  location?: string | null;
  description?: string | null;
  serialNumber?: string | null;
  created_at?: string;
};

const table = "assets";
const ASSET_CACHE_KEY = "assets:list";
const ASSET_CACHE_TTL = 60_000; // 1 minute keeps dashboards snappy without going stale

// Helpers to convert between DB (snake_case) and app (camelCase)
function toCamel(row: any): Asset {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    property: row.property,
  property_id: row.property_id ?? null,
    department: row.department ?? null,
    quantity: row.quantity,
    purchaseDate: row.purchase_date ?? null,
    expiryDate: row.expiry_date ?? null,
    poNumber: row.po_number ?? null,
    condition: row.condition ?? null,
    status: row.status,
  location: row.location ?? null,
  description: row.description ?? null,
  serialNumber: row.serial_number ?? null,
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
  if ("department" in asset) row.department = asset.department ?? null;
  if ("quantity" in asset) row.quantity = asset.quantity;
  if ("purchaseDate" in asset) row.purchase_date = asset.purchaseDate ?? null;
  if ("expiryDate" in asset) row.expiry_date = asset.expiryDate ?? null;
  if ("poNumber" in asset) row.po_number = asset.poNumber ?? null;
  if ("condition" in asset) row.condition = asset.condition ?? null;
  if ("status" in asset) row.status = asset.status;
  if ("location" in asset) row.location = asset.location ?? null;
  if ("description" in asset) row.description = asset.description ?? null;
  if ("serialNumber" in asset) row.serial_number = asset.serialNumber ?? null;
  return row;
}

export async function listAssets(options?: { force?: boolean }): Promise<Asset[]> {
  if (isDemoMode()) return getDemoAssets();
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  return getCachedValue(
    ASSET_CACHE_KEY,
    async () => {
      const { data, error } = await supabase
        .from(table)
        .select(
          "id,name,type,property,property_id,department,quantity,purchase_date,expiry_date,po_number,condition,status,location,description,serial_number,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toCamel);
    },
    { ttlMs: ASSET_CACHE_TTL, force: options?.force },
  );
}

export async function createAsset(asset: Asset): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(asset);
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  invalidateCache(ASSET_CACHE_KEY);
  return toCamel(data);
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  invalidateCache(ASSET_CACHE_KEY);
  return toCamel(data);
}

export async function deleteAsset(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  invalidateCache(ASSET_CACHE_KEY);
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
