// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's pages in the app (#213, P09, P10): numbered as they
// print, the latest first, earlier ones a tap away; sessions awaiting
// confirmation shown in what confirming them would record, never counted
// as printed nor numbered, confirmed with one tap and taken back with «تراجع»; a
// confirmed row opening its details; the month on screen printing; and the
// class's other subjects. Made-up records only.

import { confirmSessions, current, parseDay, sessionsBetween, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { useEffect } from 'react';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { bookViewPages } from '../src/book/book-pages';
import { TextsBook } from '../src/book/TextsBook';
import { textsBookPages } from '../src/documents/texts-book-pages';
import type { DocumentData } from '../src/documents/document-data';
import { useAppData } from '../src/storage/AppData';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const t = i18n.getFixedT('ar');
const onCourse = jest.fn();
const onDetails = jest.fn();
const onPrint = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

/** October's sessions of 4م1 confirmed; November's left awaiting. */
async function withOctober(): Promise<TestData> {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const october = sessionsBetween(context, data.year.from, parseDay('2026-10-31'), new Set(['c-1']));
  await data.book.recordAll(
    parseDay('2026-11-01'),
    confirmSessions(
      context,
      october.map((session) => ({ session })),
    ),
  );
  return data;
}

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-11-12'),
  lang: 'ar',
  dir: 'rtl',
});

/** Records as another screen would, such as the session's details, while the book stays open. */
let elsewhere: ((events: readonly RecordEvent[]) => void) | undefined;
function Elsewhere() {
  const { recordAll } = useAppData();
  useEffect(() => {
    elsewhere = recordAll;
  }, [recordAll]);
  return null;
}

async function show(data: TestData, courseId = 'c-1') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <>
            <TextsBook courseId={courseId} onCourse={onCourse} onDetails={onDetails} onPrint={onPrint} />
            <Elsewhere />
          </>,
          '2026-11-12',
        )}
      </LocaleDirContext.Provider>,
    );
  });
}

async function press(testID: string) {
  await ReactTestRenderer.act(() => {
    (
      root().findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0]
        ?.props as PressableProps
    ).onPress?.({} as never);
  });
}

const said = (testID: string) =>
  root()
    .findAll((node) => node.type === Text && node.props.testID === testID)
    .map((node) => [node.props.children].flat().join(''))[0];

test('pages are numbered as they print, and awaiting sessions show on their month without counting', async () => {
  const data = await withOctober();
  const context = coreContext(documentData(data));
  const course = data.book.state.courses.get('c-1');
  if (course === undefined) throw new Error('No course');
  const pages = bookViewPages(documentData(data), context, course, t, 'rtl', parseDay('2026-11-12'));
  expect(pages.map((page) => [page.number, page.month])).toEqual([
    [1, '2026-10'],
    [null, '2026-11'],
  ]);
  expect(pages[0]?.rows.every((row) => !row.awaiting)).toBe(true);
  expect(pages[1]?.rows.length).toBeGreaterThan(0);
  expect(pages[1]?.rows.every((row) => row.awaiting && row.lines.length > 0)).toBe(true);
  expect(pages[1]?.rows.every((row) => row.day <= '2026-11-12')).toBe(true);
});

test('a month awaiting confirmation is named by its month alone, and the next month keeps the number it prints with', async () => {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const november = sessionsBetween(context, parseDay('2026-11-01'), parseDay('2026-11-12'), new Set(['c-1']));
  await data.book.recordAll(
    parseDay('2026-11-12'),
    confirmSessions(
      context,
      november.map((session) => ({ session })),
    ),
  );
  const course = data.book.state.courses.get('c-1');
  if (course === undefined) throw new Error('No course');
  const pages = bookViewPages(
    documentData(data),
    coreContext(documentData(data)),
    course,
    t,
    'rtl',
    parseDay('2026-11-12'),
  );
  expect(pages.map((page) => [page.number, page.month, page.rows.every((row) => row.awaiting)])).toEqual([
    [null, '2026-10', true],
    [1, '2026-11', false],
  ]);
  const printed = textsBookPages(documentData(data), t, false);
  expect(printed).toContain('دفتر النصوص · الصفحة 1<');
  expect(printed).not.toContain('الصفحة 2<');
});

test('opens on the latest page; confirms an awaiting session with one tap and takes it back', async () => {
  const data = await withOctober();
  await show(data);
  expect(said('book-heading')).toBe('⁨4م1⁩ · اللغة العربية');
  expect(said('book-page')).toBe('نوفمبر 2026 · لا صفحة مطبوعة بعد');
  expect(accessibilityProblems(root())).toEqual([]);
  const [first] = sessionsBetween(
    coreContext({ ...data, state: data.book.state }),
    parseDay('2026-11-01'),
    parseDay('2026-11-12'),
    new Set(['c-1']),
  ).filter((session) => session.calendar === null);
  if (first === undefined) throw new Error('No session');
  await press(`book-confirm-${first.key}`);
  expect(current(data.book.state.sessions.get(first.key))).not.toBeNull();
  expect(root().findAll((node) => node.props.testID === 'book-snack').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() => {
    (
      root().findAll(
        (node) => node.props.accessibilityLabel === text.today.undo && typeof node.props.onPress === 'function',
      )[0]?.props as PressableProps
    ).onPress?.({} as never);
  });
  expect(current(data.book.state.sessions.get(first.key))).toBeNull();
});

test('«تراجع» goes once the session is recorded otherwise, so it never withdraws a later correction', async () => {
  const data = await withOctober();
  await show(data);
  const [first] = sessionsBetween(
    coreContext({ ...data, state: data.book.state }),
    parseDay('2026-11-01'),
    parseDay('2026-11-12'),
    new Set(['c-1']),
  ).filter((session) => session.calendar === null);
  if (first === undefined) throw new Error('No session');
  await press(`book-confirm-${first.key}`);
  const record = current(data.book.state.sessions.get(first.key));
  if (record === null) throw new Error('No record');
  expect(root().findAll((node) => node.props.testID === 'book-snack').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() =>
    elsewhere?.([{ kind: 'session.recorded', record: { ...record, outcome: 'not-held', coverage: [] } }]),
  );
  expect(root().findAll((node) => node.props.testID === 'book-snack')).toHaveLength(0);
});

test('an earlier page is a tap away, a confirmed row opens its details, and the month on screen prints', async () => {
  const data = await withOctober();
  await show(data);
  await press('book-before');
  expect(said('book-page')).toBe('الصفحة 1 · أكتوبر 2026');
  const row = root().findAll(
    (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('book-row-c-1'),
  )[0];
  await press(row?.props.testID as string);
  expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'c-1' }));
  await press('book-print');
  expect(onPrint).toHaveBeenCalledWith('2026-10-01');
  expect(
    root().findAll((node) => node.props.testID === 'book-after' && node.props.accessibilityLabel !== undefined)[0]
      ?.props.accessibilityLabel,
  ).toBe('الصفحة التالية، نوفمبر 2026');
  await press('book-after');
  expect(said('book-page')).toBe('نوفمبر 2026 · لا صفحة مطبوعة بعد');
});

test("the class's other subjects are a tap away, and a book with nothing yet says so", async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'course.set',
    course: { id: 'c-3', classId: 'k-1', subject: 'french', year: '2026-2027', pack: null },
  });
  await show(data, 'c-3');
  expect(said('book-empty')).toBe(text.book.empty);
  await press('book-subjects-c-1');
  expect(onCourse).toHaveBeenCalledWith('c-1');
});
