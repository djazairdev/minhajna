// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A curator sets a pack's status on its source form (#611, R-4.2-23), on the
// made-up relay: all but Official, which the form never offers, a stale plan
// says why, an example stays one, and the drafts' list shows what was set.

import type { PlanPack } from '@minhajna/core';
import { act } from 'react-test-renderer';
import { field, press, rendered, show, shown, source, type, unmount } from '../jest/editor-form';
import { packService } from '../jest/pack-release';
import { PacksPage } from '../src/editor/PacksPage';
import { readPackReleases } from '../src/editor/pack-release-session';
import { SourceForm } from '../src/editor/SourceForm';
import { leaveWorldNetwork } from '../src/network/world-network';

const pack = { ...source, status: 'community' as const, release: '2026.9' };
const said = () => JSON.stringify(rendered().toJSON());
const choose = async (value: string) => {
  const choice = rendered()
    .root.findAll((one) => one.props.testID === `source-status-${value}`)
    .at(0);
  await act(() => (choice!.props as { onPress: () => void }).onPress());
};
async function drain() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

function formOf(initial: PlanPack, opened: boolean) {
  const kept: PlanPack[] = [];
  const element = (
    <SourceForm
      pack={opened ? initial : null}
      initial={opened ? null : initial}
      country="dz"
      onKeep={(one) => kept.push(one)}
      onCancel={() => undefined}
    />
  );
  return { element, kept };
}

test('a saved draft takes the status the curator set, and the list shows it', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack });
  await show(<PacksPage {...f.editor} packs={[]} send={f.server.send} />, 'en');
  await drain();
  expect(said()).toContain('Community plan');
  await press('draft-open-2026.9');
  await press('draft-source');
  await choose('in-force');
  await press('source-keep');
  await drain();
  const saved = [...(await readPackReleases(f.editor, f.server.send)).values()][0];
  expect(saved.pack.status).toBe('in-force');
});

test('Official is never offered, whatever the release held', async () => {
  const { element } = formOf({ ...pack, status: 'official' }, false);
  await show(element, 'en');
  expect(shown('source-status-community')).toBe(true);
  expect(shown('source-status-official')).toBe(false);
});

test('a stale plan needs a reason, kept in the language typed, and gone when it stops being stale', async () => {
  const { element, kept } = formOf(pack, true);
  await show(element, 'en');
  await choose('stale');
  await press('source-keep');
  expect(kept).toHaveLength(0);
  expect(said()).toContain('Check the source fields');
  await type('source-staleReason', `  A made-up decision changed the hours ${String.fromCodePoint(0x202e)} `);
  await press('source-keep');
  expect(kept[0].status).toBe('stale');
  expect(kept[0].staleReason).toEqual({ en: 'A made-up decision changed the hours' });
  await unmount();
  const again = formOf(kept[0], true);
  await show(again.element, 'en');
  expect(field('source-staleReason').props.value).toBe('A made-up decision changed the hours');
  await press('source-keep');
  expect(again.kept[0].staleReason).toEqual({ en: 'A made-up decision changed the hours' });
  await choose('latest-found');
  expect(shown('source-staleReason')).toBe(false);
  await press('source-keep');
  expect(again.kept[1].status).toBe('latest-found');
  expect(again.kept[1].staleReason).toBeUndefined();
});

test('a copy starts as a community plan, and an example stays an example with no status to choose', async () => {
  const copy = formOf({ ...pack, status: 'in-force' }, false);
  await show(copy.element, 'en');
  await type('source-release', '2026.10');
  await press('source-keep');
  expect(copy.kept[0].status).toBe('community');
  await unmount();
  const example = formOf({ ...pack, status: 'example' }, false);
  await show(example.element, 'en');
  expect(shown('source-status')).toBe(false);
  await type('source-release', '2026.10');
  await press('source-keep');
  expect(example.kept[0].status).toBe('example');
});
