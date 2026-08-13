import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';

let environment;

before(async () => {
  const rules = await readFile('database.rules.json', 'utf8');
  environment = await initializeTestEnvironment({
    projectId: 'police-incident-test',
    database: { rules },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), 'channels/admin'), { eventId: 'a', type: 'incident.created' });
    await set(ref(context.database(), 'channels/users/citizen:user-1'), {
      eventId: 'b',
      type: 'notification.created',
    });
  });
});

after(async () => {
  await environment.cleanup();
});

test('admin can read the admin channel but citizen cannot', async () => {
  const admin = environment.authenticatedContext('admin:1', { kind: 'admin', userId: '1' });
  const citizen = environment.authenticatedContext('citizen:user-1', {
    kind: 'citizen',
    userId: 'user-1',
  });
  await assertSucceeds(get(ref(admin.database(), 'channels/admin')));
  await assertFails(get(ref(citizen.database(), 'channels/admin')));
});

test('user channel reads are owner-scoped', async () => {
  const owner = environment.authenticatedContext('citizen:user-1', {
    kind: 'citizen',
    userId: 'user-1',
  });
  const other = environment.authenticatedContext('citizen:user-2', {
    kind: 'citizen',
    userId: 'user-2',
  });
  await assertSucceeds(get(ref(owner.database(), 'channels/users/citizen:user-1')));
  await assertFails(get(ref(other.database(), 'channels/users/citizen:user-1')));
});

test('all client writes are denied', async () => {
  const admin = environment.authenticatedContext('admin:1', { kind: 'admin', userId: '1' });
  await assertFails(set(ref(admin.database(), 'channels/admin'), { eventId: 'x', type: 'forged' }));
  assert.ok(true);
});
