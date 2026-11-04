// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's thresholds (#605, N-Threshold, answer 639), against a made-up
// demo server: the national exam's committee of five, named as the page's
// viewer, on the national space; the nation's figures with each item's range
// across the wilayas in charts of their own, never naming one, only with 8
// wilayas shown, a held-back wilaya not counting; each subject's own committee
// on the general list with its signatures and never its cut, another subject
// reading nothing again; what was signed for a room not said in another; the
// first majority of the five adopts it; and the words of the national level,
// hidden totals saying its floor and a cut published to the public. Every
// world, school and share is made up.

import { addDays, NATIONAL_COMMITTEE, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { bem, fill, items, onDay, page, pageOf, putShares, seat, server, started, words } from '../jest/committee-page';
import { act, controls, press, show, texts, unmount, update } from '../jest/threshold-page';
import { reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import type { DirectorateFigures } from '../src/directorate/totals-read';
import { subjectName } from '../src/extra/extra-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import { wilayaRange } from '../src/threshold/committee-figures';
import { committeePlan } from '../src/threshold/committee-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const day = bem.figuresDay;
const national = words.level.national;
const wilayas = (count: number) => Array.from({ length: count }, (_, at) => `dir-${at + 1}`);
const SUBJECT = 'arabic';

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

async function opened(count: number) {
  const held = await started();
  onDay(held.world, day);
  const { schools } = seededWorld(held.world, reference);
  const items = committeePlan(schools, reference.packs, '4am', SUBJECT)!.items.map((one) => one.id);
  const reached = (_school: number, directorate: string) => ({
    [items[0]]: 10,
    [items[1]]: Number(directorate.slice(4)),
  });
  putShares(held.world, day, reached, { subject: SUBJECT, teachers: 3, directorates: wilayas(count) });
  const school = schools[0];
  const shown = workspacePage('ministry', 'thresholds', {
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
}

test('the nation’s figures show each item’s range across 8 wilayas, naming none', async () => {
  await opened(8);
  const all = texts();
  expect(all).toContain(national.lead);
  expect(all).toContain(national.floors);
  expect(all).toContain(national.sees);
  expect(all).toContain(fill(national.viewer, { subject: subjectName(reference.profile, SUBJECT) }));
  expect(all).toContain(fill(words.majority, { majority: 3, seats: 5 }));
  expect(all).toContain(words.range);
  for (const key of ['nation', 'low', 'middleLow', 'middleHigh', 'high'] as const)
    expect(all).toContain(words.series[key]);
  expect(all).toContain(fill(words.rangeChart.all, { day: `day ${day}` }));
  expect(all).toContain(fill(words.rangeChart.middle, { day: `day ${day}` }));
  expect(all.filter((text) => /dir-\d/u.test(text))).toEqual([]);
});

test('with fewer than 8 wilayas only the nation’s figures show', async () => {
  await opened(7);
  const all = texts();
  expect(all).toContain(words.noRange);
  expect(all).not.toContain(words.range);
  expect(all).not.toContain(words.series.low);
  expect(all).toContain(fill(words.series.figures, { day: `day ${day}` }));
});

test('a majority of five adopts, and the general list says each committee’s signatures, never its cut', async () => {
  await opened(8);
  const subject = subjectName(reference.profile, SUBJECT);
  const line = (status: string) => fill(words.statusLine, { subject, status });
  const lines = () => texts().filter((text) => text.startsWith(line('')));
  expect(lines()).toEqual([line(words.status.none)]);
  await press('committee-propose');
  const { label } = controls('committee-item')[1].props as { label: string };
  await press('committee-item', 1);
  await press('committee-propose-sign');
  expect(lines()).toEqual([line(fill(words.status.proposed, { count: 1, seats: 5 }))]);
  await press('committee-seats-2');
  await press('committee-sign');
  expect(lines()).toEqual([line(fill(words.status.proposed, { count: 2, seats: 5 }))]);
  expect(texts()).toContain(fill(page.setter.waiting, { name: seat(5) }));
  await press('committee-seats-4');
  await press('committee-sign');
  expect(lines()).toEqual([line(words.status.adopted)]);
  expect(controls('committee-none')).toHaveLength(0);
  expect(lines().some((text) => text.includes(label))).toBe(false);
  expect(texts().some((text) => text.includes(label))).toBe(true);
});

test('the list says each subject’s own committee, reads nothing again, and names no cut', async () => {
  const held = await started();
  const late = day;
  onDay(held.world, late);
  let reads = 0;
  const counting: Send = (request) => {
    if (request.path.includes('/spaces/') && request.method === 'GET') reads += 1;
    return server.send(request);
  };
  const more = { level: 'national' as const, scope: NATIONAL_COMMITTEE };
  await show(pageOf(held, held.world, late, counting, more));
  const line = (code: string, status: string) =>
    fill(words.statusLine, { subject: subjectName(reference.profile, code), status });
  const before = reads;
  await press('committee-subjects-french');
  expect(reads).toBe(before);
  await press('committee-none');
  await press('committee-seats-1');
  await press('committee-none');
  await press('committee-seats-2');
  expect(texts()).toContain(line('math', words.status.none));
  expect(texts()).toContain(line('french', words.status.none));
  await press('committee-none');
  expect(texts()).toContain(line('french', words.status.adopted));
  expect(texts()).toContain(line('math', words.status.none));
  const ended = addDays(bem.signBy, 1);
  onDay(held.world, ended);
  await update(pageOf(held, held.world, ended, counting, more));
  expect(texts()).toContain(line('math', words.status.lapsed));
  expect(texts()).toContain(line('french', words.status.adopted));
  await press('committee-subjects-french');
  expect(texts()).toContain(fill(words.state.adoptedNone, { day: `day ${late}`, count: 3, seats: 5 }));
});

test('what was signed for a room is not said in another chosen while it is signed', async () => {
  const held = await started();
  onDay(held.world, day);
  let release = () => undefined as void;
  let holding = false;
  const slow: Send = async (request) => {
    if (holding && request.method === 'POST') {
      holding = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return server.send(request);
  };
  await show(pageOf(held, held.world, day, slow, { level: 'national', scope: NATIONAL_COMMITTEE }));
  holding = true;
  await press('committee-none');
  await press('committee-subjects-french');
  release();
  await act();
  expect(texts()).not.toContain(fill(words.noneDone, { seat: seat(1) }));
});

test('hidden totals say the national floor, and after the exam it is published to the public', async () => {
  const held = await started();
  onDay(held.world, day);
  putShares(held.world, day, { [items[0]]: 10 }, { teachers: 1, directorates: wilayas(2) });
  const more = { level: 'national' as const, scope: NATIONAL_COMMITTEE };
  await show(pageOf(held, held.world, day, server.send, more));
  expect(texts()).toContain(national.hidden);
  for (const at of [0, 1, 2]) {
    await press(`committee-seats-${at}`);
    await press('committee-propose');
    await press('committee-item', 0);
    await press('committee-propose-sign');
  }
  const ended = addDays(bem.to, 1);
  onDay(held.world, ended);
  await update(pageOf(held, held.world, ended, server.send, more));
  expect(texts()).toContain(fill(national.published, { to: `day ${bem.to}`, figures: `day ${day}` }));
  expect(texts()).not.toContain(national.sees);
});

test('a range takes the wilayas shown, at the nearest ranks, and holds an item back under 8', () => {
  const grade = (classes: number, item: number | null) => ({
    teachers: 12,
    classes,
    schools: 4,
    items: [
      ['a', 40],
      ['b', item],
    ] as [string, number | null][],
  });
  const wilaya = (figure: ReturnType<typeof grade> | null) =>
    ({ subjects: [['math', { grades: [['4am', figure]] }]], all: null }) as unknown as DirectorateFigures;
  const shown = [32, 4, 16, 8, 28, 12, 24, 20].map((one) => wilaya(grade(40, one)));
  const range = wilayaRange(shown, 'math', '4am', ['a', 'b', 'c']);
  expect(range).toEqual({
    low: [100, 10, 0],
    high: [100, 80, 0],
    middleLow: [100, 20, 0],
    middleHigh: [100, 70, 0],
  });
  const hidden = [...shown.slice(0, 7), wilaya(grade(40, null))];
  expect(wilayaRange(hidden, 'math', '4am', ['a', 'b'])?.low).toEqual([100, null]);
  expect(wilayaRange([...shown.slice(0, 7), wilaya(null)], 'math', '4am', ['a', 'b'])).toBeNull();
  expect(wilayaRange([...shown.slice(0, 7), wilaya(grade(0, null))], 'math', '4am', ['a'])).toBeNull();
  expect(wilayaRange(shown, 'french', '4am', ['a'])).toBeNull();
});
