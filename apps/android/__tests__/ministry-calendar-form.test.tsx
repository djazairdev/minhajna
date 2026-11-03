// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The form that adds or changes an entry on the Ministry's calendar page
// (#607, answer 623), over the bundled calendar: saving a new entry without its
// Arabic name or source says so beside each field and keeps nothing; an exam
// window added with its term and a level is kept as new, named at random, and
// the form closes; one added in a wilaya goes in that wilaya; moving an exam's
// days asks why, then keeps the days it had, its grades staying; changing a
// lunar holiday into a closure drops the lunar mark; cancelling keeps nothing;
// a problem keeping the draft leaves the form open; and an entry whose effect
// the editor does not offer keeps it, and what the form does not show. Every
// entry and device is made up.

import { formOf, entryOf } from '../src/ministry/entry-form';
import { Platform } from 'react-native';
import {
  alerts,
  base,
  date,
  entries,
  has,
  kept,
  newBook,
  press,
  render,
  texts,
  type,
  unmount,
  withStorm,
} from '../jest/ministry-page';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryCalendar;
const exam = base.find((one) => one.id === 'term-1-exams')!;
const eid = base.find((one) => one.id === 'eid-al-fitr')!;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(unmount);

test('a new entry needs its Arabic name and source, then is kept as new', async () => {
  const book = await newBook();
  await render(book);
  await press('ministry-calendar-add');
  expect(has('ministry-form')).toBe(true);
  await press('ministry-form-save');
  expect(texts()).toEqual(expect.arrayContaining([words.form.needName, words.form.needSource]));
  expect(kept(book).draft.entries).toEqual([]);
  await type('ministry-form-name-ar', ' يوم دراسي مختلق ');
  await type('ministry-form-source', 'A made-up\nnotice');
  await press('ministry-form-effect-exam');
  expect(has('ministry-form-term-1')).toBe(true);
  await press('ministry-form-term-2');
  await press('ministry-form-levels-cem');
  await press('ministry-form-save');
  expect(has('ministry-form')).toBe(false);
  const [made] = kept(book).draft.entries;
  expect(made).toMatchObject({
    layer: 'national',
    from: date,
    to: date,
    effect: 'exam',
    term: 2,
    levels: ['cem'],
    name: { ar: 'يوم دراسي مختلق' },
    source: 'A made-up notice',
    confidence: 'announced',
  });
  expect(made.id).toMatch(/^world-[0-9a-f]{16}$/u);
  expect(has(`ministry-mark-${made.id}`)).toBe(true);
});

test('an entry added in a wilaya goes in that wilaya', async () => {
  const book = await newBook();
  await render(book);
  await press('ministry-calendar-layer-zone');
  await press('ministry-calendar-zone');
  await press('ministry-calendar-zone-16');
  await press('ministry-calendar-add');
  await type('ministry-form-name-ar', 'غلق مختلق');
  await type('ministry-form-source', 'A made-up notice');
  await press('ministry-form-effect-closure');
  await press('ministry-form-save');
  expect(kept(book).draft.entries[0]).toMatchObject({ layer: 'zone', zone: '16', effect: 'closure' });
  expect(entries()).toHaveLength(2);
});

test('moving an exam’s days asks why, then keeps the days it had and its grades', async () => {
  const book = await newBook();
  await render(book);
  await press(`ministry-change-${exam.id}`);
  expect(has('ministry-form-reason')).toBe(false);
  await press('extra-day-2026-12-13');
  await press('ministry-form-edge-to');
  await press('extra-day-2026-12-17');
  await press('ministry-form-save');
  expect(texts()).toContain(words.form.needReason);
  expect(kept(book).draft.entries).toEqual([]);
  await type('ministry-form-reason', 'A made-up reason');
  await press('ministry-form-save');
  expect(kept(book).draft.entries).toEqual([
    {
      ...exam,
      from: '2026-12-13',
      to: '2026-12-17',
      moved: { from: exam.from, to: exam.to, reason: 'A made-up reason' },
    },
  ]);
  expect(exam.grades).toBeDefined();
});

test('a lunar holiday changed into a closure drops its lunar mark, and cancelling keeps nothing', async () => {
  const book = await newBook();
  await render(book);
  await press(`ministry-change-${eid.id}`);
  await press('ministry-form-cancel');
  expect(has('ministry-form')).toBe(false);
  expect(kept(book).draft.entries).toEqual([]);
  await press(`ministry-change-${eid.id}`);
  await press('ministry-form-effect-closure');
  await press('ministry-form-save');
  const [changed] = kept(book).draft.entries;
  expect([changed?.effect, changed?.lunar, eid.lunar]).toEqual(['closure', undefined, true]);
});

test('a problem keeping the draft leaves the form open', async () => {
  const book = await newBook();
  jest.spyOn(book, 'record').mockRejectedValue(new Error('A made-up store failure'));
  await render(book);
  await press(`ministry-change-${exam.id}`);
  await type('ministry-form-source', 'Another made-up notice');
  await press('ministry-form-save');
  expect(has('ministry-form')).toBe(true);
  expect(alerts()).toEqual([ar.demo.problem.other]);
});

test('an entry whose effect the editor does not offer keeps it, and what the form does not show', () => {
  const day = withStorm.calendar.entries[0];
  const added = { ...day, effect: 'adds-sessions' as const, adds: 'make-up' as const, follows: 1 as const };
  const form = { ...formOf(added, date, withStorm.calendar.year), source: 'Another made-up notice' };
  expect(entryOf(form, added, added)).toEqual({ ...added, source: 'Another made-up notice' });
  expect(entryOf({ ...form, effect: 'closure' }, added, added)).not.toHaveProperty('adds');
});
