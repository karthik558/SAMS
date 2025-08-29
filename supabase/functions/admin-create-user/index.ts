// @ts-nocheck
// Edge Function: admin-create-user
// Securely creates a Supabase Auth user using the service role.
// POST body: { email: string, password?: string, user_metadata?: object, email_confirm?: boolean }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const { email, password, user_metadata, email_confirm } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return new Response(JSON.stringify({ error: 'Missing env' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    // Verify caller identity via Authorization header
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const token = auth.replace(/^Bearer\s+/i, '');
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    // Check caller role via service role against app_users
    const adminClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const callerEmail = (userRes.user.email || '').toLowerCase();
  const { data: rows, error: roleErr } = await adminClient.from('app_users').select('id, role, email').eq('email', callerEmail).limit(1);
    if (roleErr) return new Response(JSON.stringify({ error: 'role check failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const caller = Array.isArray(rows) ? rows[0] : null;
    const role = String(caller?.role || '').toLowerCase();
    if (!caller || (role !== 'admin' && role !== 'manager')) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Create Auth user via Admin API
    const resp = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` },
      body: JSON.stringify({ email, password, email_confirm: email_confirm ?? true, user_metadata }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.error ?? data }), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = (e as any)?.message || 'unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
