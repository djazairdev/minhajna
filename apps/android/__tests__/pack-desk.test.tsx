// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's pack-editor account on the curator's page (#612, answer 767): the
// device that started the world makes it and can show its code, another device
// signs in with that code and reads only until then, and the world's own store
// keeps it. The teacher's store never sees it. Everything is made up.

import { act } from 'react-test-renderer';
import { press, rendered, show, shown, type, unmount } from '../jest/editor-form';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { packService, reference } from '../jest/pack-release';
import { openWorld, type OpenWorld } from '../src/demo/world-mode';
import { keepPackAccount, keptPackAccounts } from '../src/editor/pack-account';
import { PackDesk } from '../src/editor/PackDesk';
import { leaveWorldNetwork } from '../src/network/world-network';

let teacher: FakeStorage;
async function drain() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
beforeEach(() => {
  teacher = new FakeStorage();
});
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

async function desk(starter: boolean) {
  const f = await packService();
  const fake = new FakeWorld(teacher);
  const found = {
    world: f.world.world,
    kind: 'national' as const,
    code: f.made.code,
    date: f.world.date,
    starter: starter ? f.made.starter : null,
  };
  const opened = await openWorld(found, teacher.asSpec(), fake.asSpec());
  const again = (held: string | null) => openWorld({ ...found, starter: held }, teacher.asSpec(), fake.asSpec());
  const page = (open: OpenWorld) => (
    <PackDesk
      role="curator"
      open={open}
      held={f.editor.held}
      profile={reference.profile}
      kit={f.editor.kit}
      packs={[]}
      send={f.server.send}
    />
  );
  return { f, opened, page, again };
}

test('the device that started the world has its account as the page opens, and shows the code when asked', async () => {
  const { opened, page } = await desk(true);
  await show(page(opened), 'en');
  await drain();
  const token = keptPackAccounts(opened).curator!;
  expect(token).toBeDefined();
  expect(JSON.stringify(rendered().toJSON())).toContain('curators');
  expect(shown('desk-code')).toBe(false);
  expect(JSON.stringify(rendered().toJSON())).not.toContain(token);
  await press('desk-show-code');
  expect(JSON.stringify(rendered().toJSON())).toContain(token);
});

test('the account stays for the next visit, and opening the world again keeps it', async () => {
  const { f, opened, page, again } = await desk(true);
  await show(page(opened), 'en');
  await drain();
  const token = keptPackAccounts(opened).curator;
  await unmount();
  expect(keptPackAccounts(await again(f.made.starter)).curator).toBe(token);
  expect(keptPackAccounts(await again('made-up-other-starter-0123456789')).curator).toBe(token);
  const posts = f.server.seen.filter((one) => one.path.endsWith('/packs/accounts')).length;
  await show(page(opened), 'en');
  await drain();
  expect(f.server.seen.filter((one) => one.path.endsWith('/packs/accounts'))).toHaveLength(posts);
  expect(keptPackAccounts(opened).curator).toBe(token);
});

test('a page opened again while the account is being made makes only one', async () => {
  const { f, opened, page } = await desk(true);
  await show(page(opened), 'en');
  await unmount();
  await show(page(opened), 'en');
  await drain();
  expect(
    f.server.seen.filter((one) => one.path.endsWith('/packs/accounts') && one.body?.includes('curator')),
  ).toHaveLength(2);
  expect(keptPackAccounts(opened).curator).toBeDefined();
});

test('two roles kept at once both stay', async () => {
  const { opened } = await desk(false);
  await Promise.all([
    keepPackAccount(opened, 'curator', 'made-up-curator-token-0123456789'),
    keepPackAccount(opened, 'ministry', 'made-up-ministry-token-012345678'),
  ]);
  expect(keptPackAccounts(opened)).toEqual({
    curator: 'made-up-curator-token-0123456789',
    ministry: 'made-up-ministry-token-012345678',
  });
});

test('another device reads only until it signs in with the code, and a wrong one is refused', async () => {
  const { f, opened, page } = await desk(false);
  await show(page(opened), 'en');
  await drain();
  expect(shown('desk-code-field')).toBe(true);
  const newDraft = () =>
    rendered().root.findAll((one) => one.props.testID === 'draft-new' && one.props.onPress !== undefined)[0];
  expect((newDraft().props as { disabled?: boolean }).disabled).toBe(true);
  await type('desk-code-field', 'not-the-account-code');
  await press('desk-sign-in');
  await drain();
  expect(JSON.stringify(rendered().toJSON())).toContain('No account of this role');
  await type('desk-code-field', f.editor.accounts.ministry!);
  await press('desk-sign-in');
  await drain();
  expect(shown('desk-code-field')).toBe(true);
  await type('desk-code-field', ` ${f.editor.accounts.curator} `);
  await press('desk-sign-in');
  await drain();
  expect(shown('desk-code-field')).toBe(false);
  expect(keptPackAccounts(opened).curator).toBe(f.editor.accounts.curator);
  expect((newDraft().props as { disabled?: boolean }).disabled).toBe(false);
});

test('a failed making says so, and trying again makes it', async () => {
  const { f, opened } = await desk(true);
  let failing = true;
  const send: typeof f.server.send = (request) =>
    failing && request.path.endsWith('/packs/accounts')
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : f.server.send(request);
  await show(
    <PackDesk
      role="curator"
      open={opened}
      held={f.editor.held}
      profile={reference.profile}
      kit={f.editor.kit}
      packs={[]}
      send={send}
    />,
    'en',
  );
  await drain();
  expect(keptPackAccounts(opened).curator).toBeUndefined();
  failing = false;
  await press('desk-retry');
  await drain();
  expect(keptPackAccounts(opened).curator).toBeDefined();
});
