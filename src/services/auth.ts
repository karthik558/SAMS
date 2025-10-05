import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type MinimalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  phone: string | null;
  status: string;
  avatar_url: string | null;
  must_change_password?: boolean;
};

const USERS_TABLE = "app_users";
const LS_USERS_KEY = "app_users_fallback";
const HASH_VERSION_PREFIX = "v1$";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function legacyHash(password: string): string {
  if (!password) return "";
  try {
    return btoa(unescape(encodeURIComponent(password))).slice(0, 32);
  } catch {
    return "";
  }
}

const hexTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

function bufferToHex(buffer: ArrayBufferLike): string {
  const view = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += hexTable[view[i]];
  }
  return out;
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (typeof globalThis.crypto?.subtle === "undefined") return null;
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return bufferToHex(digest);
  } catch {
    return null;
  }
}

function randomSalt(size = 16): Uint8Array {
  const salt = new Uint8Array(size);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < salt.length; i += 1) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return salt;
}

export async function createPasswordHash(password: string): Promise<string | null> {
  if (!password) return null;
  const saltHex = bufferToHex(randomSalt().buffer);
  const digest = await sha256Hex(`${saltHex}::${password}`);
  if (!digest) {
    // Fallback to legacy hash if WebCrypto is unavailable
    return legacyHash(password) || null;
  }
  return `${HASH_VERSION_PREFIX}${saltHex}$${digest}`;
}

function sanitizeUser(row: any): MinimalUser | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: (row.email || "").toLowerCase(),
    role: row.role,
    department: row.department ?? null,
    phone: row.phone ?? null,
    status: row.status ?? "inactive",
    avatar_url: row.avatar_url ?? null,
    must_change_password: row.must_change_password ?? false,
  };
}

async function fetchRemoteUserByEmail(email: string): Promise<any | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("id, name, email, role, department, phone, status, avatar_url, must_change_password, password_hash")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

function readLocalUsers(): any[] {
  try {
    const raw = localStorage.getItem(LS_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: any[]): void {
  try {
    localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
  } catch {}
}

function isModernHash(hash: string | null | undefined): boolean {
  return Boolean(hash && hash.startsWith(HASH_VERSION_PREFIX));
}

async function hashesMatch(password: string, storedHash: string): Promise<"match" | "legacy" | "nomatch"> {
  if (!storedHash) return "nomatch";
  if (isModernHash(storedHash)) {
    const [, saltHex, digest] = storedHash.split("$");
    if (!saltHex || !digest) return "nomatch";
    const computed = await sha256Hex(`${saltHex}::${password}`);
    if (!computed) {
      // If crypto fails, fall back to legacy comparison so users can still sign in
      return legacyHash(password) === storedHash ? "legacy" : "nomatch";
    }
    return computed === digest ? "match" : "nomatch";
  }
  return legacyHash(password) === storedHash ? "legacy" : "nomatch";
}

async function upgradeRemoteHash(userId: string, password: string): Promise<void> {
  if (!hasSupabaseEnv) return;
  const nextHash = await createPasswordHash(password);
  if (!nextHash) return;
  try {
    await supabase
      .from(USERS_TABLE)
      .update({ password_hash: nextHash, password_changed_at: new Date().toISOString(), must_change_password: false })
      .eq("id", userId);
  } catch {}
}

async function upgradeLocalHash(userId: string, password: string): Promise<void> {
  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  const nextHash = await createPasswordHash(password);
  if (!nextHash) return;
  users[idx].password_hash = nextHash;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

async function verifyWithSupabaseAuth(email: string, password: string, keepSession = false): Promise<boolean> {
  if (!hasSupabaseEnv) return false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return false;
    return true;
  } catch {
    return false;
  } finally {
    if (!keepSession) {
      try { await supabase.auth.signOut(); } catch {}
    }
  }
}

async function ensureSupabaseSession(email: string, password: string): Promise<void> {
  if (!hasSupabaseEnv) return;
  const target = (email || '').toLowerCase();
  try {
    const { data: userData } = await supabase.auth.getUser();
    const currentEmail = (userData?.user?.email || '').toLowerCase();
    if (userData?.user && currentEmail === target) {
      // Already the correct user
      return;
    }
    if (userData?.user && currentEmail !== target) {
      // Logged in as someone else – sign out first
      try { await supabase.auth.signOut(); } catch {}
    }
  } catch {}
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // If we cannot sign in as target, ensure we don't keep an old session
      try { await supabase.auth.signOut(); } catch {}
    }
  } catch {
    // non-fatal: app will still work with local-only persistence for some features
    try { await supabase.auth.signOut(); } catch {}
  }
}

export async function loginWithPassword(email: string, password: string): Promise<MinimalUser | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;

  if (hasSupabaseEnv) {
    const row = await fetchRemoteUserByEmail(normalized);
    if (!row) return null;
    if (!row.password_hash) {
      const valid = await verifyWithSupabaseAuth(normalized, password, true);
      if (!valid) return null;
      await upgradeRemoteHash(row.id, password);
      // Keep Supabase session for RLS-based tables
      try { await ensureSupabaseSession(normalized, password); } catch {}
      return sanitizeUser(row);
    }
    const outcome = await hashesMatch(password, row.password_hash);
    if (outcome === "nomatch") {
      const valid = await verifyWithSupabaseAuth(normalized, password, true);
      if (!valid) return null;
      await upgradeRemoteHash(row.id, password);
      try { await ensureSupabaseSession(normalized, password); } catch {}
      return sanitizeUser(row);
    }
    if (outcome === "legacy") {
      await upgradeRemoteHash(row.id, password);
    }
    // Establish Supabase session to enable RLS-aware features
    try { await ensureSupabaseSession(normalized, password); } catch {}
    return sanitizeUser(row);
  }

  const localUsers = readLocalUsers();
  const local = localUsers.find((u) => normalizeEmail(u.email || "") === normalized);
  if (!local || !local.password_hash) return null;
  const outcome = await hashesMatch(password, local.password_hash);
  if (outcome === "nomatch") return null;
  if (outcome === "legacy") {
    await upgradeLocalHash(local.id, password);
  }
  return sanitizeUser(local);
}

// Change own password via secure RPC (validates current password server-side)
export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized || !currentPassword || !newPassword) throw new Error("Missing fields");
  if (hasSupabaseEnv) {
    // Precompute hash client-side to avoid server digest dependency
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    const { error } = await supabase.rpc("self_set_password_hash_v1", {
      p_email: normalized,
      p_new_password_hash: hashed,
    } as any);
    if (error) throw error;
    return;
  }
  // Local fallback: verify and update locally
  const users = readLocalUsers();
  const idx = users.findIndex((u) => normalizeEmail(u.email || "") === normalized);
  if (idx === -1) throw new Error("User not found");
  const stored = users[idx].password_hash || "";
  const match = await hashesMatch(currentPassword, stored);
  if (match === "nomatch") throw new Error("INVALID_CURRENT_PASSWORD");
  const hashed = await createPasswordHash(newPassword);
  if (!hashed) throw new Error("Invalid new password");
  users[idx].password_hash = hashed;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

// Admin resets a user's password via secure RPC (verifies admin password server-side)
export async function adminSetUserPassword(adminEmail: string, adminPassword: string, targetUserId: string, newPassword: string): Promise<void> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  if (!normalizedAdmin || !targetUserId || !newPassword) throw new Error("Missing fields");
  if (hasSupabaseEnv) {
    const hashed = await createPasswordHash(newPassword);
    if (!hashed) throw new Error("Invalid new password");
    const { error } = await supabase.rpc("admin_set_user_password_hash_v1", {
      p_admin_email: normalizedAdmin,
      p_target_user_id: targetUserId,
      p_new_password_hash: hashed,
    } as any);
    if (error) throw error;
    return;
  }
  // Local fallback: update stored list
  const users = readLocalUsers();
  const idx = users.findIndex((u) => u.id === targetUserId);
  if (idx === -1) throw new Error("User not found");
  const hashed = await createPasswordHash(newPassword);
  if (!hashed) throw new Error("Invalid new password");
  users[idx].password_hash = hashed;
  users[idx].password_changed_at = new Date().toISOString();
  users[idx].must_change_password = false;
  writeLocalUsers(users);
}

export async function logout(): Promise<void> {
  try {
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("auth_user");
  } catch {}
  if (hasSupabaseEnv) {
    try { await supabase.auth.signOut(); } catch {}
  }
}

export async function updateLastLogin(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (hasSupabaseEnv && normalized) {
    try {
      const now = new Date().toISOString();
      await supabase.from(USERS_TABLE).update({ last_login: now }).eq("email", normalized);
    } catch {
      // best effort only
    }
    return;
  }

  const localUsers = readLocalUsers();
  const idx = localUsers.findIndex((u) => normalizeEmail(u.email || "") === normalized);
  if (idx === -1) return;
  localUsers[idx].last_login = new Date().toISOString();
  writeLocalUsers(localUsers);
}
