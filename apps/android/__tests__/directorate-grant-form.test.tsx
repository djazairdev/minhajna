// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant's form and rows at their edges (#593, answer 621): the request opens
// the whole weeks before the world's week, the grant ending two weeks after its
// date; a label is cleaned and kept within its length; the classes clear when
// the school or the subject changes; the button says it is sending only while
// it is, and the form empties once sent; a school no longer listed is named so;
// a request not delivered offers no sending again once lapsed; the rows follow
// the world's date while the page is open, an answer or a problem for the date
// before it moved dropped, and each sending again is named for its request.
// Every directorate, school and device is made up.

import { addDays, type DemoSchool } from '@minhajna/core';
import { Platform } from 'react-native';
import {
  act,
  control,
  disabled,
  field,
  filled,
  moved,
  page,
  press,
  rendered,
  seeded,
  texts,
  type,
  unmount,
} from '../jest/grant-page';
import { listed, reference } from '../jest/grant-world';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { personName } from '../src/director/dashboard-text';
import { seededWorld } from '../src/director/director-world';
import { listSchool } from '../src/director/school-listing';
import { requestGrant, requestsOf } from '../src/directorate/request-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { weekStart } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.grant;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const chips = (prefix: string) =>
  rendered()
    .root.findAll((node) => {
      const { testID, onPress } = node.props as { testID?: unknown; onPress?: unknown };
      return typeof testID === 'string' && testID.startsWith(prefix) && onPress !== undefined;
    })
    .map((node) => String(node.props.testID).slice(prefix.length));

test('the request opens whole weeks before the world’s week, and its label is cleaned and bounded', async () => {
  const { id, fingerprint, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  await page(directorate, school, server.send);
  await filled(fingerprint, school);
  expect((field('grant-label').props as { maxLength?: number }).maxLength).toBe(80);
  await type('grant-label', 'مفتش  اللغة العربية');
  await press('grant-weeks-4');
  const start = weekStart(directorate.date, reference.profile.workingDays);
  const from = addDays(start, -28);
  const to = addDays(start, -1);
  const until = addDays(directorate.date, 14);
  const range = words.range.replace('{{from}}', `day ${from}`).replace('{{to}}', `day ${to}`);
  expect(texts()).toContain(range.replace('{{until}}', `day ${until}`));
  await press('grant-send');
  const [row] = await requestsOf(directorate, school.directorateId, kit, server.send);
  expect([row.request.label, row.request.weeks, row.request.until]).toEqual([
    'مفتش اللغة العربية',
    { from, to },
    until,
  ]);
  expect(disabled('grant-send')).toBe(true);
  expect((field('grant-label').props as { value: string }).value).toBe('');
});

test('the classes clear when the school or the subject changes', async () => {
  const { id, fingerprint, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  await page(directorate, school, server.send);
  await filled(fingerprint, school);
  expect(disabled('grant-send')).toBe(false);
  const subjects = chips('grant-subject-');
  await press(`grant-subject-${subjects[1]}`);
  expect(disabled('grant-send')).toBe(true);
  const others = seededWorld(id, reference).schools.filter(
    (one: DemoSchool) => one.directorateId === school.directorateId && one.id !== school.id && one.teachers.length > 0,
  );
  await press(`grant-class-${chips('grant-class-')[0]}`);
  expect(disabled('grant-send')).toBe(false);
  await press(`grant-school-${others[0].id}`);
  expect(disabled('grant-send')).toBe(true);
});

test('the button says it is sending only while it is, and the rows follow the world', async () => {
  const { id, fingerprint, directorate, desk } = await listed((world) => seeded(world));
  const school = seeded(id);
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let busy = true;
  const send: Send = async (request) => {
    if (request.method === 'POST' && request.path.includes(desk.held.school)) {
      await held;
      if (busy) return { status: 429, body: { error: 'busy' }, retryAfter: 12 };
    }
    return server.send(request);
  };
  await page(directorate, school, send);
  expect((control('grant-send').props as { label: string }).label).toBe(words.send);
  await filled(fingerprint, school);
  await press('grant-send');
  expect((control('grant-send').props as { label: string }).label).toBe(words.sending);
  expect(disabled('grant-send')).toBe(true);
  release();
  await act();
  const [row] = await requestsOf(directorate, school.directorateId, kit, server.send);
  expect(texts()).toContain(words.undelivered);
  const name = words.againName.replace('{{label}}', row.request.label).replace('{{school}}', personName(school));
  expect((control(`grant-again-${row.request.id}`).props as { name?: string }).name).toBe(name);
  busy = false;
  await listSchool(id, school, 'another-made-up-space-id', kit, server.send);
  await moved({ ...directorate, date: addDays(row.request.until, 1) }, school, send);
  expect(texts()).toContain(words.lapsed.replace('{{until}}', `day ${row.request.until}`));
  expect(texts().some((one) => one.includes(words.unknownSchool))).toBe(true);
  expect(chips('grant-again-')).toEqual([]);
});

test('an answer for the date before it moved is dropped, and so is its problem', async () => {
  const { id, form, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  const request = await requestGrant(directorate, school.directorateId, form(), kit, server.send);
  let open = () => undefined as void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  let first = true;
  const send: Send = async (asked) => {
    if (first && asked.method === 'GET' && asked.path.includes('/batches')) {
      first = false;
      await gate;
      return { status: 503, body: null, retryAfter: null };
    }
    return server.send(asked);
  };
  await page(directorate, school, send);
  await moved({ ...directorate, date: addDays(request.until, 1) }, school, send);
  const lapsed = words.lapsed.replace('{{until}}', `day ${request.until}`);
  expect(texts()).toContain(lapsed);
  open();
  await act();
  expect(texts()).toContain(lapsed);
  expect(texts()).not.toContain(ar.demo.problem.other);
});

test('a problem said for one date is gone once the date moves', async () => {
  const { id, form, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  const request = await requestGrant(directorate, school.directorateId, form(), kit, server.send);
  let first = true;
  const send: Send = async (asked) => {
    if (first && asked.method === 'GET' && asked.path.includes('/batches')) {
      first = false;
      return { status: 503, body: null, retryAfter: null };
    }
    return server.send(asked);
  };
  await page(directorate, school, send);
  expect(texts()).toContain(ar.demo.problem.other);
  await moved({ ...directorate, date: addDays(request.until, 1) }, school, send);
  expect(texts()).not.toContain(ar.demo.problem.other);
  expect(texts()).toContain(words.lapsed.replace('{{until}}', `day ${request.until}`));
});
