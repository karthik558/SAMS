// Read-only counts. Uses existing local server environment; never prints secrets
// or record contents, and never changes IDs or account state.
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const oldId = '2770d961-ac8c-4c84-8fd8-5d1d3c598c1b';
const authId = 'de75fd22-93eb-4c6f-9ae4-43829322a2e3';
const columns = [
  ['app_users','id'], ['assets','created_by'], ['audit_incharge','user_id'],
  ['audit_scans','scanned_by'], ['final_approvers','created_by'], ['final_approvers','user_id'],
  ['notifications','user_id'], ['password_reset_requests','user_id'], ['recent_activity','user_id'],
  ['reports','created_by'], ['reports','created_by_id'], ['tickets','created_by'],
  ['user_department_access','user_id'], ['user_permissions','user_id'],
  ['user_preferences','user_id'], ['user_property_access','user_id'], ['user_settings','user_id'],
];
let failed = false;
for (const [table, column] of columns) {
  const results = await Promise.all([oldId,authId].map(id => client.from(table)
    .select(column, { count: 'exact', head: true }).eq(column, id)));
  if (results.some(result => result.error)) {
    console.log(`${table}.${column}\tREAD_FAILED`);
    failed = true;
  } else console.log(`${table}.${column}\told_app_id=${results[0].count}\texisting_auth_id=${results[1].count}`);
}
if (failed) process.exitCode = 1;
