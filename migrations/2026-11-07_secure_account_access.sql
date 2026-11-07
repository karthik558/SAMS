-- Account access mappings and unauthenticated database exposure hardening.
-- Apply AFTER secure_app_users.sql. Keeps existing authenticated business policies.
BEGIN;
DO $$ DECLARE t record; f record; c record; p record; allowed boolean; service_allowed boolean; BEGIN
  -- Organization data is never readable/writable through an anonymous API key.
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t.tablename);
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('public.'||quote_ident(t.tablename)) AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC, anon',c.attname,t.tablename);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS sams_active_account ON public.%I',t.tablename);
    EXECUTE format('CREATE POLICY sams_active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_user_is_active()) WITH CHECK (public.app_user_is_active())',t.tablename);
  END LOOP;
  -- PUBLIC function execution can bypass table RLS through SECURITY DEFINER.
  -- Preserve existing authenticated execution; never widen a revoked function.
  FOR f IN SELECT oid,oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' LOOP
    allowed := has_function_privilege('authenticated',f.oid,'EXECUTE');
    service_allowed := has_function_privilege('service_role',f.oid,'EXECUTE');
    IF allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END IF;
    IF service_allowed THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.signature);
  END LOOP;
  -- The live legacy credential and access-mapping RPCs had no caller checks.
  -- Access mappings now use direct, RLS-protected writes from the client.
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[
    'self_set_password_hash_v1','admin_set_user_password_hash_v1','self_set_password_v1','admin_set_user_password_v1',
    'set_user_password','create_password_hash_v1','password_hashes_match_v1',
    'request_password_reset_v1','verify_password_reset_code_v1','complete_password_reset_v1',
    'set_user_permissions_json_v1','set_user_permissions_v1','set_user_property_access_v1',
    'set_user_department_access','set_user_department_access_v1'
  ]) LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated',f.signature); END LOOP;

END $$;
-- Access mappings: own/admin-manager reads, administrator-only mutations.
DO $$ DECLARE t text; p record; BEGIN
  FOREACH t IN ARRAY ARRAY['user_permissions','user_department_access','user_property_access'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY account_access_read ON public.%I FOR SELECT TO authenticated USING (public.app_user_is_active() AND (user_id=auth.uid() OR public.app_user_is_admin_or_manager(auth.uid())))',t);
    EXECUTE format('CREATE POLICY account_access_admin ON public.%I FOR ALL TO authenticated USING (public.app_user_is_admin(auth.uid())) WITH CHECK (public.app_user_is_admin(auth.uid()))',t);
  END LOOP;
END $$;
COMMIT;
