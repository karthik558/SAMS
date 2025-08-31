import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type ItemType = { name: string; created_at?: string };

const table = "asset_types";

export async function listItemTypes(): Promise<ItemType[]> {
  const defaults = ["Furniture","Electronics","Vehicles","Machinery","Office Supplies","Other"]; 
  if (!hasSupabaseEnv) {
    return defaults.map((n) => ({ name: n }));
  }
  try {
    const { data, error } = await supabase.from(table).select("name, created_at").order("name");
    if (error) throw error;
    if (!data || data.length === 0) {
      await supabase.from(table).upsert(defaults.map((n) => ({ name: n })), { onConflict: "name" });
      return defaults.map((n) => ({ name: n }));
    }
    return data as ItemType[];
  } catch (e) {
    console.warn("asset_types unavailable, falling back to defaults", e);
    return defaults.map((n) => ({ name: n }));
  }
}

export async function createItemType(name: string): Promise<ItemType> {
  if (!name || !name.trim()) throw new Error("Type name required");
  if (!hasSupabaseEnv) {
    // local no-op; return shape for UI
    return { name };
  }
  const { data, error } = await supabase.from(table).insert({ name }).select("name, created_at").single();
  if (error) throw error;
  return data as ItemType;
}

export async function deleteItemType(name: string): Promise<void> {
  if (!name || !name.trim()) throw new Error("Type name required");
  if (!hasSupabaseEnv) return; // local no-op
  // Try privileged RPC first (if present) to bypass RLS and guard referential integrity
  const rpc = await supabase.rpc("delete_asset_type_v1", { p_name: name });
  if (!rpc.error) return;
  // Fallback to direct delete (may fail under RLS)
  const { error } = await supabase.from(table).delete().eq("name", name);
  if (error) throw error;
}
