// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's page beyond one room (#604, M-Threshold, answer 638), against a
// made-up demo server: a term end with totals shows as comparison; with no item
// every class reached it says so; only the level's exams are offered; the exams
// and grades are chips, the latest exam chosen at first, and a choice opens its
// room; what was said and a refusal hold for their date; a slower answer of
// another room is dropped; a problem reading is said with a way to read again,
// and a vote refused as a majority came in says why; the directorate's
// workspace opens its committees over the world's seeded schools. Every world,
// school and share is made up.

import { addDays, compareDays, directorateSpace, NATIONAL_COMMITTEE, worldExams, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import {
  bem,
  day,
  fill,
  items,
  mathRoom,
  onDay,
  opened,
  pack,
  page,
  pageOf,
  putShares,
  seat,
  server,
  started,
  title,
  words,
} from '../jest/committee-page';
import { act, alerts, controls, press, show, texts, unmount, update } from '../jest/threshold-page';
import { calendar, exam, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { subjectName } from '../src/extra/extra-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import { gradeName } from '../src/setup/names';
import { i18n } from '../src/text/i18n';
import { castVote } from '../src/threshold/committee-session';
import { examName } from '../src/threshold/threshold-text';

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
  const room = mathRoom(id);
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
  const vote = mathRoom(fresh.id);
  await castVote(fresh.held, vote, 0, items[1], day, nodeKit, server.send);
  holding = true;
  const next = addDays(day, 1);
  onDay(fresh.id, next);
  await update(pageOf(fresh.held, fresh.id, next, slow));
  expect(holding).toBe(false);
  await press('committee-subjects-french');
  release();
  await act();
  expect(texts()).toContain(fill(page.setter.waiting, { name: seat(1) }));
  expect(texts()).not.toContain(fill(page.setter.cut, { name: seat(1), item: title(1), day: `day ${day}` }));
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
  const room = mathRoom(id);
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
  expect(texts()).toContain(fill(page.setter.none, { name: seat(1), day: `day ${day}` }));
  const space = await directorateSpace(held.world, directorate, nodeKit.mac);
  const answer = await server.send({ method: 'GET', path: `/worlds/${held.world}/spaces/${space}/batches?after=0` });
  expect((answer.body as { batches: unknown[] }).batches).toHaveLength(1);
  expect(texts()).not.toContain(words.keys);
});
