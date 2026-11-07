// Run locally with server-only credentials. Dry-run by default; never logs secrets,
// confirms ownership, changes existing passwords, or sends email automatically.
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export function planAccounts(profiles, identities) {
  const byId = new Map(identities.map(user => [user.id, user]));
  const byEmail = new Map();
  for (const user of identities) {
    const email = (user.email || '').toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) || []), user]);
  }
  const counts = new Map();
  for (const profile of profiles) {
    const email = (profile.email || '').toLowerCase();
    counts.set(email, (counts.get(email) || 0) + 1);
  }
  return profiles.map(profile => {
    const email = (profile.email || '').toLowerCase();
    const sameId = byId.get(profile.id);
    const sameEmail = byEmail.get(email) || [];
    let status;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) status = 'INVALID_ACCOUNT';
    else if (counts.get(email) !== 1 || sameEmail.length > 1) status = 'DUPLICATE_EMAIL';
    else if (sameId && (sameId.email || '').toLowerCase() !== email) status = 'EMAIL_CONFLICT';
    else if (sameEmail.some(user => user.id !== profile.id)) status = 'ID_CONFLICT';
    else if (!sameId) status = 'CREATE_UNVERIFIED_AUTH';
    else if (!sameId.email_confirmed_at) status = 'VERIFY_EMAIL_AND_SET_PASSWORD';
    else status = 'EXISTING_AUTH_CHECK_SQL';
    return { id: profile.id, email, status };
  });
}

export async function prepareAccounts(client, { apply = false, report = () => {} } = {}) {
  const profiles = [];
  let offset = 0;
  while (true) {
    const { data, error, count } = await client.from('app_users').select('id,email', { count: 'exact' })
      .order('id').range(offset, offset + 999);
    if (error) throw new Error('Cannot read app_users; verify the server-side project credentials.');
    profiles.push(...data);
    offset += data.length;
    if (!data.length || offset >= count) break;
  }
  const identities = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('Cannot inspect Auth identities; no accounts have been changed.');
    identities.push(...data.users);
    if (!data.nextPage) break;
  }
  const plan = planAccounts(profiles, identities);
  for (const entry of plan) report(entry);
  const blocked = plan.some(entry => ['INVALID_ACCOUNT', 'DUPLICATE_EMAIL', 'EMAIL_CONFLICT', 'ID_CONFLICT'].includes(entry.status));
  if (blocked) throw new Error('Account conflicts require manual review. No accounts were created; do not change existing IDs or delete Auth identities.');
  if (!apply) return plan;
  for (const entry of plan.filter(entry => entry.status === 'CREATE_UNVERIFIED_AUTH')) {
    // A unique, undisclosed random password prevents a known/default login. The
    // owner must verify their email and set their own password through Auth.
    const { data, error } = await client.auth.admin.createUser({
      id: entry.id, email: entry.email, password: randomBytes(48).toString('base64url'), email_confirm: false,
    });
    if (error || data.user?.id !== entry.id) {
      report({ id: entry.id, email: entry.email, status: 'CREATE_FAILED' });
      throw new Error('Preparation stopped. Earlier successful creations remain; rerun the dry-run to inspect them. Check Auth logs and existing profile-creation triggers.');
    }
    report({ id: entry.id, email: entry.email, status: 'CREATED_UNVERIFIED_RESET_REQUIRED' });
  }
  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: node scripts/prepare-auth-users.mjs [--dry-run | --apply]');
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY locally. Never put the service key in VITE_ variables or paste it into chat.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await prepareAccounts(client, { apply: args.includes('--apply'), report: entry => console.log(`${entry.status}\t${entry.id}\t${entry.email}`) });
  console.log(args.includes('--apply')
    ? 'Preparation finished. No email was sent. Complete native Auth recovery/onboarding for unverified accounts, then run scripts/check-auth-accounts.sql. Apply the security migration only when every account is READY.'
    : 'Dry-run complete: no changes. Resolve conflicts before rerunning with --apply. Existing passwords and app profiles will not be modified.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
