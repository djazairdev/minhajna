// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Ministry's calendar page shows of a draft (#607, answer 623), over
// the bundled calendar: a kept draft's new and changed entries carry their
// marks, which undoing drops, and an entry taken out offers no second taking
// out; a moved entry shows the days it had and why; two presses at once keep
// the draft once; on the phone each saving and each problem is announced; and
// the workspace's page opens each world's own draft. Every entry and device is
// made up.

import { EMPTY_DRAFT, parseDay, setDraftEntry, takeOutDraftEntry, type CalendarEntry } from '@minhajna/core';
import { AccessibilityInfo, Platform, type PressableProps } from 'react-native';
import {
  act,
  control,
  base,
  date,
  has,
  kept,
  newBook,
  press,
  render,
  show,
  texts,
  unmount,
  withStorm,
} from '../jest/ministry-page';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryCalendar;
const exams = base.find((one) => one.effect === 'exam')!;
const added: CalendarEntry = {
  id: 'world-0011223344556677',
  layer: 'national',
  from: parseDay('2027-03-01'),
  to: parseDay('2027-03-01'),
  effect: 'marker',
  name: { ar: 'يوم دراسي مختلق', en: 'A made-up study day' },
  source: 'A made-up notice',
  confidence: 'projected',
};

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(unmount);

test('a kept draft’s new and changed entries carry their marks, which undoing drops', async () => {
  const book = await newBook();
  const changed = { ...base[0], source: 'Another made-up notice' };
  const draft = takeOutDraftEntry(
    base,
    setDraftEntry(base, setDraftEntry(base, EMPTY_DRAFT, added), changed),
    exams.id,
  );
  await book.record(date, { kind: 'ministry.calendar', draft });
  await render(book);
  expect(texts()).toEqual(expect.arrayContaining([words.marks.new, words.marks.changed, words.marks.removed]));
  expect(texts()).toContain(words.confidence.replace('{{confidence}}', words.confidences.projected));
  expect(has(`ministry-take-out-${exams.id}`)).toBe(false);
  await press(`ministry-undo-${added.id}`);
  await press(`ministry-undo-${changed.id}`);
  expect([has(`ministry-mark-${added.id}`), has(`ministry-mark-${changed.id}`)]).toEqual([false, false]);
  expect(has(`ministry-entry-${added.id}`)).toBe(false);
  expect(kept(book).draft).toEqual({ entries: [], removed: [exams.id] });
});

test('a moved entry shows the days it had and why', async () => {
  const book = await newBook();
  const later = { ...exams, from: parseDay('2026-12-13'), to: parseDay('2026-12-17') };
  await book.record(date, {
    kind: 'ministry.calendar',
    draft: setDraftEntry(base, EMPTY_DRAFT, later, 'A made-up reason'),
  });
  await render(book);
  const was = words.days.replace('{{from}}', `day ${exams.from}`).replace('{{to}}', `day ${exams.to}`);
  expect(texts()).toContain(words.moved.replace('{{days}}', was).replace('{{reason}}', isolate('A made-up reason')));
});

test('two presses at once keep the draft once', async () => {
  const book = await newBook();
  const record = jest.spyOn(book, 'record');
  await render(book);
  await act(() => {
    const { onPress } = control(`ministry-take-out-${base[0].id}`).props as PressableProps;
    onPress?.({} as never);
    onPress?.({} as never);
  });
  expect(record).toHaveBeenCalledTimes(1);
});

test('on the phone each saving and each problem is announced', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const book = await newBook();
  await render(book);
  await press(`ministry-take-out-${base[0].id}`);
  expect(announce).toHaveBeenLastCalledWith(words.saved);
  jest.spyOn(book, 'record').mockRejectedValue(new Error('A made-up store failure'));
  await press(`ministry-take-out-${base[1].id}`);
  await press(`ministry-take-out-${base[1].id}`);
  expect(announce.mock.calls.filter(([said]) => said === ar.demo.problem.other)).toHaveLength(2);
});

test('the workspace’s page opens each world’s own draft', async () => {
  const [one, two] = [await newBook(), await newBook()];
  await one.record(date, { kind: 'ministry.calendar', draft: takeOutDraftEntry(base, EMPTY_DRAFT, base[0].id) });
  const page = (world: string, book: typeof one) =>
    workspacePage('ministry', 'calendar', {
      open: { world, book, date },
      reference: withStorm,
      dayText: (day: string) => `day ${day}`,
    } as unknown as WorkspacePagesProps)!;
  await show(page('WORLD1', one));
  expect(has(`ministry-mark-${base[0].id}`)).toBe(true);
  await show(page('WORLD2', two));
  expect(has(`ministry-mark-${base[0].id}`)).toBe(false);
});
