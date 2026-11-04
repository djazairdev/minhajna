// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Totals' curriculum report (#599, answers 539, 549 and 630): the nation's
// report, each subject with its range across the wilayas when at least 8 show
// their figure for it, from the lowest average to the highest and the middle
// half, never naming a wilaya, and otherwise a line that the range waits for 8
// wilayas, as for a subject only some of them show; the range itself counts
// only the wilayas shown that hold a class, and takes the middle half at the
// nearest ranks below and above. Every world, wilaya figure and share is made
// up.

import { RANGE_WILAYAS } from '@minhajna/core';
import { Platform } from 'react-native';
import { dayTotals } from '../../server/src/totals/share-sums';
import { press, texts, unmount } from '../jest/grant-page';
import { ministryPage, put, putShare, row, server, shares, subject, world } from '../jest/totals-page';
import { reference } from '../jest/world-calendar';
import { seededWorld } from '../src/director/director-world';
import type { DirectorateFigures, MinistryFigures } from '../src/directorate/totals-read';
import { reportRange } from '../src/ministry/report-range';
import { leaveWorldNetwork } from '../src/network/world-network';
import { localized } from '../src/setup/names';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryTotals;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const said = (template: string, values: Record<string, number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replace(`{{${key}}}`, String(value)), template);

test('each subject shows its range across the wilayas from 8 of them, and waits for 8 otherwise', async () => {
  const { id, days } = await world();
  const day = days[1];
  const demo = seededWorld(id, reference);
  const ids = [...new Set(demo.schools.map((one) => one.directorateId))];
  put(id, day, ids);
  for (const directorate of ids)
    for (let at = 0; at < 3; at += 1) putShare(id, day, directorate, { physics: subject(4) });
  for (const directorate of ids.slice(0, 5))
    for (let at = 0; at < 3; at += 1) putShare(id, day, directorate, { history: subject(30) });
  for (const [at, directorate] of ids.slice(3, 6).entries())
    putShare(id, day, directorate, { math: { ...subject(3), reached: 1200 + 1000 * (at + 1) } });
  const view = dayTotals(day, shares(id, day), null);
  const figures: MinistryFigures = {
    directorates: view.directorates.map((one) => [one.id, asFigures(one)]),
    national: asFigures(view.national!),
  };
  await ministryPage(id, day);
  await press('totals-tab-report');
  expect(texts()).toContain(words.reportLead);
  const shown = Object.entries(view.national!.subjects).filter(([, figure]) => figure !== null);
  const lines = shown.map(([code]) => [code, reportRange(figures, code)] as const);
  expect(lines.some(([, range]) => range !== null)).toBe(true);
  expect(lines.some(([, range]) => range === null)).toBe(true);
  const history = view.directorates.filter((one) => (one.subjects['history']?.classes ?? 0) > 0);
  expect(history.length).toBeGreaterThan(0);
  expect(history.length).toBeLessThan(RANGE_WILAYAS);
  expect(lines).toContainEqual(['history', null]);
  const math = lines.find(([code]) => code === 'math')?.[1];
  expect(math !== null && math !== undefined && math.low < math.high).toBe(true);
  for (const [code, range] of lines)
    expect(row(`report-${code}-more`)).toEqual([range === null ? words.noRange : said(words.range, { ...range })]);
  const all = texts().join(' ');
  for (const zone of reference.profile.zones ?? []) expect(all).not.toContain(localized(zone.name));
}, 60_000);

/** The server's figures in the reader's shape. */
function asFigures(one: { subjects: Record<string, unknown>; all: unknown }): DirectorateFigures {
  const figure = (value: unknown) =>
    value === null ? null : { ...(value as object), items: Object.entries((value as { items?: object }).items ?? {}) };
  return {
    subjects: Object.entries(one.subjects).map(([code, value]) => [code, figure(value)]),
    all: figure(one.all),
  } as DirectorateFigures;
}

const wilayas = (averages: readonly (number | null)[]): MinistryFigures => {
  const figure = (average: number | null) =>
    average === null
      ? null
      : {
          teachers: 12,
          schools: 4,
          vacantPosts: 0,
          hoursWithoutTeacher: 0,
          classes: average < 0 ? 0 : 2,
          cover: 0,
          closed: 0,
          reached: average < 0 ? 0 : average * 20,
          runLong: 0,
          items: [],
          grades: [],
        };
  const own = (average: number | null): DirectorateFigures => ({ subjects: [['math', figure(average)]], all: null });
  return { directorates: averages.map((one, at) => [`d${at}`, own(one)]), national: own(50) };
};

test('the range takes the lowest, the highest and the middle half, of 8 wilayas or more', () => {
  expect(RANGE_WILAYAS).toBe(8);
  expect(reportRange(wilayas([40, 10, 80, 30, 70, 20, 60, 50]), 'math')).toEqual({
    low: 10,
    high: 80,
    middleLow: 20,
    middleHigh: 70,
  });
  expect(reportRange(wilayas([10, 20, 30, 40, 50, 60, 70, 80, 90]), 'math')).toEqual({
    low: 10,
    high: 90,
    middleLow: 30,
    middleHigh: 70,
  });
  expect(reportRange(wilayas([10, 20, 30, 40, 50, 60, 70, null, -1]), 'math')).toBeNull();
  expect(reportRange(wilayas([10, 20, 30, 40, 50, 60, 70, 80]), 'french')).toBeNull();
});
