# SAMS user account security

Passwords are owned by Supabase Auth. The application never downloads password hashes, stores local credential copies, or authenticates from localStorage. The account-security function requires a verified user JWT and a current, active database administrator role for account administration. Supabase gateway JWT verification remains enabled; this project's signed legacy anon JWT permits only the function's login action before sign-in.

## Migration order

1. Create a private database snapshot/backup. `node --env-file=.env.local scripts/backup-user-security.mjs` saves public-table data and security metadata to a mode-0600 JSONL file outside the repository. This is a migration recovery snapshot, not a replacement for full Supabase backups. It contains sensitive legacy account data; keep it private and manage its retention.
2. Inspect `scripts/check-auth-accounts.sql`. For the reviewed administrator conflict only, apply `migrations/2026-11-07_reconcile_admin_identity.sql`. It preserves the existing verified Auth account/password/preferences and migrates the old app ID and known references in one transaction. Unexpected FK structure and collisions abort. Never delete/recreate existing Auth users or rewrite arbitrary IDs based on email alone.
3. Run `node --env-file=.env.local scripts/prepare-auth-users.mjs --dry-run`, then `--apply`. Missing identities are created with their existing app IDs, unverified, with undisclosed random passwords. No email is sent and existing accounts/passwords are unchanged. Conflicts abort before any creation; retries skip successful previous creations.
4. Configure Auth with `node --env-file=.env.local` wrapping `supabase config push`. The committed config disables public signup, requires email confirmation, sets new passwords to at least 12 characters, expires recovery codes in 10 minutes, preserves TOTP availability, and uses the existing Resend SMTP secret from the local/server environment. Never commit the SMTP secret. Native recovery accepts both the numeric code and the secure email link.
5. Deploy `account-security` using `supabase functions deploy account-security --use-api` with gateway JWT verification enabled. Publish the matching frontend and API routes, then apply `migrations/2026-11-07_secure_app_users.sql` and `migrations/2026-11-07_secure_account_access.sql` together in the coordinated rollout. Old clients depend on the removed hashes/RPCs and must refresh. Do not roll back only the frontend after dropping legacy credential fields.
6. A verified active administrator with an Auth password is required before credential removal. Non-admin identities may remain pending owner verification/reset; their native Auth credentials are inaccessible until onboarding. Owners must complete recovery themselves. Legacy SHA-256/Base64 password strings are not imported as Supabase passwords. Existing working Auth passwords remain unchanged.

Use `node --env-file=.env.local scripts/run-supabase-sql.mjs path.sql` for read-only checks; `--write` explicitly enables mutations. The runner checks the linked/configured project, passes the password through the environment, and never prints it. It uses the normal linked PostgreSQL connection, not extracted CLI credentials. It is specific to the reviewed SAMS project.

## Access and compatibility

`app_users` exposes explicit profile columns only. Ordinary users can read their profile and update limited nonprivileged fields. Active admins/managers retain directory reads; administrative mutations use the server function. Settings/preferences use the authenticated ID for ownership. Permission/property/department mappings permit owner/admin-manager reads and administrator-only writes. Legacy password/reset and unchecked account-access RPCs are revoked, including overloads. Failed production operations never silently become successful local changes.

Anonymous roles lose access to public database tables and functions. Active-account restrictive policies supplement existing authenticated business policies. This intentionally requires sign-in for organization data, including real asset/QR lookups. Demo data remains separate. This does not redefine every business-role policy or audit every security-definer routine, bucket, dependency, or infrastructure control.

The administrator's reviewed old app ID was `2770d961-ac8c-4c84-8fd8-5d1d3c598c1b`; its retained verified Auth ID is `de75fd22-93eb-4c6f-9ae4-43829322a2e3`. The original ownership snapshot had 58 assets, 112 activity rows, seven permission rows, a settings row, notification and old reset record under the old ID, and an existing preference row under the Auth ID. The reconciliation preserves these records; the obsolete recovery record is invalidated by the final migration. After commit, reversing IDs requires another dependency/conflict review because new writes can use the reconciled ID.

Email changes require native Auth's verified email-change flow; the Auth trigger synchronizes the profile. Password changes synchronize password metadata through an Auth trigger. `must_change_password` remains metadata, not a mandatory password-change authorization boundary. MFA enrollment is available in Auth configuration; this patch does not add a mandatory MFA UI or CAPTCHA. No patch guarantees 100% security.

## Credentials and recovery

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend environment; the anon key is designed to be public and relies on RLS. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, and `RESEND_API_KEY` are server/operator secrets and must never use `VITE_` prefixes, appear in chat, or be committed. `.env.local` is ignored. No user needs to recreate an Auth ID or copy keys into chat.

After deployment, sign out/refresh existing clients and sign in with the existing native Auth password. If that password is unknown, use Forgot password. Only the mailbox owner should redeem the code/link and choose the replacement password. Pending accounts need this onboarding before they can log in. No operator script confirms mailbox ownership or exposes generated temporary passwords.

## Validation

Run `npm run build`, `npx tsc --noEmit -p tsconfig.app.json`, `node --test tests/security/prepare-auth-users.test.mjs`, and `deno test --no-lock --allow-env tests/security/account-security.test.ts`. SQL regression fixtures in `tests/security` belong exclusively in disposable local databases. Do not run them in Supabase. Production migration rehearsal is performed inside a transaction that ends with ROLLBACK before the final coordinated commit.
