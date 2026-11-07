-- Run after the disposable fixture and both security migrations.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.expect_deny(command text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN insufficient_privilege THEN RETURN;
 END;
 RAISE EXCEPTION 'Unexpectedly allowed: %',command;
END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_deny('SELECT * FROM user_permissions');
SELECT pg_temp.expect_deny('SELECT * FROM user_department_access');
SELECT pg_temp.expect_deny('SELECT * FROM user_property_access');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_deny($q$INSERT INTO user_permissions(user_id,page,can_view,can_edit) VALUES('10000000-0000-0000-0000-000000000002','users',true,true)$q$);
SELECT pg_temp.expect_deny($q$INSERT INTO user_department_access(user_id,department) VALUES('10000000-0000-0000-0000-000000000002','IT')$q$);
SELECT pg_temp.expect_deny($q$SELECT set_user_permissions_json_v1('10000000-0000-0000-0000-000000000002'::uuid,'[]'::jsonb)$q$);
SELECT pg_temp.expect_deny($q$SELECT admin_set_user_password_v1('a','b','c')$q$);
SET LOCAL request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
INSERT INTO user_permissions(user_id,page,can_view,can_edit) VALUES('10000000-0000-0000-0000-000000000002','users',false,false);
UPDATE user_permissions SET can_view=true WHERE user_id='10000000-0000-0000-0000-000000000002';
INSERT INTO user_department_access(user_id,department) VALUES('10000000-0000-0000-0000-000000000002','IT');
INSERT INTO user_property_access(user_id,property_id) VALUES('10000000-0000-0000-0000-000000000002','PROP-001');
ROLLBACK;
\echo 'Account-access mutation and legacy RPC denial checks passed'
