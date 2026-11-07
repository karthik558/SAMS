-- READ ONLY: dependency inventory before reconciling an existing Auth identity.
-- Run as the database administrator. Returns account IDs and schema metadata only.
-- No passwords, hashes, tokens, updates, or deletes.
WITH relevant_fks AS (
  SELECT c.conrelid, c.conname, c.confrelid,
         pg_get_constraintdef(c.oid, true) AS definition,
         c.condeferrable, c.condeferred
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.confrelid IN ('public.app_users'::regclass, 'auth.users'::regclass)
), relevant_tables AS (
  SELECT 'public.app_users'::regclass AS oid
  UNION SELECT 'auth.users'::regclass
  UNION SELECT conrelid FROM relevant_fks
), inventory AS (
  SELECT '1_conflicting_account'::text AS section,
    jsonb_build_object(
      'app_users', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'role',u.role,'status',u.status))
        FROM public.app_users u
        WHERE lower(u.email) = 'dev@karthiklal.in'
           OR u.id IN ('2770d961-ac8c-4c84-8fd8-5d1d3c598c1b'::uuid,'de75fd22-93eb-4c6f-9ae4-43829322a2e3'::uuid)
      ), '[]'::jsonb),
      'auth_users', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id',a.id,'email',a.email,
          'email_verified', a.email_confirmed_at IS NOT NULL,
          'password_set', coalesce(a.encrypted_password,'') <> ''))
        FROM auth.users a
        WHERE lower(a.email) = 'dev@karthiklal.in'
           OR a.id IN ('2770d961-ac8c-4c84-8fd8-5d1d3c598c1b'::uuid,'de75fd22-93eb-4c6f-9ae4-43829322a2e3'::uuid)
      ), '[]'::jsonb)
    ) AS details
  UNION ALL
  SELECT '2_foreign_keys', coalesce(jsonb_agg(jsonb_build_object(
    'table',conrelid::regclass::text,'constraint',conname,
    'references',confrelid::regclass::text,'definition',definition,
    'deferrable',condeferrable,'initially_deferred',condeferred
  ) ORDER BY conrelid::regclass::text,conname), '[]'::jsonb) FROM relevant_fks
  UNION ALL
  SELECT '3_potential_user_id_columns', coalesce(jsonb_agg(jsonb_build_object(
    'table',table_schema || '.' || table_name,'column',column_name,'type',data_type
  ) ORDER BY table_name,column_name), '[]'::jsonb)
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (udt_name = 'uuid' OR column_name ~* '(user|owner|created_by|updated_by|approver|assigned|incharge)')
  UNION ALL
  SELECT '4_identity_related_triggers', coalesce(jsonb_agg(jsonb_build_object(
    'table',tgrelid::regclass::text,'trigger',tgname,'enabled',tgenabled,
    'definition',pg_get_triggerdef(oid,true)
  ) ORDER BY tgrelid::regclass::text,tgname), '[]'::jsonb)
  FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM relevant_tables)
)
SELECT section, details FROM inventory ORDER BY section;
