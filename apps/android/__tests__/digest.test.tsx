// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Digest screen (#234, answers 402 and 405): the week before Sunday,
// its sessions awaiting confirmation opening Today's list, the confirmed
// ones, a make-up due with «جدولتها», a closure's sessions apart, the next
// exams, a class behind a parallel one until «تجاهل», and each class's
// card with «خيارات الاستدراك» while it is behind; in two schools, the
// school a closure or the exams take; Saturday's digest for a teacher who
// works then; and the Classes tab's row that opens it. Made-up data only.

import { awaitingBetween, confirmSessions, driftBefore, parseDay, type Drift, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { calendarEntry } from '../jest/calendar-data';
import { behind, repaceContext, repaceDay } from '../jest/repace-data';
import { withDay } from '../jest/today-day';
import { withClash } from '../jest/clash-schools';
import { ClassesTab } from '../src/classes/ClassesTab';
import { Digest } from '../src/digest/Digest';
import { dismissDrift } from '../src/plan/drift-dismissal';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const text = catalogues.ar;
const iso = (value: string) => `\u2068${value}\u2069`;
const calls = { backlog: jest.fn(), makeUp: jest.fn(), catchUp: jest.fn(), plan: jest.fn() };

/** Drops every dismissal kept so far: those for days before the one given go, and the one kept is for no class. */
function clearDismissals(): void {
  const far = parseDay('2099-12-31');
  dismissDrift('none', { before: { kind: 'exams', day: far, term: 1 }, gap: 0 } as Drift, far);
}

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  clearDismissals();
  setNotifyPrefs({ digest: true, preview: false, saturday: false });
  jest.clearAllMocks();
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, on = '2026-10-18') {
  missingKeys.length = 0;
  const digest = (
    <Digest onBacklog={calls.backlog} onMakeUp={calls.makeUp} onCatchUp={calls.catchUp} onPlan={calls.plan} />
  );
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, digest, on)}</LocaleDirContext.Provider>,
    );
  });
}

const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const press = async (id: string) => {
  const onPress = control(id).props.onPress as () => void;
  await ReactTestRenderer.act(() => onPress());
};
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

/** Both classes on the example pack before a common test on 12 November, 4م1 taught on 15 October. */
async function parallel(): Promise<TestData> {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const test = (id: string, courseId: string, groupId: string, index: number): RecordEvent => ({
    kind: 'test.set',
    test: {
      id,
      courseId,
      day: parseDay('2026-11-12'),
      slot: { half: 'morning', index },
      groupId,
      title: 'فرض',
      common: true,
    },
  });
  const pack = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };
  await data.book.recordAll(day, [
    { kind: 'course.set', course: { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack } },
    test('t-1', 'c-1', 'k-1-w', 1),
    test('t-2', 'c-2', 'k-2-w', 3),
  ]);
  const context = repaceContext(data);
  const taught = awaitingBetween(context, parseDay('2026-10-11'), day).filter((one) => one.courseId === 'c-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      taught.map((session) => ({ session })),
    ),
  );
  return data;
}

test('Sunday’s digest covers the week before, its sessions awaiting, no losses, and each class', async () => {
  await render(await withDay());
  expect(shown()).toEqual(
    expect.arrayContaining([
      i18n.t('digest.range', { from: '11 أكتوبر', to: '15 أكتوبر' }),
      i18n.t('digest.awaiting', { count: 3 }),
      text.digest.noLost,
      text.digest.footer,
      i18n.t('digest.exams', {
        exams: i18n.t('classPlan.driftExams', { term: text.classPlan.term1 }),
        day: '6 ديسمبر',
      }),
    ]),
  );
  expect(exists('digest-class-c-1')).toBe(true);
  expect(exists('digest-class-c-2')).toBe(true);
  expect(exists('digest-catchup-c-1')).toBe(false);
  await press('digest-awaiting');
  expect(calls.backlog).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('a make-up due opens the add screen, and a class behind its plan the catch-up options', async () => {
  const data = await behind();
  const context = repaceContext(data);
  const first = awaitingBetween(context, parseDay('2026-10-11'), repaceDay).find((one) => one.courseId === 'c-2');
  if (first === undefined) throw new Error('No session of 4م2 awaits');
  await data.book.recordAll(
    repaceDay,
    confirmSessions(context, [{ session: first, choice: { outcome: 'not-held', makeUp: true } }]),
  );
  await render(data);
  expect(shown()).toContain(i18n.t('digest.allConfirmed', { count: 3 }));
  expect(shown()).toContain(i18n.t('digest.makeUp', { class: iso('4م2'), day: 'الخميس 15 أكتوبر' }));
  await press(`digest-makeup-${first.key}-open`);
  expect(calls.makeUp).toHaveBeenCalledWith('c-2');
  await press('digest-catchup-c-1');
  expect(calls.catchUp).toHaveBeenCalledWith('c-1');
});

test('a closure’s sessions are counted apart, for the week and for each class', async () => {
  const data = await withDay();
  const storm: RecordEvent = {
    kind: 'calendar.set',
    entry: calendarEntry('storm', { layer: 'school', schoolId: 's-1', effect: 'closure' }),
  };
  await data.book.record(parseDay('2026-10-15'), storm);
  await render(data);
  const what = iso('موعد تجريبي storm');
  expect(shown()).toEqual(
    expect.arrayContaining([
      i18n.t('daymark.lost', { count: 3 }),
      i18n.t('digest.lostDay', { what, day: 'الخميس 15 أكتوبر', sessions: i18n.t('count.sessions', { count: 3 }) }),
      text.digest.lostNote,
      i18n.t('digest.classLost', { lost: i18n.t('daymark.lost', { count: 2 }), what, day: 'الخميس 15 أكتوبر' }),
      text.digest.noSessions,
    ]),
  );
  expect(exists('digest-awaiting')).toBe(false);
});

test('in two schools, a closure and the exams name their school', async () => {
  const data = await withClash();
  const storm: RecordEvent = {
    kind: 'calendar.set',
    entry: calendarEntry('storm', { layer: 'school', schoolId: 's-1', effect: 'closure' }),
  };
  await data.book.record(parseDay('2026-10-15'), storm);
  await render(data);
  const lost = shown().filter((line) => line.startsWith(iso('موعد تجريبي storm')));
  expect(lost).toHaveLength(1);
  expect(lost[0]).toContain(` في ${iso('مدرسة الفتح')}،`);
  expect(lost[0]).not.toContain('مدرسة الرياض');
  expect(shown().some((line) => line.includes(` في ${iso('مدرسة الفتح')} و${iso('مدرسة الرياض')} ابتداءً`))).toBe(true);
});

test('a teacher who works on Saturdays has Saturday’s digest, and one with it off is told so', async () => {
  setNotifyPrefs({ saturday: true, digest: false });
  await render(await withDay(), '2026-10-17');
  expect(shown()).toEqual(
    expect.arrayContaining([
      i18n.t('digest.range', { from: '10 أكتوبر', to: '15 أكتوبر' }),
      text.digest.footerSaturday,
      text.digest.off,
    ]),
  );
});

test('a class behind a parallel one is named until «تجاهل», with its plan and catch-up options', async () => {
  const data = await parallel();
  await render(data);
  expect(exists('digest-drift-c-2')).toBe(true);
  await press('digest-align-c-2');
  expect(calls.plan).toHaveBeenCalledWith('c-2');
  await press('digest-drift-catchup-c-2');
  expect(calls.catchUp).toHaveBeenCalledWith('c-2');
  await press('digest-dismiss-c-2');
  expect(exists('digest-drift-c-2')).toBe(false);
});

test('a drift dismissed on the plan of the class ahead stays dismissed in the digest', async () => {
  const data = await parallel();
  const drift = driftBefore(repaceContext(data), 'c-1', parseDay('2026-10-18'));
  expect(drift?.behind).toBe(false);
  await render(data);
  expect(exists('digest-drift-c-2')).toBe(true);
  await ReactTestRenderer.act(() => {
    if (drift !== null) dismissDrift('c-1', drift, parseDay('2026-10-18'));
  });
  expect(exists('digest-drift-c-2')).toBe(false);
});

test('the Classes tab opens the digest', async () => {
  const onDigest = jest.fn();
  missingKeys.length = 0;
  const tab = <ClassesTab onClass={jest.fn()} onBook={jest.fn()} onWeek={jest.fn()} onDigest={onDigest} />;
  const data = await withDay();
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, tab)}</LocaleDirContext.Provider>,
    );
  });
  await press('classes-digest');
  expect(onDigest).toHaveBeenCalledTimes(1);
  expect(missingKeys).toEqual([]);
});

test('there is no digest before the year’s first day has passed', async () => {
  await render(await withDay(), '2026-09-20');
  expect(shown()).toEqual([text.digest.empty]);
});
