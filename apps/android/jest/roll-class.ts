// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The made-up Thursday of today-day.ts with 45 made-up pupils in 4م1, for
// the roll call's tests.

import { parseDay } from '@minhajna/core';
import { madeUpClass, rollCallTexts } from '../src/gallery/roll-call-texts';
import type { TestData } from './app-data';
import { withDay } from './today-day';

export async function withPupils(): Promise<TestData> {
  const data = await withDay();
  await data.book.recordAll(
    parseDay('2026-10-15'),
    madeUpClass(rollCallTexts.ar).map((name, index) => ({
      kind: 'pupil.set',
      pupil: {
        id: `p-${index + 1}`,
        classId: 'k-1',
        name,
        sex: index % 2 === 0 ? 'm' : 'f',
        groups: [],
        movements: [],
      },
    })),
  );
  return data;
}

/** The roll-call unit of a session on that Thursday, one per session in CEM. */
export const unitKey = (slot: number) => `session:c-1/2026-10-15/m${slot}/k-1-w`;
