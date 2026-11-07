import { createClient } from "npm:@supabase/supabase-js@2.56.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const columns = "id,name,email,role,department,phone,last_login,status,avatar_url,must_change_password,password_changed_at,active_session_id";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
function profileInput(raw: Record<string, unknown>) {
  const profile: Record<string, unknown> = {};
  for (const key of ["name", "email", "department", "phone", "avatar_url"]) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (value !== null && (typeof value !== "string" || value.length > 2048)) throw new Error("Invalid profile");
    profile[key] = value;
  }
  if ("email" in profile) {
    if (typeof profile.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error("Invalid email");
    profile.email = profile.email.trim().toLowerCase();
  }
  if ("name" in profile && (typeof profile.name !== "string" || !profile.name.trim())) throw new Error("Name required");
  if ("role" in raw) {
    const role = String(raw.role).toLowerCase();
    if (!["admin", "manager", "user"].includes(role)) throw new Error("Invalid role");
    profile.role = role;
  }
  if ("status" in raw) {
    const status = String(raw.status).toLowerCase();
    if (!["active", "inactive"].includes(status)) throw new Error("Invalid status");
    profile.status = status === "active" ? "Active" : "Inactive";
  }
  if ("must_change_password" in raw) {
    if (typeof raw.must_change_password !== "boolean") throw new Error("Invalid password flag");
    profile.must_change_password = raw.must_change_password;
  }
  return profile;
}
function passwordInput(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) throw new Error("Password must contain 12–128 characters");
  return value;
}

export async function handleAccountRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const text = await req.text();
    if (text.length > 16_384) return reply(413, { error: "Request too large" });
    const body = JSON.parse(text);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, options);
    const publicAuth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, options);

    if (body.action === "login") {
      // No anonymous profile/credential lookup is returned to the browser.
      const identifier = String(body.identifier || "").trim().toLowerCase();
      if (!/^[a-z0-9._+-]{1,64}$/.test(identifier) || typeof body.password !== "string" || body.password.length > 128) {
        return reply(400, { error: "Invalid credentials" });
      }
      const { data: matches, error: lookupError } = await admin.from("app_users")
        .select("id,email,status").eq("login_name", identifier).limit(2);
      if (lookupError) return reply(503, { error: "Sign in unavailable" });
      const target = matches?.length === 1 ? matches[0] : null;
      // Always invoke Auth: its server-side rate limits govern password attempts.
      const { data, error } = await publicAuth.auth.signInWithPassword({
        email: target?.email || "unknown-account@invalid.example", password: body.password,
      });
      if (error || !target || target.status?.toLowerCase() !== "active" || data.user?.id !== target.id || !data.session) {
        return reply(401, { error: "Invalid credentials" });
      }
      return reply(200, { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
    }

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, { error: "Authentication required" });
    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return reply(401, { error: "Authentication required" });
    const { data: caller, error: callerError } = await admin.from("app_users")
      .select("id,role,status").eq("id", identity.user.id).single();
    if (callerError || caller?.role?.toLowerCase() !== "admin" || caller.status?.toLowerCase() !== "active") {
      return reply(403, { error: "Administrator access required" });
    }

    if (body.action === "create") {
      const raw = body.profile || {};
      const profile = profileInput(raw);
      if (!profile.email || !profile.name) return reply(400, { error: "Name and email required" });
      const password = passwordInput(raw.password);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: String(profile.email), password, email_confirm: true,
      });
      if (error || !created.user) return reply(400, { error: "Unable to create account. Check the email and password requirements." });
      const { data: user, error: insertError } = await admin.from("app_users").upsert({
        ...profile, id: created.user.id, role: profile.role || "user", status: profile.status || "Active",
      }).select(columns).single();
      if (insertError) {
        // Never leave a usable Auth account when profile/settings creation fails.
        const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
        if (cleanupError) console.error("Account creation cleanup required", created.user.id);
        return reply(500, { error: "Account creation failed" });
      }
      return reply(200, { user });
    }
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return reply(400, { error: "Invalid user" });
    const { data: target, error: targetError } = await admin.from("app_users").select("id,email").eq("id", body.id).single();
    if (targetError || !target) return reply(404, { error: "User not found" });
    if (body.action === "password") {
      const password = passwordInput(body.password);
      const { error } = await admin.auth.admin.updateUserById(body.id, { password });
      return error ? reply(400, { error: "Password update failed" }) : reply(200, { success: true });
    }
    if (body.action === "update") {
      const profile = profileInput(body.profile || {});
      // Email changes require Supabase's verified email flow; never silently change identity.
      if (profile.email && profile.email !== target.email.toLowerCase()) {
        return reply(400, { error: "Change email through the verified Supabase Auth email-change flow first." });
      }
      const { data: user, error } = await admin.from("app_users").update(profile).eq("id", body.id).select(columns).single();
      return error ? reply(400, { error: "Profile update failed" }) : reply(200, { user });
    }
    if (body.action === "delete") {
      if (body.id === caller.id) return reply(400, { error: "You cannot delete your own account" });
      // The FK cascades profile/settings deletion; database constraints can reject safely.
      const { error } = await admin.auth.admin.deleteUser(body.id);
      return error ? reply(400, { error: "User deletion failed" }) : reply(200, { success: true });
    }
    return reply(400, { error: "Unknown action" });
  } catch {
    return reply(400, { error: "Invalid account request. Passwords must contain 12–128 characters." });
  }
}

if (import.meta.main) Deno.serve(handleAccountRequest);
