// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Migrate on the draft page (#615, answer 769): a first release has no
// entries to make; a later one lists what needs one, and an entry is chosen,
// never dragged, then saved as a revision the reader keeps. The note says what
// progress does, and asks nothing. Everything is made up.

import type { PackItem, PackRelease, PlanPack } from '@minhajna/core';
import { act } from 'react-test-renderer';
import { press, rendered, show, shown, unmount } from '../jest/editor-form';
import { source } from '../jest/editor-source';
import { PackDraft } from '../src/editor/PackDraft';
import { Drawing } from '../src/drawing/drawing-kit';

const item = (id: string): PackItem => ({ id, kind: 'lesson', title: `Made-up ${id}`, budget: 1, sourcePage: 7 });
const pack = (release: string, ids: readonly string[]): PlanPack => ({
  ...source,
  status: 'community',
  release,
  items: ids.map(item),
});
const before = pack('2026.1', ['a', 'b']);
const draft = pack('2026.2', ['a', 'c', 'd']);

afterEach(unmount);

function page(history: readonly PlanPack[], onSave = jest.fn()) {
  return (
    <PackDraft
      initial={draft}
      revision={1}
      country="dz"
      busy={false}
      history={history}
      onSave={onSave}
      onClose={jest.fn()}
    />
  );
}

const said = () => JSON.stringify(rendered().toJSON());
const settled = (pack: PlanPack) => ({ pack, revision: 2 }) as PackRelease;

test('a first release has no migration entries to make', async () => {
  await show(page([]), 'en');
  expect(shown('draft-migration')).toBe(false);
});

test('an item with no entry is named, and a split is chosen and saved', async () => {
  const onSave = jest.fn((next: PlanPack) => Promise.resolve(settled(next)));
  await show(page([before], onSave), 'en');
  await press('draft-migration');
  expect(said()).toContain('have no entry');
  expect(rendered().root.findByProps({ testID: 'migrate-open' }).props.children).toContain('b');
  expect(rendered().root.findByProps({ testID: 'migrate-add-entry' }).props.disabled).toBe(true);
  await press('migrate-kind-split');
  await press('migrate-from-b');
  await press('migrate-to-c');
  expect(rendered().root.findByProps({ testID: 'migrate-add-entry' }).props.disabled).toBe(true);
  await press('migrate-to-d');
  await press('migrate-add-entry');
  await act(async () => {
    await Promise.resolve();
  });
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0];
  expect(saved.migration).toEqual({ from: '2026.1', entries: [{ kind: 'split', from: 'b', to: ['c', 'd'] }] });
  expect(shown('migrate-entry-0')).toBe(true);
  expect(shown('migrate-open')).toBe(false);
  expect(said()).toContain('every part');
  expect(said()).toContain('Source: page');
});

test('the note says progress follows the format, offering no choice', async () => {
  await show(page([before]), 'en');
  await press('draft-migration');
  expect(said()).toContain('the server never knows');
});

test('without a drawing there is no map, and a failed save keeps what was chosen', async () => {
  const onSave = jest.fn(() => Promise.resolve(null));
  await show(page([before], onSave), 'en');
  await press('draft-migration');
  expect(shown('migrate-map')).toBe(false);
  await press('migrate-from-b');
  await press('migrate-to-c');
  await press('migrate-add-entry');
  await act(async () => {
    await Promise.resolve();
  });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(rendered().root.findByProps({ testID: 'migrate-add-entry' }).props.disabled).toBe(false);
});

test('taking an entry away saves too, and the map draws where the app draws', async () => {
  const withEntry = {
    ...draft,
    migration: { from: '2026.1', entries: [{ kind: 'split' as const, from: 'b', to: ['c', 'd'] }] },
  };
  const onSave = jest.fn((next: PlanPack) => Promise.resolve(settled(next)));
  const spec = jest.fn();
  const kit = {
    Chart: () => null,
    Map: (props: { spec: unknown }) => {
      spec(props.spec);
      return null;
    },
  };
  await show(
    <Drawing.Provider value={kit}>
      <PackDraft
        initial={withEntry}
        revision={1}
        country="dz"
        busy={false}
        history={[before]}
        onSave={onSave}
        onClose={jest.fn()}
      />
    </Drawing.Provider>,
    'en',
  );
  await press('draft-migration');
  expect(spec).toHaveBeenCalled();
  await press('migrate-remove-0');
  await act(async () => {
    await Promise.resolve();
  });
  expect(onSave.mock.calls[0][0].migration).toEqual({ from: '2026.1', entries: [] });
});
