// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights log and what the app connects to, in a teachers' world (#622,
// answer 698), against a made-up demo server: the insights page opens the log,
// empty at first; once taking part is turned on and off, the day lists both and
// the sending, named by its class and term, which opens to the text exactly as
// it went to the server, the same once the world's store is read again, and
// Android's back goes from the sending to the log, the page and the world's
// home; what the app connects to names the demo server and says taking part is
// off. Both pages name every control, in every language and both directions, at
// text 200%. Every world is made up.

import { insightsLog, type InsightsLogLine, type InsightsSending } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import {
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type PressableProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { calendar, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import type { SwitchProps } from '../src/components/Switch';
import { DemoRoot } from '../src/demo/DemoRoot';
import { InsightsHelp } from '../src/insights/InsightsHelp';
import { InsightsLog } from '../src/insights/InsightsLog';
import { InsightsPage } from '../src/insights/InsightsPage';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const words = catalogues.ar.demo.insights;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  await i18n.changeLanguage('ar');
  missingKeys.length = 0;
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
const puts = () => server.seen.filter((one) => one.method === 'PUT' && one.path.endsWith('/insights/sendings'));
const label = (testID: string) => String(host(testID)[0].props.accessibilityLabel);
/** Whether a page is there and no parent hides it. */
const visible = (testID: string) => {
  let node: ReactTestRenderer.ReactTestInstance | null | undefined = host(testID)[0];
  if (node === undefined) return false;
  for (; node; node = node.parent) {
    if (StyleSheet.flatten((node.props as { style?: ViewStyle }).style)?.display === 'none') return false;
  }
  return true;
};

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

/** Turns taking part on or off, as the switch does. */
async function toggle() {
  const control = tree!.root.findByProps({ testID: 'insights-take-part' }).props as SwitchProps;
  await ReactTestRenderer.act(async () => {
    control.onValueChange(!control.value);
    await settle();
  });
  await turns();
}

/** Starts a teachers' world as its teacher, and answers its ID. */
async function teachersWorld(): Promise<string> {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
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
  return id;
}

test('the log lists each turning on or off and sending by its day, a sending opening to its text as sent', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  const back = async () => {
    await ReactTestRenderer.act(async () => {
      [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
      await settle();
    });
    await turns();
  };
  const id = await teachersWorld();
  await press('world-insights-open');
  await press('insights-log-open');
  expect(host('insights-log-empty')).toHaveLength(1);
  expect([visible('insights-log-page'), visible('insights-page')]).toEqual([true, false]);
  expect(tree!.root.findByType(InsightsPage).props.opened).toBe('log');
  await press('insights-log-back');
  expect([visible('insights-log-page'), visible('insights-page')]).toEqual([false, true]);
  expect(tree!.root.findByType(InsightsPage).props.opened).toBeNull();
  await toggle();
  await toggle();
  await press('insights-log-open');
  const ended = calendar.year.terms[0].to;
  expect(host(`insights-log-${ended}`)).toHaveLength(1);
  expect(texts()).toEqual(expect.arrayContaining([words.log.on, words.log.off]));
  const body = puts()[0].body!;
  const row = `insights-log-sent-${(JSON.parse(body) as InsightsSending).id}`;
  expect(label(row)).toContain(words.payload.reached['1']);
  await press(row);
  const sent = tree!.root.findAll(
    (node) => node.props.testID === 'insights-sent-page' && typeof node.type === 'string',
  );
  const text = sent[0].findAll(
    (node) => node.props.testID === 'insights-payload-text' && typeof node.type === 'string',
  );
  expect(String(text[0].props.children)).toBe(body);
  await back();
  expect(visible('insights-sent-page')).toBe(false);
  expect(visible('insights-log-page')).toBe(true);
  await back();
  expect(visible('insights-log-page')).toBe(false);
  expect(visible('insights-page')).toBe(true);
  await press('insights-help-open');
  expect([visible('insights-help-page'), visible('insights-page')]).toEqual([true, false]);
  expect(tree!.root.findByType(InsightsPage).props.opened).toBe('help');
  expect(host('insights-help-state')[0].props.children).toBe(words.help.insights.off);
  expect(String(host('insights-help-demo')[0].props.children)).toContain('minhajna-demo.djazair.dev');
  await back();
  expect([visible('insights-help-page'), visible('insights-page')]).toEqual([false, true]);
  await back();
  expect(host('insights-page')).toHaveLength(0);
  await press('world-leave');
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  const kept = insightsLog(book.entries);
  await ReactTestRenderer.act(() => tree!.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <InsightsLog
        lines={kept}
        className={String}
        reference={reference}
        date=""
        dayText={String}
        onClose={() => undefined}
      />,
    );
    await settle();
  });
  await press(row);
  expect(String(host('insights-payload-text')[0].props.children)).toBe(body);
  await press('insights-sent-close');
  expect(host('insights-log-page')).toHaveLength(1);
});

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
  sessions: { a: 2 },
  changed: { merged: [], skipped: [], split: [], retaught: [] },
  reached: 412,
};
const day = calendar.year.terms[0].to;
const lines: InsightsLogLine[] = [
  { kind: 'on', day },
  { kind: 'off', day },
  { kind: 'sent', day, classId: 'c1', text: JSON.stringify(sending), sending },
];

test.each(
  (['ar', 'fr', 'en'] as const).flatMap(
    (language) =>
      [
        [language, 'rtl'],
        [language, 'ltr'],
      ] as const,
  ),
)(
  'the log, a sending and the help name every control, and let text grow (%s, %s)',
  async (language: Language, direction) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
    const none = () => undefined;
    await ReactTestRenderer.act(async () => {
      await i18n.changeLanguage(language);
      tree = ReactTestRenderer.create(
        <LocaleDirContext.Provider value={direction}>
          <View>
            <InsightsLog
              lines={lines}
              className={() => '4AM1'}
              reference={reference}
              date=""
              dayText={String}
              onClose={none}
            />
            <InsightsLog lines={[]} className={String} reference={reference} date="" dayText={String} onClose={none} />
            <InsightsHelp on={false} date="" onClose={none} />
          </View>
        </LocaleDirContext.Provider>,
      );
    });
    const log = catalogues[language].demo.insights.log;
    expect(texts()).toEqual(
      expect.arrayContaining([log.on, log.off, log.empty, catalogues[language].demo.insights.help.insights.off]),
    );
    expect(accessibilityProblems(tree!.root)).toEqual([]);
    await press(`insights-log-sent-${'1'.repeat(32)}`);
    expect(texts()).toContain(
      log.asSent.replace('{{term}}', catalogues[language].demo.insights.payload.reached['1']).replace('{{day}}', day),
    );
    expect(accessibilityProblems(tree!.root)).toEqual([]);
    expect(missingKeys).toEqual([]);
    for (const node of tree!.root.findAllByType(Text)) {
      expect((node.props as TextProps).numberOfLines).toBeUndefined();
      expect((node.props as TextProps).maxFontSizeMultiplier).toBeUndefined();
    }
  },
);
