// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session taught under a change the class later took back keeps its title
// in the texts book and on Today, and a correction keeps it as it was
// (#225, answer 285). Made-up records only.

import { parseDay, type PlanPack, type SessionRecord } from '@minhajna/core';
import { bookLines } from '../src/entry/book-lines';
import { draftOf } from '../src/entry/fix-rules';
import { i18n } from '../src/text/i18n';

const pack: PlanPack = {
  format: 1,
  id: 'dz.cem.1am.math.example',
  release: '2026.1',
  status: 'example',
  licence: 'full-text',
  language: 'ar',
  anchor: { kind: 'budgets', unit: 'sessions' },
  provenance: { issuer: 'Made up for tests', edition: 'example' },
  stageTemplates: [],
  items: [{ id: 'l1', kind: 'lesson', title: 'Made-up lesson' }],
  merges: [],
  retired: [{ id: 'l1~1', kind: 'lesson', title: 'Made-up first part' }],
};

const record: SessionRecord = {
  session: {
    key: 'c-1/2026-10-15/m1/k-1-w',
    courseId: 'c-1',
    groupId: 'k-1-w',
    day: parseDay('2026-10-15'),
    slot: { half: 'morning', index: 1 },
  },
  outcome: 'done',
  sessionType: 'lesson',
  coverage: [{ op: 'taught', item: 'l1~1', from: 0, to: 1 }],
};

test('a part of an undone split keeps its title in the texts book', () => {
  const lines = bookLines(i18n.getFixedT('ar'), pack, record, (day) => day);
  expect(lines.map((line) => line.text)).toContain('Made-up first part');
  expect(lines.map((line) => line.text)).not.toContain('l1~1');
});

test('correcting a session taught under an undone change keeps its lesson', () => {
  const draft = draftOf(pack, { ...record, outcome: 'changed' }, null, undefined, null);
  expect(draft.lesson).toEqual({ kind: 'item', item: pack.retired![0], taught: false });
});
