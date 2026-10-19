// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Classes tab (#37): one card per class and subject, with its pupils,
// its first session today and where it stands against the plan, buffers
// first, then delay, and the spare sessions before the exams; a class with
// no pack is not compared; every part named in each language. Made-up
// schools, classes, pupils and timetables only.

import { confirmSessions, parseDay, todayView, type Pace, type TermCheck } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassesTab } from '../src/classes/ClassesTab';
import { paceLine } from '../src/classes/class-rules';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { coreContext } from '../src/storage/core-context';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const day = parseDay('2026-10-15');
const onClass = jest.fn();
const onBook = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function withPupils(): Promise<TestData> {
  const data = await withDay();
  for (const [id, name] of [
    ['p-1', 'بوزيد ياسين'],
    ['p-2', 'شريف مريم'],
    ['p-3', 'حداد أنس'],
  ]) {
    await data.book.record(day, {
      kind: 'pupil.set',
      pupil: { id, classId: 'k-1', name, sex: 'm', groups: [], movements: [] },
    });
  }
  return data;
}

async function notHeld(data: TestData, count: number) {
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = todayView(context, day)
    .sessions.filter((item) => item.course.id === 'c-1')
    .slice(0, count);
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      sessions.map((item) => ({ session: item.session, choice: { outcome: 'not-held' } })),
    ),
  );
}

async function show(data: TestData, direction: 'rtl' | 'ltr' = 'rtl', today = '2026-10-15') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <ClassesTab onClass={onClass} onBook={onBook} />, today)}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );

test('one card per class, with its pupils, its first session today and where it stands', async () => {
  await show(await withPupils());
  expect(shown()).toEqual([
    text.navigation.classes,
    'اللغة العربية · متوسطة النجاح · 3 تلاميذ',
    '4م1',
    '3 تلاميذ',
    'اليوم 08:00',
    'لا تأخر · يحتاج المخطط 4 حصص أكثر مما بقي قبل الاختبارات',
    text.classPage.open,
    text.book.open,
    '4م2',
    'لا تلميذ',
    'اليوم 10:00',
    text.classes.noPack,
    text.classPage.open,
    text.book.open,
  ]);
  expect(accessibilityProblems(root())).toEqual([]);
  await ReactTestRenderer.act(() => {
    (
      root().findAll((node) => node.props.testID === 'classes-c-1-class' && typeof node.props.onPress === 'function')[0]
        ?.props as PressableProps
    ).onPress?.({} as never);
  });
  expect(onClass).toHaveBeenCalledWith('c-1');
  await ReactTestRenderer.act(() => {
    (
      root().findAll((node) => node.props.testID === 'classes-c-1-book' && typeof node.props.onPress === 'function')[0]
        ?.props as PressableProps
    ).onPress?.({} as never);
  });
  expect(onBook).toHaveBeenCalledWith('c-1');
});

test('buffers absorb a delay before any delay is shown, and sessions awaiting confirmation add none', async () => {
  const data = await withPupils();
  await notHeld(data, 1);
  await show(data);
  expect(shown()).toContain('استُعملت حصة واحدة من الاحتياط، وتبقى حصة واحدة');
  await ReactTestRenderer.act(() => tree?.unmount());
  const both = await withPupils();
  await notHeld(both, 2);
  await show(both);
  expect(shown()).toContain('استُعملت حصتان من الاحتياط، ولم يبقَ منه شيء');
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(both, 'rtl', '2026-10-22');
  expect(shown()).toContain('استُعملت حصتان من الاحتياط، ولم يبقَ منه شيء');
});

test('says the spare sessions before the exams, and the delay beyond the buffers, in sessions', () => {
  const t = i18n.t.bind(i18n) as unknown as Parameters<typeof paceLine>[0];
  const pace = (fields: Partial<Pace>) => ({ delay: 0, bufferUsed: 0, bufferLeft: 2, ...fields }) as unknown as Pace;
  const check = (gives: number, needs: number) => ({ gives, needs }) as TermCheck;
  expect(paceLine(t, { pace: pace({}), check: check(20, 14) })).toBe('لا تأخر · 6 حصص احتياطية');
  expect(paceLine(t, { pace: pace({}), check: check(14, 14) })).toBe('لا تأخر · دون حصص احتياطية');
  expect(paceLine(t, { pace: pace({}), check: null })).toBe(text.classes.onPlan);
  expect(paceLine(t, { pace: pace({ delay: 2.4, bufferUsed: 2, bufferLeft: 0 }), check: check(10, 18) })).toBe(
    'حصتان خلف المخطط، بعد الاحتياط كله',
  );
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every part (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withPupils(), direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].classes.noPack);
});
