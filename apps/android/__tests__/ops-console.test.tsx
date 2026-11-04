// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ops-Console's system map (#618, answer 655): on a PC the drawing kit is
// handed the map drawn from the server's description, with the legend; the
// boxes and lines written out, the batch store in the panel first and each item
// chosen showing its own rows; the system's state with the server's version
// against the one published with this app, the fingerprint in groups of four,
// the database answering and archiving or not, or failing, or the worlds in
// memory, and the two lines that always show; a version that differs said so;
// reading said, a problem shown with a way to read again; and on a phone no map
// and no legend, the item chosen said selected. Every world here is made up.

import type { Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { Send } from '../src/demo/world-session';
import { Drawing, type DrawingKit, type MapSpec } from '../src/drawing/drawing-kit';
import { OpsConsole } from '../src/operators/OpsConsole';
import { SERVER_RELEASE } from '../src/operators/ops-system';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ops;
const FINGERPRINT = '0123456789abcdef'.repeat(4);
const PARTS = ['gateway', 'relay', 'totals', 'standins'];
const archived = {
  version: SERVER_RELEASE,
  fingerprint: FINGERPRINT,
  parts: PARTS,
  storage: 'postgresql',
  database: 'ok',
  archive: 'on',
};
const drawn: MapSpec[] = [];
const kit: DrawingKit = {
  Chart: () => null,
  Map: ({ spec }) => {
    drawn.push(spec);
    return null;
  },
};
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  drawn.length = 0;
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 10; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const texts = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const answering =
  (body: unknown, status = 200): Send =>
  () =>
    Promise.resolve({ status, body, retryAfter: null });

async function render(send: Send, drawing: DrawingKit | null = kit) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <Drawing.Provider value={drawing}>
          <OpsConsole
            world={{ world: 'AAAAA', date: '2026-12-01' as Day }}
            send={send}
            dayText={(day) => `day ${day}`}
          />
        </Drawing.Provider>
      </LocaleDirContext.Provider>,
    );
  });
}

test('maps the server from its description, writes it out and opens each item’s panel', async () => {
  await render(answering(archived));
  const spec = drawn.at(-1)!;
  expect([spec.label, spec.nodes.length, spec.links.length]).toEqual([words.map, 9, 11]);
  expect(shown('ops-legend')).toBe(true);
  expect(texts('ops-group-boxes')).toContain(words.box.backups);
  expect(texts('ops-panel')).toEqual([
    words.chosen,
    words.box.relay,
    words.row.holds,
    words.facts.relay.holds,
    words.row.sees,
    words.facts.relay.sees,
    words.row.never,
    words.facts.relay.never,
    words.note.relay,
  ]);
  await press('ops-item-line.closed');
  expect(texts('ops-panel').slice(1, 3)).toEqual([words.line.closed, words.row.carries]);
  const item = tree!.root.findAll(
    (node) => node.props.testID === 'ops-item-line.closed' && 'aria-current' in node.props,
  );
  expect((item[0].props as Record<string, unknown>)['aria-current']).toBe('true');
});

test('says the system’s state: version, fingerprint, database, backups and the two lines always shown', async () => {
  await render(answering(archived));
  expect(texts('ops-state')).toEqual([
    words.state.title,
    words.state.version.replace('{{version}}', isolate(SERVER_RELEASE)),
    words.state.matches,
    words.state.fingerprint,
    '0123 4567 89ab cdef '.repeat(4).trim(),
    words.state.answering,
    words.state.archiveOn,
    words.state.offline,
    words.state.fixes,
  ]);
});

test('says when the database fails, when worlds are in memory, and when the version differs', async () => {
  const failing = {
    version: SERVER_RELEASE,
    fingerprint: null,
    parts: PARTS,
    storage: 'postgresql',
    database: 'failing',
  };
  await render(answering(failing, 503));
  expect(texts('ops-state').slice(3)).toEqual([
    words.state.noFingerprint,
    words.state.failing,
    words.state.archiveUnknown,
    words.state.offline,
    words.state.fixes,
  ]);
  expect(texts('ops-group-boxes')).not.toContain(words.box.backups);
  await ReactTestRenderer.act(() => tree!.unmount());
  await render(answering({ ...archived, archive: 'off' }));
  expect(texts('ops-state').slice(5, 7)).toEqual([words.state.answering, words.state.archiveOff]);
  await ReactTestRenderer.act(() => tree!.unmount());
  await render(answering({ version: '9.9.9', fingerprint: FINGERPRINT, parts: PARTS, storage: 'memory' }));
  expect(texts('ops-release')).toEqual([words.state.differs.replace('{{release}}', isolate(SERVER_RELEASE))]);
  expect(texts('ops-state')).toContain(words.state.memory);
  expect(texts('ops-group-boxes')).toContain(words.sub.storage.memory);
});

test('says it is reading, shows a problem with a way to read again, and reads again', async () => {
  let pending: (() => void) | undefined;
  const slow: Send = () =>
    new Promise((resolve) => {
      pending = () => resolve({ status: 200, body: archived, retryAfter: null });
    });
  await render(slow);
  expect(texts('ops-console')).toContain(words.reading);
  await act(() => pending!());
  expect(shown('ops-panel')).toBe(true);
  await ReactTestRenderer.act(() => tree!.unmount());
  const send = jest.fn<ReturnType<Send>, Parameters<Send>>(answering(null, 500));
  await render(send);
  expect(texts('ops-console')).toContain(ar.demo.problem.other);
  expect(shown('ops-panel')).toBe(false);
  send.mockImplementation(answering(archived));
  await press('ops-again');
  expect(shown('ops-panel')).toBe(true);
  expect(send).toHaveBeenCalledTimes(2);
});

test('on a phone shows no map and no legend, only the parts written out', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await render(answering(archived), null);
  expect([drawn.length, shown('ops-legend'), shown('ops-group-boxes')]).toEqual([0, false, true]);
  const selected = (testID: string) =>
    tree!.root.findAll((node) => node.props.testID === testID && 'accessibilityState' in node.props)[0].props
      .accessibilityState as { selected: boolean };
  expect(selected('ops-item-relay').selected).toBe(true);
  await press('ops-item-gateway');
  expect([selected('ops-item-relay').selected, selected('ops-item-gateway').selected]).toEqual([false, true]);
});
