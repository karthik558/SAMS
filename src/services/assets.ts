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

type AssetRow = {
  id: string;
  name: string;
  type: string;
  property: string | null;
  property_id: string | null;
  department: string | null;
  quantity: number | null;
  purchase_date: string | null;
  expiry_date: string | null;
  po_number: string | null;
  condition: string | null;
  status: string;
  location: string | null;
  description: string | null;
  serial_number: string | null;
  created_at: string | null;
};

type AssetWriteRow = Partial<{
  id: string;
  name: string;
  type: string;
  property: string | null;
  property_id: string | null;
  department: string | null;
  quantity: number | null;
  purchase_date: string | null;
  expiry_date: string | null;
  po_number: string | null;
  condition: string | null;
  status: string;
  location: string | null;
  description: string | null;
  serial_number: string | null;
}>;

// Helpers to convert between DB (snake_case) and app (camelCase)
function toCamel(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    property: row.property ?? "",
    property_id: row.property_id ?? null,
    department: row.department ?? null,
    quantity: row.quantity ?? 0,
    purchaseDate: row.purchase_date ?? null,
    expiryDate: row.expiry_date ?? null,
    poNumber: row.po_number ?? null,
    condition: row.condition ?? null,
    status: row.status,
    location: row.location ?? null,
    description: row.description ?? null,
    serialNumber: row.serial_number ?? null,
    created_at: row.created_at ?? undefined,
  };
}

function toSnake(asset: Partial<Asset>): AssetWriteRow {
  const row: AssetWriteRow = {};
  if (asset.id !== undefined) row.id = asset.id;
  if (asset.name !== undefined) row.name = asset.name;
  if (asset.type !== undefined) row.type = asset.type;
  if (asset.property !== undefined) row.property = asset.property;
  if (asset.property_id !== undefined) row.property_id = asset.property_id ?? null;
  if (asset.department !== undefined) row.department = asset.department ?? null;
  if (asset.quantity !== undefined) row.quantity = asset.quantity;
  if (asset.purchaseDate !== undefined) row.purchase_date = asset.purchaseDate ?? null;
  if (asset.expiryDate !== undefined) row.expiry_date = asset.expiryDate ?? null;
  if (asset.poNumber !== undefined) row.po_number = asset.poNumber ?? null;
  if (asset.condition !== undefined) row.condition = asset.condition ?? null;
  if (asset.status !== undefined) row.status = asset.status;
  if (asset.location !== undefined) row.location = asset.location ?? null;
  if (asset.description !== undefined) row.description = asset.description ?? null;
  if (asset.serialNumber !== undefined) row.serial_number = asset.serialNumber ?? null;
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
      const rows = (data ?? []) as AssetRow[];
      return rows.map(toCamel);
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
  return toCamel(data as AssetRow);
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<Asset> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  invalidateCache(ASSET_CACHE_KEY);
  return toCamel(data as AssetRow);
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
  const { data, error } = await supabase
    .from(table)
    .select(
      "id,name,type,property,property_id,department,quantity,purchase_date,expiry_date,po_number,condition,status,location,description,serial_number,created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toCamel(data as AssetRow) : null;
}
