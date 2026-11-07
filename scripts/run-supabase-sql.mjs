// Uses the normal linked Postgres connection and a local environment password.
// Read-only by default. Never includes secrets in process arguments or output.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const write = args.includes('--write');
const files = args.filter(arg => arg !== '--write');
if (files.length !== 1) throw new Error('Usage: node --env-file=.env.local scripts/run-supabase-sql.mjs [--write] path.sql');
const ref = readFileSync('supabase/.temp/project-ref','utf8').trim();
const connection = new URL(readFileSync('supabase/.temp/pooler-url','utf8').trim());
const configured = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
if (ref !== 'bymmvtbiohiqayyxppgr' || configured.hostname !== `${ref}.supabase.co`
    || !decodeURIComponent(connection.username).endsWith(`.${ref}`)) throw new Error('Linked/configured project mismatch');
if (!process.env.SUPABASE_DB_PASSWORD) throw new Error('SUPABASE_DB_PASSWORD is required in local environment');
const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432',
  PGUSER: decodeURIComponent(connection.username), PGDATABASE: connection.pathname.slice(1) || 'postgres',
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGSSLMODE: 'require',
  PGOPTIONS: write ? '-c statement_timeout=60000' : '-c default_transaction_read_only=on -c statement_timeout=60000' };
const result = spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f',files[0]],{ env, stdio:'inherit' });
if (result.error) console.error('Could not start psql');
process.exit(result.status ?? 1);
