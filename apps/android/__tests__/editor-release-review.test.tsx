// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A signed synthetic history and a saved draft on the curator's Packs page.

import type { PlanPack } from '@minhajna/core';
import { act } from 'react-test-renderer';
import { field, press, rendered, show, shown, type, unmount, weekly } from '../jest/editor-form';
import { packService } from '../jest/pack-release';
import { PacksPage } from '../src/editor/PacksPage';
import { ReleaseReview } from '../src/editor/ReleaseReview';
import { leaveWorldNetwork } from '../src/network/world-network';
import { missingKeys } from '../src/text/i18n';

const lesson = { ...weekly.items[0] };
delete lesson.sourcePage;
const draft: PlanPack = {
  ...weekly,
  release: '2026.2',
  items: [{ ...lesson, id: 'new-lesson', title: 'Synthetic corrected title' }],
  migration: { from: weekly.release, entries: [{ kind: 'rename', from: lesson.id, to: 'new-lesson' }] },
};

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

test('a curator compares a saved draft to the published release without writing', async () => {
  const f = await packService();
  const previous = await f.change(null, { stage: 'draft', pack: weekly });
  const review = await f.change(previous, { stage: 'under-review' });
  await f.change(review, { stage: 'published' });
  await f.change(null, { stage: 'draft', pack: draft });
  f.server.seen.length = 0;
  await show(<PacksPage {...f.editor} packs={[]} send={f.server.send} />, 'en');
  await act(async () => {
    for (let turn = 0; turn < 30; turn++) await new Promise<void>((done) => setImmediate(done));
  });
  await press('draft-open-2026.2');
  await press('draft-review');
  expect(shown('release-review')).toBe(true);
  expect(shown('review-change')).toBe(true);
  expect(shown('review-migration')).toBe(true);
  expect(shown('review-source-finding')).toBe(true);
  expect(shown('draft-add')).toBe(false);
  await type('review-weeks', '٣');
  expect(shown('review-week-finding')).toBe(false);
  await type('review-weeks-again', '3');
  expect(shown('review-week-finding')).toBe(true);
  await type('review-weeks', '1');
  expect(field('review-weeks-again').props.value).toBe('');
  expect(shown('review-week-finding')).toBe(false);
  await press('draft-review');
  expect(shown('draft-add')).toBe(true);
  expect(f.server.seen.some((request) => request.method === 'POST')).toBe(false);
});

test.each(['ar', 'fr', 'en'] as const)('history unavailable and first release differ in %s', async (language) => {
  missingKeys.length = 0;
  const texts = () =>
    rendered()
      .root.findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
  await show(<ReleaseReview pack={weekly} history={null} />, language);
  const unavailable = texts();
  await unmount();
  await show(<ReleaseReview pack={weekly} history={[]} />, language);
  expect(texts()).not.toEqual(unavailable);
  expect(missingKeys).toEqual([]);
});
