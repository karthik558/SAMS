-- READ ONLY. Run first in the Supabase SQL editor as the database administrator.
-- Never export password/hash/token columns to resolve these account issues.
select u.id as app_user_id, u.email,
       a.id as auth_id_with_same_id,
       by_email.id as auth_id_with_same_email,
       case
         when u.email is null or u.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
           then 'INVALID_EMAIL: correct this account first'
         when duplicates.total > 1 then 'DUPLICATE_EMAIL: manual review required'
         when a.id is null and by_email.id is not null
           then 'ID_CONFLICT: Auth account exists under another ID; do not recreate/delete it'
         when a.id is null then 'MISSING_AUTH: run the preparation script'
         when lower(a.email) is distinct from lower(u.email)
           then 'EMAIL_CONFLICT: same ID belongs to a different email; manual review required'
         when a.email_confirmed_at is null then 'VERIFY_EMAIL: complete native Auth recovery/onboarding'
         when coalesce(a.encrypted_password, '') = '' then 'SET_PASSWORD: complete native Auth recovery'
         else 'READY'
       end as migration_status
from public.app_users u
left join auth.users a on a.id = u.id
left join auth.users by_email on lower(by_email.email) = lower(u.email)
cross join lateral (
  select count(*) as total from public.app_users other where lower(other.email) = lower(u.email)
) duplicates
order by u.email;
