// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today across schools (#232, PS-Today, answer 394): a day in two schools
// comes in bands by school and half day, in the order of each band's first
// session, and the day's line counts the schools; a primary specialist's
// bands keep their half-day roll calls and «الكراس اليومي»; a CEM teacher in
// two schools gets the bands too, with no journal and roll calls on the
// cards; a school whose sessions a calendar entry takes is not counted,
// and the entry marks only its cards there unless it takes the whole day,
// an exam window pausing the plan at that school by name; a
// class's afternoon roll call says it is taken alone inside its school's
// band; and a day in one school keeps its bands or none. Made-up classes
// only.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { calendarEntry } from '../jest/calendar-data';
import { withSpecialist } from '../jest/specialist-classes';
import { i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const iso = (value: string) => `\u2068${value}\u2069`;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, language: Language = 'ar') {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(
          data,
          <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onJournal={jest.fn()} />,
          '2026-10-15',
        )}
      </LocaleDirContext.Provider>,
    );
  });
}

const ids = () =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('today-band-'))
    .map((node) => node.props.testID as string);
const bands = () => [...new Set(ids().filter((id) => !id.includes('-roll')))];
const label = (id: string) =>
  root()
    .findAll((node) => node.props.testID === id)[0]
    ?.findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''))[0];
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

/** An English teacher in two CEMs: 1AM1 at 08:00 at the first, 2AM1 at 10:00 at the second, on Thursday. */
async function withTwoCems(): Promise<TestData> {
  const data = await openTestData();
  const school = (id: string, name: string): RecordEvent => ({
    kind: 'school.set',
    school: { id, name, levels: ['cem'], subjects: ['english'], zone: '16' },
  });
  const room = (id: string, schoolId: string, grade: string, name: string): RecordEvent[] => [
    {
      kind: 'class.set',
      schoolClass: { id, schoolId, level: 'cem', grade, name, groups: [{ id: `${id}-w`, kind: 'whole', name }] },
    },
    { kind: 'course.set', course: { id: `c-${id}`, classId: id, subject: 'english', year: '2026-2027', pack: null } },
  ];
  const entry = (id: string, classId: string, index: number): TimetableEntry => ({
    id,
    weekday: 4,
    slot: { half: 'morning', index },
    courseId: `c-${classId}`,
    groupId: `${classId}-w`,
    weeks: 'every',
    sessionType: 'lesson',
  });
  await data.book.recordAll(parseDay('2026-10-15'), [
    school('s-a', 'متوسطة النجاح'),
    school('s-b', 'متوسطة الأمل'),
    ...room('k-a', 's-a', '1am', '1AM1'),
    ...room('k-b', 's-b', '2am', '2AM1'),
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [entry('e-b', 'k-b', 3), entry('e-a', 'k-a', 1)],
        blocks: [],
      },
    },
  ]);
  return data;
}

test('a primary specialist’s day comes in bands by school and half day, counting the schools', async () => {
  missingKeys.length = 0;
  const pupils = ['k-1', 'k-3'].map((classId): RecordEvent => ({
    kind: 'pupil.set',
    pupil: { id: `x-${classId}`, classId, name: 'تلميذ (مثال)', sex: 'm', groups: [], movements: [] },
  }));
  await render(await withSpecialist(pupils));
  expect(bands()).toEqual(['today-band-s-1-morning', 'today-band-s-2-afternoon']);
  expect(label('today-band-s-1-morning')).toBe(`${iso('مدرسة الفتح')} · الصبيحة`);
  expect(label('today-band-s-2-afternoon')).toBe(`${iso('مدرسة الرياض')} · المساء`);
  expect(shown().some((line) => line.includes(' · مؤسستان · '))).toBe(true);
  expect(ids().some((id) => id.startsWith('today-band-s-1-morning-roll'))).toBe(true);
  expect(ids().some((id) => id.startsWith('today-band-s-2-afternoon-roll'))).toBe(true);
  expect(exists('today-journal')).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('a CEM teacher in two schools gets the bands, with no journal', async () => {
  await render(await withTwoCems(), 'en');
  expect(bands()).toEqual(['today-band-s-a-morning', 'today-band-s-b-morning']);
  expect(label('today-band-s-a-morning')).toBe(`${iso('متوسطة النجاح')} · Morning`);
  expect(shown().some((line) => line.includes(' · 2 schools · '))).toBe(true);
  expect(exists('today-journal')).toBe(false);
  expect(ids().some((id) => id.includes('-roll'))).toBe(false);
});

test('a day in one school keeps its bands or none', async () => {
  const data = await withSpecialist();
  const version = data.book.state.timetables[0].version;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'timetable.set',
    version: { ...version, entries: version.entries.filter((entry) => entry.id !== 'e-3') },
  });
  await render(data);
  expect(bands()).toEqual(['today-band-morning']);
  expect(shown().some((line) => line.includes('مؤسس'))).toBe(false);
});

test('a closure of one school marks its cards in its band, not the whole day', async () => {
  const closure = calendarEntry('closed-riadh', { layer: 'school', schoolId: 's-2', effect: 'closure' });
  await render(await withSpecialist([{ kind: 'calendar.set', entry: closure }]));
  expect(exists('day-mark')).toBe(false);
  expect(bands()).toEqual(['today-band-s-1-morning', 'today-band-s-2-afternoon']);
  const band = root().findAll((node) => node.props.testID === 'today-band-s-2-afternoon')[0]?.parent;
  const words = band?.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join('')) ?? [];
  expect(words.some((line) => line.includes('موعد تجريبي closed-riadh'))).toBe(true);
  expect(shown().some((line) => line.includes('مؤسس'))).toBe(false);
  expect(exists('day-lost')).toBe(true);
  expect(exists('day-paused')).toBe(false);
});

test('an exam window of one school pauses its plan rather than losing its sessions', async () => {
  const exams = calendarEntry('exams-riadh', { layer: 'school', schoolId: 's-2', effect: 'exam' });
  await render(await withSpecialist([{ kind: 'calendar.set', entry: exams }]));
  expect(exists('day-mark')).toBe(false);
  expect(bands()).toEqual(['today-band-s-1-morning', 'today-band-s-2-afternoon']);
  expect(exists('day-paused')).toBe(true);
  expect(exists('day-lost')).toBe(false);
  expect(shown()).toContain(i18n.t('daymark.pausedAt', { school: iso('مدرسة الرياض') }));
});

test('a holiday that takes both schools’ sessions still marks the whole day', async () => {
  const holiday = calendarEntry('holiday', { effect: 'no-school' });
  await render(await withSpecialist([{ kind: 'calendar.set', entry: holiday }]));
  expect(exists('day-mark')).toBe(true);
  expect(bands()).toEqual([]);
});

test('an afternoon roll call taken alone says so inside its school’s band', async () => {
  const pupil: RecordEvent = {
    kind: 'pupil.set',
    pupil: { id: 'x-1', classId: 'k-1', name: 'تلميذ (مثال)', sex: 'm', groups: [], movements: [] },
  };
  const afternoon: TimetableEntry = {
    id: 'e-4',
    weekday: 4,
    slot: { half: 'afternoon', index: 1 },
    courseId: 'f-1',
    groupId: 'k-1-w',
    weeks: 'every',
    sessionType: 'lesson',
  };
  await render(await withSpecialist([pupil], [afternoon]));
  expect(bands()).toEqual(['today-band-s-1-morning', 'today-band-s-1-afternoon', 'today-band-s-2-afternoon']);
  const strip = root().findAll((node) => node.props.testID === 'today-band-s-1-afternoon-roll')[0];
  const words = strip?.findAllByType(Text).map((node) => [node.props.children as unknown].flat().join('')) ?? [];
  expect(words.some((line) => line.includes(i18n.t('today.afternoonRoll')))).toBe(true);
});
