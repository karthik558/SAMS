-- SAMS only: reconcile the existing app administrator with its verified Auth ID.
-- Run BEFORE secure_app_users.sql, after a private backup and frontend staging.
-- Preserves the Auth account, password, sessions, and its existing preferences.
-- Moves only references equal to the old app ID. Does not create/delete accounts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.app_users, public.assets, public.audit_incharge,
  public.audit_scans, public.final_approvers, public.notifications,
  public.password_reset_requests, public.recent_activity, public.reports,
  public.tickets, public.user_department_access, public.user_permissions,
  public.user_preferences, public.user_property_access, public.user_settings
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  old_id constant uuid := '2770d961-ac8c-4c84-8fd8-5d1d3c598c1b';
  auth_id constant uuid := 'de75fd22-93eb-4c6f-9ae4-43829322a2e3';
  expected_email constant text := 'dev@karthiklal.in';
  f record;
  item record;
  saved_fks jsonb := '[]'::jsonb;
  current_fk_count integer;
  ref_count bigint;
BEGIN
  -- A matching email alone does not authorize merging arbitrary identities.
  -- These exact reviewed IDs, roles and verification state must still match.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth_id
      AND lower(email) = expected_email AND email_confirmed_at IS NOT NULL
      AND coalesce(encrypted_password, '') <> '') THEN
    RAISE EXCEPTION 'Expected verified administrator Auth identity is missing or changed';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = old_id) THEN
    RAISE EXCEPTION 'Old app ID now belongs to an Auth identity; manual review required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE id = old_id) THEN
    IF EXISTS (SELECT 1 FROM public.app_users WHERE id = auth_id)
       OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = old_id
         AND lower(email) = expected_email AND lower(role) = 'admin' AND lower(status) = 'active') THEN
      RAISE EXCEPTION 'Administrator app profile changed or target profile exists; refusing to merge';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth_id
      AND lower(email) = expected_email AND lower(role) = 'admin' AND lower(status) = 'active') THEN
    RAISE EXCEPTION 'Neither the expected source nor reconciled administrator profile exists';
  END IF;

  -- Changing the key with immediate NO ACTION FKs fails. Defer only the reviewed
  -- FKs in this transaction, then validate and restore their original settings.
  SELECT count(*) INTO current_fk_count FROM pg_constraint
    WHERE contype = 'f' AND confrelid = 'public.app_users'::regclass;
  IF current_fk_count <> 4 OR EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'public.app_users'::regclass
      AND NOT (c.conrelid IN ('public.password_reset_requests'::regclass,
        'public.recent_activity'::regclass,'public.user_property_access'::regclass,
        'public.user_settings'::regclass)
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='user_id')]::smallint[]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[]
        AND c.confupdtype = 'a')
  ) THEN
    RAISE EXCEPTION 'Foreign key inventory changed; inspect dependencies again before reconciliation';
  END IF;
  FOR f IN SELECT c.*, n.nspname, t.relname FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.contype='f' AND c.confrelid='public.app_users'::regclass
  LOOP
    saved_fks := saved_fks || jsonb_build_array(jsonb_build_object(
      'schema',f.nspname,'table',f.relname,'name',f.conname,
      'deferrable',f.condeferrable,'deferred',f.condeferred));
    EXECUTE format('ALTER TABLE %I.%I ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED',f.nspname,f.relname,f.conname);
    EXECUTE format('SET CONSTRAINTS %I.%I DEFERRED',f.nspname,f.conname);
  END LOOP;

  UPDATE public.app_users SET id=auth_id WHERE id=old_id;
  -- The Auth-owned preferences row already uses auth_id and remains untouched.
  FOR item IN SELECT * FROM (VALUES
    ('assets','created_by'),('audit_incharge','user_id'),('audit_scans','scanned_by'),
    ('final_approvers','created_by'),('final_approvers','user_id'),('notifications','user_id'),
    ('password_reset_requests','user_id'),('recent_activity','user_id'),
    ('reports','created_by'),('reports','created_by_id'),('tickets','created_by'),
    ('user_department_access','user_id'),('user_permissions','user_id'),
    ('user_preferences','user_id'),('user_property_access','user_id'),('user_settings','user_id')
  ) AS refs(table_name,column_name)
  LOOP
    -- %L literals are parsed as the actual column type (UUID or text).
    EXECUTE format('UPDATE public.%I SET %I=%L WHERE %I=%L',item.table_name,item.column_name,auth_id,item.column_name,old_id);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=%L',item.table_name,item.column_name,old_id) INTO ref_count;
    IF ref_count <> 0 THEN RAISE EXCEPTION 'Unmigrated reference in %.%',item.table_name,item.column_name; END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(saved_fks) LOOP
    EXECUTE format('SET CONSTRAINTS %I.%I IMMEDIATE',item.value->>'schema',item.value->>'name');
    EXECUTE format('ALTER TABLE %I.%I ALTER CONSTRAINT %I %s',
      item.value->>'schema',item.value->>'table',item.value->>'name',
      CASE WHEN (item.value->>'deferrable')::boolean THEN
        CASE WHEN (item.value->>'deferred')::boolean THEN 'DEFERRABLE INITIALLY DEFERRED' ELSE 'DEFERRABLE INITIALLY IMMEDIATE' END
      ELSE 'NOT DEFERRABLE INITIALLY IMMEDIATE' END);
  END LOOP;
END $$;
COMMIT;
