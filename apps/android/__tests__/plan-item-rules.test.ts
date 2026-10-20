// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the plan item page offers (#225, answer 284): a join asks first when
// either item is essential in the pack, never for an item the teacher
// added; changes that would do nothing are not offered; a part of a split
// shows the pack item's ID. Made-up data only.

import { courseSetup, nextSeq, parseDay, partId, queueItems, recordChange, type PackItem } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { asksFirst, itemPage, shownId } from '../src/plan/item-rules';
import { coreContext } from '../src/storage/core-context';

const day = parseDay('2026-10-15');
const context = (data: TestData) => coreContext({ ...data, state: data.book.state });
const page = (data: TestData, itemId: string) => itemPage(context(data), 'c-1', itemId, day)!;
const item = (id: string, optional?: boolean): PackItem => ({
  id,
  kind: 'lesson',
  title: id,
  budget: 1,
  ...(optional !== undefined && { optional }),
});

test('a skip or join asks first when one of its items is essential, never for an added item', () => {
  expect(asksFirst([item('a', true)])).toBe(false);
  expect(asksFirst([item('a', true), item('b')])).toBe(true);
  expect(asksFirst([item('a', true), item('b', true)])).toBe(false);
  expect(asksFirst([item('add~x')])).toBe(false);
  expect(asksFirst([item('add~x~c~1')])).toBe(false);
});

test('offers no move that does nothing, and no join of items already joined', async () => {
  const data = await withDay();
  const first = page(data, 'u1-3');
  expect(first.others.map((one) => one.id)).not.toContain('u1-4');
  expect(first.last).toBe(false);
  const end = queueItems(courseSetup(context(data), 'c-1').pack!, 'main').at(-1)!;
  expect(page(data, end.id).last).toBe(true);
  expect(first.joinable).toBe(true);
  const made = context(data);
  await data.book.record(
    day,
    recordChange(made, {
      id: 'j1',
      courseId: 'c-1',
      day,
      seq: nextSeq(made.state.decisions, 'c-1'),
      kind: 'join',
      items: ['u1-3', 'u1-4'],
    }),
  );
  expect(page(data, 'u1-3').joinable).toBe(false);
  expect(page(data, 'u1-2').joinable).toBe(false);
  expect(page(data, 'u1-4').joinable).toBe(false);
  expect(page(data, 'u1-5').joinable).toBe(true);
});

test('a part of a split shows the pack item’s ID and its part', () => {
  expect(shownId(item('u1-3'))).toEqual({ id: 'u1-3' });
  expect(shownId(item(partId('u1-3', 'c9', 2)))).toEqual({ id: 'u1-3', part: '2' });
});
