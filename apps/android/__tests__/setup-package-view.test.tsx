// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's timetable package that passes its checks in setup's week step
// (#580, Setup-5b, Setup-5d, answer 608), read under a made-up world's trust as
// a world's own setup would: it shows whose part it is and its version, picks
// the school of its name among the teacher's, says what it changes in the week
// drawn for that school and each class's sessions, and names its clash with the
// teacher's other school, found at that school's own times; accepting records
// the new version from the package's first day, keeping the other school's
// sessions, and the school's bell times, then returns to the week saying so; a
// session the week cannot place is named, and accepting waits; going back
// records nothing; a school picked is not kept for the next package; and the
// acceptance is said once the card is back, its timer held until the card has
// mounted, since an awaited act can let it run first. Every world, school and
// teacher is made up.

import {
  certificateRequest,
  issueCertificate,
  newId,
  packageFile,
  parseDay,
  signPart,
  type KeySigner,
  type PackageTrust,
  type PartSession,
  type TimetablePart,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { calendarInput } from '../jest/calendar-input';
import { PackageWait } from '../src/setup/PackageWait';
import { Week } from '../src/setup/Week';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.week.package;
const day = parseDay('2026-10-15');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  calendarInput.readFile.mockReset();
  calendarInput.readFile.mockResolvedValue(null);
});

function signer(): KeySigner {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (text) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
    verify: (key, text, signature) =>
      Promise.resolve(
        verify(
          'sha256',
          Buffer.from(text, 'utf8'),
          createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' }),
          Buffer.from(signature, 'base64'),
        ),
      ),
  };
}

const CA = signer();
const TRUST: PackageTrust = { checker: CA, world: { id: 'K7QF4', ca: CA.publicKey } };
const one = (id: string, change: Partial<PartSession>): PartSession => ({
  id: id.repeat(32),
  class: '4م1',
  group: '',
  subject: 'Made-up',
  day: 0,
  start: 540,
  end: 600,
  room: '',
  week: 'both',
  ...change,
});

async function file(sessions: PartSession[]) {
  const director = signer();
  const random = (length: number) => new Uint8Array(randomBytes(length));
  const request = await certificateRequest('K7QF4', newId(random), director);
  const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), CA);
  const part: TimetablePart = {
    world: 'K7QF4',
    school: 'S'.repeat(22),
    schoolName: 'متوسطة المختلقة',
    assignment: 'a'.repeat(32),
    issue: 1,
    teacher: 'مختلق',
    version: 2,
    from: parseDay('2026-12-06'),
    once: false,
    sessions,
    bells: [
      [480, 540],
      [540, 600],
    ],
  };
  return packageFile(await signPart(part, certificate, director));
}

const morning = (index: number) => ({ half: 'morning' as const, index });
const bells = {
  usual: [
    { ...morning(1), from: '08:00', to: '09:00' },
    { ...morning(2), from: '09:00', to: '10:00' },
  ],
};

const later = {
  usual: [
    { ...morning(1), from: '09:00', to: '10:00' },
    { ...morning(2), from: '10:00', to: '11:00' },
  ],
};

async function setting(other = bells): Promise<TestData> {
  const data = await openTestData();
  const school = (id: string, name: string) => ({
    kind: 'school.set' as const,
    school: { id, name, levels: ['cem'], subjects: ['arabic'], zone: '16', bells: id === 's-2' ? other : bells },
  });
  const schoolClass = (id: string, schoolId: string) => ({
    kind: 'class.set' as const,
    schoolClass: {
      id,
      schoolId,
      level: 'cem',
      grade: '4am',
      name: '4م1',
      groups: [{ id: `g-${id}`, kind: 'whole' as const, name: '4م1' }],
    },
  });
  const course = (id: string, classId: string) => ({
    kind: 'course.set' as const,
    course: { id, classId, subject: 'arabic', year: '2026-2027', pack: null },
  });
  const entry = (id: string, weekday: 0 | 1, courseId: string, classId: string) => ({
    id,
    weekday,
    slot: morning(1),
    courseId,
    groupId: `g-${classId}`,
    weeks: 'every' as const,
    sessionType: 'lesson',
  });
  await data.book.recordAll(day, [
    school('s-1', 'متوسطة المختلقة'),
    school('s-2', 'Made-up school'),
    schoolClass('k-1', 's-1'),
    schoolClass('k-2', 's-2'),
    course('c-1', 'k-1'),
    course('c-2', 'k-2'),
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: data.year.from,
        source: 'hand',
        entries: [entry('e-1', 0, 'c-1', 'k-1'), entry('e-2', 1, 'c-2', 'k-2')],
        blocks: [],
      },
    },
  ]);
  return data;
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;
const button = (testID: string) =>
  tree!.root.find((node) => node.props.testID === testID && typeof node.props.onPress === 'function');

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 20; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
}
const press = (testID: string) => act(() => (button(testID).props as PressableProps).onPress?.({} as never));

async function open(data: TestData, sessions: PartSession[]) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <Week onDraw={jest.fn()} onResolve={jest.fn()} onTimes={jest.fn()} onNext={jest.fn()} trust={TRUST} />,
        )}
      </LocaleDirContext.Provider>,
    );
  });
  calendarInput.readFile.mockResolvedValueOnce(await file(sessions));
  await press('package-open');
}

test('a package shows what it changes and its clash, and accepting records the week and the bell times', async () => {
  const data = await setting();
  await open(data, [one('a', {}), one('b', { day: 1, start: 480, end: 540 })]);
  expect(has('package-view')).toBe(true);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.viewTitle,
      words.signed,
      words.whose.replace('{{teacher}}', isolate('مختلق')),
      words.diffHead.replace('{{differences}}', '2'),
      words.clashHead,
      words.clashNote,
    ]),
  );
  expect(tree!.root.findAll((node) => node.type === Text && node.props.testID === 'package-clash')).toHaveLength(1);
  expect(has('package-school-s-1')).toBe(true);
  await press('package-accept');
  expect([has('package-view'), has('package-wait')]).toEqual([false, true]);
  expect(texts()).toContain(words.accepted.replace('{{date}}', '06/12/2026'));
  await press('package-open');
  expect(texts()).not.toContain(words.accepted.replace('{{date}}', '06/12/2026'));
  const version = data.book.state.timetables.at(-1)!.version;
  expect([version.source, version.from]).toEqual(['package', parseDay('2026-12-06')]);
  expect(version.entries.map((entry) => [entry.courseId, entry.weekday, entry.slot.index])).toEqual([
    ['c-2', 1, 1],
    ['c-1', 0, 2],
    ['c-1', 1, 1],
  ]);
  expect(data.book.state.schools.get('s-1')?.bells?.usual).toHaveLength(2);
});

test('a session the week cannot place is named, accepting waits, and going back records nothing', async () => {
  const data = await setting();
  const before = data.book.entries.length;
  await open(data, [one('a', { class: '4م9' })]);
  expect(texts()).toEqual(expect.arrayContaining([words.unplacedHead, words.unplacedHint]));
  expect((button('package-accept').props as PressableProps).disabled).toBe(true);
  await press('package-view-back');
  expect([has('package-view'), has('package-wait'), data.book.entries.length]).toEqual([false, true, before]);
});

test('a clash with another school is found at that school’s own times', async () => {
  const clashes = () =>
    tree!.root.findAll((node) => node.type === Text && node.props.testID === 'package-clash').length;
  const data = await setting(later);
  await open(data, [one('b', { day: 1, start: 480, end: 540 })]);
  expect(clashes()).toBe(0);
  await press('package-view-back');
  calendarInput.readFile.mockResolvedValueOnce(await file([one('b', { day: 1, start: 540, end: 600 })]));
  await press('package-open');
  expect(clashes()).toBe(1);
});

test('the school picked for one package is not kept for the next', async () => {
  const selected = () => tree!.root.find((node) => node.props.testID === 'package-school').props.selected as string;
  const data = await setting();
  await open(data, [one('a', {})]);
  await press('package-school-s-2');
  expect(selected()).toBe('s-2');
  await press('package-view-back');
  calendarInput.readFile.mockResolvedValueOnce(await file([one('a', {})]));
  await press('package-open');
  expect(selected()).toBe('s-1');
});

test('a package accepted is said once the card is back, not already there as it mounts', async () => {
  jest.useFakeTimers();
  try {
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <PackageWait busy={false} unreadable={false} accepted="Made-up" onOpen={jest.fn()} />,
      );
    });
    expect(texts()).not.toContain('Made-up');
    await ReactTestRenderer.act(() => jest.runOnlyPendingTimers());
    expect(texts()).toContain('Made-up');
  } finally {
    jest.useRealTimers();
  }
});
