import test from 'node:test';
import assert from 'node:assert/strict';
import { planAccounts, prepareAccounts } from '../../scripts/prepare-auth-users.mjs';
const id = '10000000-0000-0000-0000-000000000001';
const otherId = '10000000-0000-0000-0000-000000000002';
const profile = { id, email: 'user@example.com' };
function fakeClient(profiles, users, createUser = () => { throw new Error('Unexpected write'); }) {
  return {
    from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: profiles, count: profiles.length, error: null }) }) }) }),
    auth: { admin: { listUsers: async () => ({ data: { users, nextPage: null }, error: null }), createUser } },
  };
}
test('dry-run classifies missing, verified and unverified accounts without writes', async () => {
  const plan = await prepareAccounts(fakeClient([profile], []));
  assert.equal(plan[0].status, 'CREATE_UNVERIFIED_AUTH');
  assert.equal(planAccounts([profile], [{ ...profile, email_confirmed_at: 'now' }])[0].status, 'EXISTING_AUTH_CHECK_SQL');
  assert.equal(planAccounts([profile], [profile])[0].status, 'VERIFY_EMAIL_AND_SET_PASSWORD');
});
test('conflicts stop the entire apply before creating any accounts', async () => {
  for (const users of [[{ id: otherId, email: profile.email }], [{ id, email: 'someone-else@example.com' }]]) {
    await assert.rejects(prepareAccounts(fakeClient([profile, { id: '10000000-0000-0000-0000-000000000003', email: 'new@example.com' }], users), { apply: true }), /No accounts were created/);
  }
  assert.equal(planAccounts([profile, { id: otherId, email: 'USER@example.com' }], [])[0].status, 'DUPLICATE_EMAIL');
});
test('apply preserves app IDs, creates unverified identities, and never reports generated passwords', async () => {
  let created;
  const reports = [];
  const client = fakeClient([profile], [], async input => {
    created = input;
    return { data: { user: { id } }, error: null };
  });
  await prepareAccounts(client, { apply: true, report: entry => reports.push(entry) });
  assert.equal(created.id, id);
  assert.equal(created.email_confirm, false);
  assert.equal(created.password.length, 64);
  assert.equal(JSON.stringify(reports).includes(created.password), false);
  // Rerunning after creation does not reset the account or change the password.
  await prepareAccounts(fakeClient([profile], [profile]), { apply: true });
});
test('failed creation is observable and does not attempt subsequent accounts', async () => {
  let calls = 0;
  const client = fakeClient([profile, { id: otherId, email: 'new@example.com' }], [], async () => {
    calls++;
    return { data: {}, error: { message: 'unsafe details should not be logged' } };
  });
  await assert.rejects(prepareAccounts(client, { apply: true }), /Earlier successful creations remain/);
  assert.equal(calls, 1);
});
