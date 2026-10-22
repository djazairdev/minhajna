// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The French specialist's two schools with a clash (#232, answer 400): the
// second school with a second afternoon slot at 15:15, and its 5th-year
// class also on Thursday's first morning slot, at the same time as the first
// school's 3rd-year class.

import type { RecordEvent } from '@minhajna/core';
import type { TestData } from './app-data';
import { thursday, withSpecialist } from './specialist-classes';

/** The specialist's week with Thursday's first morning slot in both schools. */
export async function withClash(): Promise<TestData> {
  const riadh: RecordEvent = {
    kind: 'school.set',
    school: {
      id: 's-2',
      name: 'مدرسة الرياض',
      levels: ['primary'],
      subjects: ['french'],
      zone: '16',
      bells: {
        usual: [
          { half: 'afternoon', index: 1, from: '13:00', to: '13:45' },
          { half: 'afternoon', index: 2, from: '15:15', to: '16:00' },
        ],
      },
    },
  };
  return withSpecialist([riadh], [thursday('e-4', 'morning', 1, 'f-3', 'k-3')]);
}
