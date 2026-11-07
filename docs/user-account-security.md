# Account setup and security

## Fresh database

Run the root `schema.sql` once in a fresh Supabase project's SQL editor as `postgres`. It creates the complete SAMS application schema and preserves the current secured database definitions. Supabase must already provide its managed Auth schema and API roles. No production accounts, passwords, or business records are included. The script is transactional and refuses an existing application schema; it is not an upgrade migration or a production reset script.

Create your own verified administrator account through Supabase Auth first. Then run this as the database administrator, replacing the example email and display name:

```sql
INSERT INTO public.app_users (id, name, email, role, status)
SELECT id, 'Administrator', email, 'admin', 'Active'
FROM auth.users
WHERE lower(email) = lower('you@example.com')
  AND email_confirmed_at IS NOT NULL
  AND coalesce(encrypted_password, '') <> ''
ON CONFLICT (id) DO NOTHING;
```

The Auth ID is reused exactly. Confirm one profile was created before signing in. Do not manually write password hashes, recreate existing Auth identities, or automatically make the first anonymous signup an administrator.

## Required backend files

The `supabase/` directory is runtime/deployment source, not a temporary folder. It contains:

- `functions/account-security/`: server-side account administration and username login.
- `functions/send-email/`: authenticated notification delivery.
- `config.toml` and `templates/recovery.html`: Auth settings and native recovery email.

For a new project, set its own site/redirect URLs and verified SMTP sender in the configuration, then link the project and deploy with the Supabase CLI. Deploy both functions with gateway JWT verification enabled. The current gateway configuration uses a legacy signed anon JWT. Keep the SMTP credential in the server/operator environment; `config.toml` references `env(RESEND_API_KEY)` rather than storing a value. Publish the matching frontend and API routes with the project environment configured.

`.temp`, `.branches`, `.vercel`, and `dist` are generated and ignored. The CLI recreates local link metadata when needed. Old migration SQL, seed/demo SQL, one-time reconciliation scripts, and disposable SQL test fixtures have been consolidated or removed. Previously tracked versions remain in Git history; a private local cleanup archive preserves the removed migration-era files.

## Existing deployments

Directory cleanup does not alter a live database. Existing users retain their Auth IDs and passwords. Use native Forgot password if the Auth password is unknown; mailbox owners must redeem their own recovery code/link. Pending identities must complete verification before they can sign in. Do not rerun `schema.sql` on the existing production database.

Passwords belong to Supabase Auth. `app_users` exposes profile fields only. Account administration requires an active database administrator role; settings and access mappings enforce owner/admin rules with RLS. Anonymous database access and legacy credential/access RPCs are revoked. Asset/QR data requires sign-in. Existing authenticated business policies and function compatibility are preserved in the consolidated definition.

`.env.example` lists the required variables. The anon key is designed to be public and relies on RLS; service-role, database, and SMTP credentials are private and must never use `VITE_` prefixes. Keep `.env.local` private and out of Git. No keys need to be pasted into chat.

## Verification

`npm test` runs the API boundary checks. `deno test --no-lock --allow-env tests/security/account-security.test.ts` verifies account authorization and failed-create cleanup with mocked requests. These two regression files protect the security boundaries; they do not create live users or send email. The consolidated schema is verified in a disposable PostgreSQL 17 database with Supabase platform primitives, including fresh installation, account/settings creation, role isolation, Auth synchronization, realtime membership, and safe rejection of reruns.
