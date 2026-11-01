// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page (#607, answer 623), over the bundled calendar
// and a made-up wilaya entry: it lists the national entries by their first day,
// each with its source, isolated, and how sure it is, and a wilaya's once
// chosen, or none for another; taking an entry out marks it, keeps the draft in
// the world's store and announces it, undoing it drops the mark, and a page
// opened again reads the draft kept; a draft kept that no longer fits is set
// aside and said so; a draft that could not be published, or would be too
// heavy, is refused before anything is kept, the same refusal counted each
// time; a problem keeping it is said as an alert, the marks staying; and the
// page's words read in every language. Every entry and device is made up.

import { draftMark, type CalendarDraft } from '@minhajna/core';
import { Platform } from 'react-native';
import {
  act,
  alerts,
  base,
  date,
  entries,
  has,
  kept,
  newBook,
  press,
  render,
  rendered,
  show,
  storm,
  texts,
  unmount,
  withStorm,
} from '../jest/ministry-page';
import { useCalendarDesk, type CalendarDesk } from '../src/ministry/calendar-desk';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryCalendar;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(unmount);
test('the page lists the national entries, then a wilaya’s once chosen', async () => {
  await render(await newBook());
  const national = base
    .filter((one) => one.layer === 'national')
    .sort((a, b) => (a.from === b.from ? (a.id < b.id ? -1 : 1) : a.from < b.from ? -1 : 1))
    .map((one) => one.id);
  expect(entries()).toEqual(national);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.lead,
      words.source.replace('{{source}}', isolate(base[0].source)),
      words.confidence.replace('{{confidence}}', words.confidences.announced),
      words.foot,
    ]),
  );
  await press('ministry-calendar-layer-zone');
  expect(entries()).toEqual([]);
  expect(texts()).toContain(words.none);
  await press('ministry-calendar-zone');
  await press('ministry-calendar-zone-16');
  expect(entries()).toEqual([storm.id]);
  expect(texts()).toContain(
    words.line.replace('{{effect}}', words.effects.closure).replace('{{days}}', 'day 2026-11-18'),
  );
});

test('taking an entry out keeps the draft, undoing drops it, and the page reads it again', async () => {
  const book = await newBook();
  await render(book);
  const first = base[0].id;
  await press(`ministry-take-out-${first}`);
  expect(has(`ministry-mark-${first}`)).toBe(true);
  expect(texts()).toContain(words.marks.removed);
  expect(String(rendered().root.findByProps({ testID: 'ministry-calendar-said' }).props.children)).toBe(words.saved);
  expect(kept(book)).toEqual({ draft: { entries: [], removed: [first] }, setAside: false });
  await unmount();
  await render(book);
  expect(has(`ministry-mark-${first}`)).toBe(true);
  await press(`ministry-undo-${first}`);
  expect(has(`ministry-mark-${first}`)).toBe(false);
  expect(kept(book).draft).toEqual({ entries: [], removed: [] });
});

test('a draft kept that no longer fits is set aside, and said so', async () => {
  const book = await newBook();
  await book.record(date, { kind: 'ministry.calendar', draft: { entries: [], removed: ['unknown-entry'] } });
  await render(book);
  expect(has('ministry-calendar-set-aside')).toBe(true);
  expect(texts()).toContain(words.setAside);
});

test('a problem keeping the draft is said as an alert, and the marks stay', async () => {
  const book = await newBook();
  jest.spyOn(book, 'record').mockRejectedValue(new Error('A made-up store failure'));
  await render(book);
  await press(`ministry-take-out-${base[0].id}`);
  expect(has(`ministry-mark-${base[0].id}`)).toBe(false);
  expect(alerts()).toEqual([ar.demo.problem.other]);
});

test('a draft that could not be published, or would be too heavy, is refused before it is kept', async () => {
  const book = await newBook();
  const record = jest.spyOn(book, 'record');
  let desk: CalendarDesk | undefined;
  function Probe() {
    desk = useCalendarDesk({ book, date }, withStorm);
    return null;
  }
  await show(<Probe />);
  await act(() => void desk!.save({ entries: [], removed: ['unknown-entry'] }));
  expect([desk!.problem, desk!.problems]).toEqual(['demo.ministryCalendar.refused', 1]);
  await act(() => void desk!.save({ entries: [], removed: ['unknown-entry'] }));
  expect([desk!.problem, desk!.problems]).toEqual(['demo.ministryCalendar.refused', 2]);
  const heavy: CalendarDraft = {
    entries: Array.from({ length: 60 }, (_, at) => ({
      ...storm,
      id: `world-${String(at).padStart(16, '0')}`,
      name: { ar: 'ي'.repeat(120), fr: 'x'.repeat(120), en: 'x'.repeat(120) },
      source: 'x'.repeat(200),
    })),
    removed: [],
  };
  await act(() => void desk!.save(heavy));
  expect([desk!.problem, desk!.problems]).toEqual(['demo.ministryCalendar.tooBig', 3]);
  expect(record).not.toHaveBeenCalled();
  expect(draftMark(base, desk!.draft, storm.id)).toBeNull();
});

test('the page’s words read in every language', () => {
  const places = (value: unknown, path = ''): [string, string[]][] =>
    typeof value === 'string'
      ? [[path, (value.match(/\{\{\w+\}\}/gu) ?? []).sort()]]
      : Object.entries(value as Record<string, unknown>).flatMap(([key, one]) => places(one, `${path}.${key}`));
  for (const language of [fr, en]) expect(places(language.demo.ministryCalendar)).toEqual(places(words));
});
