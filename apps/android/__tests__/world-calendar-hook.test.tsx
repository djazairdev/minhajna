// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading the world's calendar (#608, answer 624), against a made-up demo
// server: a world whose national space was never opened holds the bundled
// calendar; a release signed with the world's key lies over it, while one
// signed with another key does not count; and the calendar is read again when
// the world's date moves or when asked, the last one read standing while a
// reading fails. Every world and entry is made up.

import { draftUpdate, EMPTY_DRAFT, parseDay, takeOutDraftEntry, type Day } from '@minhajna/core';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendar, exam, flakySend, moving, profile, publish, reference, strangerKeys } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { readWorldCalendar, useWorldCalendar, type HeldWorld } from '../src/demo/world-calendar-read';
import { startWorld, type Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';

const server = new DemoServer();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let failing = false;
const flaky = flakySend(server, () => failing);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  failing = false;
  leaveWorldNetwork();
  server.reset();
});

test('a world reads the releases its own key signed over the bundled calendar', async () => {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const held = { world: started.keys.world, keys: started.keys, sealing: started.sealing };
  const before = await readWorldCalendar(held, reference, nodeKit, server.send);
  expect(before).toEqual({ calendar, updates: [] });
  const update = moving();
  const next = await publish(server, { ...held, id: held.world, keys: await strangerKeys(started.keys) }, update);
  await publish(server, { id: held.world, keys: started.keys, sealing: started.sealing }, update, next);
  const after = await readWorldCalendar(held, reference, nodeKit, server.send);
  expect(after.updates).toEqual([update]);
  expect(after.calendar.release).toBe(update.release);
  expect(after.calendar.entries.find((one) => one.id === exam.id)).toMatchObject({ from: '2026-12-20' });
  expect(after.calendar.entries).toHaveLength(calendar.entries.length);
});

/** What the world's calendar hook gives, shown as text, its `again` handed out. */
function Probe(props: { held: HeldWorld; date: Day; send: Send; grab: (again: () => void) => void }) {
  const {
    read: found,
    problem,
    again,
  } = useWorldCalendar(props.held, props.date, calendar, reference, nodeKit, props.send);
  props.grab(again);
  return <Text testID="probe">{`${found?.calendar.release ?? 'none'} ${problem ?? 'fine'}`}</Text>;
}

test('the calendar is read again when the date moves or when asked, and stands while a reading fails', async () => {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const held = { world: started.keys.world, keys: started.keys, sealing: started.sealing };
  const probe = () => String(tree!.root.findByProps({ testID: 'probe' }).props.children);
  let again = () => undefined as void;
  const show = (date: string) =>
    ReactTestRenderer.act(async () => {
      const element = <Probe held={held} date={parseDay(date)} send={flaky} grab={(one) => (again = one)} />;
      if (tree === undefined) tree = ReactTestRenderer.create(element);
      else tree.update(element);
      await settle();
    });
  await show('2026-12-17');
  expect(probe()).toBe(`${calendar.release} fine`);
  const update = moving();
  const next = await publish(server, { id: held.world, keys: started.keys, sealing: started.sealing }, update);
  await show('2027-03-18');
  expect(probe()).toBe(`${update.release} fine`);
  const later = draftUpdate(
    takeOutDraftEntry(calendar.entries, EMPTY_DRAFT, 'term-1-exams'),
    profile,
    calendar.year,
    update.release,
    parseDay('2027-03-18'),
  );
  await publish(server, { id: held.world, keys: started.keys, sealing: started.sealing }, later, next);
  await ReactTestRenderer.act(async () => {
    again();
    await settle();
  });
  expect(probe()).toBe(`${later.release} fine`);
  failing = true;
  try {
    await show('2027-06-10');
    expect(probe()).toBe(`${later.release} demo.problem.other`);
  } finally {
    failing = false;
  }
});
