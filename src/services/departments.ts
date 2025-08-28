import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type Department = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
};

const table = "departments";
const LS_KEY = "departments_fallback";

function seedLocalIfEmpty(): Department[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Department[];
  } catch {}
  const now = new Date().toISOString();
  const seeded: Department[] = [
    { id: crypto?.randomUUID?.() || "IT", name: "IT", code: "IT", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "HR", name: "HR", code: "HR", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "FIN", name: "Finance", code: "FIN", is_active: true, created_at: now },
    { id: crypto?.randomUUID?.() || "OPS", name: "Operations", code: "OPS", is_active: true, created_at: now },
  ];
  try { localStorage.setItem(LS_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function readLocal(): Department[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? (JSON.parse(raw) as Department[]) : seedLocalIfEmpty(); } catch { return seedLocalIfEmpty(); }
}

function writeLocal(list: Department[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export async function listDepartments(): Promise<Department[]> {
  if (!hasSupabaseEnv) return readLocal();
  try {
    const { data, error } = await supabase.from(table).select("*").order("name");
    if (error) throw error;
    const remote = (data || []) as Department[];
    // Merge with local cache to bridge RLS-hidden rows or offline edits,
    // and de-duplicate by normalized name (case-insensitive).
    const local = readLocal();
    const byName = new Map<string, Department>();
    const add = (d?: Department) => {
      if (!d) return;
      const key = (d.name || '').trim().toLowerCase() || d.id;
      if (!key) return;
      if (!byName.has(key)) byName.set(key, d);
    };
    for (const d of remote) add(d);
    for (const d of local) add(d);
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return readLocal();
  }
}

export async function createDepartment(payload: { name: string; code?: string | null; is_active?: boolean; id?: string; }): Promise<Department> {
  const id = payload.id || (crypto?.randomUUID?.() || String(Date.now()));
  const record: Omit<Department, "created_at"> & { created_at?: string } = {
    id,
    name: payload.name,
    code: payload.code ?? null,
    is_active: payload.is_active ?? true,
  };
  if (!hasSupabaseEnv) {
    const list = readLocal();
    const now = new Date().toISOString();
    const created: Department = { ...record, created_at: now } as Department;
    writeLocal([created, ...list]);
    return created;
  }
  try {
    const { data, error } = await supabase.from(table).insert({ ...record, created_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    // Mirror to local cache so UI can still read via fallback if SELECT is blocked by RLS
    try {
      const local = readLocal();
      const exists = local.find(d => d.id === (data as any).id);
      const merged = exists ? local.map(d => d.id === (data as any).id ? (data as Department) : d) : [data as Department, ...local];
      writeLocal(merged);
    } catch {}
    return data as Department;
  } catch {
    // Fallback to local if Supabase fails
    const list = readLocal();
    const now = new Date().toISOString();
    const created: Department = { ...record, created_at: now } as Department;
    writeLocal([created, ...list]);
    return created;
  }
}

export async function updateDepartment(id: string, patch: Partial<Pick<Department, "name" | "code" | "is_active">>): Promise<Department> {
  if (!hasSupabaseEnv) {
    const list = readLocal();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Not found");
    const updated = { ...list[idx], ...patch } as Department;
    const next = [...list];
    next[idx] = updated;
    writeLocal(next);
    return updated;
  }
  try {
    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
    if (error) throw error;
    // Mirror to local cache
    try {
      const local = readLocal();
      const idx = local.findIndex(d => d.id === id);
      if (idx >= 0) { local[idx] = data as Department; writeLocal([...local]); }
    } catch {}
    return data as Department;
  } catch {
    const list = readLocal();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Not found");
    const updated = { ...list[idx], ...patch } as Department;
    const next = [...list];
    next[idx] = updated;
    writeLocal(next);
    return updated;
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  if (!hasSupabaseEnv) {
    const next = readLocal().filter(d => d.id !== id);
    writeLocal(next);
    return;
  }
  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  // Mirror local cache
  try { const next = readLocal().filter(d => d.id !== id); writeLocal(next); } catch {}
  } catch {
    const next = readLocal().filter(d => d.id !== id);
    writeLocal(next);
  }
}
