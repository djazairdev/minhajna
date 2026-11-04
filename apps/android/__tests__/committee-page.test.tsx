// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's page on the workspace's PC (#604, M-Threshold, answer 638),
// against a made-up demo server: before the figures day it says none has come
// and without the keys it says so and reads nothing; on the day it shows the
// exam's days, the totals with the term end as comparison, a hidden item held
// back, the marks and the closures, the seats waiting, how many adopt and who
// sees the cut; a seat proposes, another signs and the cut is adopted, final,
// with nothing left to sign; a majority of no cut is adopted too; after the
// deadline with no majority no cut was adopted and nothing can be signed, after
// the exam it says the cut is published; totals not added up or hidden say so;
// another subject opens its own room; a problem reading is said with a way to
// read again, and a vote refused as a majority came in says why. Every world,
// school and share is made up.

import { addDays, compareDays, directorateSpace, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { announced, bem, items, mock, onDay, pack, pageOf, putShares, server, started } from '../jest/committee-page';
import { alerts, controls, press, quoted, show, texts, unmount, update } from '../jest/threshold-page';
import { reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { castVote } from '../src/threshold/committee-session';
import { seededWorld } from '../src/director/director-world';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.committee;
const page = ar.demo.threshold;
const day = mock.figuresDay;
const fill = (text: string, values: Record<string, unknown>) =>
  Object.entries(values).reduce((all, [key, value]) => all.replaceAll(`{{${key}}}`, String(value)), text);
const title = (at: number) => quoted(pack.items[at].title);
const seat = (n: number) => fill(words.seat, { n });
const line = (cut: string, values: Record<string, unknown>) => fill(cut, values);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

async function opened(
  date: Day = day,
  counts: Parameters<typeof putShares>[2] = { [items[0]]: 10, [items[1]]: 9, [items[2]]: 5 },
) {
  const held = await started();
  onDay(held.world, date);
  putShares(held.world, day, counts);
  return { held, id: held.world };
}

test('before the figures day it says none has come, and without the keys it says so', async () => {
  const held = await started();
  const before = addDays(day, -1);
  await show(pageOf(held, held.world, before));
  expect(texts()).toContain(words.none);
  expect(controls('committee-sign')).toHaveLength(0);
  expect(texts()).not.toContain(bem.id);
  await unmount();
  const asked: string[] = [];
  const counting: Send = (request) => {
    asked.push(request.path);
    return server.send(request);
  };
  await show(pageOf(null, held.world, day, counting));
  expect(texts()).toContain(words.keys);
  expect(asked.filter((path) => path.includes('/spaces/'))).toEqual([]);
  expect(controls('committee-none')).toHaveLength(0);
});

test('it shows the exam’s days, the totals with a term end, the marks, the closures and the seats', async () => {
  const { id, held } = await opened();
  const end = reference.calendar.year.terms
    .map((one) => one.to)
    .filter((one) => compareDays(one, day) < 0)
    .at(-1)!;
  announced(id, end);
  putShares(id, end, { [items[0]]: 5 });
  await show(pageOf(held, id, day));
  const all = texts();
  expect(all).toContain('A made-up lead');
  expect(all).toContain(
    fill(words.dates, { figures: `day ${day}`, signBy: `day ${mock.signBy}`, from: `day ${mock.from}` }),
  );
  expect(all).toContain(fill(words.counts, { teachers: 8, classes: 40, schools: 4 }));
  expect(all).toContain(fill(words.chart, { day: `day ${day}` }));
  expect(all).toContain(fill(words.series.figures, { day: `day ${day}` }));
  expect(all).toContain(fill(words.series.termEnd, { day: `day ${end}` }));
  expect(all).toContain(fill(words.marks.every, { item: title(0) }));
  expect(all).toContain(fill(words.marks.ninety, { item: title(1) }));
  expect(all).toContain(fill(words.marks.half, { item: title(2) }));
  expect(all).toContain(fill(words.closures, { count: 12 }));
  expect(all).toContain(page.state.none);
  for (const n of [1, 2, 3]) expect(all).toContain(line(page.setter.waiting, { name: seat(n) }));
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
  expect(all).toContain(line(page.setter.cut, { name: seat(1), item: title(1), day: `day ${day}` }));
  expect(controls('committee-sign')).toHaveLength(0);
  expect((controls('committee-propose')[0].props as { label: string }).label).toBe(page.proposeOther);
  await press('committee-seats-1');
  expect((controls('committee-sign')[0].props as { label: string }).label).toBe(fill(page.sign, { item: title(1) }));
  await press('committee-sign');
  all = texts();
  expect(all).toContain(fill(words.done, { seat: seat(2), item: title(1) }));
  expect(all).toContain(fill(words.state.adopted, { day: `day ${day}`, count: 2, seats: 3, item: title(1) }));
  expect(controls('committee-propose')).toHaveLength(0);
  expect(controls('committee-none')).toHaveLength(0);
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
  expect(texts()).toContain(line(page.setter.none, { name: seat(1), day: `day ${day}` }));
  await press('committee-seats-2');
  await press('committee-none');
  expect(texts()).toContain(fill(words.state.adoptedNone, { day: `day ${day}`, count: 2, seats: 3 }));
  expect(controls('committee-none')).toHaveLength(0);
});

test('after the deadline with no majority no cut was adopted, and after the exam it is published', async () => {
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
  expect(texts()).toContain(words.sees);
  const ended = addDays(mock.to, 1);
  onDay(id, ended);
  await update(pageOf(held, id, ended));
  expect(texts()).toContain(fill(words.published, { to: `day ${mock.to}`, figures: `day ${day}` }));
  expect(texts()).not.toContain(words.sees);
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
  expect(texts()).toContain(line(page.setter.none, { name: seat(1), day: `day ${day}` }));
  await press('committee-subjects-french');
  const all = texts();
  expect(all).toContain(words.notYet);
  expect(all).toContain(line(page.setter.waiting, { name: seat(1) }));
  expect(all.filter((text) => text === fill(words.noneDone, { seat: seat(1) }))).toEqual([]);
});

test('a problem reading is said with a way to read again', async () => {
  const { id, held } = await opened();
  let broken = true;
  const send: Send = (request) =>
    broken ? Promise.resolve({ status: 500, body: null, retryAfter: null }) : server.send(request);
  await show(pageOf(held, id, day, send));
  expect(alerts()).toHaveLength(1);
  expect(controls('committee-choices')).toHaveLength(0);
  broken = false;
  await press('committee-again');
  expect(alerts()).toEqual([]);
  expect(controls('committee-none')).toHaveLength(1);
});

test('a vote refused as a majority came in says why, and shows the cut adopted', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  const room = {
    name: { world: id, scope: 'dir-1', exam: 'mock', subject: 'math', grade: '4am' },
    items,
    days: { from: day, to: mock.signBy },
  };
  await castVote(held, room, 1, items[0], day, nodeKit, server.send);
  await castVote(held, room, 2, items[0], day, nodeKit, server.send);
  await press('committee-none');
  expect(alerts()).toEqual([words.closed]);
  expect(texts()).toContain(fill(words.state.adopted, { day: `day ${day}`, count: 2, seats: 3, item: title(0) }));
  expect(controls('committee-none')).toHaveLength(0);
});

test('the directorate’s workspace opens its own committees over the world’s seeded schools', async () => {
  const held = await started();
  onDay(held.world, day);
  const school = seededWorld(held.world, reference).schools[0];
  const { directorateId: directorate } = school;
  const shown = workspacePage('directorate', 'thresholds', {
    open: { world: held.world, date: day },
    school,
    reference,
    bundled: reference,
    kit: nodeKit,
    send: server.send,
    dayText: (one: Day) => `day ${one}`,
    held,
    onCalendar: () => undefined,
  } as unknown as WorkspacePagesProps);
  await show(shown!);
  expect(texts()).toContain(words.lead);
  await press('committee-none');
  expect(texts()).toContain(line(page.setter.none, { name: seat(1), day: `day ${day}` }));
  const space = await directorateSpace(held.world, directorate, nodeKit.mac);
  const answer = await server.send({ method: 'GET', path: `/worlds/${held.world}/spaces/${space}/batches?after=0` });
  expect((answer.body as { batches: unknown[] }).batches).toHaveLength(1);
  expect(texts()).not.toContain(words.keys);
});
