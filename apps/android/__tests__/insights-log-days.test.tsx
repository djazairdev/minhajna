// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights log's days and focus (#622, answer 698): the newest day comes
// first, each day's lines in order; a sending stays open when lines are added
// under it, the log hidden beneath it, and closing it hands focus back to its
// row, and closing a page hands focus back to the link that opened it; a failed
// try at sending is said on the log; what the app connects to says when taking
// part is on, and on a PC names the page's own files too. Every sending is made
// up.

import type { Day, InsightsLogLine, InsightsSending } from '@minhajna/core';
import * as ReactNative from 'react-native';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  type PressableProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendar, reference } from '../jest/world-calendar';
import { InsightsHelp } from '../src/insights/InsightsHelp';
import { InsightsLog } from '../src/insights/InsightsLog';
import { InsightsPage } from '../src/insights/InsightsPage';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const words = catalogues.en.demo.insights;
const [first, second] = calendar.year.terms;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const host = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string');
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

const sent = (term: 1 | 2, day: Day): InsightsLogLine => {
  const sending: InsightsSending = {
    format: 'minhajna/insights/1',
    id: String(term).repeat(32),
    token: '7'.repeat(32),
    schoolTerm: '8'.repeat(64),
    year: '2026-2027',
    term,
    wilaya: '16',
    grade: '4am',
    subject: 'arabic',
    pack: 'dz.cem.4am.arabic.example',
    release: '2026.2',
    sessions: { a: 2 },
    changed: { merged: [], skipped: [], split: [], retaught: [] },
    reached: 412,
  };
  return { kind: 'sent', day, classId: 'c1', text: JSON.stringify(sending), sending };
};
const log = (lines: readonly InsightsLogLine[]) => (
  <InsightsLog
    lines={lines}
    className={() => '4AM1'}
    reference={reference}
    date=""
    dayText={String}
    onClose={() => undefined}
  />
);

test('lists the newest day first, each day in order, and holds a sending open as lines are added', async () => {
  const older = [
    { kind: 'on', day: first.to },
    { kind: 'off', day: first.to },
  ] as const;
  const lines = [sent(2, second.to), ...older, sent(1, first.to)];
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(log(lines));
  });
  const shownWords = texts();
  const at = (one: unknown) => shownWords.indexOf(one);
  expect(at(second.to)).toBeLessThan(at(first.to));
  expect(at(first.to)).toBeLessThan(at(words.log.on));
  expect(at(words.log.on)).toBeLessThan(at(words.log.off));
  const id = '1'.repeat(32);
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID: `insights-log-sent-${id}` })[0].props as PressableProps).onPress?.(
      {} as never,
    );
    await Promise.resolve();
  });
  expect(host('insights-sent-page')).toHaveLength(1);
  const shown = () => String(host('insights-payload-text')[0].props.children);
  expect(shown()).toBe((lines[3] as Extract<InsightsLogLine, { kind: 'sent' }>).text);
  await ReactTestRenderer.act(() => tree!.update(log([{ kind: 'on', day: second.to }, ...lines])));
  expect(shown()).toBe((lines[3] as Extract<InsightsLogLine, { kind: 'sent' }>).text);
  const under = tree!.root.findAll(
    (node) => typeof node.type === 'string' && StyleSheet.flatten(node.props.style as ViewStyle)?.display === 'none',
  );
  expect(under[0].findAll((node) => node.props.testID === 'insights-log-page').length).toBeGreaterThan(0);
});

/** The native handle a row's mock node answers: 29 for the row named, 71 for any other. */
function focusOn(testID: string) {
  const frames: ((time: number) => void)[] = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  jest
    .spyOn(jest.requireActual<typeof ReactNative>('react-native'), 'findNodeHandle')
    .mockImplementation((node) => ((node as { props?: TextProps } | null)?.props?.testID === testID ? 29 : 71));
  const focus = jest.spyOn(NativeInterface, 'focusView').mockImplementation(() => undefined);
  const settled = () => ReactTestRenderer.act(() => frames.splice(0).forEach((callback) => callback(0)));
  return { focus, settled };
}

test('closing a sending hands focus back to its own row', async () => {
  const id = '1'.repeat(32);
  const { focus, settled } = focusOn(`insights-log-sent-${id}`);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(log([sent(2, second.to), sent(1, first.to)]));
  });
  const press = (testID: string) =>
    ReactTestRenderer.act(async () => {
      (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await Promise.resolve();
    });
  await press(`insights-log-sent-${id}`);
  await settled();
  expect(focus).not.toHaveBeenCalled();
  await press('insights-sent-close');
  expect(host('insights-sent-page')).toHaveLength(0);
  await settled();
  expect(focus.mock.calls).toEqual([[29]]);
});

test.each(['log', 'help'] as const)(
  'closing the page a link opened hands focus back to that link (%s)',
  async (name) => {
    const { focus, settled } = focusOn(`insights-${name}-open`);
    const page = (opened: 'log' | 'help' | null) => (
      <InsightsPage
        state={{ kind: 'teacher' }}
        stopped={null}
        date=""
        dayText={String}
        onLog={() => undefined}
        onHelp={() => undefined}
        opened={opened}
        onClose={() => undefined}
      />
    );
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(page(null));
    });
    await ReactTestRenderer.act(() => tree!.update(page(name)));
    await settled();
    expect(focus).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree!.update(page(null)));
    await settled();
    expect(focus.mock.calls).toEqual([[29]]);
  },
);

test('says a failed try at sending, as the page saying so is hidden under the log', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <InsightsLog
        lines={[]}
        className={String}
        reference={reference}
        date=""
        dayText={String}
        failed
        onClose={() => undefined}
      />,
    );
  });
  expect(host('insights-log-failed')[0].props.children).toBe(words.log.failed);
});

test('says taking part is on, and on a PC names the page’s own files', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<InsightsHelp on date="" onClose={() => undefined} />);
  });
  expect(host('insights-help-state')[0].props.children).toBe(words.help.insights.on);
  expect(texts()).toEqual(expect.arrayContaining([words.help.nothingElse, words.help.sees.line]));
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'web');
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<InsightsHelp on={false} date="" onClose={() => undefined} />);
  });
  expect(host('insights-help-state')[0].props.children).toBe(words.help.insights.off);
  expect(texts()).toContain(words.help.pc.nothingElse);
  expect(String(host('insights-help-demo')[0].props.children)).toContain('minhajna-demo.djazair.dev');
  expect(String(host('insights-help-demo')[0].props.children)).toContain(words.help.pc.demo.split('{{address}}')[0]);
});
