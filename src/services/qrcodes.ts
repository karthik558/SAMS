import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { getCachedValue, invalidateCacheByPrefix } from "@/lib/data-cache";

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
const QR_CODES_CACHE_KEY = "qrcodes:list";
const QR_CODES_CACHE_TTL = 30_000;

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

export async function listQRCodes(options?: { force?: boolean }): Promise<QRCode[]> {
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_qr_codes");
      const arr = raw ? (JSON.parse(raw) as QRCode[]) : [];
      return arr;
    } catch { return []; }
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  return await getCachedValue(
    QR_CODES_CACHE_KEY,
    async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, asset_id, property, generated_date, status, printed, image_url, created_at, assets(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toCamel);
    },
    { ttlMs: QR_CODES_CACHE_TTL, force: options?.force }
  );
}

export async function createQRCode(qr: QRCode): Promise<QRCode> {
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_qr_codes");
      const arr: QRCode[] = raw ? JSON.parse(raw) : [];
      arr.unshift(qr);
      localStorage.setItem("demo_qr_codes", JSON.stringify(arr));
      invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
      return qr;
    } catch {
      // fallback non-persistent
      return qr;
    }
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(qr);
  const { data, error } = await supabase.from(table).insert(payload).select("id, asset_id, property, generated_date, status, printed, image_url, created_at").single();
  if (error) throw error;
  const created = toCamel(data);
  invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
  return created;
}

export async function updateQRCode(id: string, patch: Partial<QRCode>): Promise<QRCode> {
  if (isDemoMode()) {
    try {
      const raw = localStorage.getItem("demo_qr_codes");
      const arr: QRCode[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((q) => q.id === id);
      if (idx >= 0) {
        const next = { ...arr[idx], ...patch } as QRCode;
        arr[idx] = next;
        localStorage.setItem("demo_qr_codes", JSON.stringify(arr));
        invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
        return next;
      }
      throw new Error("NOT_FOUND");
    } catch (e) {
      throw e instanceof Error ? e : new Error("UPDATE_FAILED");
    }
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const payload = toSnake(patch);
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select("id, asset_id, property, generated_date, status, printed, image_url, created_at").single();
  if (error) throw error;
  const updated = toCamel(data);
  invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
  return updated;
}

export async function deleteAllQRCodes(): Promise<void> {
  if (isDemoMode()) {
    try { localStorage.removeItem("demo_qr_codes"); } catch {}
    invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
    return;
  }
  if (!hasSupabaseEnv) throw new Error("NO_SUPABASE");
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) throw error;
  invalidateCacheByPrefix(QR_CODES_CACHE_KEY);
}
