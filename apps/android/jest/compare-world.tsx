// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teachers' world and its insights for the tests of a class's comparison
// (#623), against a made-up demo server and its seeded sendings: starting it as
// its teacher, its date past the first term's end, or opening a device without
// the starter token at a date; what each request answers can be overridden.
// Every world is made up.

import type { Day } from '@minhajna/core';
import { Platform, Text, useWindowDimensions, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { SwitchProps } from '../src/components/Switch';
import { DemoRoot } from '../src/demo/DemoRoot';
import type { Send } from '../src/demo/world-session';
import { useWorldInsights } from '../src/insights/use-world-insights';
import { leaveWorldNetwork, type WorldAnswer, type WorldRequest } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import { i18n } from '../src/text/i18n';
import { FakeStorage } from './fake-storage';
import { FakeWorld } from './fake-world';
import { calendar, reference } from './world-calendar';
import { DemoServer, nodeKit } from './world-server';

export const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);

/** The tree drawn, and an answer of a test's own to a request, else null. */
export const harness: {
  tree: ReactTestRenderer.ReactTestRenderer | undefined;
  override: ((request: WorldRequest) => Promise<WorldAnswer> | WorldAnswer | null) | null;
} = { tree: undefined, override: null };

export const send: Send = (request) => {
  const own = harness.override?.(request) ?? null;
  return own === null ? server.send(request) : Promise.resolve(own);
};
export const reply = (status: number, body: unknown = null): WorldAnswer => ({ status, body, retryAfter: null });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => harness.tree?.unmount());
  harness.tree = undefined;
  harness.override = null;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export const turns = async (count = 60) => {
  for (let turn = 0; turn < count; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
};
export const host = (testID: string) =>
  harness.tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string');
export const all = () =>
  harness.tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

export async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (harness.tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

export async function takePart() {
  const control = harness.tree!.root.findByProps({ testID: 'insights-take-part' }).props as SwitchProps;
  await ReactTestRenderer.act(async () => {
    control.onValueChange(true);
    await settle();
  });
  await turns();
}

/** Starts a teachers' world as its teacher, its date moved past the first term's end, and opens the insights. */
export async function openInsights(): Promise<string> {
  await ReactTestRenderer.act(async () => {
    harness.tree = ReactTestRenderer.create(
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
  const id = String(harness.tree!.root.findByProps({ testID: 'world-code' }).props.children).slice(0, 5);
  await press('world-role-teacher');
  const end = calendar.year.terms[0].to;
  for (let move = 0; move < 40 && server.worlds.get(id)!.date < end; move += 1) await press('world-move-date');
  await press('world-insights-open');
  return id;
}

export const openLink = () => String(links()[0].props.testID);
export const asked = () => server.seen.filter((one) => one.path.includes('/insights'));

/** The insights of a world opened on a device without the starter token, at a date, and a way to move that date. */
export async function joinedInsights(date: Day) {
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), 'K7QF4'));
  const storage = teacher.asSpec();
  function Harness({ day }: { readonly day: Day }) {
    const open = { world: 'K7QF4', kind: 'teachers', date: day, book, starter: null } as const;
    const insights = useWorldInsights({
      open,
      calendars: [calendar],
      school: null,
      kit: nodeKit,
      reference,
      storage,
      send,
      date: '',
      dayText: String,
    });
    return insights.page ?? insights.row;
  }
  await ReactTestRenderer.act(async () => {
    harness.tree = ReactTestRenderer.create(<Harness day={date} />);
    await settle();
  });
  await press('world-insights-open');
  return async (day: Day) => {
    await ReactTestRenderer.act(async () => {
      harness.tree!.update(<Harness day={day} />);
      await settle();
    });
    await turns();
  };
}

export const links = () =>
  harness.tree!.root.findAll(
    (node) => typeof node.type === 'string' && String(node.props.testID).startsWith('insights-compare-open-'),
  );
