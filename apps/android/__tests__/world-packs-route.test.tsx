// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's plans through the joined card's own route (#616, #617, answers
// 770 and 771): the classes come from the timetable part in force, not an old
// one; a failed read of the channel says so rather than looking empty; a
// teacher with no timetable yet is told plainly. Only the channel is a
// stand-in. Everything is made up.

import type { SchoolJoined } from '@minhajna/core';
import { rendered, press, show, shown, unmount } from '../jest/editor-form';
import { source as clean } from '../jest/editor-source';
import { packService, reference } from '../jest/pack-release';
import { joinedPage } from '../src/school/JoinedPages';
import { leaveWorldNetwork } from '../src/network/world-network';
import { readSignChannel } from '../src/week/week-sign-session';
import { act } from 'react-test-renderer';

jest.mock('../src/week/week-sign-session', () => ({
  ...jest.requireActual<object>('../src/week/week-sign-session'),
  readSignChannel: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const channel = readSignChannel as jest.Mock;
const session = (name: string) => ({
  class: name,
  subject: 'math',
  day: 0,
  start: 480,
  end: 540,
  group: '',
  week: 'both',
});
const part = (from: string, to: string | null, name: string) => ({
  part: { once: false, from, ...(to === null ? {} : { to }), sessions: [session(name)] },
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  channel.mockReset();
});
async function drain() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

async function teacherPage(publish = true) {
  const f = await packService();
  const pack = { ...clean, status: 'community' as const, release: '2026.7' };
  const draft = await f.change(null, { stage: 'draft', pack });
  if (publish)
    await f.change(await f.approved(await f.change(draft, { stage: 'under-review' })), { stage: 'published' });
  const world = { ...f.world, book: { entries: [] } as never };
  const page = joinedPage(
    { page: 'packs', join: { code: 'made-up' } as unknown as SchoolJoined },
    {
      world,
      date: 'Made-up date',
      dayText: (day: string) => day,
      kit: f.editor.kit,
      send: f.server.send,
      year: '2026-2027',
      said: 'Made-up',
      dates: null,
      onClose: jest.fn(),
      onJoin: jest.fn(),
      onPage: jest.fn(),
      reference,
      committees: { held: f.editor.held, bundled: reference },
    },
  );
  await show(page!, 'en');
  await drain();
  return f;
}

const said = () => JSON.stringify(rendered().toJSON());

test('the classes are those of the timetable in force, not an old part', async () => {
  channel.mockResolvedValue({ parts: [part('2026-09-01', '2026-09-30', 'OLD1'), part('2026-10-01', null, 'NEW1')] });
  await teacherPage();
  expect(said()).toContain('NEW1');
  expect(said()).not.toContain('OLD1');
  expect(shown('world-pack-2026.7')).toBe(true);
});

test('only published releases are listed, and a world with none says so', async () => {
  channel.mockResolvedValue({ parts: [] });
  const f = await teacherPage(false);
  expect(shown('world-packs-empty')).toBe(true);
  expect(f).toBeDefined();
});

test('a channel that won’t read says so, and doesn’t look empty', async () => {
  channel.mockRejectedValue(Object.assign(new Error('Made-up'), { code: 'E_JOIN_TAKEN' }));
  await teacherPage();
  expect(shown('world-no-channel')).toBe(true);
  expect(said()).not.toContain('No class yet');
});

test('a teacher with no timetable yet is told so, and can still report', async () => {
  channel.mockRejectedValue(Object.assign(new Error('Made-up'), { code: 'E_TIMETABLE_UNJOINED' }));
  await teacherPage();
  expect(shown('world-no-channel')).toBe(false);
  expect(said()).toContain('No class yet');
  await press('report-open-2026.7');
  expect(shown('report-form')).toBe(true);
});
