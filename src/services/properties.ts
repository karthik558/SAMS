import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode, getDemoProperties } from "@/lib/demo";

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

function toCamel(row: any): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? null,
    type: row.type,
    status: row.status,
    manager: row.manager ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSnake(p: Partial<Property>) {
  return {
    id: p.id,
    name: p.name,
    address: p.address ?? null,
    type: p.type,
    status: p.status,
    manager: p.manager ?? null,
  };
}

export async function listProperties(): Promise<Property[]> {
  if (isDemoMode()) return getDemoProperties();
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).select("*").order("id");
  if (error) throw error;
  return (data ?? []).map(toCamel);
}

export async function deleteProperty(id: string): Promise<void> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function createProperty(p: Property): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).insert(toSnake(p)).select().single();
  if (error) throw error;
  return toCamel(data);
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<Property> {
  if (isDemoMode()) throw new Error("DEMO_READONLY");
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { data, error } = await supabase.from(table).update(toSnake(patch)).eq("id", id).select().single();
  if (error) throw error;
  return toCamel(data);
}
