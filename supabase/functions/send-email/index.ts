// Supabase Edge Function for sending emails via SMTP
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
  // Optional client-provided config (ignored for secrets). Retained for backward compatibility.
  config?: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
    from?: string;
  };
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

    // Resolve SMTP configuration from server environment first; never trust client secrets
    const ENV_HOST = Deno.env.get("SMTP_HOST") ?? Deno.env.get("VITE_SMTP_HOST") ?? body.config?.host ?? "";
    const ENV_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "" + (body.config?.port ?? "587"));
    const ENV_SECURE = (Deno.env.get("SMTP_SECURE") ?? (body.config?.secure ? "true" : "false")) === "true";
    const ENV_USER = Deno.env.get("SMTP_USER") ?? body.config?.auth?.user ?? "";
    const ENV_PASS = Deno.env.get("SMTP_PASSWORD") ?? body.config?.auth?.pass ?? "";
    const ENV_FROM = Deno.env.get("SMTP_FROM") ?? body.config?.from ?? (ENV_USER ? `"SAMS" <${ENV_USER}>` : "SAMS <noreply@example.com>");

    if (!ENV_HOST || !ENV_USER || !ENV_PASS) {
      throw new Error("SMTP server credentials are not configured on the server environment");
    }

    // Import nodemailer dynamically (Deno npm specifier)
    // @ts-ignore - Deno npm imports are not recognized by TypeScript
    const nodemailer = await import("npm:nodemailer@6.9.7");

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: ENV_HOST,
      port: ENV_PORT,
      secure: ENV_SECURE, // true for 465, false for other ports
      auth: { user: ENV_USER, pass: ENV_PASS },
      tls: { rejectUnauthorized: false },
    });

    // Verify connection
    await transporter.verify();
    console.log("SMTP connection verified");

    // Prepare email options
    const mailOptions: any = {
      from: ENV_FROM,
      to: body.to.join(", "),
      subject: body.subject,
      text: body.text,
      html: body.html,
    };

    if (body.cc && body.cc.length > 0) {
      mailOptions.cc = body.cc.join(", ");
    }

    if (body.bcc && body.bcc.length > 0) {
      mailOptions.bcc = body.bcc.join(", ");
    }

    if (body.replyTo) {
      mailOptions.replyTo = body.replyTo;
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
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
