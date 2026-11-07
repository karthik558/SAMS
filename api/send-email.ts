import { createClient } from "@supabase/supabase-js";
// Vercel API route to send email via Resend
// Requires Vercel env vars: RESEND_API_KEY, RESEND_FROM, EMAIL_ENABLED (optional)

export default async function handler(req: any, res: any) {
  // CORS (simple)
  const origin = req.headers?.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  const reqHdrs = req.headers?.["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof reqHdrs === "string" && reqHdrs ? reqHdrs : "content-type, authorization"
  );

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const token = req.headers?.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: identity, error: authError } = await db.auth.getUser(token);
    if (authError || !identity.user) return res.status(401).json({ error: "Authentication required" });
    const { data: profile, error: profileError } = await db.from("app_users").select("status").eq("id", identity.user.id).single();
    if (profileError || profile?.status?.toLowerCase() !== "active") return res.status(403).json({ error: "Active account required" });
    res.setHeader("Cache-Control", "no-store");
    const emailEnabled = (process.env.EMAIL_ENABLED ?? "true") !== "false";
    if (!emailEnabled) {
      return res.status(200).json({ success: false, skipped: true, reason: "disabled" });
    }

    const { to, cc, bcc, subject, html, text, replyTo } = req.body || {};
    if (!to || !subject || !html || !text) {
      return res.status(400).json({ error: "Missing required fields (to, subject, html, text)" });
    }

    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.RESEND_FROM || "SAMS <noreply@example.com>";
    if (!apiKey) {
      return res.status(500).json({ error: "RESEND_API_KEY not configured" });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        cc,
        bcc,
        subject,
        html,
        text,
        reply_to: replyTo,
      }),
    });

    if (!resp.ok) {
      return res.status(502).json({ error: "Email delivery failed" });
    }
    const json = await resp.json();
    return res.status(200).json({ success: true, provider: "resend", messageId: json?.id });
  } catch (err: any) {
    return res.status(500).json({ error: "Email delivery failed" });
  }
}
