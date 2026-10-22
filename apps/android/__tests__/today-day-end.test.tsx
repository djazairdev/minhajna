// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today at every level (#231, L-Today, Today-saturday, answer 387):
// «تأكيد اليوم كله كما هو مقترح» after the cards of a CEM or lycée day with
// two or more sessions awaiting, recording each as proposed with one
// «تراجع»; and a Saturday the timetable fills says it is a school day, while
// a weekday, a closed Saturday and an added make-up Saturday do not. Made-up
// data only.

import { current, parseDay, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { calendarEntry } from '../jest/calendar-data';
import { key, withDay } from '../jest/today-day';
import { catalogues, i18n, type Language } from '../src/text/i18n';
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

async function render(data: TestData, day = '2026-10-15', language: Language = 'ar') {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, day)}
      </LocaleDirContext.Provider>,
    );
  });
}

const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

async function press(id: string) {
  const [control] = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(() => {
    (control?.props as PressableProps).onPress?.({} as never);
  });
}

/** 4م1's two Thursday sessions on Saturday too, with Saturday in the week. */
async function withSaturday(): Promise<TestData> {
  const data = await withDay();
  const [timetable] = data.book.state.timetables;
  const saturday = timetable.version.entries
    .filter((entry) => entry.courseId === 'c-1')
    .map((entry): TimetableEntry => ({ ...entry, id: `${entry.id}-sat`, weekday: 6 }));
  const version = {
    ...timetable.version,
    options: { saturday: true as const },
    entries: [...timetable.version.entries, ...saturday],
  };
  await data.book.record(parseDay('2026-10-15'), { kind: 'timetable.set', version });
  return data;
}

test('confirms a CEM day whole, and takes it back with one «تراجع»', async () => {
  const data = await withDay();
  await render(data);
  expect(exists('today-band-morning')).toBe(false);
  expect(exists('today-journal')).toBe(false);
  await press('today-confirm-day');
  const records = [key(1), key(2)].map((one) => current(data.book.state.sessions.get(one)));
  expect(records.map((record) => record?.outcome)).toEqual(['done', 'done']);
  expect(current(data.book.state.sessions.get(key(3, 'c-2')))).toBeNull();
  expect(exists('today-confirm-day')).toBe(false);
  const [undo] = root().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.today.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(() => {
    (undo?.props as PressableProps).onPress?.({} as never);
  });
  expect([key(1), key(2)].map((one) => current(data.book.state.sessions.get(one)))).toEqual([null, null]);
});

test.each(['ar', 'fr', 'en'] as Language[])(
  'says a Saturday the timetable fills is a school day (%s)',
  async (language) => {
    const data = await withSaturday();
    const text = catalogues[language];
    const line = text.today.offDay.replace('{{day}}', text.week.days['6']);
    await render(data, '2026-10-17', language);
    expect(shown()).toContain(line);
    await ReactTestRenderer.act(() => tree?.unmount());
    await render(data, '2026-10-15', language);
    expect(shown().some((one) => one.includes(line))).toBe(false);
  },
);

test('says nothing on a closed Saturday, nor on an added make-up Saturday', async () => {
  const text = catalogues.ar;
  const line = text.today.offDay.replace('{{day}}', text.week.days['6']);
  const closed = await withSaturday();
  const closure = calendarEntry('closed-sat', {
    layer: 'school',
    schoolId: 's-1',
    from: parseDay('2026-10-17'),
    to: parseDay('2026-10-17'),
    effect: 'closure',
  });
  await closed.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry: closure });
  await render(closed, '2026-10-17');
  expect(shown().some((one) => one.includes(line))).toBe(false);
  await ReactTestRenderer.act(() => tree?.unmount());
  const added = await withDay();
  const makeUp = calendarEntry('make-up-sat', {
    layer: 'school',
    schoolId: 's-1',
    from: parseDay('2026-10-24'),
    to: parseDay('2026-10-24'),
    effect: 'adds-sessions',
    adds: 'make-up',
    follows: 4,
    takes: ['c-1/m1/k-1-w/every'],
  });
  await added.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry: makeUp });
  await render(added, '2026-10-24');
  expect(exists('today-c-1/2026-10-24/m1/k-1-w')).toBe(true);
  expect(shown().some((one) => one.includes(line))).toBe(false);
});
