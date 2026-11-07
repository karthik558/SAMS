// Private pre-migration snapshot. Contains sensitive legacy account data: never commit.
import { readFileSync,writeFileSync,unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const ref=readFileSync('supabase/.temp/project-ref','utf8').trim();
const c=new URL(readFileSync('supabase/.temp/pooler-url','utf8').trim());
if(ref!=='bymmvtbiohiqayyxppgr'||!process.env.SUPABASE_DB_PASSWORD) throw new Error('Expected linked SAMS project and local database password');
const output=`/private/tmp/sams-security-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.jsonl`;
writeFileSync(output,'',{flag:'wx',mode:0o600});
const input=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('kind','schema','columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),'constraints',(SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE connamespace='public'::regnamespace),'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g WHERE table_schema='public'),'column_grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_column_grants g WHERE table_schema='public'),'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid)) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f'),'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal));
SELECT format('SELECT jsonb_build_object(''kind'',''data'',''table'',%L,''rows'',coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb)) FROM public.%I t;',tablename,tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\\gexec
COMMIT;
`;
const result=spawnSync('psql',['-X','-q','-At','-v','ON_ERROR_STOP=1','-o',output],{input,encoding:'utf8',env:{...process.env,
 PGHOST:c.hostname,PGPORT:c.port||'5432',PGUSER:decodeURIComponent(c.username),PGDATABASE:c.pathname.slice(1)||'postgres',PGPASSWORD:process.env.SUPABASE_DB_PASSWORD,PGSSLMODE:'require',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=60000'}});
if(result.status!==0){unlinkSync(output);console.error('Private snapshot failed; no changes should be applied.');process.exit(1);}
let records;
try { records=readFileSync(output,'utf8').trim().split('\n').map(line=>JSON.parse(line)); }
catch { console.error('Snapshot format verification failed; no changes should be applied.'); process.exit(1); }
console.log(JSON.stringify({snapshot:output,mode:'0600',tables:records.filter(record=>record.kind==='data').length}));
