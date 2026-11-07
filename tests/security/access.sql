\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.denied(command text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN insufficient_privilege OR undefined_column THEN RETURN;
  END;
  RAISE EXCEPTION 'FAIL: unexpectedly allowed %', command;
END $$;
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_users' AND column_name IN ('password','password_hash')), 'credential columns removed');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM password_reset_requests), 'old recovery tokens invalidated');
SET LOCAL ROLE anon;
SELECT pg_temp.denied('SELECT email FROM app_users');
SELECT pg_temp.denied('SELECT * FROM user_settings');
SELECT pg_temp.denied('SELECT * FROM password_reset_requests');
SELECT pg_temp.denied($q$SELECT self_set_password_hash_v1('a','b')$q$);
SELECT pg_temp.denied($q$SELECT self_set_password_hash_v1('a','b','c')$q$);
SELECT pg_temp.denied($q$SELECT request_password_reset_v1('a','chosen-code',10)$q$);
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
SELECT pg_temp.check_true((SELECT count(id)=1 FROM app_users), 'ordinary user sees only own profile');
SELECT pg_temp.denied('SELECT password_hash FROM app_users');
SELECT pg_temp.denied($q$UPDATE app_users SET role='admin'$q$);
SELECT pg_temp.denied($q$UPDATE app_users SET status='Active'$q$);
SELECT pg_temp.denied($q$UPDATE app_users SET email='admin@example.com'$q$);
SELECT pg_temp.denied($q$INSERT INTO app_users(id,role) VALUES(gen_random_uuid(),'admin')$q$);
SELECT pg_temp.denied('DELETE FROM app_users');
SELECT pg_temp.denied($q$SELECT self_set_password_hash_v1('a','b')$q$);
SELECT pg_temp.check_true(NOT public.app_user_is_admin('10000000-0000-0000-0000-000000000001'), 'cannot supply another admin uid');
UPDATE app_users SET last_login=now(), name='Own name' WHERE id=auth.uid();
SELECT pg_temp.check_true((SELECT name='Own name' AND last_login IS NOT NULL FROM app_users WHERE id=auth.uid()), 'own profile updates still work');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM user_settings), 'own settings only');
SELECT pg_temp.denied($q$INSERT INTO user_preferences(user_id,user_email) VALUES('20000000-0000-0000-0000-000000000001','user@example.com')$q$);
UPDATE user_settings SET email_notifications=false WHERE user_id=auth.uid();
SELECT pg_temp.check_true((SELECT NOT email_notifications FROM user_settings WHERE user_id=auth.uid()), 'settings remain editable');
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
SELECT pg_temp.check_true((SELECT count(id)=0 FROM app_users), 'inactive account denied profile access');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM user_settings), 'inactive account denied settings access');
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
SELECT pg_temp.check_true((SELECT count(id)=4 FROM app_users), 'manager directory preserved');
SELECT pg_temp.check_true(NOT public.app_user_is_admin(auth.uid()), 'manager is not admin');
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true(public.app_user_is_admin(auth.uid()), 'admin checked against database');
SELECT pg_temp.check_true((SELECT count(id)=4 FROM app_users), 'admin directory access');
RESET ROLE;
-- Auth password updates synchronize only metadata and never restore public hashes.
UPDATE auth.users SET encrypted_password='new-auth-managed' WHERE id='10000000-0000-0000-0000-000000000002';
SELECT pg_temp.check_true((SELECT password_changed_at IS NOT NULL AND NOT must_change_password FROM app_users WHERE email='user@example.com'), 'Auth password metadata sync');
INSERT INTO auth.users VALUES('10000000-0000-0000-0000-000000000005','new@example.com',now(),'auth-managed');
SET LOCAL ROLE service_role;
INSERT INTO app_users(id,name,email,role,status) VALUES('10000000-0000-0000-0000-000000000005','New','new@example.com','user','Active');
SELECT pg_temp.check_true((SELECT email_notifications FROM user_settings WHERE user_id='10000000-0000-0000-0000-000000000005'), 'settings created atomically');
RESET ROLE;
DELETE FROM auth.users WHERE id='10000000-0000-0000-0000-000000000005';
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM app_users WHERE email='new@example.com'), 'Auth deletion removes profile');
ROLLBACK;
\echo 'Account RLS regression checks passed'
