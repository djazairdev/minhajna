// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school's share of the totals (#596), in the shape the core
// prepares, for the shares' tests: one subject with one plan item, its ID from
// a number, for a day and a count of teachers; and a made-up world on a server
// running, its date moved onto its first announced day.

import assert from 'node:assert/strict';
import type { Share } from '../src/totals/share-read.js';
import { freshId, PASS, WITH_PASS } from './state-kit.js';

/** A made-up share, its ID from `at`. */
export const madeUpShare = (at: number, day = '2026-12-06', teachers = 3): Share => ({
  format: 'minhajna/total-share/1',
  id: at.toString(16).padStart(64, '0'),
  day,
  directorate: 'dir-01',
  subjects: {
    math: {
      teachers,
      vacantPosts: 0,
      hoursWithoutTeacher: 0,
      classes: 4,
      cover: 1,
      closed: 2,
      reached: 1800,
      runLong: 1,
      items: { 'item-01': { sessions: 12, merged: 0, skipped: 1, retaught: 0 } },
    },
  },
});

/** A world dated 2026-12-01 on the server at `base`, its date moved onto its first announced day, 2026-12-06. */
export async function announcedWorld(base: string): Promise<string> {
  const id = freshId();
  const body = {
    world: id,
    sealed: 'c2VhbGVkLXdvcmxk',
    date: '2026-12-01',
    announcedDays: ['2026-12-06', '2026-12-20'],
  };
  const res = await fetch(`${base}/worlds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, pass: PASS }),
  });
  const { starter } = (await res.json()) as { starter: string };
  const moved = await fetch(`${base}/worlds/${id}/date`, {
    method: 'POST',
    headers: { ...WITH_PASS, authorization: `Bearer ${starter}` },
  });
  assert.deepEqual(await moved.json(), { date: '2026-12-06' });
  return id;
}
