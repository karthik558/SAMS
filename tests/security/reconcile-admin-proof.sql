-- Run after reconcile-admin-fixture.sql and reconcile_admin_identity.sql, locally.
DO $$ BEGIN
  IF (SELECT count(*) FROM app_users WHERE id='de75fd22-93eb-4c6f-9ae4-43829322a2e3' AND role='admin') <> 1
    OR EXISTS(SELECT 1 FROM app_users WHERE id='2770d961-ac8c-4c84-8fd8-5d1d3c598c1b')
    OR (SELECT count(*) FROM assets WHERE created_by='de75fd22-93eb-4c6f-9ae4-43829322a2e3') <> 58
    OR (SELECT count(*) FROM recent_activity WHERE user_id='de75fd22-93eb-4c6f-9ae4-43829322a2e3') <> 112
    OR (SELECT count(*) FROM user_permissions WHERE user_id='de75fd22-93eb-4c6f-9ae4-43829322a2e3') <> 7
    OR NOT EXISTS(SELECT 1 FROM user_settings WHERE user_id='de75fd22-93eb-4c6f-9ae4-43829322a2e3' AND email_notifications)
    OR NOT EXISTS(SELECT 1 FROM user_preferences WHERE user_id='de75fd22-93eb-4c6f-9ae4-43829322a2e3' AND compact_mode)
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='de75fd22-93eb-4c6f-9ae4-43829322a2e3' AND encrypted_password='unchanged-auth-password')
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='public.app_users'::regclass AND condeferrable)
  THEN RAISE EXCEPTION 'Administrator reconciliation regression failed'; END IF;
END $$;
