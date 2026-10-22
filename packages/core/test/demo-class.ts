// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up classes, pupils and timetables only (PRD §5.12).

import { type Pupil, type RecordEvent, type TimetableEntry } from '../src/index.ts';
import { d, languagePack, mathPack } from './reference-fixtures.ts';

function pupil(
  id: string,
  classId: string,
  name: string,
  latinName: string,
  sex: 'f' | 'm',
  groups: string[] = [],
): Pupil {
  return { id, classId, registration: `00000000${id.slice(1)}`, name, latinName, sex, groups, movements: [] };
}

/** A CEM teacher with one class split into two half-groups for TD. */
export function cemEvents(): RecordEvent[] {
  const lesson = (
    id: string,
    weekday: TimetableEntry['weekday'],
    half: 'morning' | 'afternoon',
    index: number,
  ): TimetableEntry => ({
    id,
    weekday,
    slot: { half, index },
    courseId: 'c-math',
    groupId: 'g-all',
    weeks: 'every',
    sessionType: 'lesson',
  });
  return [
    { kind: 'teacher.set', card: { rank: 'Example rank' } },
    { kind: 'teacher.personal.set', personal: { name: 'Example Teacher' } },
    {
      kind: 'school.set',
      school: { id: 's-cem', name: 'Example middle school', levels: ['cem'], subjects: ['math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-1am2',
        schoolId: 's-cem',
        level: 'cem',
        grade: '1am',
        name: '1AM2',
        groups: [
          { id: 'g-all', kind: 'whole', name: '1AM2' },
          { id: 'g-1', kind: 'half', name: 'Group 1' },
          { id: 'g-2', kind: 'half', name: 'Group 2' },
        ],
      },
    },
    ...[
      pupil('p01', 'k-1am2', 'أمينة بن علي', 'Amina Benali', 'f', ['g-1']),
      pupil('p02', 'k-1am2', 'محمد الأمين بن علي', 'Mohamed El Amine Benali', 'm', ['g-1']),
      pupil('p03', 'k-1am2', 'إسراء بوزيد', 'Israa Bouzid', 'f', ['g-1']),
      pupil('p04', 'k-1am2', 'عبد الرحمن بن عبد الله آيت مسعود', 'Abderrahmane Ben Abdellah Ait Messaoud', 'm', [
        'g-1',
      ]),
      pupil('p05', 'k-1am2', 'رؤى قاسمي', 'Rouaa Kacimi', 'f', ['g-1']),
      pupil('p06', 'k-1am2', 'يوسف شعبان', 'Youcef Chaabane', 'm', ['g-2']),
      pupil('p07', 'k-1am2', 'هبة الله مرابط', 'Hibat Allah Merabet', 'f', ['g-2']),
      pupil('p08', 'k-1am2', 'مؤمن بلقاسم', 'Moumen Belkacem', 'm', ['g-2']),
      pupil('p09', 'k-1am2', 'آية زروقي', 'Aya Zerrouki', 'f', ['g-2']),
      pupil('p10', 'k-1am2', 'لؤي بن علي', 'Louai Benali', 'm', ['g-2']),
    ].map((p): RecordEvent => ({ kind: 'pupil.set', pupil: p })),
    {
      kind: 'course.set',
      course: {
        id: 'c-math',
        classId: 'k-1am2',
        subject: 'math',
        year: '2026-2027',
        pack: { id: mathPack.id, release: mathPack.release },
      },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v1',
        from: d('2026-09-20'),
        source: 'hand',
        blocks: [],
        entries: [
          lesson('e-sun', 0, 'morning', 1),
          lesson('e-mon', 1, 'morning', 2),
          {
            id: 'e-tue-1',
            weekday: 2,
            slot: { half: 'afternoon', index: 1 },
            courseId: 'c-math',
            groupId: 'g-1',
            weeks: 'A',
            sessionType: 'td',
          },
          {
            id: 'e-tue-2',
            weekday: 2,
            slot: { half: 'afternoon', index: 1 },
            courseId: 'c-math',
            groupId: 'g-2',
            weeks: 'B',
            sessionType: 'td',
          },
          lesson('e-wed', 3, 'morning', 3),
          lesson('e-thu', 4, 'morning', 1),
        ],
      },
    },
  ];
}

/** A primary teacher with one class: activity slots and half-day roll call. */
export function primaryEvents(): RecordEvent[] {
  const slot = (
    id: string,
    weekday: TimetableEntry['weekday'],
    half: 'morning' | 'afternoon',
    index: number,
    activity?: string,
  ): TimetableEntry => ({
    id,
    weekday,
    slot: { half, index },
    courseId: 'c-lang',
    groupId: 'h-all',
    weeks: 'every',
    sessionType: 'lesson',
    ...(activity !== undefined && { activity }),
  });
  const movingIn: Pupil = {
    ...pupil('q05', 'k-5apb', 'رحمة لونيس', 'Rahma Lounis', 'f'),
    movements: [{ day: d('2026-10-11'), kind: 'in', reason: 'Transfer' }],
  };
  const movingOut: Pupil = {
    ...pupil('q06', 'k-5apb', 'ضياء الدين سعيداني', 'Dhiaa Eddine Saidani', 'm'),
    movements: [{ day: d('2026-10-14'), kind: 'out', reason: 'Transfer' }],
  };
  return [
    {
      kind: 'school.set',
      school: { id: 's-pri', name: 'Example primary school', levels: ['primary'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-5apb',
        schoolId: 's-pri',
        level: 'primary',
        grade: '5ap',
        name: '5AP B',
        groups: [{ id: 'h-all', kind: 'whole', name: '5AP B' }],
      },
    },
    ...[
      pupil('q01', 'k-5apb', 'سلمى حداد', 'Salma Haddad', 'f'),
      pupil('q02', 'k-5apb', 'أنس مزيان', 'Anas Meziane', 'm'),
      pupil('q03', 'k-5apb', 'نور الهدى بوعلام', 'Nour El Houda Boualem', 'f'),
      pupil('q04', 'k-5apb', 'إلياس حداد', 'Ilyes Haddad', 'm'),
      movingIn,
      movingOut,
    ].map((p): RecordEvent => ({ kind: 'pupil.set', pupil: p })),
    {
      kind: 'course.set',
      course: {
        id: 'c-lang',
        classId: 'k-5apb',
        subject: 'language',
        year: '2026-2027',
        pack: { id: languagePack.id, release: languagePack.release },
      },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v1',
        from: d('2026-09-20'),
        source: 'hand',
        blocks: [{ weekday: 2, half: 'afternoon', label: 'Teacher time' }],
        entries: [
          slot('f-sun-1', 0, 'morning', 1, 'reading'),
          slot('f-sun-2', 0, 'morning', 2, 'writing'),
          slot('f-sun-3', 0, 'afternoon', 1),
          slot('f-mon-1', 1, 'morning', 1, 'reading'),
          slot('f-mon-2', 1, 'afternoon', 1, 'writing'),
          slot('f-tue-1', 2, 'morning', 1),
          slot('f-wed-1', 3, 'morning', 1, 'reading'),
          slot('f-thu-1', 4, 'morning', 1, 'writing'),
        ],
      },
    },
  ];
}

/** The primary class with Tuesday's slot a remediation session and Thursday's a support one. */
export function listEvents(): RecordEvent[] {
  return primaryEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries.map((entry) =>
              entry.id === 'f-tue-1'
                ? { ...entry, sessionType: 'remediation' }
                : entry.id === 'f-thu-1'
                  ? { ...entry, sessionType: 'support' }
                  : entry,
            ),
          },
        }
      : event,
  );
}
