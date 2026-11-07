// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school book, one teacher's delivery from it and the phone's school
// it goes to, for the directory's joining tests (answer 808).

import { deliveryFor, readSchoolBook, type School, type SchoolBook, type TeacherDelivery } from '../src/index.ts';

export const listed = {
  id: 'cem-16-1',
  name: 'Made-up middle school',
  level: 'cem',
  wilaya: '16',
  commune: { code: '1601', name: { fr: 'Made-up town' } },
};
export const pupil = (id: string, name: string) => ({ id, name, sex: 'f' as const });
const book = readSchoolBook({
  format: 1,
  teachers: [{ id: 't1', name: 'Made-up teacher', option: 'math' }],
  classes: [
    {
      id: 'c1',
      grade: '1am',
      name: '1AM1',
      pupils: [{ ...pupil('p1', 'Pupil one'), registration: '1001' }, pupil('p2', 'Pupil two')],
      teachers: { math: 't1' },
    },
    { id: 'c2', grade: '1am', name: '1AM2', pupils: [pupil('p1', 'Pupil three')], teachers: { math: 't1' } },
  ],
  week: [
    { id: 's1', classId: 'c1', subject: 'math', weekday: 0, slot: { half: 'morning', index: 1 } },
    { id: 's2', classId: 'c2', subject: 'math', weekday: 1, slot: { half: 'morning', index: 2 } },
  ],
}) as SchoolBook;
export const delivery = deliveryFor(book, 't1', listed) as TeacherDelivery;
export const chosen: School = {
  id: 'own-1',
  name: 'Made-up middle school',
  code: 'cem-16-1',
  levels: ['cem'],
  subjects: ['math'],
  zone: '16',
};
export const typed: School = { id: 'own-1', name: 'Typed', levels: ['cem'], subjects: ['math'], zone: '16' };
export const [class1, class2] = delivery.classes as [
  TeacherDelivery['classes'][number],
  TeacherDelivery['classes'][number],
];
