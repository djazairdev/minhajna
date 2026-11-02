// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals on the directorate's PC (#598, answer 629), against a made-up demo
// server that adds shares up with the server's own sums: before an announced
// day it says totals wait for one; on one, with no share in, it says the day
// is not added up yet; with shares in, it shows what the system owes teachers
// by subject as the server's view gives it, a subject under the floor said as
// hidden and the row over every subject counting teachers at least, never the
// directorate's schools by name; the latest day reached is shown, another can
// be chosen, and a problem is said. The reader refuses an answer for another
// directorate. Every world, directorate and share is made up.

import { parseDay, type Day } from '@minhajna/core';
import { randomBytes } from 'node:crypto';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type TextProps } from 'react-native';
import type { Share } from '../../server/src/totals/share-read';
import { dayTotals } from '../../server/src/totals/share-sums';
import { press, rendered, show, texts, unmount } from '../jest/grant-page';
import { calendar } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { moveWorldDate, startWorld, type Send } from '../src/demo/world-session';
import { DirectorateTotals } from '../src/directorate/DirectorateTotals';
import { readTotals } from '../src/directorate/totals-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.totals;
const server = new DemoServer();
const OWN = 'dir-a';

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const subject = (teachers: number) => ({
  teachers,
  vacantPosts: 1,
  hoursWithoutTeacher: 3,
  classes: 4,
  cover: 2,
  closed: 5,
  reached: 1200,
  runLong: 1,
  items: { 'u1-2': { sessions: 6, merged: 0, skipped: 1, retaught: 0 } },
});

/** Puts made-up shares for a day: `schools` of each directorate with math and French, two with Arabic too. */
function put(world: string, day: Day, directorates: readonly string[], schools = 4) {
  for (const directorate of directorates) {
    for (let at = 0; at < schools; at += 1) {
      const id = randomBytes(32).toString('hex');
      const both = { math: subject(3), french: subject(4) };
      const subjects = at < 2 ? { arabic: subject(2), ...both } : both;
      server.shares.set(`${world}\n${day}\n${id}`, {
        format: 'minhajna/total-share/1',
        id,
        day,
        directorate,
        subjects,
      });
    }
  }
}

async function world(moves = 1) {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const days = [started.date];
  for (let at = 0; at < moves; at += 1)
    days.push(await moveWorldDate(started.keys.world, started.starter, days.at(-1)!, server.send));
  return { id: started.keys.world, days };
}

const page = (id: string, date: Day, send: Send = server.send) =>
  show(
    <LocaleDirContext.Provider value="rtl">
      <DirectorateTotals
        world={{ world: id, date }}
        school={{ directorateId: OWN }}
        wilaya="ولاية مختلقة"
        calendar={calendar}
        send={send}
        dayText={(day) => `day ${day}`}
        subjectName={(code) => `subject ${code}`}
      />
    </LocaleDirContext.Provider>,
  );

const row = (testID: string) =>
  rendered()
    .root.findByProps({ testID })
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

const shares = (id: string, day: Day) =>
  [...server.shares].filter(([key]) => key.startsWith(`${id}\n${day}\n`)).map(([, share]) => share as Share);

test('before an announced day it says totals wait for one, and on one with no share it says so', async () => {
  const { id, days } = await world();
  await page(id, days[0]);
  expect(texts()).toEqual(expect.arrayContaining([words.lead, words.none]));
  await page(id, days[1]);
  expect(texts()).toContain(words.notYet);
  expect(texts()).toContain(words.never);
}, 60_000);

test('the owed table shows the server’s view, a subject under the floor hidden and teachers at least', async () => {
  const { id, days } = await world();
  const day = days[1];
  put(id, day, [OWN, 'dir-b', 'dir-c']);
  const view = dayTotals(day, shares(id, day), OWN).directorates[0];
  expect(view.subjects.arabic).toBeNull();
  const shown = Object.entries(view.subjects).filter(([, figure]) => figure !== null);
  expect(shown.length).toBeGreaterThan(0);
  await page(id, day);
  const all = texts();
  expect(all).toEqual(expect.arrayContaining([words.owedLead, words.closures, words.never]));
  expect(row('owed-row-arabic')).toEqual(['subject arabic', words.hidden]);
  for (const [code, figure] of shown) {
    const { teachers, schools, cover, vacantPosts, hoursWithoutTeacher, closed } = figure!;
    const figures = [teachers, schools, cover, vacantPosts, hoursWithoutTeacher, closed].map(String);
    expect(row(`owed-row-${code}`)).toEqual([`subject ${code}`, ...figures]);
  }
  const over = view.all === null ? [words.hidden] : [words.atLeast.replace('{{figure}}', String(view.all.teachers))];
  expect(row('owed-all').slice(0, 2)).toEqual([words.all, ...over]);
  expect(all.join(' ')).toContain(`day ${day}`);
}, 60_000);

test('the latest day reached is shown, another can be chosen, and a problem is said', async () => {
  const { id, days } = await world(2);
  put(id, days[1], [OWN, 'dir-b', 'dir-c'], 4);
  await page(id, days[2]);
  expect(texts()).toContain(words.notYet);
  await press(`totals-day-${days[1]}`);
  expect(texts()).toContain(words.hidden);
  const failing: Send = () => Promise.resolve({ status: 500, body: null, retryAfter: null });
  await page(id, days[2], failing);
  expect(texts()).toContain(ar.demo.problem.other);
  expect(texts()).not.toContain(words.hidden);
}, 60_000);

test('the reader refuses an answer for another directorate, and takes a day not reached as none', async () => {
  const other: Send = () =>
    Promise.resolve({
      status: 200,
      body: { day: '2026-12-10', directorates: [{ id: 'dir-b', subjects: {}, all: null }] },
      retryAfter: null,
    });
  const day = parseDay('2026-12-10');
  await expect(readTotals('K7QF5', day, OWN, other)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
  const early: Send = () => Promise.resolve({ status: 422, body: { error: 'not reached' }, retryAfter: null });
  expect(await readTotals('K7QF5', day, OWN, early)).toBeNull();
});
