// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The re-pace screen tests' made-up setup (#229): the demo day with c-1's
// sessions not held, so items would land after the exams, and the same
// class made a primary class, whose re-pace waits for the director.

import { awaitingBetween, confirmSessions, parseDay } from '@minhajna/core';
import { coreContext } from '../src/storage/core-context';
import type { TestData } from './app-data';
import { withDay } from './today-day';

export const repaceDay = parseDay('2026-10-15');
export const repaceContext = (data: TestData) => coreContext({ ...data, state: data.book.state });

/** The demo day with c-1's sessions not held, so items would land after the exams. */
export async function behind(): Promise<TestData> {
  const data = await withDay();
  const sessions = awaitingBetween(repaceContext(data), parseDay('2026-10-11'), repaceDay).filter(
    (one) => one.courseId === 'c-1',
  );
  await data.book.recordAll(
    repaceDay,
    confirmSessions(
      repaceContext(data),
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return data;
}

/** The same, with c-1's class a primary class. */
export async function behindInPrimary(): Promise<TestData> {
  const data = await behind();
  const primary = { id: 'k-1', schoolId: 's-1', level: 'primary', grade: '4am', name: '4م1' } as const;
  await data.book.record(repaceDay, {
    kind: 'class.set',
    schoolClass: { ...primary, groups: [{ id: 'k-1-w', kind: 'whole', name: '4م1' }] },
  });
  return data;
}
