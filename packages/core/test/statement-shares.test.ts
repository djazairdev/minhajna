// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل المشاركة» (#439, answer 486): shares listed newest day first with the
// role said last, the earlier role kept in the history; a role for no share or
// outside the five, and a share left in a way unknown, left out; the activity
// log's lines for both; and the shared-statement layer, which goes to the
// teacher's own devices and export but never into a statement. Made-up data
// only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityLog, eventOf, layerOf, mayTravelAs, sharingHistory, type RecordEvent } from '../src/index.ts';
import { d, openBook } from './fixtures.ts';

const shared = (id: string, how: 'print' | 'pdf' | 'qr' | 'file'): RecordEvent => ({
  kind: 'statement.shared',
  share: { id, courseId: 'c-math', how },
});
const sent = (id: string, to: string): RecordEvent => ({ kind: 'statement.sent', sent: { id, to } }) as RecordEvent;

async function history() {
  const book = await openBook([]);
  await book.recordAll(d('2026-10-01'), [shared('s-1', 'pdf'), sent('s-1', 'director')]);
  await book.recordAll(d('2026-10-04'), [shared('s-2', 'qr'), shared('s-3', 'file')]);
  await book.recordAll(d('2026-10-05'), [
    sent('s-1', 'inspector'),
    sent('s-9', 'director'),
    sent('s-3', 'Nadia'),
    { kind: 'statement.shared', share: { id: 's-8', courseId: 'c-math', how: 'fax' } } as unknown as RecordEvent,
    sent('s-8', 'director'),
  ]);
  return book;
}

test('shares are listed newest day first, each with the role said last', async () => {
  const book = await history();
  assert.deepEqual(sharingHistory(book.entries), [
    { id: 's-3', courseId: 'c-math', how: 'file', day: '2026-10-04', to: null },
    { id: 's-2', courseId: 'c-math', how: 'qr', day: '2026-10-04', to: null },
    { id: 's-1', courseId: 'c-math', how: 'pdf', day: '2026-10-01', to: 'inspector' },
  ]);
  const roles = book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'statement.sent' ? [event.sent.to] : [];
  });
  assert.deepEqual(roles, ['director', 'inspector', 'director', 'Nadia', 'director']);
});

test('the activity log names each share and each role it went to, never a name', async () => {
  const lines = activityLog((await history()).entries).flatMap((day) =>
    day.items.map((item) => [item.category, item.line]),
  );
  const share = (id: string, how: string) => ({ id, courseId: 'c-math', how });
  assert.deepEqual(lines, [
    ['files', { kind: 'sent', share: share('s-1', 'pdf'), to: 'inspector' }],
    ['files', { kind: 'shared', share: share('s-3', 'file') }],
    ['files', { kind: 'shared', share: share('s-2', 'qr') }],
    ['files', { kind: 'sent', share: share('s-1', 'pdf'), to: 'director' }],
    ['files', { kind: 'shared', share: share('s-1', 'pdf') }],
  ]);
});

test('the sharing history stays with the teacher and never goes into a statement', () => {
  for (const event of [shared('s-1', 'print'), sent('s-1', 'other')]) {
    assert.equal(layerOf(event), 'shared-statement');
    assert.equal(mayTravelAs('shared-statement', event.kind, 'full-export'), true);
    assert.equal(mayTravelAs('shared-statement', event.kind, 'own-devices'), true);
    assert.equal(mayTravelAs('shared-statement', event.kind, 'statement'), false);
    assert.equal(mayTravelAs('shared-statement', event.kind, 'school-space'), false);
  }
});
