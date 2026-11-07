-- Disposable PostgreSQL database ONLY: minimal Supabase Auth/RLS test fixture.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, encrypted_password text);
CREATE TABLE public.app_users(
 id uuid PRIMARY KEY, name text, email text, role text, department text, phone text,
 last_login timestamptz, status text, avatar_url text, password_hash text, password text,
 must_change_password boolean, password_changed_at timestamptz, active_session_id text
);
CREATE TABLE public.user_settings(user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, email_notifications boolean);
CREATE TABLE public.user_preferences(user_id uuid PRIMARY KEY, user_email text, compact_mode boolean);
CREATE TABLE public.password_reset_requests(user_id uuid, code_hash text, session_token text);
INSERT INTO auth.users VALUES
 ('10000000-0000-0000-0000-000000000001','admin@example.com',now(),'auth-managed'),
 ('10000000-0000-0000-0000-000000000002','user@example.com',now(),'auth-managed'),
 ('10000000-0000-0000-0000-000000000003','inactive@example.com',now(),'auth-managed'),
 ('10000000-0000-0000-0000-000000000004','manager@example.com',now(),'auth-managed');
INSERT INTO public.app_users(id,name,email,role,status,password_hash) SELECT id,email,email,
 CASE WHEN email LIKE 'admin%' THEN 'admin' WHEN email LIKE 'manager%' THEN 'manager' ELSE 'user' END,
 CASE WHEN email LIKE 'inactive%' THEN 'Inactive' ELSE 'Active' END,'legacy-exposed' FROM auth.users;
INSERT INTO user_settings SELECT id,true FROM auth.users;
INSERT INTO user_preferences SELECT id,email,false FROM auth.users;
INSERT INTO password_reset_requests VALUES ('10000000-0000-0000-0000-000000000002','known-code','known-token');
-- Reproduce a permissive live schema, including column grants and RPC overloads.
GRANT ALL ON app_users,user_settings,user_preferences,password_reset_requests TO anon, authenticated;
GRANT SELECT(password_hash), UPDATE(role) ON app_users TO anon, authenticated;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY old_open_access ON app_users USING (true) WITH CHECK (true);
CREATE FUNCTION public.self_set_password_hash_v1(text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
CREATE FUNCTION public.self_set_password_hash_v1(text,text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
CREATE FUNCTION public.request_password_reset_v1(text,text,integer) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;

CREATE TABLE public.user_permissions(user_id uuid,page text,can_view boolean,can_edit boolean,UNIQUE(user_id,page));
CREATE TABLE public.user_department_access(user_id uuid,department text,UNIQUE(user_id,department));
CREATE TABLE public.user_property_access(user_id uuid,property_id text,UNIQUE(user_id,property_id));
CREATE FUNCTION public.set_user_permissions_json_v1(uuid,jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RETURN; END$$;
CREATE FUNCTION public.admin_set_user_password_v1(text,text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT true$$;
-- Pending non-admin onboarding must not prevent an existing verified admin logging in.
UPDATE auth.users SET email_confirmed_at=NULL WHERE email='user@example.com';
