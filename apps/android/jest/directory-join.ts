// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up teacher's delivery from the directory, and a stand-in for
// `POST /directory/join` that answers it or refuses with an error code
// (answer 808). Every name is made up.

import type { TeacherDelivery } from '@minhajna/core';
import * as directory from '../src/network/directory-network';

/** A made-up delivery: two classes of the made-up list's first middle school, and their sessions. */
export const MADE_UP_DELIVERY: TeacherDelivery = {
  format: 1,
  school: {
    id: 'cem-16-1',
    name: 'متوسطة النجاح',
    level: 'cem',
    wilaya: '16',
    commune: { code: '1601', name: { ar: 'بلدية مثال', fr: 'Commune exemple' } },
  },
  teacher: { id: 't1', name: 'أستاذة مختلقة', option: 'arabic' },
  classes: [
    {
      id: 'c1',
      grade: '1am',
      name: '1م1',
      pupils: [
        { id: 'p1', name: 'تلميذة أولى', sex: 'f', registration: '1001' },
        { id: 'p2', name: 'تلميذ ثان', sex: 'm' },
      ],
    },
    { id: 'c2', grade: '1am', name: '1م2', pupils: [{ id: 'p1', name: 'تلميذة ثالثة', sex: 'f' }] },
  ],
  sessions: [
    { id: 's1', classId: 'c1', subject: 'arabic', weekday: 0, slot: { half: 'morning', index: 1 } },
    { id: 's2', classId: 'c2', subject: 'arabic', weekday: 1, slot: { half: 'morning', index: 2 } },
  ],
};

/** A made-up joining code, in its groups. */
export const MADE_UP_CODE = '7K2M-9Q4R-X8ZT-3HN6';

/** Answers every join with `answer`, or refuses it with that error code. */
export function serveJoin(
  answer: TeacherDelivery | string = MADE_UP_DELIVERY,
): jest.SpyInstance<Promise<unknown>, Parameters<typeof directory.directoryPost>> {
  return jest
    .spyOn(directory, 'directoryPost')
    .mockImplementation(() =>
      typeof answer === 'string'
        ? Promise.reject(Object.assign(new Error('made-up refusal'), { code: answer }))
        : Promise.resolve(answer),
    );
}
