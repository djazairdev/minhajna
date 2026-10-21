// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Exam-week entries (#221, Today-exams, answer 270): the form opens on the next
// exam day, or the last after them all, and offers only exam days; an
// invigilation saved with its times and room, then removed and restored with
// «تراجع»; a class exam needs its classes; Today shows the day's entries and
// the form's button only on an exam day; the test schedule opens the form on
// the exams' first day; an invigilation has its row in the journal for all
// classes, among the sessions by its start; every control is named in each
// language. Made-up records only.

import { parseDay, type ExamDuty } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import type { DocumentData } from '../src/documents/document-data';
import { journalPages } from '../src/documents/journal-pages';
import { DutyEntry } from '../src/exams/DutyEntry';
import { examDays } from '../src/exams/duty-rules';
import { coreContext } from '../src/storage/core-context';
import { TestSchedule } from '../src/exams/TestSchedule';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { dayName } from '../src/today/DayMark';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mount(
  data: TestData,
  element: React.ReactElement,
  day = '2026-10-15',
  direction: 'rtl' | 'ltr' = 'rtl',
) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

const exists = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onChangeText: (value: string) => void }).onChangeText(value);
    await settle();
  });
}

const duties = (data: TestData) => [...data.book.state.duties.values()];
const problems = () =>
  accessibilityProblems(tree!.root).filter((problem) => !problem.endsWith('smaller than 48dp (0×48)'));
const enabled = (testID: string) =>
  (
    tree!.root.findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled: boolean } | undefined
  )?.disabled === false;

const invigilation: ExamDuty = {
  id: 'i-1',
  kind: 'invigilation',
  day: parseDay('2026-12-07'),
  from: '10:00',
  to: '12:00',
  room: '5',
};

test('the form opens on the next exam day, offers only exam days, and saves an invigilation', async () => {
  const data = await withDay();
  await mount(data, <DutyEntry />);
  expect(texts()).toContain('الأحد 6 ديسمبر');
  expect(enabled('extra-day-2026-12-07')).toBe(true);
  expect(enabled('extra-day-2026-12-13')).toBe(false);
  expect(problems()).toEqual([]);

  await press('extra-day-2026-12-07');
  await type('duty-from', '10:00');
  await type('duty-to', '12:00');
  await type('duty-room', '5');
  await press('duty-save');
  expect(duties(data)).toEqual([{ ...invigilation, id: expect.any(String) as string }]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'حُفظ إدخال «حراسة» ليوم الإثنين 7 ديسمبر.',
      'ما أُدخل ليوم الإثنين 7 ديسمبر',
      'القاعة \u20685\u2069',
    ]),
  );
});

test('after the last exams, the form opens on their last day', async () => {
  const data = await withDay();
  const days = [...examDays(coreContext({ ...data, state: data.book.state }))].sort();
  await mount(data, <DutyEntry />, '2027-06-28');
  expect(days.length).toBeGreaterThan(0);
  expect(days[days.length - 1] < '2027-06-28').toBe(true);
  expect(tree!.root.findByProps({ testID: 'duty-day' }).props.children).toBe(
    dayName(i18n.getFixedT('ar'), days[days.length - 1], 'ar', data.profile),
  );
});

test('a time that ends before it starts, or a class exam with no class, is not saved', async () => {
  const data = await withDay();
  await mount(data, <DutyEntry day={parseDay('2026-12-06')} />);
  await type('duty-from', '10:00');
  await type('duty-to', '09:00');
  await press('duty-save');
  expect(texts()).toContain(text.duties.timeWrong);
  await press('duty-kind-exam');
  await type('duty-to', '12:00');
  await press('duty-save');
  expect(texts()).toContain(text.duties.classesMissing);
  expect(duties(data)).toEqual([]);
  await press('duty-classes-c-1');
  await press('duty-classes-c-2');
  await press('duty-save');
  expect(duties(data)).toEqual([
    {
      id: expect.any(String) as string,
      kind: 'exam',
      day: '2026-12-06',
      from: '10:00',
      to: '12:00',
      courseIds: ['c-1', 'c-2'],
    },
  ]);
});

test('an entry is removed and restored with «تراجع»', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'duty.set', duty: invigilation });
  await mount(data, <DutyEntry day={parseDay('2026-12-07')} />);
  await press('duty-remove-i-1');
  expect(duties(data)).toEqual([]);
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'duty-said' }).props as { onUndo: () => void }).onUndo();
    await settle();
  });
  expect(duties(data)).toEqual([invigilation]);
});

test('Today shows the day’s entries and the form’s button only on an exam day', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'duty.set', duty: invigilation });
  const duty = jest.fn();
  const today = (
    <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onExams={{ warning: jest.fn(), duty }} />
  );
  await mount(data, today);
  expect(exists('today-duty')).toBe(false);
  await mount(data, today, '2026-12-07');
  expect(exists('duty-i-1')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining([text.duties.kinds.invigilation, 'القاعة \u20685\u2069']));
  expect(problems()).toEqual([]);
  await press('today-duty');
  expect(duty).toHaveBeenCalledWith('2026-12-07');
});

test('the test schedule opens the form on the exams’ first day', async () => {
  const data = await withDay();
  const onDuty = jest.fn();
  await mount(data, <TestSchedule courseId="c-1" onCourse={jest.fn()} onDuty={onDuty} />);
  await press('tests-duty');
  expect(onDuty).toHaveBeenCalledWith('2026-12-06');
});

test('an invigilation has its own row in the journal for all classes, not in one per class', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'duty.set', duty: invigilation });
  const documentData = (): DocumentData => ({
    state: data.book.state,
    profile: data.profile,
    year: data.year,
    calendar: data.calendar,
    calendarRelease: data.calendarRelease,
    packs: data.packs,
    bells: data.bells,
    day: parseDay('2026-12-07'),
    lang: 'ar',
    dir: 'rtl',
  });
  const t = i18n.getFixedT('ar');
  const combined = journalPages(documentData(), t, false, 'combined');
  expect(combined).toContain(text.duties.kinds.invigilation);
  expect(combined).toContain('القاعة \u20685\u2069');
  expect(journalPages(documentData(), t, false, 'per-class')).not.toContain(text.duties.kinds.invigilation);
});

test('an invigilation takes its place among the day’s sessions by its start', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'duty.set',
    duty: { ...invigilation, day: parseDay('2026-10-15'), from: '08:30', to: '09:30' },
  });
  const page = journalPages(
    {
      state: data.book.state,
      profile: data.profile,
      year: data.year,
      calendar: data.calendar,
      calendarRelease: data.calendarRelease,
      packs: data.packs,
      bells: data.bells,
      day: parseDay('2026-10-15'),
      lang: 'ar',
      dir: 'rtl',
    },
    i18n.getFixedT('ar'),
    false,
    'combined',
  );
  const at = (part: string) => page.indexOf(part);
  expect(at('8سا')).toBeLessThan(at(text.duties.kinds.invigilation));
  expect(at(text.duties.kinds.invigilation)).toBeLessThan(at('9سا – 10سا'));
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'duty.set', duty: invigilation });
  await mount(data, <DutyEntry day={parseDay('2026-12-07')} />, '2026-10-15', direction);
  await press('duty-kind-exam');
  expect(problems()).toEqual([]);
  expect(texts()).toContain(catalogues[language].duties.intro);
});
