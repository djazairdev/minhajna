// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary day on Today (#230, P-Today, answers 379 and 380): the sessions in
// «الصبيحة» and «المساء», one roll call for each class's half day and none on
// the cards, named by class when a band has two, the afternoon's showing its
// marks once taken; «الكراس اليومي»; and «تأكيد اليوم كله كما هو مقترح»
// recording every session still awaiting, a «معالجة» one with its item, which
// «تراجع» takes back. A day with only an afternoon, or whose morning was not
// held, does not say its roll call is taken on its own (answer 385). A class
// called session by session keeps its roll call on its cards, and a secondary
// or mixed day, which can be confirmed whole too (answer 387), keeps its cards
// as they were. Made-up data only.

import {
  awaitingBetween,
  confirmSessions,
  current,
  parseDay,
  saveSupportQueue,
  takeRollCall,
  type RecordEvent,
  type TimetableEntry,
} from '@minhajna/core';
import { unitOf } from '../src/roll/roll-rules';
import { coreContext } from '../src/storage/core-context';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { slot, withPrimary } from '../jest/primary-class';
import { withPupils as secondary } from '../jest/roll-class';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = parseDay('2026-10-15');
const keys = ['a-1/2026-10-15/m1/p-1-w', 'a-1/2026-10-15/m2/p-1-w', 'm-1/2026-10-15/a1/p-1-w'];
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

/** 5 ابتدائي أ with two made-up pupils; `remediation` makes the afternoon an Arabic «معالجة» session with a list. */
async function withPupils(remediation = false): Promise<TestData> {
  const data = await withPrimary();
  for (const [id, name] of [
    ['x-1', 'تلميذ أول (مثال)'],
    ['x-2', 'تلميذ ثان (مثال)'],
  ] as const) {
    const pupil = { id, classId: 'p-1', name, sex: 'm', groups: [], movements: [] } as const;
    await data.book.record(day, { kind: 'pupil.set', pupil });
  }
  if (remediation) {
    const [version] = data.book.state.timetables;
    const entries = version.version.entries.map((entry) =>
      entry.id === 'e-3' ? { ...slot('e-3', 'afternoon', 1, 'a-1'), sessionType: 'remediation' } : entry,
    );
    await data.book.record(day, { kind: 'timetable.set', version: { ...version.version, entries } });
    const items = [{ id: 'r1', title: 'معالجة 1 (مثال)' }];
    await data.book.record(day, saveSupportQueue(data.book.state, { courseId: 'a-1', kind: 'remediation', items }));
  }
  return data;
}

async function render(data: TestData, onJournal = jest.fn(), direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(
          data,
          <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onJournal={onJournal} />,
          '2026-10-15',
        )}
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

test.each(['ar', 'fr', 'en'] as Language[])('puts the day in bands, each with its roll call (%s)', async (language) => {
  missingKeys.length = 0;
  await i18n.changeLanguage(language);
  const onJournal = jest.fn();
  await render(await withPupils(), onJournal, language === 'ar' ? 'rtl' : 'ltr');
  const text = catalogues[language];
  const band = (half: 'morning' | 'afternoon', fact: string) =>
    text.today.bandRoll.replace('{{band}}', text.today.band[half]).replace('{{fact}}', fact);
  expect(exists('today-band-morning')).toBe(true);
  expect(exists('today-band-afternoon')).toBe(true);
  expect(shown()).toEqual(
    expect.arrayContaining([band('morning', text.roll.none), band('afternoon', text.today.afternoonRoll)]),
  );
  for (const key of keys) expect(exists(`today-${key}-roll`)).toBe(false);
  await press('today-journal');
  expect(onJournal).toHaveBeenCalledWith(day);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('«تأكيد اليوم كله» records every session awaiting, the remediation one with its item', async () => {
  const data = await withPupils(true);
  await render(data);
  await press('today-confirm-day');
  const records = keys.map((key) => current(data.book.state.sessions.get(key.replace('m-1/', 'a-1/'))));
  expect(records.every((record) => record?.outcome === 'done')).toBe(true);
  expect(records[2]?.listItem).toEqual({ id: 'r1', finished: true });
  expect(exists('today-confirm-day')).toBe(false);
  const [undo] = root().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.today.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(() => {
    (undo?.props as PressableProps).onPress?.({} as never);
  });
  expect([...data.book.state.sessions.values()].map(current)).toEqual([null, null, null]);
});

test('a secondary day keeps the roll call on its cards, has no bands, and can be confirmed whole', async () => {
  await render(await secondary());
  expect(exists('today-band-morning')).toBe(false);
  expect(exists('today-confirm-day')).toBe(true);
  expect(root().findAll((node) => /^today-.*-roll$/.test(String(node.props.testID))).length).toBeGreaterThan(0);
});

/** A second class on Thursday morning at the same school: `level` primary, or a middle school's for a mixed day. */
async function withSecond(data: TestData, level: 'primary' | 'cem'): Promise<TestData> {
  const [version] = data.book.state.timetables;
  const extra: TimetableEntry = { ...slot('e-4', 'morning', 3, 'b-1'), groupId: 'p-2-w' };
  const school = data.book.state.schools.get('s-1');
  const events: RecordEvent[] = [
    ...(school === undefined
      ? []
      : [{ kind: 'school.set', school: { ...school, levels: ['primary', 'cem'] } } as const]),
    {
      kind: 'class.set',
      schoolClass: {
        id: 'p-2',
        schoolId: 's-1',
        level,
        grade: level === 'primary' ? '4ap' : '1am',
        name: level === 'primary' ? '4 ابتدائي ب' : '1 متوسط أ',
        groups: [{ id: 'p-2-w', kind: 'whole', name: 'p-2' }],
      },
    },
    { kind: 'course.set', course: { id: 'b-1', classId: 'p-2', subject: 'math', year: '2026-2027', pack: null } },
    {
      kind: 'pupil.set',
      pupil: { id: 'x-3', classId: 'p-2', name: 'تلميذ ثالث (مثال)', sex: 'f', groups: [], movements: [] },
    },
    { kind: 'timetable.set', version: { ...version.version, entries: [...version.version.entries, extra] } },
  ];
  await data.book.recordAll(day, events);
  return data;
}

test('names each class when a band has two, and shows the afternoon’s marks once taken', async () => {
  const data = await withSecond(await withPupils(), 'primary');
  const context = coreContext({ ...data, state: data.book.state });
  const afternoon = unitOf(context, keys[2] ?? '', day);
  if (afternoon !== null) await data.book.record(day, takeRollCall(context, afternoon, { absent: [], late: [] }));
  await render(data);
  const text = catalogues.ar;
  const named = (name: string) =>
    text.today.bandRollClass
      .replace('{{band}}', text.today.band.morning)
      .replace('{{name}}', `\u2068${name}\u2069`)
      .replace('{{fact}}', text.roll.none);
  expect(shown()).toEqual(
    expect.arrayContaining([
      named('5 ابتدائي أ'),
      named('4 ابتدائي ب'),
      text.today.bandRoll.replace('{{band}}', text.today.band.afternoon).replace('{{fact}}', text.roll.allPresent),
    ]),
  );
  const ids = root()
    .findAll(
      (node) =>
        String(node.props.testID).startsWith('today-band-morning-roll-') && typeof node.props.onPress === 'function',
    )
    .map((node) => String(node.props.testID));
  expect(new Set(ids).size).toBe(2);
});

test('a mixed day keeps the roll call on its cards, has no bands and no journal', async () => {
  await render(await withSecond(await withPupils(), 'cem'));
  expect(exists('today-band-morning')).toBe(false);
  expect(exists('today-confirm-day')).toBe(true);
  expect(exists('today-journal')).toBe(false);
  expect(exists(`today-${keys[0]}-roll`)).toBe(true);
});

test('a class called session by session keeps its roll call on its cards', async () => {
  const data = await withPupils();
  const schoolClass = data.book.state.classes.get('p-1');
  if (schoolClass !== undefined)
    await data.book.record(day, { kind: 'class.set', schoolClass: { ...schoolClass, rollCallUnit: 'session' } });
  await render(data);
  expect(exists('today-band-morning')).toBe(true);
  expect(exists('today-band-morning-roll')).toBe(false);
  for (const key of keys) expect(exists(`today-${key}-roll`)).toBe(true);
});

test('a day with only an afternoon does not say its roll call is taken on its own', async () => {
  const data = await withPupils();
  const [version] = data.book.state.timetables;
  const entries = version.version.entries.filter((entry) => entry.slot.half === 'afternoon');
  await data.book.record(day, { kind: 'timetable.set', version: { ...version.version, entries } });
  await render(data);
  const text = catalogues.ar;
  expect(exists('today-band-morning')).toBe(false);
  expect(shown()).toContain(
    text.today.bandRoll.replace('{{band}}', text.today.band.afternoon).replace('{{fact}}', text.roll.none),
  );
  expect(shown()).not.toContain(
    text.today.bandRoll.replace('{{band}}', text.today.band.afternoon).replace('{{fact}}', text.today.afternoonRoll),
  );
});

test('a day whose morning was not held does not say the afternoon’s roll call is taken on its own', async () => {
  const data = await withPupils();
  const context = coreContext({ ...data, state: data.book.state });
  const mornings = awaitingBetween(context, day, day).filter((session) => session.slot.half === 'morning');
  expect(mornings).toHaveLength(2);
  const notHeld = mornings.map((session) => ({ session, choice: { outcome: 'not-held' as const } }));
  await data.book.recordAll(day, confirmSessions(context, notHeld));
  await render(data);
  const text = catalogues.ar;
  expect(shown()).not.toContain(
    text.today.bandRoll.replace('{{band}}', text.today.band.afternoon).replace('{{fact}}', text.today.afternoonRoll),
  );
});
