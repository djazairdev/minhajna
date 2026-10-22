// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A TD session's list on Today (#231, L-Today, answer 387): in place of the
// proposal, the next items of the pack's TD queue with «اليوم» and
// «الحصة القادمة», «بعد الفرض» on a row a test of the class comes before,
// and that TD never moves the main plan, with where it stands. The focus
// card still records the session; a card further down shows the list
// without the tap. Made-up data only.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { i18n, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, language: Language = 'ar') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, '2026-10-15')}
      </LocaleDirContext.Provider>,
    );
  });
}

const byId = (id: string) => root().findAll((node) => node.props.testID === id);
const texts = (id: string) =>
  byId(id)[0]
    ?.findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join('')) ?? [];

async function press(id: string) {
  const [control] = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(() => {
    (control?.props as PressableProps).onPress?.({} as never);
  });
}

const entry = (id: string, weekday: 0 | 4, index: number, sessionType: string): TimetableEntry => ({
  id,
  weekday,
  slot: { half: 'morning', index },
  courseId: 'c-m',
  groupId: 'k-m-w',
  weeks: 'every',
  sessionType,
});

/**
 * 1م1's mathematics: TD at 08:00 and a lesson at 09:00 on Thursday 15 October, or the other way round with
 * `lessonFirst`, and TD on Sunday at 08:00; `test` puts a test on Thursday at 09:00.
 */
async function withTd(test = false, lessonFirst = false): Promise<TestData> {
  const data = await openTestData();
  const day = parseDay('2026-10-15');
  const events: RecordEvent[] = [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-m',
        schoolId: 's-1',
        level: 'cem',
        grade: '1am',
        name: '1م1',
        groups: [{ id: 'k-m-w', kind: 'whole', name: '1م1' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-m',
        classId: 'k-m',
        subject: 'math',
        year: '2026-2027',
        pack: { id: 'dz.cem.1am.math.example', release: '2026.1' },
      },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: day,
        source: 'hand',
        entries: [
          entry('e-td', 4, lessonFirst ? 2 : 1, 'td'),
          entry('e-ls', 4, lessonFirst ? 1 : 2, 'lesson'),
          entry('e-sun', 0, 1, 'td'),
        ],
        blocks: [],
      },
    },
  ];
  const slot = { half: 'morning' as const, index: 2 };
  const exam: RecordEvent = {
    kind: 'test.set',
    test: { id: 'x-1', courseId: 'c-m', day, slot, groupId: 'k-m-w', title: 'الفرض الأول' },
  };
  await data.book.recordAll(day, test ? [...events, exam] : events);
  return data;
}

const td = 'today-c-m/2026-10-15/m1/k-m-w';

test('shows the TD list in place of the proposal, and records the session', async () => {
  await render(await withTd());
  expect(texts(`${td}-td`)).toEqual([
    'قائمة الأعمال الموجهة لهذا القسم',
    '1',
    'أعمال موجهة 1 (مثال)',
    'اليوم',
    '2',
    'أعمال موجهة 2 (مثال)',
    'الحصة القادمة',
    'لحصص الأعمال الموجهة قائمتها، ولا يتقدّم بها المخطط الرئيسي. ' +
      'ويبقى \u20681م1\u2069 على «\u2068تقويم تشخيصي (مثال)\u2069»، الحصة 1 من 1.',
  ]);
  expect(byId(`${td}-td-row-1`)[0]?.props.accessibilityLabel).toBe(
    '2، \u2068أعمال موجهة 2 (مثال)\u2069، الحصة القادمة',
  );
  expect(texts(td)).not.toContain('مقترح من المخطط');
  await press(`${td}-confirm`);
  expect(byId(`${td}-td`)).toHaveLength(0);
});

test('marks the row after a test of the class «بعد الفرض»', async () => {
  await render(await withTd(true));
  expect(texts(`${td}-td`).slice(4, 7)).toEqual(['2', 'أعمال موجهة 2 (مثال)', 'بعد الفرض']);
});

test('says the list in English', async () => {
  await render(await withTd(), 'en');
  expect(texts(`${td}-td`)[0]).toBe('The class’s directed-work list');
  expect(texts(`${td}-td`)[3]).toBe('Today');
  expect(texts(`${td}-td`)[7]).toBe(
    'Directed-work sessions have their own list and never move the main plan. \u20681م1\u2069 stays at ' +
      '“\u2068تقويم تشخيصي (مثال)\u2069”, session 1 of 1.',
  );
});

test('shows the list on a TD session further down the day, without the tap', async () => {
  await render(await withTd(false, true));
  const later = 'today-c-m/2026-10-15/m2/k-m-w';
  expect(texts(`${later}-td`).slice(0, 4)).toEqual([
    'قائمة الأعمال الموجهة لهذا القسم',
    '1',
    'أعمال موجهة 1 (مثال)',
    'اليوم',
  ]);
  expect(byId(`${later}-confirm`)).toHaveLength(0);
  expect(byId('today-c-m/2026-10-15/m1/k-m-w-confirm').length).toBeGreaterThan(0);
});
