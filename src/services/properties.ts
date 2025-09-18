import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoProperties } from "@/lib/demo";
import { getCachedValue, invalidateCache } from "@/lib/data-cache";

export type Property = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  status: string;
  manager: string | null;
  created_at?: string;
  updated_at?: string;
};

const table = "properties";
const PROPERTY_CACHE_KEY = "properties:list";
const PROPERTY_CACHE_TTL = 60_000;

type PropertyRow = {
  id: string;
  name: string;
  address: string | null;
  type: string;
  status: string;
  manager: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PropertyWriteRow = Partial<{
  id: string;
  name: string;
  address: string | null;
  type: string;
  status: string;
  manager: string | null;
}>;

function toCamel(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    type: row.type,
    status: row.status,
    manager: row.manager ?? null,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function toSnake(p: Partial<Property>): PropertyWriteRow {
  const row: PropertyWriteRow = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.address !== undefined) row.address = p.address ?? null;
  if (p.type !== undefined) row.type = p.type;
  if (p.status !== undefined) row.status = p.status;
  if (p.manager !== undefined) row.manager = p.manager ?? null;
  return row;
}

export async function listProperties(options?: { force?: boolean }): Promise<Property[]> {
  if (isDemoMode()) return getDemoProperties();
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  return getCachedValue(
    PROPERTY_CACHE_KEY,
    async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id,name,address,type,status,manager,created_at,updated_at")
        .order("id");
      if (error) throw error;
      const rows = (data ?? []) as PropertyRow[];
      return rows.map(toCamel);
    },
    { ttlMs: PROPERTY_CACHE_TTL, force: options?.force },
  );
}

export async function deleteProperty(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  invalidateCache(PROPERTY_CACHE_KEY);
}

export async function createProperty(p: Property): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).insert(toSnake(p)).select().single();
  if (error) throw error;
  invalidateCache(PROPERTY_CACHE_KEY);
  return toCamel(data as PropertyRow);
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).update(toSnake(patch)).eq("id", id).select().single();
  if (error) throw error;
  invalidateCache(PROPERTY_CACHE_KEY);
  return toCamel(data as PropertyRow);
}
