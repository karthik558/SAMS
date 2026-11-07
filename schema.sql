-- SAMS application schema: fresh Supabase projects only (PostgreSQL 17+).
-- Run this whole file once in the Supabase SQL editor as postgres, or with psql
-- -v ON_ERROR_STOP=1. It intentionally contains no application rows or users.
-- Supabase provides auth.users, auth.uid(), auth.jwt(), and API roles; this file
-- creates the application schema, RLS/grants, Auth sync trigger, and realtime setup.
-- Existing deployments: DO NOT rerun this file or use it as an upgrade migration.
-- Auth/SMTP settings and Edge Functions are deployed from the supabase/ directory.

BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'SAMS requires a Supabase project with its managed Auth schema';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')) THEN
    RAISE EXCEPTION 'schema.sql is for a fresh project only; existing public tables/views were found. Nothing was changed.';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: user_permission_row; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_permission_row AS (
	page text,
	v boolean,
	e boolean
);


--
-- Name: asset_scope(text); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.asset_scope(p_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.assets WHERE id=p_id AND app_private.property_scope(property_id) AND app_private.department_scope(department));
$$;


--
-- Name: department_scope(text); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.department_scope(p_department text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT public.app_user_is_active() AND (public.app_user_is_admin(auth.uid()) OR public.app_user_can('all_departments','view')
 OR NOT EXISTS(SELECT 1 FROM public.user_department_access WHERE user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.user_department_access a LEFT JOIN public.departments d ON lower(a.department) IN (lower(d.name),lower(d.code))
 WHERE a.user_id=auth.uid() AND lower(coalesce(p_department,'')) IN (lower(a.department),lower(d.name),lower(d.code))));
$$;


--
-- Name: guard_approval_transition(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.guard_approval_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.role()='service_role' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT public.app_user_is_admin(auth.uid()) AND NEW.status<>'pending_manager' THEN RAISE EXCEPTION 'New requests must start pending review' USING ERRCODE='42501'; END IF;
  IF NOT public.app_user_is_admin(auth.uid()) THEN NEW.reviewed_by:=NULL; NEW.reviewed_at:=NULL; END IF;
  RETURN NEW;
 END IF;
 IF NEW.requested_by IS DISTINCT FROM OLD.requested_by AND NOT public.app_user_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Cannot change the request author' USING ERRCODE='42501'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='approved' AND NOT public.app_user_can('approval_review','edit') THEN RAISE EXCEPTION 'Final approval permission required' USING ERRCODE='42501'; END IF;
  NEW.reviewed_by:=(SELECT email FROM public.app_users WHERE id=auth.uid());
  NEW.reviewed_at:=now();
 END IF;
 RETURN NEW;
END $$;


--
-- Name: guard_direct_property_delete(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.guard_direct_property_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.assets WHERE property_id=OLD.id) OR EXISTS(SELECT 1 FROM public.audit_sessions WHERE property_id=OLD.id) THEN
  RAISE EXCEPTION 'Use the atomic property deletion action for a property with assets or audits' USING ERRCODE='42501';
 END IF;
 RETURN OLD;
END $$;


--
-- Name: guard_profile_edit(); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.guard_profile_edit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.role()='service_role' OR public.app_user_is_admin(auth.uid()) THEN RETURN NEW; END IF;
 IF (NEW.name,NEW.phone,NEW.avatar_url) IS DISTINCT FROM (OLD.name,OLD.phone,OLD.avatar_url) AND NOT public.app_user_can('settings','edit') THEN RAISE EXCEPTION 'Profile edit permission required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;


--
-- Name: is_self(text); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.is_self(p_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT p_id=auth.uid()::text OR lower(p_id)=(SELECT lower(email) FROM public.app_users WHERE id=auth.uid());
$$;


--
-- Name: property_scope(text); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.property_scope(p_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT public.app_user_is_active() AND (public.app_user_is_admin(auth.uid()) OR (p_id IS NOT NULL AND p_id<>'' AND
 (public.app_user_can('all_properties','view') OR EXISTS(SELECT 1 FROM public.user_property_access WHERE user_id=auth.uid() AND property_id=p_id))));
$$;


--
-- Name: row_scope(text, jsonb); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.row_scope(p_table text, p_row jsonb) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE parent jsonb; prop text; patch_prop text;
BEGIN
 IF public.app_user_is_admin(auth.uid()) THEN RETURN true; END IF;
 CASE p_table
 WHEN 'properties' THEN RETURN app_private.property_scope(p_row->>'id');
 WHEN 'assets' THEN RETURN app_private.property_scope(p_row->>'property_id') AND app_private.department_scope(p_row->>'department');
 WHEN 'qr_codes' THEN RETURN app_private.asset_scope(p_row->>'asset_id');
 WHEN 'tickets' THEN RETURN app_private.property_scope(p_row->>'property_id');
 WHEN 'audit_sessions' THEN RETURN app_private.property_scope(p_row->>'property_id');
 WHEN 'audit_assignments' THEN RETURN app_private.session_scope(p_row->>'session_id') AND app_private.department_scope(p_row->>'department');
 WHEN 'audit_reviews' THEN RETURN app_private.session_scope(p_row->>'session_id') AND app_private.asset_scope(p_row->>'asset_id') AND app_private.department_scope(p_row->>'department');
 WHEN 'audit_scans' THEN RETURN app_private.session_scope(p_row->>'session_id') AND app_private.asset_scope(p_row->>'asset_id') AND app_private.department_scope(p_row->>'department') AND app_private.property_scope(p_row->>'property_id');
 WHEN 'audit_reports' THEN RETURN app_private.session_scope(p_row->>'session_id') AND (app_private.is_self(p_row->>'generated_by') OR public.app_user_can('all_departments','view') OR NOT EXISTS(SELECT 1 FROM public.user_department_access WHERE user_id=auth.uid()));
 WHEN 'approvals' THEN
  patch_prop:=coalesce(p_row->'patch'->>'property_id',p_row->'patch'->>'propertyId');
  IF patch_prop IS NOT NULL AND NOT app_private.property_scope(patch_prop) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.assets WHERE id=p_row->>'asset_id') THEN RETURN app_private.asset_scope(p_row->>'asset_id'); END IF;
  RETURN p_row->>'action'='create' AND app_private.property_scope(patch_prop) AND app_private.department_scope(p_row->'patch'->>'department');
 WHEN 'approval_events' THEN
  SELECT to_jsonb(a) INTO parent FROM public.approvals a WHERE id=p_row->>'approval_id';
  RETURN parent IS NOT NULL AND app_private.row_scope('approvals',parent);
 WHEN 'ticket_events' THEN
  SELECT to_jsonb(t) INTO parent FROM public.tickets t WHERE id=p_row->>'ticket_id';
  RETURN parent IS NOT NULL AND app_private.row_scope('tickets',parent);
 WHEN 'reports' THEN
  prop:=nullif(p_row->>'filter_property','');
  IF (prop IS NULL OR lower(prop)='all') AND p_row->>'filter_session_id' IS NOT NULL THEN SELECT property_id INTO prop FROM public.audit_sessions WHERE id=p_row->>'filter_session_id'; END IF;
  IF prop IS NULL OR lower(prop) IN ('all','all properties') THEN RETURN public.app_user_can('all_properties','view') AND (public.app_user_can('all_departments','view') OR NOT EXISTS(SELECT 1 FROM public.user_department_access WHERE user_id=auth.uid())); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=prop) THEN
   SELECT min(id) INTO prop FROM public.properties WHERE lower(name)=lower(prop) HAVING count(*)=1;
  END IF;
  RETURN app_private.property_scope(prop) AND app_private.department_scope(p_row->>'filter_department');
 WHEN 'property_license' THEN RETURN app_private.property_scope(p_row->>'property_id');
 WHEN 'audit_incharge' THEN RETURN app_private.property_scope(p_row->>'property_id');
 WHEN 'final_approvers' THEN RETURN app_private.property_scope(p_row->>'property_id');
 WHEN 'notifications' THEN RETURN app_private.is_self(p_row->>'user_id');
 WHEN 'recent_activity' THEN RETURN app_private.is_self(p_row->>'user_id');
 WHEN 'user_property_access' THEN RETURN p_row->>'user_id'=auth.uid()::text;
 WHEN 'user_department_access' THEN RETURN p_row->>'user_id'=auth.uid()::text;
 WHEN 'user_permissions' THEN RETURN p_row->>'user_id'=auth.uid()::text;
 WHEN 'user_settings' THEN RETURN p_row->>'user_id'=auth.uid()::text;
 WHEN 'user_preferences' THEN RETURN p_row->>'user_id'=auth.uid()::text;
 ELSE RETURN true;
 END CASE;
END $$;


--
-- Name: session_scope(text); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.session_scope(p_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.audit_sessions WHERE id=p_id AND app_private.property_scope(property_id));
$$;


--
-- Name: shared_user(uuid); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.shared_user(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_property_access WHERE user_id=p_id AND app_private.property_scope(property_id));
$$;


--
-- Name: add_approval_event_v1(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_approval_event_v1(p_approval_id text, p_event_type text, p_author text, p_message text, p_comments text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  -- Ensure the approval row exists (best-effort defaults)
  if not exists (select 1 from public.approvals where id = p_approval_id) then
    insert into public.approvals (id, asset_id, action, status, requested_by)
    values (p_approval_id, 'UNKNOWN', 'edit', 'pending_manager', coalesce(p_author, 'system'));
  end if;

  insert into public.approval_events (approval_id, event_type, author, message, comments)
  values (p_approval_id, p_event_type, p_author, p_message, coalesce(p_comments, p_message));
end;
$$;


--
-- Name: admin_set_user_password_hash_v1(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_user_password_hash_v1(p_admin_email text, p_target_user_id uuid, p_new_password_hash text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
	PERFORM set_config('app.bypass_sensitive_guard', 'on', true);

	IF COALESCE(trim(p_new_password_hash),'') = '' THEN
		RAISE EXCEPTION 'INVALID_NEW_PASSWORD_HASH';
	END IF;

	UPDATE public.app_users
		 SET password_hash = p_new_password_hash,
				 password_changed_at = now(),
				 must_change_password = false
	 WHERE id = p_target_user_id;
END;
$$;


--
-- Name: admin_set_user_password_v1(text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_user_password_v1(p_admin_email text, p_admin_password text, p_target_user_id uuid, p_new_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
	v_admin_id uuid;
	v_admin_role text;
	v_admin_hash text;
	v_next text;
BEGIN
	-- Enable guarded access for this transaction (for RLS and trigger)
	PERFORM set_config('app.bypass_sensitive_guard', 'on', true);

	SELECT u.id, lower(coalesce(u.role,'')), u.password_hash
		INTO v_admin_id, v_admin_role, v_admin_hash
		FROM public.app_users u
	 WHERE lower(u.email) = lower(trim(COALESCE(p_admin_email,'')))
	 LIMIT 1;

	IF v_admin_id IS NULL THEN
		RAISE EXCEPTION 'ADMIN_NOT_FOUND';
	END IF;

	-- Removed admin role/password verification as requested

	v_next := public.create_password_hash_v1(p_new_password);
	IF v_next IS NULL THEN
		RAISE EXCEPTION 'INVALID_NEW_PASSWORD';
	END IF;

	UPDATE public.app_users
		 SET password_hash = v_next,
				 password_changed_at = now(),
				 must_change_password = false
	 WHERE id = p_target_user_id;

	RETURN;
END;
$$;


--
-- Name: app_create_profile_with_access(uuid, jsonb, jsonb, text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_create_profile_with_access(p_id uuid, p_profile jsonb, p_permissions jsonb, p_property_ids text[], p_departments text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only operation' USING ERRCODE='42501'; END IF;
 INSERT INTO public.app_users(id,name,email,role,status,department,phone,avatar_url,must_change_password)
 VALUES(p_id,p_profile->>'name',p_profile->>'email',coalesce(p_profile->>'role','user'),coalesce(p_profile->>'status','Active'),p_profile->>'department',p_profile->>'phone',p_profile->>'avatar_url',coalesce((p_profile->>'must_change_password')::boolean,false));
 PERFORM public.app_save_user_access(p_id,p_permissions,p_property_ids,p_departments);
 SELECT to_jsonb(u) INTO result FROM public.app_users u WHERE id=p_id;
 RETURN result;
END $$;


--
-- Name: app_current_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_permissions() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE r text; result jsonb; item record;
BEGIN
 SELECT lower(role) INTO r FROM public.app_users WHERE id=auth.uid() AND lower(status)='active';
 IF r IS NULL THEN RETURN '{}'::jsonb; END IF;
 result:=public.app_permission_defaults(r);
 FOR item IN SELECT * FROM public.user_permissions WHERE user_id=auth.uid() LOOP
  result:=result||jsonb_build_object(item.page,CASE WHEN r='admin' THEN '{"v":true,"c":true,"e":true,"d":true,"x":true}'::jsonb ELSE jsonb_build_object('v',item.can_view,'c',item.can_create,'e',item.can_edit,'d',item.can_delete,'x',item.can_export) END);
 END LOOP;
 RETURN result;
END $$;


--
-- Name: app_is_admin_v1(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_is_admin_v1() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$SELECT public.app_user_is_admin(auth.uid())$$;


--
-- Name: app_permission_defaults(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_permission_defaults(p_role text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$ SELECT CASE lower(p_role) WHEN 'admin' THEN '{"dashboard":{"v":true,"c":true,"e":true,"d":true,"x":true},"assets":{"v":true,"c":true,"e":true,"d":true,"x":true},"properties":{"v":true,"c":true,"e":true,"d":true,"x":true},"qrcodes":{"v":true,"c":true,"e":true,"d":true,"x":true},"scan":{"v":true,"c":true,"e":true,"d":true,"x":true},"approvals":{"v":true,"c":true,"e":true,"d":true,"x":true},"tickets":{"v":true,"c":true,"e":true,"d":true,"x":true},"reports":{"v":true,"c":true,"e":true,"d":true,"x":true},"audit":{"v":true,"c":true,"e":true,"d":true,"x":true},"newsletter":{"v":true,"c":true,"e":true,"d":true,"x":true},"help":{"v":true,"c":true,"e":true,"d":true,"x":true},"users":{"v":true,"c":true,"e":true,"d":true,"x":true},"settings":{"v":true,"c":true,"e":true,"d":true,"x":true},"status":{"v":true,"c":true,"e":true,"d":true,"x":true},"license":{"v":true,"c":true,"e":true,"d":true,"x":true},"asset_import":{"v":true,"c":true,"e":true,"d":true,"x":true},"asset_compare":{"v":true,"c":true,"e":true,"d":true,"x":true},"amc_tracker":{"v":true,"c":true,"e":true,"d":true,"x":true},"food_expiry_tracker":{"v":true,"c":true,"e":true,"d":true,"x":true},"approval_review":{"v":true,"c":true,"e":true,"d":true,"x":true},"asset_types":{"v":true,"c":true,"e":true,"d":true,"x":true},"departments":{"v":true,"c":true,"e":true,"d":true,"x":true},"all_properties":{"v":true,"c":true,"e":true,"d":true,"x":true},"all_departments":{"v":true,"c":true,"e":true,"d":true,"x":true}}'::jsonb WHEN 'manager' THEN '{"dashboard":{"v":true,"c":false,"e":false,"d":false,"x":false},"assets":{"v":true,"c":true,"e":true,"d":false,"x":false},"properties":{"v":true,"c":true,"e":true,"d":false,"x":false},"qrcodes":{"v":true,"c":true,"e":true,"d":false,"x":false},"scan":{"v":true,"c":false,"e":false,"d":false,"x":false},"approvals":{"v":true,"c":false,"e":true,"d":false,"x":false},"tickets":{"v":true,"c":true,"e":true,"d":false,"x":false},"reports":{"v":true,"c":false,"e":false,"d":false,"x":false},"audit":{"v":false,"c":false,"e":false,"d":false,"x":false},"newsletter":{"v":true,"c":false,"e":false,"d":false,"x":false},"help":{"v":true,"c":false,"e":false,"d":false,"x":false},"users":{"v":false,"c":false,"e":false,"d":false,"x":false},"settings":{"v":true,"c":false,"e":false,"d":false,"x":false},"status":{"v":true,"c":false,"e":false,"d":false,"x":false},"license":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_import":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_compare":{"v":false,"c":false,"e":false,"d":false,"x":false},"amc_tracker":{"v":false,"c":false,"e":false,"d":false,"x":false},"food_expiry_tracker":{"v":false,"c":false,"e":false,"d":false,"x":false},"approval_review":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_types":{"v":false,"c":false,"e":false,"d":false,"x":false},"departments":{"v":false,"c":false,"e":false,"d":false,"x":false},"all_properties":{"v":false,"c":false,"e":false,"d":false,"x":false},"all_departments":{"v":false,"c":false,"e":false,"d":false,"x":false}}'::jsonb ELSE '{"dashboard":{"v":true,"c":false,"e":false,"d":false,"x":false},"assets":{"v":true,"c":true,"e":true,"d":false,"x":false},"properties":{"v":true,"c":false,"e":false,"d":false,"x":false},"qrcodes":{"v":true,"c":true,"e":true,"d":false,"x":false},"scan":{"v":true,"c":false,"e":false,"d":false,"x":false},"approvals":{"v":false,"c":false,"e":false,"d":false,"x":false},"tickets":{"v":true,"c":true,"e":false,"d":false,"x":false},"reports":{"v":false,"c":false,"e":false,"d":false,"x":false},"audit":{"v":false,"c":false,"e":false,"d":false,"x":false},"newsletter":{"v":true,"c":false,"e":false,"d":false,"x":false},"help":{"v":true,"c":false,"e":false,"d":false,"x":false},"users":{"v":false,"c":false,"e":false,"d":false,"x":false},"settings":{"v":true,"c":false,"e":false,"d":false,"x":false},"status":{"v":true,"c":false,"e":false,"d":false,"x":false},"license":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_import":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_compare":{"v":false,"c":false,"e":false,"d":false,"x":false},"amc_tracker":{"v":false,"c":false,"e":false,"d":false,"x":false},"food_expiry_tracker":{"v":false,"c":false,"e":false,"d":false,"x":false},"approval_review":{"v":false,"c":false,"e":false,"d":false,"x":false},"asset_types":{"v":false,"c":false,"e":false,"d":false,"x":false},"departments":{"v":false,"c":false,"e":false,"d":false,"x":false},"all_properties":{"v":false,"c":false,"e":false,"d":false,"x":false},"all_departments":{"v":false,"c":false,"e":false,"d":false,"x":false}}'::jsonb END $$;


--
-- Name: app_record_allowed(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_record_allowed(p_table text, p_action text, p_row jsonb) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE resource text; own boolean;
BEGIN
 IF NOT public.app_user_is_active() THEN RETURN false; END IF;
 IF public.app_user_is_admin(auth.uid()) THEN RETURN true; END IF;
 IF p_table='app_users' THEN
  own:=p_row->>'id'=auth.uid()::text;
  RETURN (p_action='view' AND (own OR (public.app_user_can('users','view') AND app_private.shared_user((p_row->>'id')::uuid)))) OR (p_action='edit' AND own);
 END IF;
 IF p_table IN ('user_permissions','user_property_access','user_department_access','audit_incharge','final_approvers') THEN
  RETURN p_action='view' AND app_private.row_scope(p_table,p_row) AND (p_table LIKE 'user_%' OR public.app_user_can('audit','view') OR public.app_user_can('approvals','view'));
 END IF;
 IF p_table='password_reset_requests' THEN RETURN false; END IF;
 IF p_table IN ('user_settings','user_preferences') THEN RETURN app_private.row_scope(p_table,p_row) AND p_action IN ('view','create','edit'); END IF;
 IF p_table='system_settings' THEN RETURN p_action='view' AND public.app_user_can('settings','view'); END IF;
 IF p_table='license_meta' THEN RETURN p_action='view' AND (public.app_user_can('license','view') OR public.app_user_can('assets','create'));
 END IF;
 IF p_table='property_license' THEN RETURN p_action='view' AND app_private.row_scope(p_table,p_row) AND (public.app_user_can('properties','view') OR public.app_user_can('assets','view')); END IF;
 IF p_table='recent_activity' THEN RETURN app_private.row_scope(p_table,p_row) AND p_action IN ('view','create'); END IF;
 IF p_table='notifications' THEN RETURN app_private.row_scope(p_table,p_row) AND p_action IN ('view','create','edit','delete'); END IF;
 IF p_table IN ('asset_types','departments') THEN RETURN CASE WHEN p_action='view' THEN public.app_user_can('assets','view') OR public.app_user_can('properties','view') OR public.app_user_can('users','view') ELSE public.app_user_can(p_table,p_action) END; END IF;
 IF NOT app_private.row_scope(p_table,p_row) THEN RETURN false; END IF;
 resource:=CASE
 WHEN p_table IN ('audit_sessions','audit_assignments','audit_reviews','audit_scans','audit_reports') THEN 'audit'
 WHEN p_table IN ('approvals','approval_events') THEN 'approvals'
 WHEN p_table IN ('tickets','ticket_events') THEN 'tickets'
 WHEN p_table IN ('newsletter_posts','newsletter_categories') THEN 'newsletter'
 WHEN p_table='qr_codes' THEN 'qrcodes'
 WHEN p_table IN ('departments','asset_types') THEN 'assets'
 ELSE p_table END;
 IF p_table='approvals' AND p_action='create' THEN RETURN app_private.is_self(p_row->>'requested_by') AND public.app_user_can('assets',CASE WHEN p_row->>'action'='decommission' THEN 'delete' ELSE p_row->>'action' END); END IF;
 IF p_table='approvals' AND p_action='view' AND app_private.is_self(p_row->>'requested_by') AND public.app_user_can('assets','view') THEN RETURN true; END IF;
 IF p_table='audit_reports' AND p_action IN ('view','create') THEN RETURN public.app_user_can('audit','export') AND public.app_user_can('audit',CASE WHEN p_action='create' THEN 'create' ELSE 'view' END); END IF;
 IF p_table='audit_scans' AND p_action='create' AND p_row->>'scanned_by'<>auth.uid()::text THEN RETURN false; END IF;
 RETURN public.app_user_can(resource,p_action);
END $$;


--
-- Name: app_request_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_request_role() RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((auth.jwt() ->> 'role')::text, '');
$$;


--
-- Name: app_save_user_access(uuid, jsonb, text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_save_user_access(p_user_id uuid, p_permissions jsonb, p_property_ids text[], p_departments text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE entry record; flag text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.app_user_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.app_users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_permissions) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid permissions' USING ERRCODE='22023'; END IF;
 FOR entry IN SELECT * FROM jsonb_each(p_permissions) LOOP
  IF entry.key !~ '^[a-z][a-z0-9_.-]{0,63}$' OR jsonb_typeof(entry.value) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid permission key or grant' USING ERRCODE='22023'; END IF;
  FOREACH flag IN ARRAY ARRAY['v','c','e','d','x'] LOOP
   IF entry.value ? flag AND jsonb_typeof(entry.value->flag) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Permission flags must be booleans' USING ERRCODE='22023'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_property_ids,ARRAY[]::text[])) AS requested(property_id) WHERE NOT EXISTS(SELECT 1 FROM public.properties WHERE public.properties.id=requested.property_id)) THEN RAISE EXCEPTION 'Unknown property assignment' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_departments,ARRAY[]::text[])) value WHERE NOT EXISTS(SELECT 1 FROM public.departments WHERE name=value OR code=value)) THEN RAISE EXCEPTION 'Unknown department assignment' USING ERRCODE='22023'; END IF;
 DELETE FROM public.user_permissions WHERE user_id=p_user_id;
 INSERT INTO public.user_permissions(user_id,page,can_view,can_create,can_edit,can_delete,can_export)
 SELECT p_user_id,key,coalesce((value->>'v')::boolean,false),coalesce((value->>'c')::boolean,false),coalesce((value->>'e')::boolean,false),coalesce((value->>'d')::boolean,false),coalesce((value->>'x')::boolean,false) FROM jsonb_each(p_permissions);
 DELETE FROM public.user_property_access WHERE user_id=p_user_id;
 INSERT INTO public.user_property_access(user_id,property_id) SELECT p_user_id,id FROM (SELECT DISTINCT unnest(coalesce(p_property_ids,ARRAY[]::text[])) id) ids;
 DELETE FROM public.user_department_access WHERE user_id=p_user_id;
 INSERT INTO public.user_department_access(user_id,department) SELECT p_user_id,value FROM (SELECT DISTINCT unnest(coalesce(p_departments,ARRAY[]::text[])) value) assigned;
END $_$;


--
-- Name: app_trg_set_user_email_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_trg_set_user_email_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text;
begin
  if new.user_id is not null then
    select u.email into v_email from public.app_users u where u.id = new.user_id limit 1;
    if found then
      new.user_email := v_email;
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: app_trg_set_user_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_trg_set_user_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT u.name, u.email INTO v_name, v_email
      FROM public.app_users u
     WHERE u.id = NEW.user_id
     LIMIT 1;
    IF FOUND THEN
      NEW.user_name := v_name;
      NEW.user_email := v_email;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: app_user_can(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_can(p_resource text, p_action text DEFAULT 'view'::text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE r text; g jsonb; k text;
BEGIN
 IF p_resource !~ '^[a-z][a-z0-9_.-]{0,63}$' OR p_action NOT IN ('view','create','edit','delete','export') THEN RETURN false; END IF;
 SELECT lower(role) INTO r FROM public.app_users WHERE id=auth.uid() AND lower(status)='active';
 IF r IS NULL THEN RETURN false; END IF;
 IF r='admin' THEN RETURN true; END IF;
 SELECT jsonb_build_object('v',can_view,'c',can_create,'e',can_edit,'d',can_delete,'x',can_export) INTO g FROM public.user_permissions WHERE user_id=auth.uid() AND page=p_resource;
 IF g IS NULL THEN g:=public.app_permission_defaults(r)->p_resource; END IF;
 k:=CASE p_action WHEN 'view' THEN 'v' WHEN 'create' THEN 'c' WHEN 'edit' THEN 'e' WHEN 'delete' THEN 'd' ELSE 'x' END;
 RETURN coalesce((g->>'v')::boolean,false) AND coalesce((g->>k)::boolean,false);
END $_$;


--
-- Name: app_user_has_role(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_has_role(p_uid uuid, p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT auth.uid() IS NOT NULL AND p_uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = auth.uid() AND lower(u.status) = 'active'
      AND lower(u.role) IN (SELECT lower(r) FROM unnest(p_roles) AS r)
  );
$$;


--
-- Name: app_user_is_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_is_active() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND lower(status) = 'active');
$$;


--
-- Name: app_user_is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_is_admin(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT public.app_user_has_role(p_uid, ARRAY['admin']);
$$;


--
-- Name: app_user_is_admin_or_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_user_is_admin_or_manager(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT public.app_user_has_role(p_uid, ARRAY['admin','manager']);
$$;


--
-- Name: app_users_guard_sensitive_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_users_guard_sensitive_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
	v_claims jsonb := auth.jwt();
	v_email_lower text := lower(coalesce(v_claims ->> 'email', ''));
	v_new_email_lower text := lower(coalesce(NEW.email, ''));
BEGIN
	-- If an RPC has explicitly enabled bypass, allow the update
	IF current_setting('app.bypass_sensitive_guard', true) = 'on' THEN
		RETURN NEW;
	END IF;

	-- service_role bypasses these checks (migration scripts / backend service).
	IF current_setting('request.jwt.claims', true) IS NULL THEN
		RETURN NEW;
	END IF;
	IF public.app_request_role() = 'service_role' THEN
		RETURN NEW;
	END IF;

	-- Allow users to update their own password metadata while keeping other fields locked down.
	IF auth.uid() = NEW.id OR (v_email_lower <> '' AND v_email_lower = v_new_email_lower) THEN
		IF NEW.email IS DISTINCT FROM OLD.email THEN
			RAISE EXCEPTION 'Only administrators may change email addresses';
		END IF;
		IF NEW.status IS DISTINCT FROM OLD.status THEN
			RAISE EXCEPTION 'Only administrators may change account status';
		END IF;
		IF NEW.department IS DISTINCT FROM OLD.department THEN
			RAISE EXCEPTION 'Only administrators may change department assignments';
		END IF;
		IF NEW.role IS DISTINCT FROM OLD.role THEN
			RAISE EXCEPTION 'Only administrators may change user roles';
		END IF;
		IF NEW.phone IS DISTINCT FROM OLD.phone THEN
			RAISE EXCEPTION 'Only administrators may change phone numbers';
		END IF;
		-- Allow password_hash, password_changed_at, must_change_password, last_login updates here.
		RETURN NEW;
	END IF;

	IF public.app_user_is_admin(auth.uid()) THEN
		RETURN NEW;
	END IF;

	-- Non-admins updating someone else are not allowed to touch sensitive fields.
	IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
		RAISE EXCEPTION 'Only administrators may change password hash values';
	END IF;
	IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
		RAISE EXCEPTION 'Only administrators may change password reset flags';
	END IF;
	IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
		RAISE EXCEPTION 'Only administrators may change password metadata';
	END IF;
	IF NEW.status IS DISTINCT FROM OLD.status THEN
		RAISE EXCEPTION 'Only administrators may change account status';
	END IF;
	IF NEW.role IS DISTINCT FROM OLD.role THEN
		RAISE EXCEPTION 'Only administrators may change user roles';
	END IF;

	RETURN NEW;
END;
$$;


--
-- Name: audit_scans_set_user_info(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_scans_set_user_info() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_name text;
  v_email text;
begin
  select name, email
    into v_name, v_email
  from public.app_users
  where id = new.scanned_by
  limit 1;

  new.scanned_by_name := v_name;
  new.scanned_by_email := v_email;

  return new;
end;
$$;


--
-- Name: complete_password_reset_v1(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_password_reset_v1(p_reset_token uuid, p_password_hash text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  rec record;
  now_ts timestamptz := now();
begin
  if p_reset_token is null then
    return false;
  end if;

  if coalesce(p_password_hash, '') = '' then
    return false;
  end if;

  select pr.*, au.id as target_user_id
    into rec
    from password_reset_requests pr
    join app_users au on au.id = pr.user_id
    where pr.session_token = p_reset_token
      and pr.session_expires_at is not null
      and pr.session_expires_at >= now_ts
      and pr.consumed_at is null
    limit 1;

  if not found then
    return false;
  end if;

  -- Elevate role context for guarded column updates (RLS + trigger inspect request.jwt.claims)
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'service_role',
      'sub', coalesce(rec.target_user_id::text, ''),
      'email', coalesce(rec.email, '')
    )::text,
    true
  );

  update app_users
    set password_hash = p_password_hash,
        password_changed_at = now_ts,
        must_change_password = false
    where id = rec.target_user_id;

  update password_reset_requests
    set consumed_at = now_ts,
        code_hash = null,
        code_salt = null,
        expires_at = null,
        session_token = null,
        session_expires_at = null,
        invalid_attempts = 0,
        updated_at = now_ts
    where id = rec.id;

  return true;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_reports (
    id text DEFAULT ('AR-'::text || substr(encode(extensions.gen_random_bytes(6), 'hex'::text), 1, 6)) NOT NULL,
    session_id text NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by text,
    payload jsonb NOT NULL
);

ALTER TABLE ONLY public.audit_reports FORCE ROW LEVEL SECURITY;


--
-- Name: create_audit_report_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_audit_report_v1(p_session_id text, p_generated_by text) RETURNS public.audit_reports
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  report public.audit_reports;
begin
  -- Build aggregates per department
  with per_dept as (
    select department,
      count(*) filter (where status = 'verified') as verified,
      count(*) filter (where status = 'missing') as missing,
      count(*) filter (where status = 'damaged') as damaged,
      count(*) as total
    from public.audit_reviews
    where session_id = p_session_id
    group by department
  ), totals as (
    select coalesce(sum(verified),0) as verified,
           coalesce(sum(missing),0) as missing,
           coalesce(sum(damaged),0) as damaged,
           coalesce(sum(total),0) as total
    from per_dept
  ), contributors as (
    select department, status, submitted_at, submitted_by
    from public.audit_assignments
    where session_id = p_session_id
  ), sub_summary as (
    select count(*) filter (where status = 'submitted') as submitted,
           count(*) as total
    from contributors
  )
  insert into public.audit_reports(session_id, generated_by, payload)
  select p_session_id, p_generated_by,
    jsonb_build_object(
      'session_id', p_session_id,
      'generated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'generated_by', p_generated_by,
      'submissions', jsonb_build_object(
        'submitted', (select submitted from sub_summary),
        'total',     (select total     from sub_summary)
      ),
      'totals', jsonb_build_object(
        'verified', (select verified from totals),
        'missing',  (select missing  from totals),
        'damaged',  (select damaged  from totals),
        'total',    (select total    from totals)
      ),
      'byDepartment', coalesce((
        select jsonb_agg(jsonb_build_object(
          'department', d.department,
          'verified', d.verified,
          'missing', d.missing,
          'damaged', d.damaged,
          'total', d.total
        ) order by d.department)
        from per_dept d
      ), '[]'::jsonb),
      'contributors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'department', c.department,
          'status', c.status,
          'submitted_at', to_char(c.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'submitted_by', c.submitted_by
        ) order by c.department)
        from contributors c
      ), '[]'::jsonb)
    )
  returning * into report;
  return report;
end; $$;


--
-- Name: create_password_hash_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_password_hash_v1(p_password text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
	v_salt_hex text;
	v_digest_hex text;
BEGIN
	IF COALESCE(p_password,'') = '' THEN
		RETURN NULL;
	END IF;
	-- Generate a 32-hex salt without requiring gen_random_bytes
	v_salt_hex := md5(random()::text || clock_timestamp()::text);
	v_digest_hex := encode(digest(convert_to(v_salt_hex || '::' || p_password, 'UTF8'), 'sha256'), 'hex');
	RETURN 'v1$' || v_salt_hex || '$' || v_digest_hex;
END;
$_$;


--
-- Name: create_user_settings_on_signup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_settings_on_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insert user_settings entry for the new user
  -- email_notifications defaults to true
  INSERT INTO user_settings (user_id, email_notifications)
  VALUES (NEW.id, true)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: delete_all_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_all_reports() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  delete from public.reports where true;
end;
$$;


--
-- Name: delete_property_with_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_property_with_access(p_property_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF NOT public.app_user_can('properties','delete') OR NOT app_private.property_scope(p_property_id) THEN RAISE EXCEPTION 'Property deletion is not permitted' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Property not found or not accessible' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.assets WHERE property_id=p_property_id) AND NOT public.app_user_can('assets','delete') THEN RAISE EXCEPTION 'Deleting a property with assets requires asset delete permission' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.audit_sessions WHERE property_id=p_property_id) AND NOT public.app_user_can('audit','delete') THEN RAISE EXCEPTION 'Deleting a property with audits requires audit delete permission' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.assets WHERE property_id=p_property_id AND NOT app_private.department_scope(department)) THEN RAISE EXCEPTION 'Cannot delete a property containing departments outside your access' USING ERRCODE='42501'; END IF;
 DELETE FROM public.audit_incharge WHERE property_id=p_property_id;
 DELETE FROM public.audit_sessions WHERE property_id=p_property_id;
 DELETE FROM public.assets WHERE property_id=p_property_id;
 DELETE FROM public.properties WHERE id=p_property_id;
END $$;


--
-- Name: end_audit_session_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.end_audit_session_v1(p_session_id text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  update public.audit_sessions set is_active = false where id = p_session_id;
  -- leave reviews/assignments for record
end; $$;


--
-- Name: audit_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_assignments (
    session_id text NOT NULL,
    department text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone,
    submitted_by text,
    CONSTRAINT audit_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text])))
);

ALTER TABLE ONLY public.audit_assignments FORCE ROW LEVEL SECURITY;


--
-- Name: ensure_audit_assignment_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_audit_assignment_v1(p_session_id text, p_department text) RETURNS public.audit_assignments
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.audit_assignments;
BEGIN
  -- Insert if missing; ignore if exists (composite key on (session_id, department))
  INSERT INTO public.audit_assignments (session_id, department, status, submitted_at, submitted_by)
  VALUES (p_session_id, p_department, 'pending', NULL, NULL)
  ON CONFLICT (session_id, department) DO NOTHING;

  SELECT * INTO v_row
  FROM public.audit_assignments
  WHERE session_id = p_session_id AND department = p_department;

  RETURN v_row;
END;
$$;


--
-- Name: get_audit_incharge_for_user_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audit_incharge_for_user_v1(p_user_id text, p_user_email text DEFAULT NULL::text) RETURNS TABLE(property_id text)
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select ai.property_id::text as property_id
  from public.audit_incharge ai
  where (
    ai.user_id::text = p_user_id::text
    or (
      p_user_email is not null
      and (
        ai.user_id::text = p_user_email::text
        or ai.user_id::text = lower(p_user_email::text)
        or ai.user_id::text = upper(p_user_email::text)
      )
    )
  )
  order by ai.property_id::text
$$;


--
-- Name: get_audit_reviews_for_session_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audit_reviews_for_session_v1(p_session_id text) RETURNS TABLE(session_id text, asset_id text, department text, status text, comment text, updated_at timestamp with time zone)
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  with sess as (
    select s.id, s.property_id
    from public.audit_sessions s
    where s.id = p_session_id
  )
  select r.session_id, r.asset_id, r.department, r.status, r.comment, r.updated_at
  from public.audit_reviews r
  join sess on sess.id = r.session_id
  where r.session_id = p_session_id
    and (
      -- If session is not property-scoped, allow viewing (based on assignment activity)
      sess.property_id is null
      or exists (
        -- User has explicit property access
        select 1 from public.user_property_access upa
        where upa.user_id::text = auth.uid()::text
          and upa.property_id::text = sess.property_id::text
      )
      or exists (
        -- User is audit incharge for the session's property
        select 1 from public.audit_incharge ai
        where ai.user_id::text = auth.uid()::text
          and ai.property_id::text = sess.property_id::text
      )
      or exists (
        -- User has audit page permission (view or edit)
        select 1 from public.user_permissions p
        where p.user_id::text = auth.uid()::text
          and p.page = 'audit'
          and (
            coalesce(p.can_view, false) = true
            or coalesce(p.can_edit, false) = true
          )
      )
      or (
        -- Allow admins/managers (role-based) to read
        coalesce(public.app_user_has_role(auth.uid(), ARRAY['admin','manager']), false) = true
        or lower(coalesce(auth.jwt() ->> 'role', '')) in ('admin','manager','superadmin')
        or lower(coalesce(auth.jwt() ->> 'app_role', '')) in ('admin','manager','superadmin')
      )
    );
$$;


--
-- Name: get_audit_reviews_for_session_v2(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audit_reviews_for_session_v2(p_session_id text) RETURNS TABLE(session_id text, asset_id text, department text, status text, comment text, updated_at timestamp with time zone)
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select r.session_id, r.asset_id, r.department, r.status, r.comment, r.updated_at
  from public.audit_reviews r
  where r.session_id = p_session_id
    and exists (select 1 from public.audit_sessions s where s.id = p_session_id);
$$;


--
-- Name: get_auth_uid_by_email_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_uid_by_email_v1(p_email text) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$SELECT id FROM public.app_users WHERE lower(email)=lower(p_email) LIMIT 1$$;


--
-- Name: initialize_app_user_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_app_user_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    INSERT INTO public.user_settings(user_id,email_notifications) VALUES (NEW.id,true)
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: list_final_approver_props_for_email_v1(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_final_approver_props_for_email_v1(p_email text) RETURNS text[]
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  uid uuid;
  pids text[] := array[]::text[];
begin
  select public.get_auth_uid_by_email_v1(p_email) into uid;
  if uid is null then
    return pids;
  end if;
  select coalesce(array_agg(property_id), array[]::text[])
    into pids
    from public.final_approvers
    where user_id = uid;
  return pids;
end;
$$;


--
-- Name: password_hashes_match_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.password_hashes_match_v1(p_password text, p_stored text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
	v_is_modern boolean;
	v_salt text;
	v_digest text;
	v_computed text;
	v_legacy text;
BEGIN
	IF p_stored IS NULL OR COALESCE(p_password,'') = '' THEN
		RETURN FALSE;
	END IF;

	v_is_modern := position('v1$' in p_stored) = 1;
	IF v_is_modern THEN
		v_salt := split_part(p_stored, '$', 2);
		v_digest := split_part(p_stored, '$', 3);
		IF v_salt = '' OR v_digest = '' THEN
			RETURN FALSE;
		END IF;
		v_computed := encode(digest(convert_to(v_salt || '::' || p_password, 'UTF8'), 'sha256'), 'hex');
		RETURN v_computed = v_digest;
	END IF;

	-- legacy: base64 of UTF8 bytes, then first 32 chars
	v_legacy := substring(encode(convert_to(p_password, 'UTF8'), 'base64') from 1 for 32);
	RETURN v_legacy = p_stored;
END;
$_$;


--
-- Name: request_password_reset_v1(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_password_reset_v1(p_email text, p_code text, p_ttl_minutes integer DEFAULT 10) RETURNS TABLE(user_id uuid, user_name text, user_email text, sent boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target record;
  hashed text;
  salt text;
  expires_at timestamptz;
  now_ts timestamptz := now();
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return;
  end if;

  select id, name, email
    into target
    from app_users
    where lower(email) = lower(p_email)
    limit 1;

  if not found then
    return;
  end if;

  if coalesce(p_code, '') = '' then
    return;
  end if;

  salt := md5(now_ts::text || random()::text || target.id::text || p_code);
  hashed := md5(p_code || salt);
  expires_at := now_ts + make_interval(mins => greatest(p_ttl_minutes, 1));

  insert into password_reset_requests as pr (
    user_id,
    email,
    code_hash,
    code_salt,
    invalid_attempts,
    expires_at,
    session_token,
    session_expires_at,
    consumed_at,
    last_sent_at,
    updated_at
  )
  values (
    target.id,
    target.email,
    hashed,
    salt,
    0,
    expires_at,
    null,
    null,
    null,
    now_ts,
    now_ts
  )
  on conflict on constraint password_reset_requests_user_key
  do update set
    email = excluded.email,
    code_hash = excluded.code_hash,
    code_salt = excluded.code_salt,
    invalid_attempts = 0,
    expires_at = excluded.expires_at,
    session_token = null,
    session_expires_at = null,
    consumed_at = null,
    last_sent_at = excluded.last_sent_at,
    updated_at = excluded.updated_at;

  return query
  select target.id, target.name, target.email, true;
end;
$$;


--
-- Name: self_set_password_hash_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.self_set_password_hash_v1(p_email text, p_new_password_hash text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
	v_uid uuid;
BEGIN
	PERFORM set_config('app.bypass_sensitive_guard', 'on', true);

	SELECT u.id INTO v_uid
		FROM public.app_users u
	 WHERE lower(u.email) = lower(trim(COALESCE(p_email,'')))
	 LIMIT 1;

	IF v_uid IS NULL THEN
		RAISE EXCEPTION 'USER_NOT_FOUND';
	END IF;
	IF COALESCE(trim(p_new_password_hash),'') = '' THEN
		RAISE EXCEPTION 'INVALID_NEW_PASSWORD_HASH';
	END IF;

	UPDATE public.app_users
		 SET password_hash = p_new_password_hash,
				 password_changed_at = now(),
				 must_change_password = false
	 WHERE id = v_uid;
END;
$$;


--
-- Name: self_set_password_v1(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.self_set_password_v1(p_email text, p_current_password text, p_new_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
	v_uid uuid;
	v_stored text;
	v_ok boolean;
	v_next text;
BEGIN
	-- Enable guarded access for this transaction (for RLS and trigger)
	PERFORM set_config('app.bypass_sensitive_guard', 'on', true);

	SELECT u.id, u.password_hash
		INTO v_uid, v_stored
		FROM public.app_users u
	 WHERE lower(u.email) = lower(trim(COALESCE(p_email,'')))
	 LIMIT 1;

	IF v_uid IS NULL THEN
		RAISE EXCEPTION 'USER_NOT_FOUND';
	END IF;

	-- Removed current password verification (per request): any caller may change the password for this email
	v_ok := TRUE;

	v_next := public.create_password_hash_v1(p_new_password);
	IF v_next IS NULL THEN
		RAISE EXCEPTION 'INVALID_NEW_PASSWORD';
	END IF;

	UPDATE public.app_users
		 SET password_hash = v_next,
				 password_changed_at = now(),
				 must_change_password = false
	 WHERE id = v_uid;

	RETURN;
END;
$$;


--
-- Name: set_audit_incharge_for_user_v1(text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_audit_incharge_for_user_v1(p_user_id text, p_user_name text DEFAULT NULL::text, p_property_ids text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
	pid text;
	v_email text;
begin
	perform set_config('app.bypass_sensitive_guard', 'on', true);
	if p_user_id is null then
		raise exception 'user_id is required';
	end if;
	-- fetch email for this user id if present
	select email into v_email from public.app_users where id::text = p_user_id::text limit 1;

	-- remove prior assignments for this user that are not in the new list
	delete from public.audit_incharge ai
	where (
		ai.user_id::text = p_user_id::text
		or (v_email is not null and (ai.user_id::text = v_email::text or ai.user_id::text = lower(v_email::text) or ai.user_id::text = upper(v_email::text)))
	)
	and (
		p_property_ids is null or not (ai.property_id = any(p_property_ids))
	);

	-- upsert new assignments (reassign if currently mapped to someone else)
	if p_property_ids is not null then
		foreach pid in array p_property_ids loop
			insert into public.audit_incharge(property_id, user_id, user_name)
			values (pid, p_user_id, p_user_name)
			on conflict (property_id) do update set user_id = excluded.user_id, user_name = excluded.user_name, updated_at = now();
		end loop;
	end if;
end $$;


--
-- Name: audit_incharge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_incharge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id text NOT NULL,
    user_id text NOT NULL,
    user_name text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.audit_incharge FORCE ROW LEVEL SECURITY;


--
-- Name: set_audit_incharge_v1(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_audit_incharge_v1(p_property_id text, p_user_id text, p_user_name text DEFAULT NULL::text) RETURNS public.audit_incharge
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
	v_row public.audit_incharge;
begin
	perform set_config('app.bypass_sensitive_guard', 'on', true);
	if p_property_id is null or p_user_id is null then
		raise exception 'property_id and user_id are required';
	end if;
	insert into public.audit_incharge(property_id, user_id, user_name)
	values (p_property_id, p_user_id, p_user_name)
	on conflict (property_id) do update set user_id = excluded.user_id, user_name = excluded.user_name, updated_at = now()
	returning * into v_row;
	return v_row;
end $$;


--
-- Name: set_final_approver(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver(p_property_id text, p_user_id uuid, p_user_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select public.set_final_approver_v1(p_property_id, p_user_id, p_user_name);
$$;


--
-- Name: set_final_approver_by_email_v1(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver_by_email_v1(p_property_id text, p_email text, p_user_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  uid uuid;
  v_name text;
BEGIN
  IF NOT public.app_is_admin_v1() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  SELECT public.get_auth_uid_by_email_v1(p_email) INTO uid;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'user not found for email %', p_email;
  END IF;
  SELECT u.name INTO v_name FROM public.app_users u WHERE u.id = uid LIMIT 1;
  INSERT INTO public.final_approvers(property_id, user_id, user_name, user_email, created_by)
  VALUES (p_property_id, uid, COALESCE(p_user_name, v_name), p_email, auth.uid())
  ON CONFLICT (property_id)
  DO UPDATE SET user_id = EXCLUDED.user_id,
                user_name = EXCLUDED.user_name,
                user_email = EXCLUDED.user_email,
                created_by = auth.uid();
END;
$$;


--
-- Name: set_final_approver_for_user(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver_for_user(p_user_id uuid, p_user_name text, p_property_ids text[]) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select public.set_final_approver_for_user_v1(p_user_id, p_user_name, p_property_ids);
$$;


--
-- Name: set_final_approver_for_user_by_email_v1(text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver_for_user_by_email_v1(p_email text, p_user_name text, p_property_ids text[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  uid uuid;
  pid text;
  v_name text;
BEGIN
  IF NOT public.app_is_admin_v1() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  SELECT public.get_auth_uid_by_email_v1(p_email) INTO uid;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'user not found for email %', p_email;
  END IF;
  SELECT u.name INTO v_name FROM public.app_users u WHERE u.id = uid LIMIT 1;

  -- Remove assignments based on provided array semantics
  IF p_property_ids IS NULL THEN
    NULL; -- no change
  ELSIF COALESCE(array_length(p_property_ids, 1), 0) = 0 THEN
    DELETE FROM public.final_approvers WHERE user_id = uid;
  ELSE
    DELETE FROM public.final_approvers
     WHERE user_id = uid
       AND property_id <> ALL(p_property_ids);
  END IF;

  IF p_property_ids IS NOT NULL AND COALESCE(array_length(p_property_ids, 1), 0) > 0 THEN
    FOREACH pid IN ARRAY p_property_ids LOOP
      INSERT INTO public.final_approvers(property_id, user_id, user_name, user_email, created_by)
      VALUES (pid, uid, COALESCE(p_user_name, v_name), p_email, auth.uid())
      ON CONFLICT (property_id)
      DO UPDATE SET user_id = EXCLUDED.user_id,
                    user_name = EXCLUDED.user_name,
                    user_email = EXCLUDED.user_email,
                    created_by = auth.uid();
    END LOOP;
  END IF;
END;
$$;


--
-- Name: set_final_approver_for_user_v1(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver_for_user_v1(p_user_id uuid, p_user_name text, p_property_ids text[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  pid text;
  v_name text;
  v_email text;
BEGIN
  IF NOT public.app_is_admin_v1() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT u.name, u.email INTO v_name, v_email FROM public.app_users u WHERE u.id = p_user_id LIMIT 1;

  -- Remove assignments based on provided array semantics
  IF p_property_ids IS NULL THEN
    NULL; -- no change
  ELSIF COALESCE(array_length(p_property_ids, 1), 0) = 0 THEN
    DELETE FROM public.final_approvers WHERE user_id = p_user_id;
  ELSE
    DELETE FROM public.final_approvers
     WHERE user_id = p_user_id
       AND property_id <> ALL(p_property_ids);
  END IF;

  IF p_property_ids IS NOT NULL AND COALESCE(array_length(p_property_ids, 1), 0) > 0 THEN
    FOREACH pid IN ARRAY p_property_ids LOOP
      INSERT INTO public.final_approvers(property_id, user_id, user_name, user_email, created_by)
      VALUES (pid, p_user_id, COALESCE(p_user_name, v_name), v_email, auth.uid())
      ON CONFLICT (property_id)
      DO UPDATE SET user_id = EXCLUDED.user_id,
                    user_name = EXCLUDED.user_name,
                    user_email = EXCLUDED.user_email,
                    created_by = auth.uid();
    END LOOP;
  END IF;
END;
$$;


--
-- Name: set_final_approver_v1(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_final_approver_v1(p_property_id text, p_user_id uuid, p_user_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NOT public.app_is_admin_v1() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT u.name, u.email INTO v_name, v_email FROM public.app_users u WHERE u.id = p_user_id LIMIT 1;

  INSERT INTO public.final_approvers(property_id, user_id, user_name, user_email, created_by)
  VALUES (p_property_id, p_user_id, COALESCE(p_user_name, v_name), v_email, auth.uid())
  ON CONFLICT (property_id)
  DO UPDATE SET user_id = EXCLUDED.user_id,
                user_name = EXCLUDED.user_name,
                user_email = EXCLUDED.user_email,
                created_by = auth.uid();
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
	new.updated_at = now();
	return new;
end $$;


--
-- Name: set_updated_at_now(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_now() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: set_user_department_access(text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_department_access(p_user_id text, p_departments text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- Ensure predictable search_path
  perform set_config('search_path', 'public, pg_temp', true);
  -- Note: Admin check removed to avoid 403 when JWT lacks 'role' claim.
  -- The function runs as SECURITY DEFINER and will execute for authenticated callers.

  -- Remove rows not in the desired set
  delete from public.user_department_access
  where user_id = p_user_id
    and department not in (select unnest(p_departments));

  -- Insert missing rows
  insert into public.user_department_access(user_id, department)
  select p_user_id, d
  from unnest(p_departments) as d
  on conflict (user_id, department) do nothing;
end;
$$;


--
-- Name: set_user_department_access(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_department_access(p_user_id uuid, p_departments text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- Ensure predictable search_path
  perform set_config('search_path', 'public, pg_temp', true);
  -- Note: Admin check removed to avoid 403 when JWT lacks 'role' claim.
  -- The function runs as SECURITY DEFINER and will execute for authenticated callers.

  -- Remove rows not in the desired set
  delete from public.user_department_access
  where user_id = p_user_id
    and department not in (select unnest(p_departments));

  -- Insert missing rows
  insert into public.user_department_access(user_id, department)
  select p_user_id, d
  from unnest(p_departments) as d
  on conflict (user_id, department) do nothing;
end;
$$;


--
-- Name: set_user_department_access_v1(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_department_access_v1(p_user_id uuid, p_departments text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  perform set_config('search_path', 'public, pg_temp', true);

  delete from public.user_department_access
  where user_id = p_user_id
    and department not in (select unnest(p_departments));

  insert into public.user_department_access(user_id, department)
  select p_user_id, d
  from unnest(p_departments) as d
  on conflict (user_id, department) do nothing;
end;
$$;


--
-- Name: set_user_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_password(uid uuid, raw_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  update public.app_users
    set password_hash = crypt(raw_password, gen_salt('bf')),
        password_changed_at = now()
  where id = uid;
end;
$$;


--
-- Name: set_user_permissions_json_v1(text, json); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_permissions_json_v1(p_user_id text, p_perms json) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_page text;
  v_v boolean;
  v_e boolean;
begin
  perform set_config('app.bypass_sensitive_guard', 'on', true);
  if p_user_id is null then raise exception 'user_id required'; end if;
  -- p_perms is expected as JSON array of objects: [{"page":"audit","v":true,"e":false}, ...]
  for v_page, v_v, v_e in
    select (elem->>'page')::text, coalesce((elem->>'v')::boolean, false), coalesce((elem->>'e')::boolean, false)
    from json_array_elements(p_perms) as elem
  loop
    insert into public.user_permissions(user_id, page, can_view, can_edit)
    values (p_user_id, v_page::text, v_v, v_e)
    on conflict (user_id, page) do update set can_view = excluded.can_view, can_edit = excluded.can_edit;
  end loop;
end $$;


--
-- Name: set_user_permissions_json_v1(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_permissions_json_v1(p_user_id uuid, p_perms jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  perform set_config('search_path', 'public, pg_temp', true);

  delete from public.user_permissions up
  where up.user_id = p_user_id
    and up.page not in (select (elem->>'page') from jsonb_array_elements(p_perms) elem);

  insert into public.user_permissions(user_id, page, can_view, can_edit)
  select p_user_id,
         elem->>'page',
         coalesce((elem->>'v')::boolean, false),
         coalesce((elem->>'e')::boolean, false)
  from jsonb_array_elements(p_perms) elem
  on conflict (user_id, page) do update
  set can_view = excluded.can_view,
      can_edit = excluded.can_edit;
end;
$$;


--
-- Name: set_user_permissions_v1(uuid, public.user_permission_row[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_permissions_v1(p_user_id uuid, p_perms public.user_permission_row[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  perform set_config('search_path', 'public, pg_temp', true);

  -- Upsert each provided page entry; remove pages not provided
  delete from public.user_permissions
  where user_id = p_user_id
    and page not in (select (x).page from unnest(p_perms) x);

  insert into public.user_permissions(user_id, page, can_view, can_edit)
  select p_user_id, (x).page, (x).v, (x).e
  from unnest(p_perms) x
  on conflict (user_id, page) do update
  set can_view = excluded.can_view,
      can_edit = excluded.can_edit;
end;
$$;


--
-- Name: set_user_property_access_v1(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_property_access_v1(p_user_id uuid, p_property_ids text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  perform set_config('search_path', 'public, pg_temp', true);

  delete from public.user_property_access
  where user_id = p_user_id
    and property_id not in (select unnest(p_property_ids));

  insert into public.user_property_access(user_id, property_id)
  select p_user_id, d
  from unnest(p_property_ids) as d
  on conflict (user_id, property_id) do nothing;
end;
$$;


--
-- Name: audit_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_sessions (
    id text DEFAULT ('AUD-'::text || substr(encode(extensions.gen_random_bytes(6), 'hex'::text), 1, 6)) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    frequency_months integer NOT NULL,
    initiated_by text,
    is_active boolean DEFAULT true NOT NULL,
    property_id text,
    CONSTRAINT audit_sessions_frequency_months_check CHECK ((frequency_months = ANY (ARRAY[1, 3, 6])))
);

ALTER TABLE ONLY public.audit_sessions FORCE ROW LEVEL SECURITY;


--
-- Name: start_audit_session_v1(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_audit_session_v1(p_frequency_months integer, p_initiated_by text) RETURNS public.audit_sessions
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare s public.audit_sessions;
begin
  insert into public.audit_sessions(frequency_months, initiated_by, is_active)
  values (p_frequency_months, p_initiated_by, true)
  returning * into s;
  return s;
end; $$;


--
-- Name: start_audit_session_v2(integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_audit_session_v2(p_frequency_months integer, p_initiated_by text, p_property_id text) RETURNS public.audit_sessions
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  new_session public.audit_sessions;
begin
  -- Validate property (optional but safer)
  if p_property_id is not null and not exists (
    select 1 from public.properties pr where pr.id = p_property_id
  ) then
    raise exception 'Property % not found', p_property_id using errcode = 'P0002';
  end if;

  -- End any active session
  update public.audit_sessions set is_active = false where is_active = true;

  -- Start new session with property scoping
  insert into public.audit_sessions (frequency_months, initiated_by, is_active, started_at, property_id)
  values (p_frequency_months, p_initiated_by, true, now(), p_property_id)
  returning * into new_session;

  return new_session;
end;
$$;


--
-- Name: submit_audit_assignment_v1(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_audit_assignment_v1(p_session_id text, p_department text, p_submitted_by text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.audit_assignments(session_id, department, status, submitted_at, submitted_by)
  values (p_session_id, p_department, 'submitted', now(), p_submitted_by)
  on conflict (session_id, department) do update set status = 'submitted', submitted_at = now(), submitted_by = p_submitted_by;
end; $$;


--
-- Name: sync_auth_account_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auth_account_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.app_users SET
    email = NEW.email,
    password_changed_at = CASE WHEN NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN now() ELSE password_changed_at END,
    must_change_password = CASE WHEN NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN false ELSE must_change_password END
  WHERE id = NEW.id;
  RETURN NEW;
END $$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: trg_sync_approval_event_comments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sync_approval_event_comments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- On insert/update: if comments provided but message null, copy comments -> message
  if new.message is null and new.comments is not null then
    new.message := new.comments;
  end if;
  -- If message provided but comments null, copy message -> comments
  if new.comments is null and new.message is not null then
    new.comments := new.message;
  end if;
  return new;
end;
$$;


--
-- Name: upsert_audit_reviews_v1(text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_audit_reviews_v1(p_session_id text, p_department text, p_rows_json jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.audit_reviews(session_id, asset_id, department, status, comment)
  select p_session_id, (r->>'asset_id')::text, p_department, (r->>'status')::text, nullif(r->>'comment','')
  from jsonb_array_elements(p_rows_json) as r
  on conflict (session_id, asset_id) do update set status = excluded.status, comment = excluded.comment, updated_at = now();
end; $$;


--
-- Name: verify_asset_via_scan_v1(text, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_asset_via_scan_v1(p_session_id text, p_asset_id text, p_status text, p_scanned_by uuid, p_comment text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_dept text;
  v_prop text;
  v_sess_prop text;
begin
  if p_status not in ('verified','damaged') then
    raise exception 'Invalid status %', p_status;
  end if;

  -- Resolve asset department/property
  select a.department::text, a.property_id::text into v_dept, v_prop
  from public.assets a where a.id = p_asset_id;
  if v_dept is null then
    raise exception 'Asset % not found or missing department', p_asset_id;
  end if;

  -- If session is property-scoped, ensure match
  select s.property_id::text into v_sess_prop from public.audit_sessions s where s.id = p_session_id;
  if v_sess_prop is not null and v_prop is not null and v_prop::text <> v_sess_prop::text then
    raise exception 'Asset property % does not match session property %', v_prop, v_sess_prop;
  end if;

  -- Access checks: department and property
  if not exists (
    select 1 from public.user_department_access uda
    where uda.user_id::text = p_scanned_by::text and uda.department = v_dept
  ) then
    raise exception 'User lacks department access to %', v_dept;
  end if;
  if v_prop is not null and not exists (
    select 1 from public.user_property_access upa
    where upa.user_id::text = p_scanned_by::text and upa.property_id::text = v_prop::text
  ) then
    raise exception 'User lacks property access to %', v_prop;
  end if;

  -- Log scan
  insert into public.audit_scans(session_id, asset_id, property_id, department, status, scanned_by)
  values (p_session_id, p_asset_id, v_prop, v_dept, p_status, p_scanned_by);

  -- Upsert review via existing RPC (single row payload)
  perform public.upsert_audit_reviews_v1(p_session_id, v_dept, jsonb_build_array(jsonb_build_object(
    'asset_id', p_asset_id,
    'status', p_status,
    'comment', p_comment
  )));
end $$;


--
-- Name: verify_password_reset_code_v1(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_password_reset_code_v1(p_email text, p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  rec record;
  now_ts timestamptz := now();
  attempts integer;
  token uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return jsonb_build_object('status', 'resend', 'reason', 'missing_email');
  end if;

  select pr.*, au.id as target_user_id
    into rec
    from password_reset_requests pr
    join app_users au on au.id = pr.user_id
    where lower(au.email) = lower(p_email)
    limit 1;

  if not found then
    return jsonb_build_object('status', 'resend', 'reason', 'missing_request');
  end if;

  if rec.consumed_at is not null then
    return jsonb_build_object('status', 'resend', 'reason', 'already_used');
  end if;

  if rec.expires_at is null or rec.expires_at < now_ts then
    return jsonb_build_object('status', 'resend', 'reason', 'expired');
  end if;

  if rec.code_hash is null or rec.code_salt is null then
    return jsonb_build_object('status', 'resend', 'reason', 'no_code');
  end if;

  if md5(coalesce(p_code, '') || rec.code_salt) = rec.code_hash then
    token := coalesce(rec.session_token, gen_random_uuid());
    update password_reset_requests
      set invalid_attempts = 0,
          session_token = token,
          session_expires_at = now_ts + interval '15 minutes',
          updated_at = now_ts
      where id = rec.id;

    return jsonb_build_object('status', 'ok', 'reset_token', token::text);
  end if;

  attempts := coalesce(rec.invalid_attempts, 0) + 1;

  if attempts >= 3 then
    update password_reset_requests
      set invalid_attempts = 0,
          code_hash = null,
          code_salt = null,
          expires_at = null,
          session_token = null,
          session_expires_at = null,
          updated_at = now_ts
      where id = rec.id;

    return jsonb_build_object('status', 'resend', 'attempts_remaining', 0);
  else
    update password_reset_requests
      set invalid_attempts = attempts,
          code_salt = rec.code_salt,
          updated_at = now_ts
      where id = rec.id;

    return jsonb_build_object('status', 'mismatch', 'attempts_remaining', greatest(0, 3 - attempts));
  end if;
end;
$$;


--
-- Name: verify_user_credentials(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_user_credentials(p_email text, p_password text) RETURNS TABLE(id uuid, name text, email text, role text, department text, phone text, status text, avatar_url text, must_change_password boolean)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select u.id, u.name, u.email, u.role, u.department, u.phone, u.status, u.avatar_url, coalesce(u.must_change_password, false)
  from public.app_users u
  where lower(u.email) = lower(p_email)
    and u.status is distinct from 'Inactive'
    and u.password_hash is not null
    and crypt(p_password, u.password_hash) = u.password_hash
  limit 1;
$$;


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'User'::text NOT NULL,
    department text,
    phone text,
    last_login date,
    status text DEFAULT 'Active'::text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    password_changed_at timestamp with time zone,
    active_session_id text,
    login_name text GENERATED ALWAYS AS (lower(split_part(email, '@'::text, 1))) STORED,
    CONSTRAINT check_role_lowercase CHECK ((role = lower(role)))
);

ALTER TABLE ONLY public.app_users FORCE ROW LEVEL SECURITY;


--
-- Name: approval_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_events (
    id bigint NOT NULL,
    approval_id text NOT NULL,
    event_type text NOT NULL,
    author text NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comments text,
    CONSTRAINT approval_events_event_type_check CHECK ((event_type = ANY (ARRAY['submitted'::text, 'forwarded'::text, 'approved'::text, 'rejected'::text, 'applied'::text, 'manager_updated'::text, 'admin_override_approved'::text, 'comment'::text])))
);

ALTER TABLE ONLY public.approval_events FORCE ROW LEVEL SECURITY;


--
-- Name: approval_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_events_id_seq OWNED BY public.approval_events.id;


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id text NOT NULL,
    asset_id text NOT NULL,
    action text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    notes text,
    patch jsonb,
    department text,
    CONSTRAINT approvals_action_check CHECK ((action = ANY (ARRAY['create'::text, 'edit'::text, 'delete'::text]))),
    CONSTRAINT approvals_status_check CHECK ((status = ANY (ARRAY['pending_manager'::text, 'pending_admin'::text, 'approved'::text, 'rejected'::text])))
);

ALTER TABLE ONLY public.approvals FORCE ROW LEVEL SECURITY;


--
-- Name: asset_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_types (
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.asset_types FORCE ROW LEVEL SECURITY;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    property text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    purchase_date date,
    expiry_date date,
    po_number text,
    condition text,
    status text DEFAULT 'Active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    property_id text,
    location text,
    department text,
    description text,
    serial_number text,
    amc_enabled boolean DEFAULT false NOT NULL,
    amc_start_date date,
    amc_end_date date,
    created_by text,
    created_by_name text,
    created_by_email text
);

ALTER TABLE ONLY public.assets FORCE ROW LEVEL SECURITY;


--
-- Name: audit_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_reviews (
    session_id text NOT NULL,
    asset_id text NOT NULL,
    department text NOT NULL,
    status text NOT NULL,
    comment text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_reviews_status_check CHECK ((status = ANY (ARRAY['verified'::text, 'missing'::text, 'damaged'::text])))
);

ALTER TABLE ONLY public.audit_reviews FORCE ROW LEVEL SECURITY;


--
-- Name: audit_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    asset_id text NOT NULL,
    property_id text,
    department text NOT NULL,
    status text NOT NULL,
    scanned_by uuid NOT NULL,
    scanned_at timestamp with time zone DEFAULT now() NOT NULL,
    scanned_by_name text,
    scanned_by_email text,
    CONSTRAINT audit_scans_status_check CHECK ((status = ANY (ARRAY['verified'::text, 'damaged'::text])))
);

ALTER TABLE ONLY public.audit_scans FORCE ROW LEVEL SECURITY;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.departments FORCE ROW LEVEL SECURITY;


--
-- Name: final_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.final_approvers (
    property_id text NOT NULL,
    user_id uuid NOT NULL,
    user_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    user_email text
);

ALTER TABLE ONLY public.final_approvers FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE final_approvers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.final_approvers IS 'Property-wise Final Approver mapping';


--
-- Name: COLUMN final_approvers.property_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.final_approvers.property_id IS 'Property identifier (code/id used in app)';


--
-- Name: COLUMN final_approvers.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.final_approvers.user_id IS 'Supabase auth user id of the final approver';


--
-- Name: license_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_meta (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.license_meta FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE license_meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.license_meta IS 'Global license and related key/value metadata (RLS enforced)';


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id text NOT NULL,
    name text NOT NULL,
    address text,
    type text NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    manager text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.properties FORCE ROW LEVEL SECURITY;


--
-- Name: property_license; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_license (
    property_id text NOT NULL,
    asset_limit integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plan text
);

ALTER TABLE ONLY public.property_license FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE property_license; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.property_license IS 'Per-property asset license limits (RLS enforced)';


--
-- Name: COLUMN property_license.plan; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.property_license.plan IS 'Optional plan tier for this property (free|standard|pro|business). If set, asset_limit may derive from plan unless overridden.';


--
-- Name: license_usage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.license_usage WITH (security_barrier='true', security_invoker='on') AS
 SELECT p.id AS property_id,
    pl.plan,
    pl.asset_limit,
        CASE
            WHEN (pl.asset_limit > 0) THEN pl.asset_limit
            WHEN (pl.plan = 'free'::text) THEN 100
            WHEN (pl.plan = 'standard'::text) THEN 500
            WHEN (pl.plan = 'pro'::text) THEN 2500
            WHEN (pl.plan = 'business'::text) THEN NULL::integer
            ELSE NULL::integer
        END AS effective_limit,
    ( SELECT count(*) AS count
           FROM public.assets a
          WHERE (a.property_id = p.id)) AS asset_count
   FROM (public.properties p
     LEFT JOIN public.property_license pl ON ((pl.property_id = p.id)));


--
-- Name: VIEW license_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.license_usage IS 'Per-property license usage with plan, raw asset_limit, and effective_limit (derived).';


--
-- Name: newsletter_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_categories (
    key text NOT NULL,
    label text NOT NULL,
    hue text DEFAULT 'blue'::text NOT NULL
);

ALTER TABLE ONLY public.newsletter_categories FORCE ROW LEVEL SECURITY;


--
-- Name: newsletter_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_posts (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    author text,
    published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    category text DEFAULT 'update'::text NOT NULL
);

ALTER TABLE ONLY public.newsletter_posts FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'system'::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id text,
    user_name text
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    code_hash text,
    invalid_attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    session_token uuid,
    session_expires_at timestamp with time zone,
    consumed_at timestamp with time zone,
    last_sent_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    code_salt text
);

ALTER TABLE ONLY public.password_reset_requests FORCE ROW LEVEL SECURITY;


--
-- Name: qr_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_codes (
    id text NOT NULL,
    asset_id text NOT NULL,
    property text,
    generated_date date DEFAULT (now())::date NOT NULL,
    status text DEFAULT 'Generated'::text NOT NULL,
    printed boolean DEFAULT false NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.qr_codes FORCE ROW LEVEL SECURITY;


--
-- Name: recent_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recent_activity (
    id bigint NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    user_id uuid,
    user_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.recent_activity FORCE ROW LEVEL SECURITY;


--
-- Name: recent_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recent_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recent_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recent_activity_id_seq OWNED BY public.recent_activity.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    format text DEFAULT 'pdf'::text NOT NULL,
    status text DEFAULT 'Completed'::text NOT NULL,
    date_from date,
    date_to date,
    file_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    filter_department text,
    filter_property text,
    filter_asset_type text,
    created_by text,
    created_by_id text,
    user_name text,
    user_email text,
    filter_session_id text
);

ALTER TABLE ONLY public.reports FORCE ROW LEVEL SECURITY;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id boolean DEFAULT true NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    language text DEFAULT 'en'::text,
    backup_frequency text DEFAULT 'daily'::text,
    auto_backup boolean DEFAULT true,
    appearance jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.system_settings FORCE ROW LEVEL SECURITY;


--
-- Name: ticket_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_events (
    id bigint NOT NULL,
    ticket_id text NOT NULL,
    event_type text NOT NULL,
    message text,
    author text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'comment'::text, 'status_change'::text, 'closed'::text])))
);

ALTER TABLE ONLY public.ticket_events FORCE ROW LEVEL SECURITY;


--
-- Name: ticket_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_events_id_seq OWNED BY public.ticket_events.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'open'::text NOT NULL,
    assignee text,
    priority text DEFAULT 'medium'::text NOT NULL,
    sla_due_at timestamp with time zone,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    target_role text NOT NULL,
    close_note text,
    property_id text,
    CONSTRAINT tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT tickets_target_role_check CHECK ((target_role = ANY (ARRAY['admin'::text, 'manager'::text])))
);

ALTER TABLE ONLY public.tickets FORCE ROW LEVEL SECURITY;


--
-- Name: user_department_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_department_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    department text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_department_access FORCE ROW LEVEL SECURITY;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    page text NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_name text,
    user_email text,
    can_create boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_export boolean DEFAULT false NOT NULL,
    CONSTRAINT user_permissions_page_check CHECK ((page ~ '^[a-z][a-z0-9_.-]{0,63}$'::text))
);

ALTER TABLE ONLY public.user_permissions FORCE ROW LEVEL SECURITY;


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    show_newsletter boolean DEFAULT false NOT NULL,
    compact_mode boolean DEFAULT false NOT NULL,
    enable_beta_features boolean DEFAULT false NOT NULL,
    default_landing_page text,
    feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sidebar_collapsed boolean DEFAULT false NOT NULL,
    enable_sounds boolean DEFAULT true NOT NULL,
    density text DEFAULT 'comfortable'::text,
    auto_theme boolean DEFAULT false NOT NULL,
    show_announcements boolean DEFAULT true NOT NULL,
    sticky_header boolean DEFAULT false NOT NULL,
    top_nav_mode boolean DEFAULT false NOT NULL,
    user_email text,
    show_help_center boolean DEFAULT true NOT NULL,
    CONSTRAINT user_preferences_density_check CHECK ((density = ANY (ARRAY['comfortable'::text, 'compact'::text, 'ultra'::text])))
);

ALTER TABLE ONLY public.user_preferences FORCE ROW LEVEL SECURITY;


--
-- Name: user_property_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_property_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    property_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_name text,
    user_email text
);

ALTER TABLE ONLY public.user_property_access FORCE ROW LEVEL SECURITY;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notifications boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    notification_types jsonb DEFAULT '{"low_stock": true, "new_assets": false, "asset_expiry": true, "system_updates": true}'::jsonb,
    dark_mode boolean DEFAULT false,
    dashboard_prefs jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_name text,
    user_email text
);

ALTER TABLE ONLY public.user_settings FORCE ROW LEVEL SECURITY;


--
-- Name: approval_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events ALTER COLUMN id SET DEFAULT nextval('public.approval_events_id_seq'::regclass);


--
-- Name: recent_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_activity ALTER COLUMN id SET DEFAULT nextval('public.recent_activity_id_seq'::regclass);


--
-- Name: ticket_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_events ALTER COLUMN id SET DEFAULT nextval('public.ticket_events_id_seq'::regclass);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: approval_events approval_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: asset_types asset_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_types
    ADD CONSTRAINT asset_types_pkey PRIMARY KEY (name);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_assignments audit_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_assignments
    ADD CONSTRAINT audit_assignments_pkey PRIMARY KEY (session_id, department);


--
-- Name: audit_incharge audit_incharge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_incharge
    ADD CONSTRAINT audit_incharge_pkey PRIMARY KEY (id);


--
-- Name: audit_incharge audit_incharge_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_incharge
    ADD CONSTRAINT audit_incharge_property_id_key UNIQUE (property_id);


--
-- Name: audit_reports audit_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_reports
    ADD CONSTRAINT audit_reports_pkey PRIMARY KEY (id);


--
-- Name: audit_reviews audit_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_reviews
    ADD CONSTRAINT audit_reviews_pkey PRIMARY KEY (session_id, asset_id);


--
-- Name: audit_scans audit_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_scans
    ADD CONSTRAINT audit_scans_pkey PRIMARY KEY (id);


--
-- Name: audit_sessions audit_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: final_approvers final_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_approvers
    ADD CONSTRAINT final_approvers_pkey PRIMARY KEY (property_id);


--
-- Name: license_meta license_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_meta
    ADD CONSTRAINT license_meta_pkey PRIMARY KEY (key);


--
-- Name: newsletter_categories newsletter_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_categories
    ADD CONSTRAINT newsletter_categories_pkey PRIMARY KEY (key);


--
-- Name: newsletter_posts newsletter_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_posts
    ADD CONSTRAINT newsletter_posts_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_user_key UNIQUE (user_id);


--
-- Name: properties properties_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_name_key UNIQUE (name);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_license property_license_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_license
    ADD CONSTRAINT property_license_pkey PRIMARY KEY (property_id);


--
-- Name: qr_codes qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_pkey PRIMARY KEY (id);


--
-- Name: recent_activity recent_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_activity
    ADD CONSTRAINT recent_activity_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: ticket_events ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_events
    ADD CONSTRAINT ticket_events_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: user_department_access user_department_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_department_access
    ADD CONSTRAINT user_department_access_pkey PRIMARY KEY (id);


--
-- Name: user_department_access user_department_access_user_id_department_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_department_access
    ADD CONSTRAINT user_department_access_user_id_department_key UNIQUE (user_id, department);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_page_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_page_key UNIQUE (user_id, page);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_property_access user_property_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_property_access
    ADD CONSTRAINT user_property_access_pkey PRIMARY KEY (id);


--
-- Name: user_property_access user_property_access_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_property_access
    ADD CONSTRAINT user_property_access_user_id_property_id_key UNIQUE (user_id, property_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: app_users_email_unique_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_users_email_unique_lower ON public.app_users USING btree (lower(email));


--
-- Name: app_users_login_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_users_login_name_idx ON public.app_users USING btree (login_name);


--
-- Name: approval_events_approval_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_events_approval_id_idx ON public.approval_events USING btree (approval_id);


--
-- Name: approval_events_approval_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_events_approval_idx ON public.approval_events USING btree (approval_id);


--
-- Name: approval_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_events_created_at_idx ON public.approval_events USING btree (created_at);


--
-- Name: approval_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_events_created_idx ON public.approval_events USING btree (created_at DESC);


--
-- Name: approvals_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_asset_idx ON public.approvals USING btree (asset_id);


--
-- Name: approvals_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_department_idx ON public.approvals USING btree (department);


--
-- Name: approvals_requested_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_requested_at_idx ON public.approvals USING btree (requested_at DESC);


--
-- Name: approvals_requested_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_requested_by_idx ON public.approvals USING btree (lower(requested_by));


--
-- Name: approvals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_status_idx ON public.approvals USING btree (status);


--
-- Name: departments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_active_idx ON public.departments USING btree (is_active);


--
-- Name: departments_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX departments_name_idx ON public.departments USING btree (name);


--
-- Name: idx_ai_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_property ON public.audit_incharge USING btree (property_id);


--
-- Name: idx_assets_amc_end_date_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_amc_end_date_enabled ON public.assets USING btree (amc_end_date) WHERE amc_enabled;


--
-- Name: idx_assets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_created_at ON public.assets USING btree (created_at DESC);


--
-- Name: idx_assets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_created_by ON public.assets USING btree (created_by);


--
-- Name: idx_assets_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_department ON public.assets USING btree (department);


--
-- Name: idx_assets_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_property ON public.assets USING btree (property);


--
-- Name: idx_assets_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_property_id ON public.assets USING btree (property_id);


--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_type ON public.assets USING btree (type);


--
-- Name: idx_audit_reports_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_reports_session ON public.audit_reports USING btree (session_id);


--
-- Name: idx_audit_reviews_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_reviews_session ON public.audit_reviews USING btree (session_id);


--
-- Name: idx_audit_reviews_session_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_reviews_session_dept ON public.audit_reviews USING btree (session_id, department);


--
-- Name: idx_audit_scans_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_scans_asset ON public.audit_scans USING btree (asset_id);


--
-- Name: idx_audit_scans_scanned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_scans_scanned_by ON public.audit_scans USING btree (scanned_by);


--
-- Name: idx_audit_scans_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_scans_session ON public.audit_scans USING btree (session_id);


--
-- Name: idx_audit_sessions_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_sessions_property_id ON public.audit_sessions USING btree (property_id);


--
-- Name: idx_final_approvers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_final_approvers_user_id ON public.final_approvers USING btree (user_id);


--
-- Name: idx_newsletter_category_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_category_created_at ON public.newsletter_posts USING btree (category, created_at DESC);


--
-- Name: idx_newsletter_published_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_published_created_at ON public.newsletter_posts USING btree (published, created_at DESC);


--
-- Name: idx_password_reset_requests_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_requests_email ON public.password_reset_requests USING btree (lower(email));


--
-- Name: idx_password_reset_requests_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_requests_session_token ON public.password_reset_requests USING btree (session_token);


--
-- Name: idx_password_reset_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_password_reset_requests_user ON public.password_reset_requests USING btree (user_id);


--
-- Name: idx_property_license_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_license_plan ON public.property_license USING btree (plan);


--
-- Name: idx_qr_codes_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_codes_asset ON public.qr_codes USING btree (asset_id);


--
-- Name: idx_recent_activity_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recent_activity_created_at ON public.recent_activity USING btree (created_at DESC);


--
-- Name: idx_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_created_at ON public.reports USING btree (created_at DESC);


--
-- Name: idx_reports_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_type ON public.reports USING btree (type);


--
-- Name: idx_uda_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uda_user ON public.user_department_access USING btree (user_id);


--
-- Name: idx_uda_user_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uda_user_dept ON public.user_department_access USING btree (user_id, department);


--
-- Name: idx_up_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_up_user ON public.user_permissions USING btree (user_id);


--
-- Name: idx_up_user_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_up_user_page ON public.user_permissions USING btree (user_id, page);


--
-- Name: idx_upa_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upa_user ON public.user_property_access USING btree (user_id);


--
-- Name: idx_upa_user_prop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upa_user_prop ON public.user_property_access USING btree (user_id, property_id);


--
-- Name: ticket_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_events_created_idx ON public.ticket_events USING btree (created_at DESC);


--
-- Name: ticket_events_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_events_ticket_idx ON public.ticket_events USING btree (ticket_id);


--
-- Name: tickets_assignee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_assignee_idx ON public.tickets USING btree (assignee);


--
-- Name: tickets_property_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_property_id_idx ON public.tickets USING btree (property_id);


--
-- Name: tickets_sla_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_sla_due_idx ON public.tickets USING btree (sla_due_at);


--
-- Name: tickets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_status_idx ON public.tickets USING btree (status);


--
-- Name: tickets_target_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_target_role_idx ON public.tickets USING btree (target_role);


--
-- Name: audit_scans audit_scans_set_user_info; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_scans_set_user_info BEFORE INSERT OR UPDATE ON public.audit_scans FOR EACH ROW EXECUTE FUNCTION public.audit_scans_set_user_info();


--
-- Name: qr_codes qr_codes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER qr_codes_set_updated_at BEFORE UPDATE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: approvals sams_approval_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sams_approval_transition BEFORE INSERT OR UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION app_private.guard_approval_transition();


--
-- Name: properties sams_atomic_property_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sams_atomic_property_delete BEFORE DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION app_private.guard_direct_property_delete();


--
-- Name: app_users sams_initialize_user_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sams_initialize_user_settings AFTER INSERT ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.initialize_app_user_settings();


--
-- Name: app_users sams_profile_edit_permission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sams_profile_edit_permission BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION app_private.guard_profile_edit();


--
-- Name: audit_incharge set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.audit_incharge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();


--
-- Name: tickets tickets_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tickets_set_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_users trg_app_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: final_approvers trg_final_approvers_set_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_final_approvers_set_identity BEFORE INSERT OR UPDATE OF user_id ON public.final_approvers FOR EACH ROW EXECUTE FUNCTION public.app_trg_set_user_identity();


--
-- Name: license_meta trg_license_meta_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_license_meta_updated_at BEFORE UPDATE ON public.license_meta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();


--
-- Name: newsletter_posts trg_newsletter_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_newsletter_touch BEFORE UPDATE ON public.newsletter_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: properties trg_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: property_license trg_property_license_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_property_license_updated_at BEFORE UPDATE ON public.property_license FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();


--
-- Name: approval_events trg_sync_approval_event_comments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_approval_event_comments BEFORE INSERT OR UPDATE ON public.approval_events FOR EACH ROW EXECUTE FUNCTION public.trg_sync_approval_event_comments();


--
-- Name: system_settings trg_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_permissions trg_user_permissions_set_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_permissions_set_identity BEFORE INSERT OR UPDATE OF user_id ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.app_trg_set_user_identity();


--
-- Name: user_preferences trg_user_preferences_set_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_preferences_set_email BEFORE INSERT OR UPDATE OF user_id ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.app_trg_set_user_email_only();


--
-- Name: user_preferences trg_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: user_preferences trg_user_prefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_prefs_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_property_access trg_user_property_access_set_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_property_access_set_identity BEFORE INSERT OR UPDATE OF user_id ON public.user_property_access FOR EACH ROW EXECUTE FUNCTION public.app_trg_set_user_identity();


--
-- Name: user_settings trg_user_settings_set_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_settings_set_identity BEFORE INSERT OR UPDATE OF user_id ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.app_trg_set_user_identity();


--
-- Name: user_settings trg_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_preferences user_preferences_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_users app_users_auth_identity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_auth_identity_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: approval_events approval_events_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;


--
-- Name: assets assets_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: audit_assignments audit_assignments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_assignments
    ADD CONSTRAINT audit_assignments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_reports audit_reports_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_reports
    ADD CONSTRAINT audit_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_reviews audit_reviews_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_reviews
    ADD CONSTRAINT audit_reviews_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_scans audit_scans_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_scans
    ADD CONSTRAINT audit_scans_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: audit_scans audit_scans_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_scans
    ADD CONSTRAINT audit_scans_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.audit_sessions(id) ON DELETE CASCADE;


--
-- Name: audit_sessions audit_sessions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_sessions
    ADD CONSTRAINT audit_sessions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: final_approvers final_approvers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.final_approvers
    ADD CONSTRAINT final_approvers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_department_access fk_user_dept_department_name; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_department_access
    ADD CONSTRAINT fk_user_dept_department_name FOREIGN KEY (department) REFERENCES public.departments(name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: newsletter_posts newsletter_posts_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_posts
    ADD CONSTRAINT newsletter_posts_category_fkey FOREIGN KEY (category) REFERENCES public.newsletter_categories(key);


--
-- Name: password_reset_requests password_reset_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: property_license property_license_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_license
    ADD CONSTRAINT property_license_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: qr_codes qr_codes_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: recent_activity recent_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recent_activity
    ADD CONSTRAINT recent_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: ticket_events ticket_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_events
    ADD CONSTRAINT ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_property_access user_property_access_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_property_access
    ADD CONSTRAINT user_property_access_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: user_property_access user_property_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_property_access
    ADD CONSTRAINT user_property_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;


--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_incharge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_incharge ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_scans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_scans ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: final_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.final_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: license_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.license_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: property_license; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_license ENABLE ROW LEVEL SECURITY;

--
-- Name: qr_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: recent_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.app_users FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('app_users'::text, 'create'::text, to_jsonb(app_users.*)));


--
-- Name: approval_events rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.approval_events FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('approval_events'::text, 'create'::text, to_jsonb(approval_events.*)));


--
-- Name: approvals rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.approvals FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('approvals'::text, 'create'::text, to_jsonb(approvals.*)));


--
-- Name: asset_types rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.asset_types FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('asset_types'::text, 'create'::text, to_jsonb(asset_types.*)));


--
-- Name: assets rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.assets FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('assets'::text, 'create'::text, to_jsonb(assets.*)));


--
-- Name: audit_assignments rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_assignments FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_assignments'::text, 'create'::text, to_jsonb(audit_assignments.*)));


--
-- Name: audit_incharge rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_incharge FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_incharge'::text, 'create'::text, to_jsonb(audit_incharge.*)));


--
-- Name: audit_reports rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_reports FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_reports'::text, 'create'::text, to_jsonb(audit_reports.*)));


--
-- Name: audit_reviews rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_reviews FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_reviews'::text, 'create'::text, to_jsonb(audit_reviews.*)));


--
-- Name: audit_scans rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_scans FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_scans'::text, 'create'::text, to_jsonb(audit_scans.*)));


--
-- Name: audit_sessions rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.audit_sessions FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('audit_sessions'::text, 'create'::text, to_jsonb(audit_sessions.*)));


--
-- Name: departments rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.departments FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('departments'::text, 'create'::text, to_jsonb(departments.*)));


--
-- Name: final_approvers rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.final_approvers FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('final_approvers'::text, 'create'::text, to_jsonb(final_approvers.*)));


--
-- Name: license_meta rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.license_meta FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('license_meta'::text, 'create'::text, to_jsonb(license_meta.*)));


--
-- Name: newsletter_categories rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.newsletter_categories FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('newsletter_categories'::text, 'create'::text, to_jsonb(newsletter_categories.*)));


--
-- Name: newsletter_posts rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.newsletter_posts FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('newsletter_posts'::text, 'create'::text, to_jsonb(newsletter_posts.*)));


--
-- Name: notifications rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('notifications'::text, 'create'::text, to_jsonb(notifications.*)));


--
-- Name: password_reset_requests rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.password_reset_requests FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('password_reset_requests'::text, 'create'::text, to_jsonb(password_reset_requests.*)));


--
-- Name: properties rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.properties FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('properties'::text, 'create'::text, to_jsonb(properties.*)));


--
-- Name: property_license rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.property_license FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('property_license'::text, 'create'::text, to_jsonb(property_license.*)));


--
-- Name: qr_codes rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.qr_codes FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('qr_codes'::text, 'create'::text, to_jsonb(qr_codes.*)));


--
-- Name: recent_activity rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.recent_activity FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('recent_activity'::text, 'create'::text, to_jsonb(recent_activity.*)));


--
-- Name: reports rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.reports FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('reports'::text, 'create'::text, to_jsonb(reports.*)));


--
-- Name: system_settings rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('system_settings'::text, 'create'::text, to_jsonb(system_settings.*)));


--
-- Name: ticket_events rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.ticket_events FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('ticket_events'::text, 'create'::text, to_jsonb(ticket_events.*)));


--
-- Name: tickets rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.tickets FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('tickets'::text, 'create'::text, to_jsonb(tickets.*)));


--
-- Name: user_department_access rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.user_department_access FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('user_department_access'::text, 'create'::text, to_jsonb(user_department_access.*)));


--
-- Name: user_permissions rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('user_permissions'::text, 'create'::text, to_jsonb(user_permissions.*)));


--
-- Name: user_preferences rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('user_preferences'::text, 'create'::text, to_jsonb(user_preferences.*)));


--
-- Name: user_property_access rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.user_property_access FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('user_property_access'::text, 'create'::text, to_jsonb(user_property_access.*)));


--
-- Name: user_settings rights_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_create ON public.user_settings FOR INSERT TO authenticated WITH CHECK (public.app_record_allowed('user_settings'::text, 'create'::text, to_jsonb(user_settings.*)));


--
-- Name: app_users rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.app_users FOR DELETE TO authenticated USING (public.app_record_allowed('app_users'::text, 'delete'::text, to_jsonb(app_users.*)));


--
-- Name: approval_events rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.approval_events FOR DELETE TO authenticated USING (public.app_record_allowed('approval_events'::text, 'delete'::text, to_jsonb(approval_events.*)));


--
-- Name: approvals rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.approvals FOR DELETE TO authenticated USING (public.app_record_allowed('approvals'::text, 'delete'::text, to_jsonb(approvals.*)));


--
-- Name: asset_types rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.asset_types FOR DELETE TO authenticated USING (public.app_record_allowed('asset_types'::text, 'delete'::text, to_jsonb(asset_types.*)));


--
-- Name: assets rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.assets FOR DELETE TO authenticated USING (public.app_record_allowed('assets'::text, 'delete'::text, to_jsonb(assets.*)));


--
-- Name: audit_assignments rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_assignments FOR DELETE TO authenticated USING (public.app_record_allowed('audit_assignments'::text, 'delete'::text, to_jsonb(audit_assignments.*)));


--
-- Name: audit_incharge rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_incharge FOR DELETE TO authenticated USING (public.app_record_allowed('audit_incharge'::text, 'delete'::text, to_jsonb(audit_incharge.*)));


--
-- Name: audit_reports rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_reports FOR DELETE TO authenticated USING (public.app_record_allowed('audit_reports'::text, 'delete'::text, to_jsonb(audit_reports.*)));


--
-- Name: audit_reviews rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_reviews FOR DELETE TO authenticated USING (public.app_record_allowed('audit_reviews'::text, 'delete'::text, to_jsonb(audit_reviews.*)));


--
-- Name: audit_scans rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_scans FOR DELETE TO authenticated USING (public.app_record_allowed('audit_scans'::text, 'delete'::text, to_jsonb(audit_scans.*)));


--
-- Name: audit_sessions rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.audit_sessions FOR DELETE TO authenticated USING (public.app_record_allowed('audit_sessions'::text, 'delete'::text, to_jsonb(audit_sessions.*)));


--
-- Name: departments rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.departments FOR DELETE TO authenticated USING (public.app_record_allowed('departments'::text, 'delete'::text, to_jsonb(departments.*)));


--
-- Name: final_approvers rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.final_approvers FOR DELETE TO authenticated USING (public.app_record_allowed('final_approvers'::text, 'delete'::text, to_jsonb(final_approvers.*)));


--
-- Name: license_meta rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.license_meta FOR DELETE TO authenticated USING (public.app_record_allowed('license_meta'::text, 'delete'::text, to_jsonb(license_meta.*)));


--
-- Name: newsletter_categories rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.newsletter_categories FOR DELETE TO authenticated USING (public.app_record_allowed('newsletter_categories'::text, 'delete'::text, to_jsonb(newsletter_categories.*)));


--
-- Name: newsletter_posts rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.newsletter_posts FOR DELETE TO authenticated USING (public.app_record_allowed('newsletter_posts'::text, 'delete'::text, to_jsonb(newsletter_posts.*)));


--
-- Name: notifications rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.notifications FOR DELETE TO authenticated USING (public.app_record_allowed('notifications'::text, 'delete'::text, to_jsonb(notifications.*)));


--
-- Name: password_reset_requests rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.password_reset_requests FOR DELETE TO authenticated USING (public.app_record_allowed('password_reset_requests'::text, 'delete'::text, to_jsonb(password_reset_requests.*)));


--
-- Name: properties rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.properties FOR DELETE TO authenticated USING (public.app_record_allowed('properties'::text, 'delete'::text, to_jsonb(properties.*)));


--
-- Name: property_license rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.property_license FOR DELETE TO authenticated USING (public.app_record_allowed('property_license'::text, 'delete'::text, to_jsonb(property_license.*)));


--
-- Name: qr_codes rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.qr_codes FOR DELETE TO authenticated USING (public.app_record_allowed('qr_codes'::text, 'delete'::text, to_jsonb(qr_codes.*)));


--
-- Name: recent_activity rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.recent_activity FOR DELETE TO authenticated USING (public.app_record_allowed('recent_activity'::text, 'delete'::text, to_jsonb(recent_activity.*)));


--
-- Name: reports rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.reports FOR DELETE TO authenticated USING (public.app_record_allowed('reports'::text, 'delete'::text, to_jsonb(reports.*)));


--
-- Name: system_settings rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.system_settings FOR DELETE TO authenticated USING (public.app_record_allowed('system_settings'::text, 'delete'::text, to_jsonb(system_settings.*)));


--
-- Name: ticket_events rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.ticket_events FOR DELETE TO authenticated USING (public.app_record_allowed('ticket_events'::text, 'delete'::text, to_jsonb(ticket_events.*)));


--
-- Name: tickets rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.tickets FOR DELETE TO authenticated USING (public.app_record_allowed('tickets'::text, 'delete'::text, to_jsonb(tickets.*)));


--
-- Name: user_department_access rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.user_department_access FOR DELETE TO authenticated USING (public.app_record_allowed('user_department_access'::text, 'delete'::text, to_jsonb(user_department_access.*)));


--
-- Name: user_permissions rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.user_permissions FOR DELETE TO authenticated USING (public.app_record_allowed('user_permissions'::text, 'delete'::text, to_jsonb(user_permissions.*)));


--
-- Name: user_preferences rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.user_preferences FOR DELETE TO authenticated USING (public.app_record_allowed('user_preferences'::text, 'delete'::text, to_jsonb(user_preferences.*)));


--
-- Name: user_property_access rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.user_property_access FOR DELETE TO authenticated USING (public.app_record_allowed('user_property_access'::text, 'delete'::text, to_jsonb(user_property_access.*)));


--
-- Name: user_settings rights_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_delete ON public.user_settings FOR DELETE TO authenticated USING (public.app_record_allowed('user_settings'::text, 'delete'::text, to_jsonb(user_settings.*)));


--
-- Name: app_users rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.app_users FOR UPDATE TO authenticated USING (public.app_record_allowed('app_users'::text, 'edit'::text, to_jsonb(app_users.*))) WITH CHECK (public.app_record_allowed('app_users'::text, 'edit'::text, to_jsonb(app_users.*)));


--
-- Name: approval_events rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.approval_events FOR UPDATE TO authenticated USING (public.app_record_allowed('approval_events'::text, 'edit'::text, to_jsonb(approval_events.*))) WITH CHECK (public.app_record_allowed('approval_events'::text, 'edit'::text, to_jsonb(approval_events.*)));


--
-- Name: approvals rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.approvals FOR UPDATE TO authenticated USING (public.app_record_allowed('approvals'::text, 'edit'::text, to_jsonb(approvals.*))) WITH CHECK (public.app_record_allowed('approvals'::text, 'edit'::text, to_jsonb(approvals.*)));


--
-- Name: asset_types rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.asset_types FOR UPDATE TO authenticated USING (public.app_record_allowed('asset_types'::text, 'edit'::text, to_jsonb(asset_types.*))) WITH CHECK (public.app_record_allowed('asset_types'::text, 'edit'::text, to_jsonb(asset_types.*)));


--
-- Name: assets rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.assets FOR UPDATE TO authenticated USING (public.app_record_allowed('assets'::text, 'edit'::text, to_jsonb(assets.*))) WITH CHECK (public.app_record_allowed('assets'::text, 'edit'::text, to_jsonb(assets.*)));


--
-- Name: audit_assignments rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_assignments FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_assignments'::text, 'edit'::text, to_jsonb(audit_assignments.*))) WITH CHECK (public.app_record_allowed('audit_assignments'::text, 'edit'::text, to_jsonb(audit_assignments.*)));


--
-- Name: audit_incharge rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_incharge FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_incharge'::text, 'edit'::text, to_jsonb(audit_incharge.*))) WITH CHECK (public.app_record_allowed('audit_incharge'::text, 'edit'::text, to_jsonb(audit_incharge.*)));


--
-- Name: audit_reports rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_reports FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_reports'::text, 'edit'::text, to_jsonb(audit_reports.*))) WITH CHECK (public.app_record_allowed('audit_reports'::text, 'edit'::text, to_jsonb(audit_reports.*)));


--
-- Name: audit_reviews rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_reviews FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_reviews'::text, 'edit'::text, to_jsonb(audit_reviews.*))) WITH CHECK (public.app_record_allowed('audit_reviews'::text, 'edit'::text, to_jsonb(audit_reviews.*)));


--
-- Name: audit_scans rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_scans FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_scans'::text, 'edit'::text, to_jsonb(audit_scans.*))) WITH CHECK (public.app_record_allowed('audit_scans'::text, 'edit'::text, to_jsonb(audit_scans.*)));


--
-- Name: audit_sessions rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.audit_sessions FOR UPDATE TO authenticated USING (public.app_record_allowed('audit_sessions'::text, 'edit'::text, to_jsonb(audit_sessions.*))) WITH CHECK (public.app_record_allowed('audit_sessions'::text, 'edit'::text, to_jsonb(audit_sessions.*)));


--
-- Name: departments rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.departments FOR UPDATE TO authenticated USING (public.app_record_allowed('departments'::text, 'edit'::text, to_jsonb(departments.*))) WITH CHECK (public.app_record_allowed('departments'::text, 'edit'::text, to_jsonb(departments.*)));


--
-- Name: final_approvers rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.final_approvers FOR UPDATE TO authenticated USING (public.app_record_allowed('final_approvers'::text, 'edit'::text, to_jsonb(final_approvers.*))) WITH CHECK (public.app_record_allowed('final_approvers'::text, 'edit'::text, to_jsonb(final_approvers.*)));


--
-- Name: license_meta rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.license_meta FOR UPDATE TO authenticated USING (public.app_record_allowed('license_meta'::text, 'edit'::text, to_jsonb(license_meta.*))) WITH CHECK (public.app_record_allowed('license_meta'::text, 'edit'::text, to_jsonb(license_meta.*)));


--
-- Name: newsletter_categories rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.newsletter_categories FOR UPDATE TO authenticated USING (public.app_record_allowed('newsletter_categories'::text, 'edit'::text, to_jsonb(newsletter_categories.*))) WITH CHECK (public.app_record_allowed('newsletter_categories'::text, 'edit'::text, to_jsonb(newsletter_categories.*)));


--
-- Name: newsletter_posts rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.newsletter_posts FOR UPDATE TO authenticated USING (public.app_record_allowed('newsletter_posts'::text, 'edit'::text, to_jsonb(newsletter_posts.*))) WITH CHECK (public.app_record_allowed('newsletter_posts'::text, 'edit'::text, to_jsonb(newsletter_posts.*)));


--
-- Name: notifications rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.notifications FOR UPDATE TO authenticated USING (public.app_record_allowed('notifications'::text, 'edit'::text, to_jsonb(notifications.*))) WITH CHECK (public.app_record_allowed('notifications'::text, 'edit'::text, to_jsonb(notifications.*)));


--
-- Name: password_reset_requests rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.password_reset_requests FOR UPDATE TO authenticated USING (public.app_record_allowed('password_reset_requests'::text, 'edit'::text, to_jsonb(password_reset_requests.*))) WITH CHECK (public.app_record_allowed('password_reset_requests'::text, 'edit'::text, to_jsonb(password_reset_requests.*)));


--
-- Name: properties rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.properties FOR UPDATE TO authenticated USING (public.app_record_allowed('properties'::text, 'edit'::text, to_jsonb(properties.*))) WITH CHECK (public.app_record_allowed('properties'::text, 'edit'::text, to_jsonb(properties.*)));


--
-- Name: property_license rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.property_license FOR UPDATE TO authenticated USING (public.app_record_allowed('property_license'::text, 'edit'::text, to_jsonb(property_license.*))) WITH CHECK (public.app_record_allowed('property_license'::text, 'edit'::text, to_jsonb(property_license.*)));


--
-- Name: qr_codes rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.qr_codes FOR UPDATE TO authenticated USING (public.app_record_allowed('qr_codes'::text, 'edit'::text, to_jsonb(qr_codes.*))) WITH CHECK (public.app_record_allowed('qr_codes'::text, 'edit'::text, to_jsonb(qr_codes.*)));


--
-- Name: recent_activity rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.recent_activity FOR UPDATE TO authenticated USING (public.app_record_allowed('recent_activity'::text, 'edit'::text, to_jsonb(recent_activity.*))) WITH CHECK (public.app_record_allowed('recent_activity'::text, 'edit'::text, to_jsonb(recent_activity.*)));


--
-- Name: reports rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.reports FOR UPDATE TO authenticated USING (public.app_record_allowed('reports'::text, 'edit'::text, to_jsonb(reports.*))) WITH CHECK (public.app_record_allowed('reports'::text, 'edit'::text, to_jsonb(reports.*)));


--
-- Name: system_settings rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.system_settings FOR UPDATE TO authenticated USING (public.app_record_allowed('system_settings'::text, 'edit'::text, to_jsonb(system_settings.*))) WITH CHECK (public.app_record_allowed('system_settings'::text, 'edit'::text, to_jsonb(system_settings.*)));


--
-- Name: ticket_events rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.ticket_events FOR UPDATE TO authenticated USING (public.app_record_allowed('ticket_events'::text, 'edit'::text, to_jsonb(ticket_events.*))) WITH CHECK (public.app_record_allowed('ticket_events'::text, 'edit'::text, to_jsonb(ticket_events.*)));


--
-- Name: tickets rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.tickets FOR UPDATE TO authenticated USING (public.app_record_allowed('tickets'::text, 'edit'::text, to_jsonb(tickets.*))) WITH CHECK (public.app_record_allowed('tickets'::text, 'edit'::text, to_jsonb(tickets.*)));


--
-- Name: user_department_access rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.user_department_access FOR UPDATE TO authenticated USING (public.app_record_allowed('user_department_access'::text, 'edit'::text, to_jsonb(user_department_access.*))) WITH CHECK (public.app_record_allowed('user_department_access'::text, 'edit'::text, to_jsonb(user_department_access.*)));


--
-- Name: user_permissions rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.user_permissions FOR UPDATE TO authenticated USING (public.app_record_allowed('user_permissions'::text, 'edit'::text, to_jsonb(user_permissions.*))) WITH CHECK (public.app_record_allowed('user_permissions'::text, 'edit'::text, to_jsonb(user_permissions.*)));


--
-- Name: user_preferences rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.user_preferences FOR UPDATE TO authenticated USING (public.app_record_allowed('user_preferences'::text, 'edit'::text, to_jsonb(user_preferences.*))) WITH CHECK (public.app_record_allowed('user_preferences'::text, 'edit'::text, to_jsonb(user_preferences.*)));


--
-- Name: user_property_access rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.user_property_access FOR UPDATE TO authenticated USING (public.app_record_allowed('user_property_access'::text, 'edit'::text, to_jsonb(user_property_access.*))) WITH CHECK (public.app_record_allowed('user_property_access'::text, 'edit'::text, to_jsonb(user_property_access.*)));


--
-- Name: user_settings rights_edit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_edit ON public.user_settings FOR UPDATE TO authenticated USING (public.app_record_allowed('user_settings'::text, 'edit'::text, to_jsonb(user_settings.*))) WITH CHECK (public.app_record_allowed('user_settings'::text, 'edit'::text, to_jsonb(user_settings.*)));


--
-- Name: app_users rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.app_users FOR SELECT TO authenticated USING (public.app_record_allowed('app_users'::text, 'view'::text, to_jsonb(app_users.*)));


--
-- Name: approval_events rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.approval_events FOR SELECT TO authenticated USING (public.app_record_allowed('approval_events'::text, 'view'::text, to_jsonb(approval_events.*)));


--
-- Name: approvals rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.approvals FOR SELECT TO authenticated USING (public.app_record_allowed('approvals'::text, 'view'::text, to_jsonb(approvals.*)));


--
-- Name: asset_types rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.asset_types FOR SELECT TO authenticated USING (public.app_record_allowed('asset_types'::text, 'view'::text, to_jsonb(asset_types.*)));


--
-- Name: assets rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.assets FOR SELECT TO authenticated USING (public.app_record_allowed('assets'::text, 'view'::text, to_jsonb(assets.*)));


--
-- Name: audit_assignments rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_assignments FOR SELECT TO authenticated USING (public.app_record_allowed('audit_assignments'::text, 'view'::text, to_jsonb(audit_assignments.*)));


--
-- Name: audit_incharge rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_incharge FOR SELECT TO authenticated USING (public.app_record_allowed('audit_incharge'::text, 'view'::text, to_jsonb(audit_incharge.*)));


--
-- Name: audit_reports rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_reports FOR SELECT TO authenticated USING (public.app_record_allowed('audit_reports'::text, 'view'::text, to_jsonb(audit_reports.*)));


--
-- Name: audit_reviews rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_reviews FOR SELECT TO authenticated USING (public.app_record_allowed('audit_reviews'::text, 'view'::text, to_jsonb(audit_reviews.*)));


--
-- Name: audit_scans rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_scans FOR SELECT TO authenticated USING (public.app_record_allowed('audit_scans'::text, 'view'::text, to_jsonb(audit_scans.*)));


--
-- Name: audit_sessions rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.audit_sessions FOR SELECT TO authenticated USING (public.app_record_allowed('audit_sessions'::text, 'view'::text, to_jsonb(audit_sessions.*)));


--
-- Name: departments rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.departments FOR SELECT TO authenticated USING (public.app_record_allowed('departments'::text, 'view'::text, to_jsonb(departments.*)));


--
-- Name: final_approvers rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.final_approvers FOR SELECT TO authenticated USING (public.app_record_allowed('final_approvers'::text, 'view'::text, to_jsonb(final_approvers.*)));


--
-- Name: license_meta rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.license_meta FOR SELECT TO authenticated USING (public.app_record_allowed('license_meta'::text, 'view'::text, to_jsonb(license_meta.*)));


--
-- Name: newsletter_categories rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.newsletter_categories FOR SELECT TO authenticated USING (public.app_record_allowed('newsletter_categories'::text, 'view'::text, to_jsonb(newsletter_categories.*)));


--
-- Name: newsletter_posts rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.newsletter_posts FOR SELECT TO authenticated USING (public.app_record_allowed('newsletter_posts'::text, 'view'::text, to_jsonb(newsletter_posts.*)));


--
-- Name: notifications rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.notifications FOR SELECT TO authenticated USING (public.app_record_allowed('notifications'::text, 'view'::text, to_jsonb(notifications.*)));


--
-- Name: password_reset_requests rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.password_reset_requests FOR SELECT TO authenticated USING (public.app_record_allowed('password_reset_requests'::text, 'view'::text, to_jsonb(password_reset_requests.*)));


--
-- Name: properties rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.properties FOR SELECT TO authenticated USING (public.app_record_allowed('properties'::text, 'view'::text, to_jsonb(properties.*)));


--
-- Name: property_license rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.property_license FOR SELECT TO authenticated USING (public.app_record_allowed('property_license'::text, 'view'::text, to_jsonb(property_license.*)));


--
-- Name: qr_codes rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.qr_codes FOR SELECT TO authenticated USING (public.app_record_allowed('qr_codes'::text, 'view'::text, to_jsonb(qr_codes.*)));


--
-- Name: recent_activity rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.recent_activity FOR SELECT TO authenticated USING (public.app_record_allowed('recent_activity'::text, 'view'::text, to_jsonb(recent_activity.*)));


--
-- Name: reports rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.reports FOR SELECT TO authenticated USING (public.app_record_allowed('reports'::text, 'view'::text, to_jsonb(reports.*)));


--
-- Name: system_settings rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.system_settings FOR SELECT TO authenticated USING (public.app_record_allowed('system_settings'::text, 'view'::text, to_jsonb(system_settings.*)));


--
-- Name: ticket_events rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.ticket_events FOR SELECT TO authenticated USING (public.app_record_allowed('ticket_events'::text, 'view'::text, to_jsonb(ticket_events.*)));


--
-- Name: tickets rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.tickets FOR SELECT TO authenticated USING (public.app_record_allowed('tickets'::text, 'view'::text, to_jsonb(tickets.*)));


--
-- Name: user_department_access rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.user_department_access FOR SELECT TO authenticated USING (public.app_record_allowed('user_department_access'::text, 'view'::text, to_jsonb(user_department_access.*)));


--
-- Name: user_permissions rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.user_permissions FOR SELECT TO authenticated USING (public.app_record_allowed('user_permissions'::text, 'view'::text, to_jsonb(user_permissions.*)));


--
-- Name: user_preferences rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.user_preferences FOR SELECT TO authenticated USING (public.app_record_allowed('user_preferences'::text, 'view'::text, to_jsonb(user_preferences.*)));


--
-- Name: user_property_access rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.user_property_access FOR SELECT TO authenticated USING (public.app_record_allowed('user_property_access'::text, 'view'::text, to_jsonb(user_property_access.*)));


--
-- Name: user_settings rights_view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rights_view ON public.user_settings FOR SELECT TO authenticated USING (public.app_record_allowed('user_settings'::text, 'view'::text, to_jsonb(user_settings.*)));


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_department_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_department_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_property_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Clear inherited Supabase default grants before replaying the exact object ACLs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION asset_scope(p_id text); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.asset_scope(p_id text) FROM PUBLIC;


--
-- Name: FUNCTION department_scope(p_department text); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.department_scope(p_department text) FROM PUBLIC;


--
-- Name: FUNCTION guard_approval_transition(); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.guard_approval_transition() FROM PUBLIC;


--
-- Name: FUNCTION guard_direct_property_delete(); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.guard_direct_property_delete() FROM PUBLIC;


--
-- Name: FUNCTION guard_profile_edit(); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.guard_profile_edit() FROM PUBLIC;


--
-- Name: FUNCTION is_self(p_id text); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.is_self(p_id text) FROM PUBLIC;


--
-- Name: FUNCTION property_scope(p_id text); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.property_scope(p_id text) FROM PUBLIC;


--
-- Name: FUNCTION row_scope(p_table text, p_row jsonb); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.row_scope(p_table text, p_row jsonb) FROM PUBLIC;


--
-- Name: FUNCTION session_scope(p_id text); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.session_scope(p_id text) FROM PUBLIC;


--
-- Name: FUNCTION shared_user(p_id uuid); Type: ACL; Schema: app_private; Owner: -
--

REVOKE ALL ON FUNCTION app_private.shared_user(p_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION add_approval_event_v1(p_approval_id text, p_event_type text, p_author text, p_message text, p_comments text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_approval_event_v1(p_approval_id text, p_event_type text, p_author text, p_message text, p_comments text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_approval_event_v1(p_approval_id text, p_event_type text, p_author text, p_message text, p_comments text) TO authenticated;
GRANT ALL ON FUNCTION public.add_approval_event_v1(p_approval_id text, p_event_type text, p_author text, p_message text, p_comments text) TO service_role;


--
-- Name: FUNCTION admin_set_user_password_hash_v1(p_admin_email text, p_target_user_id uuid, p_new_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_user_password_hash_v1(p_admin_email text, p_target_user_id uuid, p_new_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_user_password_hash_v1(p_admin_email text, p_target_user_id uuid, p_new_password_hash text) TO service_role;


--
-- Name: FUNCTION admin_set_user_password_v1(p_admin_email text, p_admin_password text, p_target_user_id uuid, p_new_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_user_password_v1(p_admin_email text, p_admin_password text, p_target_user_id uuid, p_new_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_user_password_v1(p_admin_email text, p_admin_password text, p_target_user_id uuid, p_new_password text) TO service_role;


--
-- Name: FUNCTION app_create_profile_with_access(p_id uuid, p_profile jsonb, p_permissions jsonb, p_property_ids text[], p_departments text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_create_profile_with_access(p_id uuid, p_profile jsonb, p_permissions jsonb, p_property_ids text[], p_departments text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_create_profile_with_access(p_id uuid, p_profile jsonb, p_permissions jsonb, p_property_ids text[], p_departments text[]) TO service_role;


--
-- Name: FUNCTION app_current_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_current_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_current_permissions() TO authenticated;
GRANT ALL ON FUNCTION public.app_current_permissions() TO service_role;


--
-- Name: FUNCTION app_is_admin_v1(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_is_admin_v1() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_is_admin_v1() TO authenticated;
GRANT ALL ON FUNCTION public.app_is_admin_v1() TO service_role;


--
-- Name: FUNCTION app_permission_defaults(p_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_permission_defaults(p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_permission_defaults(p_role text) TO authenticated;
GRANT ALL ON FUNCTION public.app_permission_defaults(p_role text) TO service_role;


--
-- Name: FUNCTION app_record_allowed(p_table text, p_action text, p_row jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_record_allowed(p_table text, p_action text, p_row jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_record_allowed(p_table text, p_action text, p_row jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.app_record_allowed(p_table text, p_action text, p_row jsonb) TO service_role;


--
-- Name: FUNCTION app_request_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_request_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_request_role() TO authenticated;
GRANT ALL ON FUNCTION public.app_request_role() TO service_role;


--
-- Name: FUNCTION app_save_user_access(p_user_id uuid, p_permissions jsonb, p_property_ids text[], p_departments text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_save_user_access(p_user_id uuid, p_permissions jsonb, p_property_ids text[], p_departments text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_save_user_access(p_user_id uuid, p_permissions jsonb, p_property_ids text[], p_departments text[]) TO authenticated;
GRANT ALL ON FUNCTION public.app_save_user_access(p_user_id uuid, p_permissions jsonb, p_property_ids text[], p_departments text[]) TO service_role;


--
-- Name: FUNCTION app_trg_set_user_email_only(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_trg_set_user_email_only() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_trg_set_user_email_only() TO authenticated;
GRANT ALL ON FUNCTION public.app_trg_set_user_email_only() TO service_role;


--
-- Name: FUNCTION app_trg_set_user_identity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_trg_set_user_identity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_trg_set_user_identity() TO authenticated;
GRANT ALL ON FUNCTION public.app_trg_set_user_identity() TO service_role;


--
-- Name: FUNCTION app_user_can(p_resource text, p_action text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_user_can(p_resource text, p_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_can(p_resource text, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.app_user_can(p_resource text, p_action text) TO service_role;


--
-- Name: FUNCTION app_user_has_role(p_uid uuid, p_roles text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_user_has_role(p_uid uuid, p_roles text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_has_role(p_uid uuid, p_roles text[]) TO authenticated;
GRANT ALL ON FUNCTION public.app_user_has_role(p_uid uuid, p_roles text[]) TO service_role;


--
-- Name: FUNCTION app_user_is_active(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_user_is_active() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_is_active() TO authenticated;
GRANT ALL ON FUNCTION public.app_user_is_active() TO service_role;


--
-- Name: FUNCTION app_user_is_admin(p_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_user_is_admin(p_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_is_admin(p_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.app_user_is_admin(p_uid uuid) TO service_role;


--
-- Name: FUNCTION app_user_is_admin_or_manager(p_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_user_is_admin_or_manager(p_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_is_admin_or_manager(p_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.app_user_is_admin_or_manager(p_uid uuid) TO service_role;


--
-- Name: FUNCTION app_users_guard_sensitive_columns(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_users_guard_sensitive_columns() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_users_guard_sensitive_columns() TO authenticated;
GRANT ALL ON FUNCTION public.app_users_guard_sensitive_columns() TO service_role;


--
-- Name: FUNCTION audit_scans_set_user_info(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_scans_set_user_info() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_scans_set_user_info() TO authenticated;
GRANT ALL ON FUNCTION public.audit_scans_set_user_info() TO service_role;


--
-- Name: FUNCTION complete_password_reset_v1(p_reset_token uuid, p_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_password_reset_v1(p_reset_token uuid, p_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_password_reset_v1(p_reset_token uuid, p_password_hash text) TO service_role;


--
-- Name: TABLE audit_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_reports TO authenticated;
GRANT ALL ON TABLE public.audit_reports TO service_role;


--
-- Name: FUNCTION create_audit_report_v1(p_session_id text, p_generated_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_audit_report_v1(p_session_id text, p_generated_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_audit_report_v1(p_session_id text, p_generated_by text) TO authenticated;
GRANT ALL ON FUNCTION public.create_audit_report_v1(p_session_id text, p_generated_by text) TO service_role;


--
-- Name: FUNCTION create_password_hash_v1(p_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_password_hash_v1(p_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_password_hash_v1(p_password text) TO service_role;


--
-- Name: FUNCTION create_user_settings_on_signup(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_user_settings_on_signup() FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_user_settings_on_signup() TO authenticated;
GRANT ALL ON FUNCTION public.create_user_settings_on_signup() TO service_role;


--
-- Name: FUNCTION delete_all_reports(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_all_reports() FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_all_reports() TO service_role;
GRANT ALL ON FUNCTION public.delete_all_reports() TO authenticated;


--
-- Name: FUNCTION delete_property_with_access(p_property_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_property_with_access(p_property_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_property_with_access(p_property_id text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_property_with_access(p_property_id text) TO service_role;


--
-- Name: FUNCTION end_audit_session_v1(p_session_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.end_audit_session_v1(p_session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.end_audit_session_v1(p_session_id text) TO authenticated;
GRANT ALL ON FUNCTION public.end_audit_session_v1(p_session_id text) TO service_role;


--
-- Name: TABLE audit_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_assignments TO authenticated;
GRANT ALL ON TABLE public.audit_assignments TO service_role;


--
-- Name: FUNCTION ensure_audit_assignment_v1(p_session_id text, p_department text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ensure_audit_assignment_v1(p_session_id text, p_department text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_audit_assignment_v1(p_session_id text, p_department text) TO authenticated;
GRANT ALL ON FUNCTION public.ensure_audit_assignment_v1(p_session_id text, p_department text) TO service_role;


--
-- Name: FUNCTION get_audit_incharge_for_user_v1(p_user_id text, p_user_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_audit_incharge_for_user_v1(p_user_id text, p_user_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_audit_incharge_for_user_v1(p_user_id text, p_user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.get_audit_incharge_for_user_v1(p_user_id text, p_user_email text) TO service_role;


--
-- Name: FUNCTION get_audit_reviews_for_session_v1(p_session_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_audit_reviews_for_session_v1(p_session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_audit_reviews_for_session_v1(p_session_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_audit_reviews_for_session_v1(p_session_id text) TO service_role;


--
-- Name: FUNCTION get_audit_reviews_for_session_v2(p_session_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_audit_reviews_for_session_v2(p_session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_audit_reviews_for_session_v2(p_session_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_audit_reviews_for_session_v2(p_session_id text) TO service_role;


--
-- Name: FUNCTION get_auth_uid_by_email_v1(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_auth_uid_by_email_v1(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_auth_uid_by_email_v1(p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.get_auth_uid_by_email_v1(p_email text) TO service_role;


--
-- Name: FUNCTION initialize_app_user_settings(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_app_user_settings() FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_app_user_settings() TO service_role;


--
-- Name: FUNCTION list_final_approver_props_for_email_v1(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_final_approver_props_for_email_v1(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_final_approver_props_for_email_v1(p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.list_final_approver_props_for_email_v1(p_email text) TO service_role;


--
-- Name: FUNCTION password_hashes_match_v1(p_password text, p_stored text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.password_hashes_match_v1(p_password text, p_stored text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.password_hashes_match_v1(p_password text, p_stored text) TO service_role;


--
-- Name: FUNCTION request_password_reset_v1(p_email text, p_code text, p_ttl_minutes integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_password_reset_v1(p_email text, p_code text, p_ttl_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_password_reset_v1(p_email text, p_code text, p_ttl_minutes integer) TO service_role;


--
-- Name: FUNCTION self_set_password_hash_v1(p_email text, p_new_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.self_set_password_hash_v1(p_email text, p_new_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.self_set_password_hash_v1(p_email text, p_new_password_hash text) TO service_role;


--
-- Name: FUNCTION self_set_password_v1(p_email text, p_current_password text, p_new_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.self_set_password_v1(p_email text, p_current_password text, p_new_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.self_set_password_v1(p_email text, p_current_password text, p_new_password text) TO service_role;


--
-- Name: FUNCTION set_audit_incharge_for_user_v1(p_user_id text, p_user_name text, p_property_ids text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_audit_incharge_for_user_v1(p_user_id text, p_user_name text, p_property_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_audit_incharge_for_user_v1(p_user_id text, p_user_name text, p_property_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_audit_incharge_for_user_v1(p_user_id text, p_user_name text, p_property_ids text[]) TO service_role;


--
-- Name: TABLE audit_incharge; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_incharge TO authenticated;
GRANT ALL ON TABLE public.audit_incharge TO service_role;


--
-- Name: FUNCTION set_audit_incharge_v1(p_property_id text, p_user_id text, p_user_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_audit_incharge_v1(p_property_id text, p_user_id text, p_user_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_audit_incharge_v1(p_property_id text, p_user_id text, p_user_name text) TO authenticated;
GRANT ALL ON FUNCTION public.set_audit_incharge_v1(p_property_id text, p_user_id text, p_user_name text) TO service_role;


--
-- Name: FUNCTION set_final_approver(p_property_id text, p_user_id uuid, p_user_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver(p_property_id text, p_user_id uuid, p_user_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver(p_property_id text, p_user_id uuid, p_user_name text) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver(p_property_id text, p_user_id uuid, p_user_name text) TO service_role;


--
-- Name: FUNCTION set_final_approver_by_email_v1(p_property_id text, p_email text, p_user_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver_by_email_v1(p_property_id text, p_email text, p_user_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver_by_email_v1(p_property_id text, p_email text, p_user_name text) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver_by_email_v1(p_property_id text, p_email text, p_user_name text) TO service_role;


--
-- Name: FUNCTION set_final_approver_for_user(p_user_id uuid, p_user_name text, p_property_ids text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver_for_user(p_user_id uuid, p_user_name text, p_property_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver_for_user(p_user_id uuid, p_user_name text, p_property_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver_for_user(p_user_id uuid, p_user_name text, p_property_ids text[]) TO service_role;


--
-- Name: FUNCTION set_final_approver_for_user_by_email_v1(p_email text, p_user_name text, p_property_ids text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver_for_user_by_email_v1(p_email text, p_user_name text, p_property_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver_for_user_by_email_v1(p_email text, p_user_name text, p_property_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver_for_user_by_email_v1(p_email text, p_user_name text, p_property_ids text[]) TO service_role;


--
-- Name: FUNCTION set_final_approver_for_user_v1(p_user_id uuid, p_user_name text, p_property_ids text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver_for_user_v1(p_user_id uuid, p_user_name text, p_property_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver_for_user_v1(p_user_id uuid, p_user_name text, p_property_ids text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver_for_user_v1(p_user_id uuid, p_user_name text, p_property_ids text[]) TO service_role;


--
-- Name: FUNCTION set_final_approver_v1(p_property_id text, p_user_id uuid, p_user_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_final_approver_v1(p_property_id text, p_user_id uuid, p_user_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_final_approver_v1(p_property_id text, p_user_id uuid, p_user_name text) TO authenticated;
GRANT ALL ON FUNCTION public.set_final_approver_v1(p_property_id text, p_user_id uuid, p_user_name text) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION set_updated_at_now(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at_now() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at_now() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at_now() TO service_role;


--
-- Name: FUNCTION set_user_department_access(p_user_id text, p_departments text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_department_access(p_user_id text, p_departments text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_department_access(p_user_id text, p_departments text[]) TO service_role;


--
-- Name: FUNCTION set_user_department_access(p_user_id uuid, p_departments text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_department_access(p_user_id uuid, p_departments text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_department_access(p_user_id uuid, p_departments text[]) TO service_role;


--
-- Name: FUNCTION set_user_department_access_v1(p_user_id uuid, p_departments text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_department_access_v1(p_user_id uuid, p_departments text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_department_access_v1(p_user_id uuid, p_departments text[]) TO service_role;


--
-- Name: FUNCTION set_user_password(uid uuid, raw_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_password(uid uuid, raw_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_password(uid uuid, raw_password text) TO service_role;


--
-- Name: FUNCTION set_user_permissions_json_v1(p_user_id text, p_perms json); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_permissions_json_v1(p_user_id text, p_perms json) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_permissions_json_v1(p_user_id text, p_perms json) TO service_role;


--
-- Name: FUNCTION set_user_permissions_json_v1(p_user_id uuid, p_perms jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_permissions_json_v1(p_user_id uuid, p_perms jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_permissions_json_v1(p_user_id uuid, p_perms jsonb) TO service_role;


--
-- Name: FUNCTION set_user_permissions_v1(p_user_id uuid, p_perms public.user_permission_row[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_permissions_v1(p_user_id uuid, p_perms public.user_permission_row[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_permissions_v1(p_user_id uuid, p_perms public.user_permission_row[]) TO service_role;


--
-- Name: FUNCTION set_user_property_access_v1(p_user_id uuid, p_property_ids text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_property_access_v1(p_user_id uuid, p_property_ids text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_property_access_v1(p_user_id uuid, p_property_ids text[]) TO service_role;


--
-- Name: TABLE audit_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_sessions TO authenticated;
GRANT ALL ON TABLE public.audit_sessions TO service_role;


--
-- Name: FUNCTION start_audit_session_v1(p_frequency_months integer, p_initiated_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_audit_session_v1(p_frequency_months integer, p_initiated_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_audit_session_v1(p_frequency_months integer, p_initiated_by text) TO authenticated;
GRANT ALL ON FUNCTION public.start_audit_session_v1(p_frequency_months integer, p_initiated_by text) TO service_role;


--
-- Name: FUNCTION start_audit_session_v2(p_frequency_months integer, p_initiated_by text, p_property_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_audit_session_v2(p_frequency_months integer, p_initiated_by text, p_property_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_audit_session_v2(p_frequency_months integer, p_initiated_by text, p_property_id text) TO authenticated;
GRANT ALL ON FUNCTION public.start_audit_session_v2(p_frequency_months integer, p_initiated_by text, p_property_id text) TO service_role;


--
-- Name: FUNCTION submit_audit_assignment_v1(p_session_id text, p_department text, p_submitted_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_audit_assignment_v1(p_session_id text, p_department text, p_submitted_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_audit_assignment_v1(p_session_id text, p_department text, p_submitted_by text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_audit_assignment_v1(p_session_id text, p_department text, p_submitted_by text) TO service_role;


--
-- Name: FUNCTION sync_auth_account_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_auth_account_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_auth_account_profile() TO service_role;


--
-- Name: FUNCTION tg_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tg_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.tg_set_updated_at() TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;


--
-- Name: FUNCTION trg_sync_approval_event_comments(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trg_sync_approval_event_comments() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trg_sync_approval_event_comments() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_approval_event_comments() TO service_role;


--
-- Name: FUNCTION upsert_audit_reviews_v1(p_session_id text, p_department text, p_rows_json jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.upsert_audit_reviews_v1(p_session_id text, p_department text, p_rows_json jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.upsert_audit_reviews_v1(p_session_id text, p_department text, p_rows_json jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_audit_reviews_v1(p_session_id text, p_department text, p_rows_json jsonb) TO service_role;


--
-- Name: FUNCTION verify_asset_via_scan_v1(p_session_id text, p_asset_id text, p_status text, p_scanned_by uuid, p_comment text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_asset_via_scan_v1(p_session_id text, p_asset_id text, p_status text, p_scanned_by uuid, p_comment text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_asset_via_scan_v1(p_session_id text, p_asset_id text, p_status text, p_scanned_by uuid, p_comment text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_asset_via_scan_v1(p_session_id text, p_asset_id text, p_status text, p_scanned_by uuid, p_comment text) TO service_role;


--
-- Name: FUNCTION verify_password_reset_code_v1(p_email text, p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_password_reset_code_v1(p_email text, p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_password_reset_code_v1(p_email text, p_code text) TO service_role;


--
-- Name: FUNCTION verify_user_credentials(p_email text, p_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_user_credentials(p_email text, p_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_user_credentials(p_email text, p_password text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_user_credentials(p_email text, p_password text) TO service_role;


--
-- Name: TABLE app_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_users TO service_role;


--
-- Name: COLUMN app_users.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name),UPDATE(name) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(role) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.department; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(department) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.phone; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(phone),UPDATE(phone) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.last_login; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(last_login),UPDATE(last_login) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url),UPDATE(avatar_url) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.must_change_password; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(must_change_password) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.password_changed_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(password_changed_at) ON TABLE public.app_users TO authenticated;


--
-- Name: COLUMN app_users.active_session_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(active_session_id),UPDATE(active_session_id) ON TABLE public.app_users TO authenticated;


--
-- Name: TABLE approval_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approval_events TO authenticated;
GRANT ALL ON TABLE public.approval_events TO service_role;


--
-- Name: SEQUENCE approval_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.approval_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.approval_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.approval_events_id_seq TO service_role;


--
-- Name: TABLE approvals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approvals TO authenticated;
GRANT ALL ON TABLE public.approvals TO service_role;


--
-- Name: TABLE asset_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.asset_types TO authenticated;
GRANT ALL ON TABLE public.asset_types TO service_role;


--
-- Name: TABLE assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.assets TO authenticated;
GRANT ALL ON TABLE public.assets TO service_role;


--
-- Name: TABLE audit_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_reviews TO authenticated;
GRANT ALL ON TABLE public.audit_reviews TO service_role;


--
-- Name: TABLE audit_scans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_scans TO authenticated;
GRANT ALL ON TABLE public.audit_scans TO service_role;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.departments TO authenticated;
GRANT ALL ON TABLE public.departments TO service_role;


--
-- Name: TABLE final_approvers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.final_approvers TO authenticated;
GRANT ALL ON TABLE public.final_approvers TO service_role;


--
-- Name: TABLE license_meta; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.license_meta TO authenticated;
GRANT ALL ON TABLE public.license_meta TO service_role;


--
-- Name: TABLE properties; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.properties TO authenticated;
GRANT ALL ON TABLE public.properties TO service_role;


--
-- Name: TABLE property_license; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.property_license TO authenticated;
GRANT ALL ON TABLE public.property_license TO service_role;


--
-- Name: TABLE license_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.license_usage TO authenticated;
GRANT ALL ON TABLE public.license_usage TO service_role;


--
-- Name: TABLE newsletter_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.newsletter_categories TO authenticated;
GRANT ALL ON TABLE public.newsletter_categories TO service_role;


--
-- Name: TABLE newsletter_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.newsletter_posts TO authenticated;
GRANT ALL ON TABLE public.newsletter_posts TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE password_reset_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.password_reset_requests TO service_role;


--
-- Name: TABLE qr_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.qr_codes TO authenticated;
GRANT ALL ON TABLE public.qr_codes TO service_role;


--
-- Name: TABLE recent_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recent_activity TO authenticated;
GRANT ALL ON TABLE public.recent_activity TO service_role;


--
-- Name: SEQUENCE recent_activity_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.recent_activity_id_seq TO anon;
GRANT ALL ON SEQUENCE public.recent_activity_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.recent_activity_id_seq TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE ticket_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ticket_events TO authenticated;
GRANT ALL ON TABLE public.ticket_events TO service_role;


--
-- Name: SEQUENCE ticket_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.ticket_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.ticket_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ticket_events_id_seq TO service_role;


--
-- Name: TABLE tickets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tickets TO authenticated;
GRANT ALL ON TABLE public.tickets TO service_role;


--
-- Name: TABLE user_department_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_department_access TO authenticated;
GRANT ALL ON TABLE public.user_department_access TO service_role;


--
-- Name: TABLE user_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_permissions TO authenticated;
GRANT ALL ON TABLE public.user_permissions TO service_role;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preferences TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.user_preferences TO authenticated;


--
-- Name: TABLE user_property_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_property_access TO authenticated;
GRANT ALL ON TABLE public.user_property_access TO service_role;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_settings TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.user_settings TO authenticated;


--
-- PostgreSQL database dump complete
--



-- pg_dump application schemas do not include triggers on the managed Auth table.
CREATE TRIGGER sams_sync_auth_profile
  AFTER UPDATE OF email, encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_account_profile();

-- Preserve the current SAMS realtime membership without replacing Supabase's
-- managed publication or changing any other project's publication members.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users, public.user_preferences;

NOTIFY pgrst, 'reload schema';
COMMIT;
