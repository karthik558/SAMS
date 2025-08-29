// Vercel Serverless Function: admin-create-user
// Creates a Supabase Auth user with service role and returns the created user payload
// POST body: { email: string, password?: string, user_metadata?: object, email_confirm?: boolean }

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { email, password, user_metadata, email_confirm } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!email) {
      res.status(400).json({ error: 'email required' });
      return;
    }
    const SUPABASE_URL = process.env.SUPABASE_URL as string;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string | undefined;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
      return;
    }

    // Require Authorization header and validate caller's role (admin/manager)
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const token = String(authHeader).replace(/^Bearer\s+/i, '');
    if (!SUPABASE_ANON_KEY) {
      res.status(500).json({ error: 'Missing SUPABASE_ANON_KEY for auth verification' });
      return;
    }
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData?.user) {
      res.status(401).json({ error: 'invalid token' });
      return;
    }
    const callerEmail = (userData.user.email || '').toLowerCase();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    // Check caller's role from app_users by email (avoids id mismatches)
    const { data: callerRows, error: callerErr } = await (admin as any)
      .from('app_users')
      .select('id, role, email')
      .eq('email', callerEmail)
      .limit(1);
    if (callerErr) {
      res.status(500).json({ error: 'role check failed' });
      return;
    }
    const caller = Array.isArray(callerRows) ? callerRows[0] : null;
    const role = String(caller?.role || '').toLowerCase();
    if (!caller || (role !== 'admin' && role !== 'manager')) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const { data, error } = await (admin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: email_confirm === undefined ? true : !!email_confirm,
      user_metadata: user_metadata || {},
    });
    if (error) {
      res.status(400).json({ error: error.message || 'createUser failed' });
      return;
    }
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'unknown error' });
  }
}
