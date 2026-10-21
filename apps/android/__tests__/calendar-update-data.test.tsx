// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData } from '../jest/app-data';
import { useAppData, type AppData } from '../src/storage/AppData';
import { coreContext } from '../src/storage/core-context';

const applied = (release: string, removed: string): RecordEvent => ({
  kind: 'calendar.updated',
  applied: {
    update: {
      country: 'dz',
      year: '2026-2027',
      release,
      published: parseDay('2026-10-13'),
      entries: [],
      removed: [removed],
    },
    key: 'example-ministry',
    file: '{}',
  },
});

test('every screen gets the calendar with the applied updates after the bundled release, and that release', async () => {
  const data = await openTestData();
  expect(data.calendarRelease).toBe('2026.4');
  await data.book.recordAll(parseDay('2026-10-14'), [
    applied('2026.5', 'spring-holidays'),
    applied('2026.2', 'autumn-holidays'),
  ]);
  let seen: AppData | undefined;
  function Probe() {
    seen = useAppData();
    return null;
  }
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(withData(data, <Probe />));
    await Promise.resolve();
  });
  const ids = (seen?.calendar ?? []).map((entry) => entry.id);
  expect(ids).not.toContain('spring-holidays');
  expect(ids).toContain('autumn-holidays');
  expect(seen?.calendarRelease).toBe('2026.4');
  expect(seen?.updatedIds).toEqual(['spring-holidays']);
  const context = coreContext(seen!);
  expect(context.ref.calendar.map((entry) => entry.id)).toEqual(ids);
  expect(context.ref.calendarRelease).toBe('2026.4');
  await ReactTestRenderer.act(() => tree?.unmount());
});
