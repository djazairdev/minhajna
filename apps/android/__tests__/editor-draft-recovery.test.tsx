// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An open draft on the made-up relay: removing an item asks first, an erased
// world says so plainly, the draft says when it is reading, focus returns to
// what opened a form, and a day that moved during a read isn't taken for
// damage.

import { addDays } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { act } from 'react-test-renderer';
import { press, rendered, show, shown, source, type, unmount } from '../jest/editor-form';
import { packService } from '../jest/pack-release';
import { PacksPage } from '../src/editor/PacksPage';
import { changePackRelease, readPackEditor, readPackReleases } from '../src/editor/pack-release-session';
import en from '../src/editor/item-text/en.json';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';

const pack = { ...source, release: '2026.9' };
const two = {
  ...pack,
  items: [...pack.items, { id: 'second', kind: 'lesson' as const, title: 'Made-up second', budget: 1, sourcePage: 4 }],
};
const newest = async (f: Awaited<ReturnType<typeof packService>>) =>
  [...(await readPackReleases(f.editor, f.server.send)).values()][0];
const page = (f: Awaited<ReturnType<typeof packService>>) => (
  <PacksPage {...f.editor} packs={[]} send={f.server.send} />
);
const said = () => JSON.stringify(rendered().toJSON());
async function drain() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

test('“Changes saved” goes as soon as another save starts', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: two });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-up-second');
  await drain();
  expect(said()).toContain(en.saved);
  await f.change({ ...first, revision: 2 }, { stage: 'draft', pack: two });
  await press('draft-up-lesson');
  await press('draft-up-second');
  await drain();
  expect(said()).not.toContain(en.saved);
});

test('removing an item asks first, saves nothing until confirmed, and names each button', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: two });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  const names = rendered()
    .root.findAll((one) => typeof one.type === 'string' && one.props.accessibilityRole === 'button')
    .map((one) => one.props.accessibilityLabel as string);
  expect(names).toContain('Remove Made-up second');
  expect(names).toContain('Move up Made-up second');
  await press('draft-remove-second');
  expect(said()).toContain('Remove “Made-up second” from this draft?');
  await drain();
  expect((await newest(f)).revision).toBe(1);
  await press('draft-remove-no-second');
  expect(shown('draft-remove-yes-second')).toBe(false);
  await press('draft-remove-second');
  await press('draft-remove-yes-second');
  await drain();
  const saved = await newest(f);
  expect(saved.revision).toBe(2);
  expect(saved.pack.items.map((one) => one.id)).toEqual(['lesson']);
  expect(shown('draft-remove-yes-second')).toBe(false);
});

test('an erased world says so, rather than asking to reload', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  await press('draft-edit-lesson');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  f.server.worlds.delete(f.world.world);
  await press('item-save');
  await drain();
  expect(said()).toContain(en.worldErased);
  expect(said()).not.toContain(en.saveError);
});

test('the open draft says when it is reading, and shows its ID and release isolated', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  expect(said()).not.toContain(en.loading);
  let release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const send: Send = async (request) => {
    await held;
    return f.server.send(request);
  };
  const date = addDays(f.world.date, 1);
  f.server.worlds.get(f.world.world)!.date = date;
  const later = <PacksPage {...f.editor} world={{ ...f.world, date }} packs={[]} send={send} />;
  await act(() => rendered().update(<LocaleDirContext.Provider value="ltr">{later}</LocaleDirContext.Provider>));
  await drain();
  expect(said()).toContain(en.loading);
  await act(async () => {
    release();
    await Promise.resolve();
  });
  await drain();
  expect(said()).not.toContain(en.loading);
  const heading = rendered().root.findAll((one) => one.props.accessibilityRole === 'header')[0];
  expect(String((heading.props as { children: unknown[] }).children[0])).toMatch(/^\u2068.*\u2069$/u);
});

/** The test IDs of the hosts focused from now on. */
function focusing(): string[] {
  const host = rendered().root.findAll(
    (node) => typeof (node.instance as { focus?: unknown } | null)?.focus === 'function',
  )[0];
  const focused: string[] = [];
  jest
    .spyOn(Object.getPrototypeOf(host.instance) as { focus: () => void }, 'focus')
    .mockImplementation(function focus(this: { props: { testID?: string } }) {
      focused.push(String(this.props.testID));
    });
  return focused;
}

test('showing the latest revision moves focus to the open form, or to the add button', async () => {
  const f = await packService();
  const first = await f.change(null, { stage: 'draft', pack: two });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  const focused = focusing();
  await press('draft-edit-lesson');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  const second = await f.change(first, { stage: 'draft', pack: { ...two, licence: 'link-only' } });
  await press('item-save');
  await drain();
  await press('draft-latest');
  expect(focused.at(-1)).toBe('draft-form');
  const pane = rendered().root.findAll((one) => one.props.testID === 'draft-form')[0];
  expect(pane.props).toMatchObject({ tabIndex: -1, role: 'group', accessibilityLabel: en.yourForm });
  await press('item-cancel');
  await f.change(second, { stage: 'draft', pack: { ...two, licence: 'full-text' } });
  await press('draft-up-second');
  await drain();
  await press('draft-latest');
  expect(focused.at(-1)).toBe('draft-add');
  jest.restoreAllMocks();
});

test('focus returns to what opened a form when it closes', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: two });
  await show(page(f), 'en');
  await drain();
  await press('draft-open-2026.9');
  const focused = focusing();
  await press('draft-edit-lesson');
  await press('item-cancel');
  expect(focused.at(-1)).toBe('draft-edit-lesson');
  await press('draft-add');
  await press('item-cancel');
  expect(focused.at(-1)).toBe('draft-add');
  await press('draft-structure');
  await press('structure-cancel');
  expect(focused.at(-1)).toBe('draft-structure');
  await press('draft-edit-lesson');
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  await press('item-save');
  await drain();
  expect(focused.at(-1)).toBe('draft-edit-lesson');
  const before = focused.length;
  await press('draft-up-second');
  await drain();
  expect(focused).toHaveLength(before);
  await press('draft-remove-second');
  expect(focused.at(-1)).toBe('draft-remove-no-second');
  await press('draft-remove-no-second');
  expect(focused.at(-1)).toBe('draft-remove-second');
  await press('draft-remove-second');
  await press('draft-remove-yes-second');
  await drain();
  expect(focused.at(-1)).toBe('draft-add');
  jest.restoreAllMocks();
});

test('a day that moved during a read is read again, and not taken for damage', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack });
  const date = addDays(f.world.date, 1);
  f.server.worlds.get(f.world.world)!.date = date;
  const target = { id: pack.id, release: pack.release, revision: 1 };
  await changePackRelease(
    { ...f.editor, world: { ...f.world, date } },
    'curator',
    target,
    { stage: 'draft', pack: { ...pack, licence: 'link-only' } },
    f.server.send,
  );
  let asked = 0;
  const send: Send = (request) =>
    request.path.endsWith('/date') && asked++ === 0
      ? Promise.resolve({ status: 200, body: { date: f.world.date }, retryAfter: null })
      : f.server.send(request);
  const read = await readPackEditor(f.editor, send);
  expect(asked).toBe(2);
  expect(read).toMatchObject({ date, damaged: false });
  expect([...read.records.values()][0].revision).toBe(2);
});
