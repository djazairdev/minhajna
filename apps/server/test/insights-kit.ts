// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up class's insights sending for a term (#621), in the shape
// packages/core's insights.ts builds, for the observatory's tests: its sending
// ID from a number, its token from another, and a school-and-term code from a
// third, so a test can tell what the server kept from what it dropped; and a
// made-up world started on a server running, with its starter token.

import type { KeptSending, Sending } from '../src/insights/sending-read.js';
import { freshId, PASS } from './state-kit.js';

/** A made-up sending: its ID from `at`, its token from `teacher`, its school-and-term code from `school`. */
export const madeUpSending = (at: number, teacher = 1, school = 1): Sending => ({
  format: 'minhajna/insights/1',
  id: at.toString(16).padStart(32, '0'),
  token: teacher.toString(16).padStart(32, 'e'),
  schoolTerm: school.toString(16).padStart(64, 'c'),
  year: '2027-2028',
  term: 1,
  wilaya: '16',
  grade: '4am',
  subject: 'arabic',
  pack: 'dz.cem.4am.arabic.made-up',
  release: '2027.1',
  sessions: { 's1-w1': 5, 's1-w2': 6, 's1-w3': 0 },
  changed: { merged: [], skipped: ['s1-w3'], split: ['s1-w4'], retaught: ['s1-w2'] },
  reached: 310,
});

/** The sending as the server keeps it, with no school-and-term code. */
export function keptOf(sending: Sending): KeptSending {
  return Object.fromEntries(Object.entries(sending).filter(([field]) => field !== 'schoolTerm')) as KeptSending;
}

/** A made-up world started on the server at `base`, with its starter token. */
export async function startedWorld(base: string): Promise<{ id: string; starter: string }> {
  const id = freshId();
  const body = { world: id, sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: ['2026-12-06'], pass: PASS };
  const res = await fetch(`${base}/worlds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const { starter } = (await res.json()) as { starter: string };
  return { id, starter };
}
