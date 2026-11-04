// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's page on the workspace's PC (#604, M-Threshold, answer 638),
// against a made-up demo server: before the figures day it says none has come
// and without the keys it says so and reads nothing; on the day it shows the
// exam's days, the totals, an item under the floors held back, the marks and
// the closures, the seats waiting, how many adopt and who sees the cut, and
// never asks for the first term's end; a seat proposes, another signs and the
// cut is adopted, final, with nothing left to sign, then published after the
// exam; a majority of no cut is adopted too, with nothing to publish; after the
// deadline with no majority no cut was adopted and nothing can be signed or is
// published; totals not added up or hidden say so; another subject opens its
// own room. Every world, school and share is made up.

import { addDays } from '@minhajna/core';
import { Platform } from 'react-native';
import {
  day,
  fill,
  items,
  mock,
  onDay,
  opened,
  page,
  pageOf,
  putShares,
  seat,
  server,
  started,
  title,
  words,
} from '../jest/committee-page';
import { controls, press, show, texts, unmount, update } from '../jest/threshold-page';
import { reference } from '../jest/world-calendar';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const { terms } = reference.calendar.year;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('before the figures day it says none has come, and without the keys it says so', async () => {
  const held = await started();
  const before = addDays(day, -1);
  await show(pageOf(held, held.world, before));
  expect(texts()).toContain(words.none);
  expect(controls('committee-none')).toHaveLength(0);
  await unmount();
  const asked: string[] = [];
  const counting: Send = (request) => {
    asked.push(request.path);
    return server.send(request);
  };
  await show(pageOf(null, held.world, day, counting));
  expect(texts()).toContain(words.keys);
  expect(asked).toEqual([]);
  expect(controls('committee-none')).toHaveLength(0);
});

test('it shows the exam’s days, the totals with a term end, the marks, the closures and the seats', async () => {
  const { id, held } = await opened();
  const asked: string[] = [];
  const counting: Send = (request) => {
    asked.push(request.path);
    return server.send(request);
  };
  await show(pageOf(held, id, day, counting));
  const all = texts();
  expect(all).toContain('A made-up lead');
  expect(all).toContain(
    fill(words.dates, { figures: `day ${day}`, signBy: `day ${mock.signBy}`, from: `day ${mock.from}` }),
  );
  expect(all).toContain(fill(words.counts, { teachers: 8, classes: 40, schools: 4 }));
  expect(all).toContain(fill(words.chart, { day: `day ${day}` }));
  expect(all).toContain(fill(words.series.figures, { day: `day ${day}` }));
  expect(all.some((text) => text === fill(words.series.termEnd, { day: `day ${terms[0].to}` }))).toBe(false);
  expect(asked.some((path) => path.includes(terms[0].to))).toBe(false);
  expect(all).toContain(fill(words.marks.every, { item: title(0) }));
  expect(all).toContain(fill(words.marks.ninety, { item: title(1) }));
  expect(all).toContain(fill(words.marks.half, { item: title(2) }));
  expect(all).toContain(fill(words.closures, { count: 12 }));
  expect(all).toContain(page.state.none);
  for (const n of [1, 2, 3]) expect(all).toContain(fill(page.setter.waiting, { name: seat(n) }));
  expect(all).toContain(fill(words.majority, { majority: 2, seats: 3 }));
  expect(all).toContain(words.sees);
  expect(all).toContain(fill(words.publishes, { to: `day ${mock.to}`, figures: `day ${day}` }));
  for (const note of Object.values(words.notes)) expect(all).toContain(note);
});

test('a term end not added up is left out, and an item under the floors is held back', async () => {
  const hidden = (school: number) => ({ [items[0]]: 10, ...(school < 2 ? { [items[1]]: 10 } : {}) });
  const { id, held } = await opened(day, hidden);
  await show(pageOf(held, id, day));
  const all = texts();
  expect(all.filter((text) => text.startsWith(fill(words.series.termEnd, { day: '' }).slice(0, 8)))).toEqual([]);
  expect(all).toContain(fill(words.chart, { day: `day ${day}` }));
  expect(all).toContain(fill(words.series.figures, { day: `day ${day}` }));
  expect(all).toContain(ar.chart.heldBack);
  expect(all).toContain(fill(words.marks.every, { item: title(0) }));
  expect(all).not.toContain(fill(words.marks.every, { item: title(1) }));
  expect(all).not.toContain(fill(words.marks.half, { item: title(1) }));
});

test('a seat proposes, another signs, and the first majority is adopted and final', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  expect(controls('committee-sign')).toHaveLength(0);
  expect((controls('committee-propose')[0].props as { label: string }).label).toBe(page.propose);
  await press('committee-propose');
  expect((controls('committee-propose-sign')[0].props as { disabled?: boolean }).disabled).toBe(true);
  await press('committee-item', 1);
  await press('committee-propose-sign');
  let all = texts();
  expect(all).toContain(fill(words.done, { seat: seat(1), item: title(1) }));
  expect(all).toContain(fill(words.state.proposed, { item: title(1), count: 1, seats: 3 }));
  expect(all).toContain(fill(page.setter.cut, { name: seat(1), item: title(1), day: `day ${day}` }));
  expect(controls('committee-sign')).toHaveLength(0);
  expect((controls('committee-propose')[0].props as { label: string }).label).toBe(page.proposeOther);
  await press('committee-seats-1');
  const sign = controls('committee-sign')[0].props as { label: string; name: string };
  expect(sign.label).toBe(fill(page.sign, { item: title(1) }));
  expect(sign.name).toBe(`${sign.label}${ar.chart.colon}${seat(2)}`);
  await press('committee-sign');
  all = texts();
  expect(all).toContain(fill(words.done, { seat: seat(2), item: title(1) }));
  expect(all).toContain(fill(words.state.adopted, { day: `day ${day}`, count: 2, seats: 3, item: title(1) }));
  expect(controls('committee-propose')).toHaveLength(0);
  expect(controls('committee-none')).toHaveLength(0);
  expect(all).toContain(words.sees);
  const ended = addDays(mock.to, 1);
  onDay(id, ended);
  await update(pageOf(held, id, ended));
  expect(texts()).toContain(fill(words.published, { to: `day ${mock.to}`, figures: `day ${day}` }));
  expect(texts()).not.toContain(words.sees);
});

test('choosing another seat puts a pick aside, and a pick goes back', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  await press('committee-propose');
  await press('committee-item', 0);
  await press('committee-seats-2');
  expect(controls('committee-item')).toHaveLength(0);
  await press('committee-propose');
  expect((controls('committee-propose-sign')[0].props as { disabled?: boolean }).disabled).toBe(true);
  await press('committee-pick-back');
  expect(controls('committee-item')).toHaveLength(0);
  expect(controls('committee-none')).toHaveLength(1);
});

test('a majority of no cut is adopted', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  await press('committee-none');
  expect(texts()).toContain(fill(words.noneDone, { seat: seat(1) }));
  expect(texts()).toContain(fill(page.setter.none, { name: seat(1), day: `day ${day}` }));
  await press('committee-seats-2');
  await press('committee-none');
  const all = texts();
  expect(all).toContain(fill(words.state.adoptedNone, { day: `day ${day}`, count: 2, seats: 3 }));
  expect(controls('committee-none')).toHaveLength(0);
  expect(all).not.toContain(words.sees);
  expect(all).not.toContain(fill(words.publishes, { to: `day ${mock.to}`, figures: `day ${day}` }));
});

test('after the deadline with no majority no cut was adopted, nothing is signed and nothing is published', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  await press('committee-propose');
  await press('committee-item', 2);
  await press('committee-propose-sign');
  const late = addDays(mock.signBy, 1);
  onDay(id, late);
  await update(pageOf(held, id, late));
  expect(texts()).toContain(words.state.lapsed);
  expect(controls('committee-none')).toHaveLength(0);
  expect(texts()).not.toContain(words.sees);
  const ended = addDays(mock.to, 1);
  onDay(id, ended);
  await update(pageOf(held, id, ended));
  expect(texts()).toContain(words.state.lapsed);
  expect(texts()).not.toContain(fill(words.published, { to: `day ${mock.to}`, figures: `day ${day}` }));
});

test('totals not added up or hidden say so, and the committee still stands', async () => {
  const held = await started();
  onDay(held.world, day);
  await show(pageOf(held, held.world, day));
  expect(texts()).toContain(words.notYet);
  expect(controls('committee-none')).toHaveLength(1);
  await unmount();
  putShares(held.world, day, { [items[0]]: 10 }, { teachers: 1 });
  await show(pageOf(held, held.world, day));
  expect(texts()).toContain(words.hidden);
});

test('another subject opens its own room and its own figures', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  await press('committee-none');
  expect(texts()).toContain(fill(page.setter.none, { name: seat(1), day: `day ${day}` }));
  await press('committee-subjects-french');
  const all = texts();
  expect(all).toContain(words.notYet);
  expect(all).toContain(fill(page.setter.waiting, { name: seat(1) }));
  expect(all.filter((text) => text === fill(words.noneDone, { seat: seat(1) }))).toEqual([]);
});
