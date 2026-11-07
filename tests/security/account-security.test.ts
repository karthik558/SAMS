import { handleAccountRequest } from "../../supabase/functions/account-security/index.ts";

const adminId = "10000000-0000-0000-0000-000000000001";
const targetId = "10000000-0000-0000-0000-000000000002";
Deno.env.set("SUPABASE_URL", "https://security-test.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json" },
});
const request = (body: unknown, token?: string) => new Request("https://example.com/account-security", {
  method: "POST", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

Deno.test("account administration requires a valid JWT, independent of supplied admin email", async () => {
  const response = await handleAccountRequest(request({ action: "password", id: targetId, adminEmail: "admin@example.com", password: "strong-password-123" }));
  assert(response.status === 401, "anonymous password reset must fail");
});

Deno.test("forged JWT metadata cannot grant administrator privileges; inactive admins are denied", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const caller of [{ role: "user", status: "Active" }, { role: "admin", status: "Inactive" }]) {
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") return json({ id: adminId, email: "user@example.com", user_metadata: { role: "admin" } });
        if (url.pathname === "/rest/v1/app_users") return json({ id: adminId, ...caller });
        throw new Error(`Unexpected privileged request ${url.pathname}`);
      };
      const response = await handleAccountRequest(request({ action: "password", id: targetId, password: "strong-password-123" }, "verified-user-token"));
      assert(response.status === 403, "database role/status must govern administration");
    }
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("admin creation sends credentials only to Auth, strips arbitrary profile fields and rolls back failed profiles", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const failProfile of [false, true]) {
      let authCreated = false;
      let profileWritten = false;
      let authDeleted = false;
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") return json({ id: adminId, email: "admin@example.com" });
        if (url.pathname === "/auth/v1/admin/users" && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          assert(body.password === "strong-password-123", "Auth must receive password");
          authCreated = true;
          return json({ id: targetId, email: "new@example.com" });
        }
        if (url.pathname === `/auth/v1/admin/users/${targetId}` && init?.method === "DELETE") {
          authDeleted = true;
          return json({});
        }
        if (url.pathname === "/rest/v1/rpc/app_create_profile_with_access" && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          assert(!("password" in body.p_profile) && !("password_hash" in body.p_profile), "profile must never contain credentials");
          assert(body.p_id === targetId && body.p_profile.role === "user", "Auth owns identity and profile role is normalized");
          assert(Array.isArray(body.p_property_ids) && typeof body.p_permissions === "object", "scope and permissions must be saved in the profile transaction");
          profileWritten = true;
          return failProfile ? json({ message: "db failure", code: "23514" }, 400) : json({ ...body.p_profile, id: body.p_id });
        }
        if (url.pathname === "/rest/v1/app_users") return json({ id: adminId, role: "admin", status: "Active" });
        throw new Error(`Unexpected request ${url.pathname}`);
      };
      const response = await handleAccountRequest(request({ action: "create", profile: {
        name: "New user", email: "new@example.com", password: "strong-password-123", password_hash: "injected-hash", role: "User", id: adminId,
      } }, "admin-token"));
      assert(authCreated && profileWritten, "both Auth and profile creation must run");
      assert(response.status === (failProfile ? 500 : 200), "must report actual outcome");
      assert(authDeleted === failProfile, "failed profile must clean up Auth account");
      assert(!(await response.text()).includes("strong-password-123"), "response must not expose password");
    }
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("unknown and inactive usernames return generic failures and never expose the directory", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const matches of [[], [{ id: targetId, email: "inactive@example.com", status: "Inactive" }]]) {
      let authAttempted = false;
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/rest/v1/app_users") return json(matches);
        if (url.pathname === "/auth/v1/token") {
          authAttempted = true;
          return json({ access_token: "secret-access", refresh_token: "secret-refresh", expires_in: 3600, token_type: "bearer", user: { id: targetId } });
        }
        throw new Error(`Unexpected request ${url.pathname}`);
      };
      const response = await handleAccountRequest(request({ action: "login", identifier: "someone", password: "strong-password-123" }));
      assert(authAttempted, "even unknown accounts go through Auth throttling");
      assert(response.status === 401, "inactive and unknown accounts denied");
      assert(await response.text() === '{"error":"Invalid credentials"}', "no profile/session exposed");
    }
  } finally { globalThis.fetch = originalFetch; }
});
