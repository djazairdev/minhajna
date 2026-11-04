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

import { addDays, compareDays, directorateSpace, NATIONAL_COMMITTEE, worldExams, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { calendar, exam, reference } from '../jest/world-calendar';
import { bem, items, mock, onDay, pack, pageOf, putShares, SCOPE, server, started } from '../jest/committee-page';
import { act, alerts, controls, press, quoted, show, texts, unmount, update } from '../jest/threshold-page';
import { nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { subjectName } from '../src/extra/extra-rules';
import { gradeName } from '../src/setup/names';
import { i18n } from '../src/text/i18n';
import { castVote } from '../src/threshold/committee-session';
import { examName } from '../src/threshold/threshold-text';
import { seededWorld } from '../src/director/director-world';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.committee;
const page = ar.demo.threshold;
const day = mock.figuresDay;
const { terms } = reference.calendar.year;
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
  expect(all).toContain(line(page.setter.cut, { name: seat(1), item: title(1), day: `day ${day}` }));
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
  expect(texts()).toContain(line(page.setter.none, { name: seat(1), day: `day ${day}` }));
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
  expect(texts()).toContain(line(page.setter.none, { name: seat(1), day: `day ${day}` }));
  await press('committee-subjects-french');
  const all = texts();
  expect(all).toContain(words.notYet);
  expect(all).toContain(line(page.setter.waiting, { name: seat(1) }));
  expect(all.filter((text) => text === fill(words.noneDone, { seat: seat(1) }))).toEqual([]);
});

test('a term end with totals before the figures day shows as comparison', async () => {
  const late = bem.figuresDay;
  const { id, held } = await opened(late);
  const end = terms[1].to;
  expect(compareDays(end, late)).toBeLessThan(0);
  putShares(id, late, { [items[0]]: 10, [items[1]]: 10 });
  putShares(id, end, { [items[0]]: 5 });
  await show(pageOf(held, id, late, server.send, { level: 'national', scope: NATIONAL_COMMITTEE }));
  const all = texts();
  expect(all).toContain(fill(words.chartEnds, { day: `day ${late}` }));
  expect(all).toContain(fill(words.series.figures, { day: `day ${late}` }));
  expect(all).toContain(fill(words.series.termEnd, { day: `day ${end}` }));
});

test('no item every class reached is said, and only the level’s exams are offered', async () => {
  const { id, held } = await opened(day, { [items[0]]: 9 });
  await show(pageOf(held, id, day));
  expect(texts()).toContain(words.marks.everyNone);
  expect(texts()).toContain(fill(words.marks.ninety, { item: title(0) }));
  await unmount();
  const late = bem.figuresDay;
  onDay(id, late);
  await show(pageOf(held, id, late));
  expect(controls('committee-exams-bem')).toHaveLength(0);
  expect(texts()).toContain(
    fill(page.head, {
      exam: page.exams.mock,
      subject: subjectName(reference.profile, 'math'),
      grade: gradeName(reference.profile, '4am'),
    }),
  );
  await unmount();
  await show(pageOf(held, id, late, server.send, { level: 'national', scope: NATIONAL_COMMITTEE }));
  expect(texts()).toContain(
    fill(page.head, {
      exam: page.exams.bem,
      subject: subjectName(reference.profile, 'math'),
      grade: gradeName(reference.profile, '4am'),
    }),
  );
  expect(controls('committee-exams-mock')).toHaveLength(0);
  expect(texts()).toContain(fill(words.majority, { majority: 3, seats: 5 }));
});

test('the exams and grades are chips, the latest exam first chosen, and a choice opens its room', async () => {
  const entries = calendar.entries.map((one) => (one.id === exam.id ? { ...exam, grades: ['3am', '4am'] } : one));
  const made = { ...reference, calendar: { ...calendar, entries } };
  const school = worldExams(calendar.year, entries).filter((one) => one.setBy === 'school');
  const [first] = school;
  const last = school.filter((one) => compareDays(one.figuresDay, day) <= 0).at(-1)!;
  expect(first.grades).toEqual(expect.arrayContaining(['3am', '4am']));
  const held = await started();
  onDay(held.world, day);
  const pinned = { id: pack.id, release: pack.release };
  const classes = ['3am', '4am'].map((grade) => ({ grade, packs: { math: pinned } }));
  const more = { level: 'school', reference: made, schools: [{ classes }] } as never;
  await show(pageOf(held, held.world, day, server.send, more));
  const chips = (testID: string) => (controls(testID)[0].props as { selected?: boolean }).selected;
  expect(chips(`committee-exams-${last.id}`)).toBe(true);
  await press(`committee-exams-${first.id}`);
  expect(chips(`committee-exams-${first.id}`)).toBe(true);
  expect(chips('committee-grades-3am')).toBe(true);
  const head = (grade: string) =>
    fill(page.head, {
      exam: examName(i18n.t, first.id),
      subject: subjectName(reference.profile, 'math'),
      grade: gradeName(reference.profile, grade),
    });
  expect(texts()).toContain(head('3am'));
  await press('committee-grades-4am');
  expect(texts()).toContain(head('4am'));
  expect(texts()).not.toContain(head('3am'));
});

test('what was said and a refusal hold for their date', async () => {
  const { id, held } = await opened();
  await show(pageOf(held, id, day));
  await press('committee-none');
  const done = fill(words.noneDone, { seat: seat(1) });
  expect(texts()).toContain(done);
  const next = addDays(day, 1);
  onDay(id, next);
  await update(pageOf(held, id, next));
  expect(texts()).not.toContain(done);
  await press('committee-seats-1');
  const room = {
    name: { world: id, scope: SCOPE, exam: 'mock', subject: 'math', grade: '4am' },
    items,
    days: { from: day, to: mock.signBy },
  };
  await castVote(held, room, 2, null, next, nodeKit, server.send);
  await press('committee-propose');
  await press('committee-item', 0);
  await press('committee-propose-sign');
  expect(alerts()).toEqual([words.closed]);
  const later = addDays(day, 2);
  onDay(id, later);
  await update(pageOf(held, id, later));
  expect(alerts()).toEqual([]);
});

test('a slower answer of another room is dropped', async () => {
  const fresh = await opened();
  let release = () => undefined as void;
  let holding = false;
  const slow: Send = async (request) => {
    if (holding && request.path.includes('/spaces/')) {
      holding = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return server.send(request);
  };
  await show(pageOf(fresh.held, fresh.id, day, slow));
  const vote = {
    name: { world: fresh.id, scope: SCOPE, exam: 'mock', subject: 'math', grade: '4am' },
    items,
    days: { from: day, to: mock.signBy },
  };
  await castVote(fresh.held, vote, 0, items[1], day, nodeKit, server.send);
  holding = true;
  const next = addDays(day, 1);
  onDay(fresh.id, next);
  await update(pageOf(fresh.held, fresh.id, next, slow));
  expect(holding).toBe(false);
  await press('committee-subjects-french');
  release();
  await act();
  expect(texts()).toContain(line(page.setter.waiting, { name: seat(1) }));
  expect(texts()).not.toContain(line(page.setter.cut, { name: seat(1), item: title(1), day: `day ${day}` }));
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
