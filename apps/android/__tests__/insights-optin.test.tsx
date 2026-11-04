// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exact payload before opting in (#622, answer 696), against a made-up demo
// server: in a teachers' world, the teacher's insights page shows, for the term
// the world's date ended, each class of the world's teacher, the one with a
// pack with its sending in words and as its exact text, which reads as a
// sending and carries the token and IDs the world's store keeps, the same when
// the page opens again; the class with no pack says it sends nothing; opening
// it sends nothing to the server; once the world's date moves past the next
// term's end, the next term shows with a new token, the first kept; with no
// term ended, or a working out that fails, it says so; a partial or failed
// sending says so, with a retry only after a failure. The opt-in and its
// payload name every control and field, in every language and both directions,
// at text 200%. Every world is made up.

import {
  keptDraw,
  NO_PACK,
  readSending,
  worldTeacher,
  type InsightsSending,
  type SchoolCalendar,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, useWindowDimensions, View, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { seededWorld } from '../src/director/director-world';
import { InsightsOptin, WorldOptin } from '../src/insights/InsightsOptin';
import { leaveWorldNetwork } from '../src/network/world-network';
import { isolate } from '../src/week/grid-labels';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const words = catalogues.ar.demo.insights;
const paths: string[] = [];
const send: typeof server.send = (request) => {
  paths.push(request.path);
  return server.send(request);
};

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const turns = async (count = 60) => {
  for (let turn = 0; turn < count; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
};
const host = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string');
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

/** The sending the page shows as its exact text. */
const shownText = () => JSON.parse(String(host('insights-payload-text')[0].props.children)) as unknown;

test('a teachers’ world shows each class’s exact sending before opting in, and sends nothing', async () => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
    await settle();
  });
  await press('demo-start-teachers');
  const id = String(tree!.root.findByProps({ testID: 'world-code' }).props.children).slice(0, 5);
  await press('world-role-teacher');
  const sent = paths.length;
  await press('world-insights-open');
  const mine = worldTeacher(seededWorld(id, reference))!;
  const classes = mine.school.classes.filter((one) => mine.teacher.classIds.includes(one.id));
  const packed = classes.find((one) => one.packs[mine.teacher.subject] !== undefined)!;
  const bare = classes.find((one) => one !== packed)!;
  expect(host('insights-class-' + classes[0].id)).toHaveLength(1);
  await press(`insights-class-${packed.id}`);
  const sending = readSending(shownText()) as InsightsSending;
  expect(typeof sending).toBe('object');
  expect([sending.grade, sending.subject, sending.term]).toEqual([packed.grade, mine.teacher.subject, 1]);
  expect(texts()).toContain(words.payload.reached['1']);
  await press(`insights-class-${bare.id}`);
  expect(texts()).toContain(words.preview.noPack);
  expect(host('insights-payload')).toHaveLength(0);
  await press('insights-back');
  await press('world-insights-open');
  await press(`insights-class-${packed.id}`);
  expect(shownText()).toEqual(sending);
  expect(paths.slice(sent)).toEqual([]);
  await press('insights-back');
  let second = sending;
  for (let move = 0; move < 12 && second.term === 1; move += 1) {
    await press('world-move-date');
    await press('world-insights-open');
    await press(`insights-class-${packed.id}`);
    second = readSending(shownText()) as InsightsSending;
    if (second.term === 1) await press('insights-back');
  }
  expect(second.term).toBe(2);
  expect(texts()).toContain(words.preview.head.replace('{{term}}', words.payload.terms['2']));
  expect(second.token).not.toBe(sending.token);
  await press('insights-back');
  await press('world-leave');
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  const draw = keptDraw(book.entries, calendar.year.id, 1)!;
  expect([draw.token, draw.ids[packed.id]]).toEqual([sending.token, sending.id]);
  expect(keptDraw(book.entries, calendar.year.id, 2)?.token).toBe(second.token);
  expect(book.entries.filter((entry) => entry.kind === 'insights.drawn')).toHaveLength(2);
  expect(paths.slice(sent).some((path) => path.includes('insights'))).toBe(false);
});

test.each([
  ['none', 'insights-none', 'none'],
  ['failed', 'insights-failed', 'failedAll'],
] as const)('says when nothing is worked out (%s)', async (_kind, testID, key) => {
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), 'K7QF4'));
  const failing = { mac: () => Promise.reject(new Error('Made-up failure')), random: nodeKit.random };
  const date = key === 'none' ? calendar.year.from : calendar.year.terms[0].to;
  const digest = (text: string) => Promise.resolve(text);
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <WorldOptin
        world="K7QF4"
        date={date}
        book={book}
        reference={reference}
        kit={failing}
        digest={digest}
        choice={{ on: false, since: null }}
        status={{ kind: 'off' }}
        onChoose={() => undefined}
        onRetry={() => undefined}
        unkept={false}
      />,
    );
    await settle();
  });
  await turns();
  expect(host(testID)).toHaveLength(1);
  expect(texts()).toContain(words.preview[key]);
  expect(host('insights-payload')).toHaveLength(0);
  await world.leaveWorld();
});

test.each([
  ['partial', false],
  ['failed', true],
] as const)('says how the sending stands, with a retry only after a failure (%s)', async (kind, retry) => {
  const sendings = { kind: 'none' } as const;
  const on = { on: true, since: calendar.year.terms[0].to };
  const none = () => undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <InsightsOptin
        reference={reference}
        choice={on}
        status={{ kind }}
        onChoose={none}
        onRetry={none}
        unkept={false}
        sendings={sendings}
      />,
    );
    await settle();
  });
  expect(texts()).toContain(words.sending[kind]);
  expect(host('insights-retry').length > 0).toBe(retry);
});

test.each(
  (['ar', 'fr', 'en'] as const).flatMap(
    (language) =>
      [
        [language, 'rtl'],
        [language, 'ltr'],
      ] as const,
  ),
)('names every control and field of the opt-in, and lets text grow (%s, %s)', async (language: Language, direction) => {
  const sending: InsightsSending = {
    format: 'minhajna/insights/1',
    id: '1'.repeat(32),
    token: '2'.repeat(32),
    schoolTerm: '3'.repeat(64),
    year: '2026-2027',
    term: 1,
    wilaya: '16',
    grade: '4am',
    subject: 'arabic',
    pack: 'dz.cem.4am.arabic.example',
    release: '2026.2',
    sessions: { 'made-up-item-1': 2, 'made-up-item-2': 1, a: 1, b: 1, c: 0 },
    changed: { merged: ['a'], skipped: ['c'], split: [], retaught: ['b'] },
    reached: 412,
  };
  await ReactTestRenderer.act(async () => {
    await i18n.changeLanguage(language);
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <View>
          <InsightsOptin
            reference={reference}
            choice={{ on: true, since: calendar.year.terms[0].to }}
            status={{ kind: 'failed' }}
            onChoose={() => undefined}
            onRetry={() => undefined}
            unkept
            sendings={{
              kind: 'shown',
              term: 1,
              classes: [
                {
                  classId: 'c1',
                  sending,
                  schoolClass: { id: 'c1', grade: '4am', name: '4AM1', pupils: [], packs: {} },
                },
                {
                  classId: 'c2',
                  sending: NO_PACK,
                  schoolClass: { id: 'c2', grade: '1am', name: '1AM1', pupils: [], packs: {} },
                },
              ],
            }}
          />
        </View>
      </LocaleDirContext.Provider>,
    );
  });
  const payload = catalogues[language].demo.insights.payload;
  expect(texts()).toEqual(expect.arrayContaining([payload.level, payload.token, payload.text, payload.reached['1']]));
  expect(texts()).toContain(payload.reachedLine.replace('{{percent}}', '41'));
  expect(shownText()).toEqual(sending);
  expect(host('insights-payload-changed')[0].props.accessibilityLabel).toContain(
    payload.changes.merged.replace('{{item}}', isolate('a')),
  );
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  expect(missingKeys).toEqual([]);
  for (const node of tree!.root.findAllByType(Text)) {
    expect((node.props as TextProps).numberOfLines).toBeUndefined();
    expect((node.props as TextProps).maxFontSizeMultiplier).toBeUndefined();
  }
});
