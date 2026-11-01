// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's calendar page with publishing (#608, answer 624), over a
// made-up world on a made-up demo server: without the world's keys it offers no
// publishing; with them, a release put while the empty draft cannot be kept is
// still said and the world's calendar read again, the store's problem said
// beside it. Every world and entry is made up.

import { EMPTY_DRAFT, nextRelease, takeOutDraftEntry } from '@minhajna/core';
import { Platform } from 'react-native';
import { alerts, has, newBook, press, rendered, show, unmount } from '../jest/ministry-page';
import { calendar, exam, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startWorld } from '../src/demo/world-session';
import { MinistryCalendarPage } from '../src/ministry/MinistryCalendarPage';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const server = new DemoServer();
const words = ar.demo.ministryCalendar;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('without the keys nothing is offered, and a release put is said though the empty draft is not kept', async () => {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const held = { world: started.keys.world, keys: started.keys, sealing: started.sealing };
  const book = await newBook();
  await book.record(started.date, {
    kind: 'ministry.calendar',
    draft: takeOutDraftEntry(calendar.entries, EMPTY_DRAFT, exam.id),
  });
  const onPublished = jest.fn();
  const world = { world: held.world, book, date: started.date };
  const page = (keys: typeof held | null) => (
    <MinistryCalendarPage
      world={world}
      held={keys}
      reference={reference}
      kit={nodeKit}
      send={server.send}
      dayText={(day) => `day ${day}`}
      onPublished={onPublished}
    />
  );
  await show(page(null));
  expect(has('ministry-publish')).toBe(false);
  await show(page(held));
  jest.spyOn(book, 'record').mockRejectedValue(new Error('A made-up store failure'));
  await press('ministry-publish');
  await press('ministry-publish-yes');
  expect(onPublished).toHaveBeenCalledTimes(1);
  const said = String(rendered().root.findByProps({ testID: 'ministry-publish-said' }).props.children);
  expect(said).toBe(words.publish.done.replace('{{release}}', isolate(nextRelease(calendar.release))));
  expect(alerts()).toContain(words.publish.notEmptied);
});
