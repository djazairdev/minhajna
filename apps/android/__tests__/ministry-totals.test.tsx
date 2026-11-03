// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Totals on the Ministry's PC (#599, answers 539 and 630), against a made-up
// demo server that adds shares up with the server's own sums: what the system
// owes teachers shows a row for each wilaya, by its code and name, in the
// official order whatever its figures, a directorate no seeded school names
// after them by its ID, and a last row for the nation, each figure as the
// server's Ministry view gives it, a hidden one said as hidden; over every
// subject teachers are at least that many; the subjects offered are those the
// nation's figure shows, and one chosen shows its own figures, a wilaya under
// the wilaya floor hidden though its directorate sees it, and another day
// without it going back to every subject. The reader refuses a directorate
// without its ID or named twice, and takes a day with no share as none. Every
// world, wilaya figure and share is made up.

import { parseDay, type Zone } from '@minhajna/core';
import { Platform } from 'react-native';
import type { Total } from '../../server/src/totals/share-sums';
import { dayTotals } from '../../server/src/totals/share-sums';
import { press, rendered, texts, unmount } from '../jest/grant-page';
import { ministryPage, put, putShare, row, server, shares, subject, world } from '../jest/totals-page';
import { reference } from '../jest/world-calendar';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { readMinistryTotals } from '../src/directorate/totals-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import { localized } from '../src/setup/names';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryTotals;
const zones: readonly Zone[] = reference.profile.zones ?? [];

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const cells = (figure: Total | null, atLeast: boolean) =>
  figure === null
    ? [ar.demo.totals.hidden]
    : [
        atLeast ? ar.demo.totals.atLeast.replace('{{figure}}', String(figure.teachers)) : String(figure.teachers),
        ...[figure.schools, figure.cover, figure.vacantPosts, figure.hoursWithoutTeacher, figure.closed].map(String),
      ];

const order = () =>
  rendered()
    .root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('wilaya-row-'), {
      deep: false,
    })
    .map((node) => node.props.testID as string);

test('the wilayas come in their official order, then the nation, every figure as the server gives it', async () => {
  const { id, days } = await world();
  const day = days[1];
  const schools = seededWorld(id, reference).schools;
  const ids = [...new Set(schools.map((one) => one.directorateId))];
  put(id, day, [...[...ids].reverse(), 'dir-z']);
  for (let at = 0; at < 3; at += 1) putShare(id, day, 'dir-small', { math: subject(3) });
  putShare(id, day, 'dir-z', { physics: subject(2) });
  const view = dayTotals(day, shares(id, day), null);
  expect(dayTotals(day, shares(id, day), 'dir-small').directorates[0].subjects.math).not.toBeNull();
  expect(view.directorates.find((one) => one.id === 'dir-small')!.subjects.math).toBeNull();
  await ministryPage(id, day);
  expect(texts()).toEqual(expect.arrayContaining([words.lead, words.owedLead, words.closures, words.never]));
  const at = (directorate: string) => {
    const code = schools.find((one) => one.directorateId === directorate)!.wilaya;
    return zones.findIndex((zone) => zone.code === code);
  };
  const official = [...ids].sort((a, b) => at(a) - at(b));
  expect(order()).toEqual([...official, 'dir-small', 'dir-z', 'all'].map((one) => `wilaya-row-${one}`));
  for (const directorate of official) {
    const zone = zones[at(directorate)];
    const figure = view.directorates.find((one) => one.id === directorate)!.all;
    expect(row(`wilaya-row-${directorate}`)).toEqual([`${zone.code} ${localized(zone.name)}`, ...cells(figure, true)]);
  }
  const unnamed = view.directorates.find((one) => one.id === 'dir-z')!.all;
  expect(row('wilaya-row-dir-z')).toEqual(['dir-z', ...cells(unnamed, true)]);
  expect([view.national!.subjects.physics, view.national!.subjects.arabic]).toEqual([null, null]);
  const offered = Object.entries(view.national!.subjects).filter(([, figure]) => figure !== null);
  const chips = rendered().root.findAll(
    (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('totals-subject-'),
    { deep: false },
  );
  expect(chips.map((node) => node.props.testID as string)).toEqual(
    ['*', ...offered.map(([code]) => code)].map((one) => `totals-subject-${one}`),
  );
  expect(row('wilaya-row-all')).toEqual([words.nation, ...cells(view.national!.all, true)]);
  await press('totals-subject-math');
  for (const directorate of official) {
    const figure = view.directorates.find((one) => one.id === directorate)!.subjects.math;
    expect(row(`wilaya-row-${directorate}`).slice(1)).toEqual(cells(figure, false));
  }
  expect(row('wilaya-row-all').slice(1)).toEqual(cells(view.national!.subjects.math, false));
  expect(row('wilaya-row-dir-small').slice(1)).toEqual([ar.demo.totals.hidden]);
  for (const code of ['physics', 'arabic'])
    expect(rendered().root.findAll((node) => node.props.testID === `totals-subject-${code}`)).toHaveLength(0);
}, 60_000);

test('a subject chosen goes back to every subject on a day the nation does not hold it', async () => {
  const { id, days } = await world(2);
  const ids = [...new Set(seededWorld(id, reference).schools.map((one) => one.directorateId))];
  put(id, days[1], ids);
  put(id, days[2], ids);
  for (const [key, share] of server.shares) {
    const held = Object.entries((share as { subjects: Record<string, unknown> }).subjects);
    const subjects = Object.fromEntries(held.filter(([code]) => code !== 'french'));
    if (key.includes(`\n${days[2]}\n`)) server.shares.set(key, { ...(share as object), subjects });
  }
  await ministryPage(id, days[1]);
  await press('totals-subject-french');
  const french = dayTotals(days[1], shares(id, days[1]), null).national!.subjects.french!.teachers;
  expect(row('wilaya-row-all')[1]).toBe(String(french));
  await ministryPage(id, days[2]);
  expect(rendered().root.findAll((node) => node.props.testID === 'totals-subject-french')).toHaveLength(0);
  const teachers = dayTotals(days[2], shares(id, days[2]), null).national!.all!.teachers;
  expect(row('wilaya-row-all')[1]).toBe(ar.demo.totals.atLeast.replace('{{figure}}', String(teachers)));
}, 60_000);

test('the reader refuses a directorate without an ID or named twice, and takes an empty day as none', async () => {
  const day = parseDay('2026-12-10');
  const figures = { subjects: {}, all: null };
  const answer =
    (body: unknown): Send =>
    () =>
      Promise.resolve({ status: 200, body, retryAfter: null });
  const bad = answer({ day, directorates: [figures], national: figures });
  await expect(readMinistryTotals('K7QF5', day, bad)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  const empty = answer({ day, directorates: [{ id: '', ...figures }], national: figures });
  await expect(readMinistryTotals('K7QF5', day, empty)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  const twice = answer({
    day,
    directorates: [
      { id: 'a', ...figures },
      { id: 'a', ...figures },
    ],
    national: figures,
  });
  await expect(readMinistryTotals('K7QF5', day, twice)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  expect(await readMinistryTotals('K7QF5', day, answer({ day, directorates: [], national: figures }))).toBeNull();
  const early: Send = () => Promise.resolve({ status: 422, body: { error: 'not reached' }, retryAfter: null });
  expect(await readMinistryTotals('K7QF5', day, early)).toBeNull();
});
