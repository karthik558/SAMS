-- Apply AFTER the account-security function and matching frontend are staged.
-- Read docs/user-account-security.md first. This is a migration, not a replacement
-- for your existing business schema. Run as postgres in the Supabase SQL editor.
BEGIN;
LOCK TABLE public.app_users IN ACCESS EXCLUSIVE MODE;

-- Preserve all existing app IDs and foreign keys. Never silently recreate users,
-- guess identity from email. Non-admin accounts may await native Auth onboarding;
-- a verified active administrator with a working Auth password is mandatory.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.app_users u
    LEFT JOIN auth.users a ON a.id = u.id
    WHERE a.id IS NULL OR lower(a.email) IS DISTINCT FROM lower(u.email)
  ) THEN
    RAISE EXCEPTION 'Migration stopped: existing accounts are not ready for Supabase Auth'
      USING HINT = 'Run scripts/check-auth-accounts.sql first. For MISSING_AUTH, use scripts/prepare-auth-users.mjs, then complete native Auth recovery. Do not bypass this check or delete/recreate existing identities. See docs/user-account-security.md.';
  END IF;
  IF EXISTS (SELECT lower(email) FROM public.app_users GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Migration stopped: duplicate account emails require review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_users u JOIN auth.users a ON a.id=u.id
    WHERE lower(u.role)='admin' AND lower(u.status)='active'
      AND a.email_confirmed_at IS NOT NULL AND coalesce(a.encrypted_password,'') <> '') THEN
    RAISE EXCEPTION 'Migration stopped: at least one verified active administrator with an Auth password is required';
  END IF;
END $$;

-- Remove every permissive legacy policy; policies otherwise combine with OR.
DO $$ DECLARE p record; c record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_users' LOOP
    EXECUTE format('DROP POLICY %I ON public.app_users', p.policyname);
  END LOOP;
  REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
  -- Table revokes do not revoke pre-existing column grants.
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = 'public.app_users'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.app_users FROM PUBLIC, anon, authenticated', c.attname);
  END LOOP;
END $$;

-- Supersede password/reset RPCs, including overloaded versions in live databases.
-- Do not drop them with CASCADE: unrelated dependencies should never be destroyed.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'self_set_password_hash_v1', 'admin_set_user_password_hash_v1',
      'self_set_password_v1', 'admin_set_user_password_v1', 'set_user_password',
      'create_password_hash_v1', 'password_hashes_match_v1',
      'request_password_reset_v1', 'verify_password_reset_code_v1', 'complete_password_reset_v1'
    ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.password_reset_requests FROM PUBLIC, anon, authenticated;
    FOR f IN SELECT attname FROM pg_attribute WHERE attrelid = 'public.password_reset_requests'::regclass AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.password_reset_requests FROM PUBLIC, anon, authenticated', f.attname);
    END LOOP;
    DELETE FROM public.password_reset_requests;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_app_users_guard_sensitive_columns ON public.app_users;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS password;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS active_session_id text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS login_name text
  GENERATED ALWAYS AS (lower(split_part(email, '@', 1))) STORED;
CREATE INDEX IF NOT EXISTS app_users_login_name_idx ON public.app_users(login_name);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_lower ON public.app_users(lower(email));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.app_users'::regclass AND conname = 'app_users_auth_identity_fk') THEN
    ALTER TABLE public.app_users ADD CONSTRAINT app_users_auth_identity_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Roles come from the database, never user-editable JWT metadata or a supplied uid.
CREATE OR REPLACE FUNCTION public.app_user_has_role(p_uid uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = auth.uid() AND lower(u.status) = 'active'
      AND lower(u.role) IN (SELECT lower(r) FROM unnest(p_roles) AS r)
  );
$$;
CREATE OR REPLACE FUNCTION public.app_user_is_admin(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_user_has_role(p_uid, ARRAY['admin']);
$$;
CREATE OR REPLACE FUNCTION public.app_user_is_admin_or_manager(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_user_has_role(p_uid, ARRAY['admin','manager']);
$$;
CREATE OR REPLACE FUNCTION public.app_user_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND lower(status) = 'active');
$$;
REVOKE ALL ON FUNCTION public.app_user_has_role(uuid,text[]), public.app_user_is_admin(uuid),
  public.app_user_is_admin_or_manager(uuid), public.app_user_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_user_has_role(uuid,text[]), public.app_user_is_admin(uuid),
  public.app_user_is_admin_or_manager(uuid), public.app_user_is_active() TO authenticated, service_role;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users FORCE ROW LEVEL SECURITY;
GRANT ALL ON public.app_users TO service_role;
GRANT SELECT (id,name,email,role,department,phone,last_login,status,avatar_url,
  must_change_password,password_changed_at,active_session_id) ON public.app_users TO authenticated;
GRANT UPDATE (last_login,active_session_id,name,phone,avatar_url) ON public.app_users TO authenticated;
CREATE POLICY app_users_read ON public.app_users FOR SELECT TO authenticated
  USING (public.app_user_is_active() AND (id = auth.uid() OR public.app_user_is_admin_or_manager(auth.uid())));
CREATE POLICY app_users_update_self ON public.app_users FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.app_user_is_active())
  WITH CHECK (id = auth.uid() AND public.app_user_is_active());
-- No browser INSERT/DELETE/admin UPDATE grants: use the server function.

-- Keep password metadata synchronized when Auth performs password changes/resets.
CREATE OR REPLACE FUNCTION public.sync_auth_account_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.app_users SET
    email = NEW.email,
    password_changed_at = CASE WHEN NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN now() ELSE password_changed_at END,
    must_change_password = CASE WHEN NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN false ELSE must_change_password END
  WHERE id = NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_auth_account_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sams_sync_auth_profile ON auth.users;
CREATE TRIGGER sams_sync_auth_profile AFTER UPDATE OF email, encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_account_profile();

-- Create notification settings atomically with the profile, if this table exists.
CREATE OR REPLACE FUNCTION public.initialize_app_user_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    INSERT INTO public.user_settings(user_id,email_notifications) VALUES (NEW.id,true)
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.initialize_app_user_settings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trigger_create_user_settings ON public.app_users;
DROP TRIGGER IF EXISTS sams_initialize_user_settings ON public.app_users;
CREATE TRIGGER sams_initialize_user_settings AFTER INSERT ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_app_user_settings();

-- Settings/preferences may be changed only by their owner or an active admin.
-- Existing row IDs are retained; a spoofed user_email never establishes ownership.
DO $$ DECLARE t text; p record; c record; BEGIN
  FOREACH t IN ARRAY ARRAY['user_settings','user_preferences'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = to_regclass('public.' || t) AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC, anon, authenticated', c.attname, t);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY account_settings_owner ON public.%I FOR ALL TO authenticated USING (public.app_user_is_active() AND (user_id = auth.uid() OR public.app_user_is_admin(auth.uid()))) WITH CHECK (public.app_user_is_active() AND (user_id = auth.uid() OR public.app_user_is_admin(auth.uid())))', t);
  END LOOP;
END $$;
COMMIT;
