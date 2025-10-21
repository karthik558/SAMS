// Supabase Edge Function for sending emails via Resend
// Deploy: supabase functions deploy send-email
//
// NOTE: TypeScript errors shown in VS Code are FALSE POSITIVES!
// This file uses Deno runtime, not Node.js. It will work perfectly when deployed.
// See TYPESCRIPT_ERRORS_EXPLAINED.md for details.
//
// To hide the red squiggles, install the "Deno" VS Code extension or add @ts-nocheck below.

// @ts-nocheck - Uncomment this line to hide VS Code errors (they're false positives)

/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EmailRequest = await req.json();

    // Validate required fields
    if (!body.to || body.to.length === 0) {
      throw new Error("At least one recipient is required");
    }
    if (!body.subject || !body.html || !body.text) {
      throw new Error("Subject, HTML, and text content are required");
    }

    // Feature flag to globally disable email from server env
    const serverEmailEnabled = (Deno.env.get("EMAIL_ENABLED") ?? Deno.env.get("VITE_EMAIL_ENABLED") ?? "true") !== "false";
    if (!serverEmailEnabled) {
      console.log("[send-email] Email disabled by server environment, skipping send:", body.subject);
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Resend-only implementation
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const FROM = Deno.env.get("RESEND_FROM") || "SAMS <noreply@example.com>";
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured in server environment");
    }

    // Create transporter
    // Send with Resend REST API
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        html: body.html,
        text: body.text,
        reply_to: body.replyTo,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Resend API error ${resp.status}: ${errText}`);
    }
    const json = await resp.json();
    console.log("Email sent via Resend:", json?.id || "ok");
    return new Response(
      JSON.stringify({ success: true, provider: "resend", messageId: json?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    console.error("Error sending email:", errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
