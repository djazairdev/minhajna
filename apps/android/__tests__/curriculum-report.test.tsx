// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals' curriculum report (#598, R-7.9-06, answer 629), against a made-up
// demo server that adds shares up with the server's own sums: its tab shows,
// for each subject the directorate holds, the classes, how far they got on
// average and the plans running long, then each plan item's sessions and the
// classes that merged, skipped or re-taught it, as the server's view gives
// them, a hidden subject or item said as hidden, a subject with no item said
// so, an item named by the title the directorate's seeded classes' packs give
// it, in the packs' order; and the tab stays chosen as another day is. Every
// world, directorate and share is made up.

import { directorSchool } from '@minhajna/core';
import math from '@minhajna/data/dz/packs/dz.cem.1am.math.example@2026.1.json';
import { Platform } from 'react-native';
import { dayTotals } from '../../server/src/totals/share-sums';
import { press, rendered, texts, unmount } from '../jest/grant-page';
import { page, put, row, server, shares, world } from '../jest/totals-page';
import { reference } from '../jest/world-calendar';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { averageReached } from '../src/directorate/CurriculumReport';
import { itemNames } from '../src/directorate/item-names';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.totals;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('the report shows each subject’s classes and items as the server’s view gives them', async () => {
  const { id, days } = await world();
  const day = days[1];
  const demo = seededWorld(id, reference);
  const own = directorSchool(demo)!.directorateId;
  put(id, day, [own, 'dir-b', 'dir-c']);
  const view = dayTotals(day, shares(id, day), own).directorates[0];
  const shown = Object.entries(view.subjects).filter(([, figure]) => figure !== null);
  expect(shown.length).toBeGreaterThan(0);
  expect(view.subjects.arabic).toBeNull();
  const hiddenItems = shown.flatMap(([, figure]) => Object.values(figure!.items ?? {}).filter((one) => one === null));
  expect(hiddenItems.length).toBeGreaterThan(0);
  const names = itemNames(
    demo.schools.filter((one) => one.directorateId === own),
    reference.packs,
  );
  expect(names.title('math', 'u1-2')).toBe(math.items.find((one) => one.id === 'u1-2')!.title);
  await page(id, day, server.send, own);
  expect(texts()).not.toContain(words.reportLead);
  await press('totals-tab-report');
  expect(texts()).toContain(words.reportLead);
  expect(texts()).not.toContain(words.owedLead);
  for (const [code, figure] of Object.entries(view.subjects)) {
    if (figure === null) {
      expect(row(`report-${code}`)).toEqual([`subject ${code}`, words.hidden]);
      continue;
    }
    const line = words.reportLine
      .replace('{{classes}}', String(figure.classes))
      .replace('{{reached}}', String(averageReached(figure)))
      .replace('{{long}}', String(figure.runLong));
    expect(row(`report-${code}`).slice(0, 2)).toEqual([`subject ${code}`, line]);
    const items = Object.entries(figure.items ?? {});
    const order = names.sorted(code, items).map(([item]) => item);
    const rows = rendered().root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith(`report-${code}-`),
      { deep: false },
    );
    expect(rows.map((node) => node.props.testID as string)).toEqual(order.map((item) => `report-${code}-${item}`));
    const drawn = order.map((item) => row(`report-${code}-${item}`)[0]);
    expect(drawn).toEqual(order.map((item) => names.title(code, item) ?? item));
    for (const [item, one] of items) {
      const cells = row(`report-${code}-${item}`).slice(1);
      const expected =
        one === null ? [words.hidden] : [one.sessions, one.merged, one.skipped, one.retaught].map(String);
      expect(cells).toEqual(expected);
    }
  }
}, 60_000);

test('the report tab stays chosen as another day is chosen, and a subject with no item says so', async () => {
  const { id, days } = await world(2);
  const own = directorSchool(seededWorld(id, reference))!.directorateId;
  put(id, days[1], [own, 'dir-b', 'dir-c']);
  put(id, days[2], [own, 'dir-b', 'dir-c']);
  await page(id, days[2], server.send, own);
  await press('totals-tab-report');
  await press(`totals-day-${days[1]}`);
  expect(texts()).toContain(words.reportLead);
  expect(texts()).not.toContain(words.noItems);
  const bare = { teachers: 4, vacantPosts: 0, hoursWithoutTeacher: 0, classes: 2, cover: 0, closed: 0, reached: 0 };
  const empty: Send = (request) =>
    request.method !== 'GET'
      ? server.send(request)
      : Promise.resolve({
          status: 200,
          body: {
            day: days[1],
            directorates: [{ id: own, subjects: { math: { ...bare, schools: 3, runLong: 0, items: {} } }, all: null }],
          },
          retryAfter: null,
        });
  await page(id, days[2], empty, own);
  expect(texts()).toContain(words.reportLead);
  expect(texts()).toContain(words.noItems);
}, 60_000);

test('how far classes got is their average, in whole percent', () => {
  expect(averageReached({ reached: 1200, classes: 4 })).toBe(30);
  expect(averageReached({ reached: 1005, classes: 2 })).toBe(50);
  expect(averageReached({ reached: 1999, classes: 2 })).toBe(99);
  expect(averageReached({ reached: 0, classes: 0 })).toBe(0);
});
