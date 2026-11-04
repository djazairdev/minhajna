// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What is published of a level's cuts (#606, N-Published, answer 640), against
// a made-up demo server: nothing before the day after the exam's last day; a
// cut with its day, the share of the classes that had reached it, the
// committee's words unchanged and the signatures of the seats that adopted it;
// no cut decided, and none adopted; the figures with the subject chosen, the
// share held back under the floors; the safeguards, what was not used; a moved
// exam's two dates and why; a problem said with a way to read again; and each
// workspace's page. Every world, school and share is made up.

import { addDays, NATIONAL_COMMITTEE, worldExams, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import {
  bem,
  day,
  fill,
  items,
  mathRoom,
  mock,
  onDay,
  opened,
  published,
  publishedOf,
  putShares,
  seat,
  server,
  started,
  title,
  words,
} from '../jest/committee-page';
import { alerts, controls, press, show, texts, textsIn, unmount } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { subjectName } from '../src/extra/extra-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { castVote, committeePlan, putWords } from '../src/threshold/committee-session';
import type { PublishedCutsProps } from '../src/threshold/PublishedCuts';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const after = addDays(mock.to, 1);
const written = (one: Day) => `day ${one}`;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('nothing is published until the day after the exam’s last day', async () => {
  const { held, id } = await opened(mock.to);
  await castVote(held, mathRoom(id), 0, items[1], day, nodeKit, server.send);
  await castVote(held, mathRoom(id), 1, items[1], day, nodeKit, server.send);
  await show(publishedOf(held, id, mock.to));
  const all = texts();
  expect(all).toContain(published.none);
  expect(all).toContain(published.level.directorate.lead);
  expect(all.some((text) => text.includes(title(1)))).toBe(false);
  await unmount();
  onDay(id, after);
  await show(publishedOf(held, id, after));
  expect(texts()).not.toContain(published.none);
  expect(textsIn('published-math')).toContain(fill(published.cut, { item: title(1), day: written(day) }));
});

test('a cut says its day, the classes that had reached it, the words unchanged and who signed', async () => {
  const { held, id } = await opened(after);
  const room = mathRoom(id);
  const next = addDays(day, 1);
  await castVote(held, room, 0, items[1], day, nodeKit, server.send);
  await castVote(held, room, 2, items[1], next, nodeKit, server.send);
  await show(publishedOf(held, id, after));
  let math = textsIn('published-math');
  expect(math).toContain(fill(published.cut, { item: title(1), day: written(next) }));
  expect(math).toContain(fill(published.share, { share: 90, day: written(day) }));
  expect(math).toContain(words.words.none);
  expect(math).toContain(fill(published.signed, { seat: seat(1), day: written(day) }));
  expect(math).toContain(fill(published.signed, { seat: seat(3), day: written(next) }));
  expect(math).toContain(fill(published.majority, { adopted: 2, seats: 3 }));
  await unmount();
  await putWords(held, room, 0, 'The text from unit 5, the questions up to unit 6.', after, nodeKit, server.send);
  await show(publishedOf(held, id, after));
  math = textsIn('published-math');
  expect(math).toContain('The text from unit 5, the questions up to unit 6.');
  expect(math).toContain(words.words.title);
  expect(math).not.toContain(words.words.none);
});

test('a committee that decided no cut says so, and one that adopted none that the paper was as usual', async () => {
  const { held, id } = await opened(after);
  const room = mathRoom(id);
  await castVote(held, room, 0, null, day, nodeKit, server.send);
  await castVote(held, room, 1, null, day, nodeKit, server.send);
  await show(publishedOf(held, id, after));
  const math = textsIn('published-math');
  expect(math).toContain(fill(published.noCut, { day: written(day) }));
  expect(math).not.toContain(words.words.none);
  expect(math.filter((text) => text.includes('%'))).toEqual([]);
  const french = textsIn('published-french');
  expect(french).toContain(published.noneAdopted);
  expect(french.filter((text) => text.includes(fill(words.seat, { n: 1 })))).toEqual([]);
});

test('the figures come with the subject chosen, and the safeguards and what was not used are said', async () => {
  const { held, id } = await opened(after);
  await show(publishedOf(held, id, after));
  expect(textsIn('published-figures')).toContain(fill(words.counts, { teachers: 8, classes: 40, schools: 4 }));
  expect(textsIn('published-figures')).toContain(
    fill(published.figures, { subject: subjectName(reference.profile, 'math') }),
  );
  expect(textsIn('published-figures')).toContain(fill(words.chart, { day: written(day) }));
  const all = texts();
  expect(all).toContain(fill(published.safeguards.announced, { figures: written(day) }));
  expect(all).toContain(published.safeguards.after);
  expect(all).toContain(published.safeguards.unchecked);
  for (const line of Object.values(published.unused)) expect(all).toContain(line);
  expect(all).toContain(words.level.directorate.floors);
  expect(all).toContain(
    fill(published.dates, { figures: written(day), from: written(mock.from), to: written(mock.to) }),
  );
  await press('published-subjects-french');
  expect(textsIn('published-figures')).toContain(words.notYet);
});

test('the share is held back under the floors', async () => {
  const held = await started();
  const id = held.world;
  onDay(id, after);
  putShares(id, day, { [items[1]]: 9 }, { teachers: 1 });
  await castVote(held, mathRoom(id), 0, items[1], day, nodeKit, server.send);
  await castVote(held, mathRoom(id), 1, items[1], day, nodeKit, server.send);
  await show(publishedOf(held, id, after));
  const math = textsIn('published-math');
  expect(math).toContain(fill(published.cut, { item: title(1), day: written(day) }));
  expect(math).toContain(published.shareHidden);
});

test('a single item held back holds back its share', async () => {
  const { held, id } = await opened(after);
  await castVote(held, mathRoom(id), 0, items[1], day, nodeKit, server.send);
  await castVote(held, mathRoom(id), 1, items[1], day, nodeKit, server.send);
  const grade = { teachers: 8, classes: 40, schools: 4, items: [[items[1], null]] };
  const read = () => Promise.resolve({ subjects: [['math', { closed: 0, grades: [['4am', grade]] }]] });
  await show(publishedOf(held, id, after, server.send, { read: read as unknown as PublishedCutsProps['read'] }));
  expect(textsIn('published-math')).toContain(published.shareHidden);
});

test('a grade with no plan says so', async () => {
  const { held, id } = await opened(after);
  await show(publishedOf(held, id, after, server.send, { schools: [] }));
  expect(texts()).toContain(words.noPlan);
});

test('a moved exam says both dates and why', async () => {
  const entries = calendar.entries.map((one) =>
    one.effect === 'exam' && one.term === 3 && one.zone === undefined
      ? {
          ...one,
          from: addDays(one.from, 7),
          to: addDays(one.to, 7),
          moved: { from: one.from, to: one.to, reason: 'A made-up reason' },
        }
      : one,
  );
  const moved = worldExams(calendar.year, entries).find((one) => one.id === 'mock')!;
  const held = await started();
  const date = addDays(moved.to, 1);
  const made = { ...reference, calendar: { ...calendar, entries } };
  const old = addDays(mock.to, 1);
  onDay(held.world, old);
  await show(publishedOf(held, held.world, old, server.send, { reference: made, updates: [] }));
  expect(texts()).toContain(published.none);
  await unmount();
  onDay(held.world, date);
  await show(publishedOf(held, held.world, date, server.send, { reference: made, updates: [] }));
  const all = texts();
  expect(all.some((text) => text.includes('A made-up reason'))).toBe(true);
  expect(all.some((text) => text.includes(written(mock.from)) && text.includes(written(moved.from)))).toBe(true);
  expect(all).not.toContain(ar.demo.thresholds.movedCalendar);
  expect(all).not.toContain(ar.demo.thresholds.movedFigures);
});

test('without the keys it says so, and a problem is said with a way to read again', async () => {
  const { held, id } = await opened(after);
  await show(publishedOf(null, id, after));
  expect(texts()).toContain(words.keys);
  expect(controls('published-subjects').length).toBe(0);
  await unmount();
  let broken = true;
  const send: Send = (request) =>
    broken ? Promise.resolve({ status: 500, body: null, retryAfter: null }) : server.send(request);
  await show(publishedOf(held, id, after, send));
  expect(alerts()).toHaveLength(1);
  broken = false;
  await press('published-again');
  expect(alerts().length).toBe(0);
  expect(textsIn('published-math')).toContain(published.noneAdopted);
});

test('each workspace opens its page, the Ministry’s on the national committees', async () => {
  const held = await started();
  const date = addDays(bem.to, 1);
  onDay(held.world, date);
  const { schools } = seededWorld(held.world, reference);
  const plan = committeePlan(schools, reference.packs, '4am', 'arabic')!;
  const room = {
    name: { world: held.world, scope: NATIONAL_COMMITTEE, exam: 'bem', subject: 'arabic', grade: '4am' },
    items: plan.items.map((one) => one.id),
    days: { from: bem.figuresDay, to: bem.signBy },
    lastDay: bem.to,
  };
  for (const place of [0, 1, 2]) await castVote(held, room, place, room.items[1], bem.figuresDay, nodeKit, server.send);
  onDay(held.world, bem.figuresDay);
  onDay(held.world, date);
  const wilayas = Array.from({ length: 8 }, (_, at) => `dir-${at + 1}`);
  const reached = (_school: number, directorate: string) => ({ [room.items[1]]: Number(directorate.slice(4)) });
  putShares(held.world, bem.figuresDay, reached, { subject: 'arabic', teachers: 3, directorates: wilayas });
  const props = {
    open: { world: held.world, date },
    school: schools[0],
    reference,
    bundled: reference,
    kit: nodeKit,
    send: server.send,
    dayText: written,
    held,
    onCalendar: () => undefined,
  } as unknown as WorkspacePagesProps;
  await show(workspacePage('ministry', 'published', props)!);
  expect(texts()).toContain(published.level.national.lead);
  const national = textsIn('published-arabic');
  expect(national.some((text) => text.includes(plan.items[1].title))).toBe(true);
  expect(national).toContain(fill(published.majority, { adopted: 3, seats: 5 }));
  expect(textsIn('published-figures')).toContain(words.range);
  expect(texts().some((text) => text.includes('dir-'))).toBe(false);
  expect(texts()).toContain(published.level.national.ranking);
  await unmount();
  await show(workspacePage('directorate', 'published', props)!);
  expect(texts()).toContain(published.level.directorate.lead);
  expect(texts()).toContain(published.level.directorate.ranking);
});
