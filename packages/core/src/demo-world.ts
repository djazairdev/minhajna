// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded national demo world (#547, answer 579), as the device that starts a
// world first describes it, whose staff #548's seeding joins to their schools
// with their keys, before #549 adds a term of signed weeks: a directorate for
// each of the twelve wilayas, and in each wilaya one primary school, four CEMs
// and one lycée, each with a director, a deputy and a timetable preparer, its
// classes with the demo class's made-up pupils under registration numbers no
// school gives out, unique in the world, and its teachers: a CEM's three of
// each of Arabic, mathematics and French each take a 1AM and a 4AM class, a
// lycée's one of each takes both its classes, and a primary class has its own,
// so each wilaya's figures by subject pass the floors. Each class's week sits
// on the morning slots of the working days, two or three sessions a day for a
// CEM or lycée class and one for a primary class, and is checked so no class
// and no teacher is in two places at once; a class pins the pack the app would
// offer first for its grade and subject. Staff alternate between women and men
// role by role, and from one wilaya to the next. Every name comes from the seed
// and every ID from the order things are made in, so the same seed gives the
// same world. The Ministry needs no record here: the world is the Ministry's.

import type { Weekday } from './day.ts';
import type { DemoLevel, DemoName, DemoPerson } from './demo-names.ts';
import { demoNames, demoWilayas } from './demo-names.ts';
import { demoPupils } from './demo-pupils.ts';
import type { PlanPack } from './pack.ts';
import { packsFor, pinOf } from './pack-catalogue.ts';
import type { Pupil } from './attendance-records.ts';
import type { PinnedPack, Slot } from './records.ts';
import type { Zone } from './reference.ts';
import { SLOTS_PER_HALF } from './week.ts';

/** The subjects a seeded class is taught, with their sessions a week. */
const WEEK: Readonly<Record<DemoLevel, readonly (readonly [string, number])[]>> = {
  primary: [['arabic', 5]],
  cem: [
    ['arabic', 5],
    ['math', 4],
    ['french', 4],
  ],
  lycee: [
    ['arabic', 5],
    ['math', 4],
    ['french', 4],
  ],
};

/** Each level's classes in a school, by grade and section. */
const CLASSES: Readonly<Record<DemoLevel, readonly (readonly [string, number])[]>> = {
  primary: [
    ['5ap', 1],
    ['5ap', 2],
  ],
  cem: [
    ['1am', 1],
    ['1am', 2],
    ['1am', 3],
    ['4am', 1],
    ['4am', 2],
    ['4am', 3],
  ],
  lycee: [
    ['1as', 1],
    ['1as', 2],
  ],
};

/** How many teachers of each subject share a school's classes: a CEM's three each take a 1AM and a 4AM class. */
const SHARES: Readonly<Record<Exclude<DemoLevel, 'primary'>, number>> = { cem: 3, lycee: 1 };

/** A wilaya's schools, by level. */
const SCHOOLS: readonly DemoLevel[] = ['primary', 'cem', 'cem', 'cem', 'cem', 'lycee'];

export interface DemoClass {
  readonly id: string;
  readonly grade: string;
  /** As the school writes it, such as 4AM2. */
  readonly name: string;
  readonly pupils: readonly Pupil[];
  /** The pack the class pins for each subject; a subject with none is entered freely. */
  readonly packs: Readonly<Record<string, PinnedPack>>;
}

export interface DemoTeacher extends DemoPerson {
  readonly id: string;
  readonly subject: string;
  readonly classIds: readonly string[];
}

/** One session of a class's week: who teaches which subject, on which day and slot. */
export interface DemoSession {
  readonly classId: string;
  readonly teacherId: string;
  readonly subject: string;
  readonly weekday: Weekday;
  readonly slot: Slot;
}

export interface DemoSchool extends DemoName {
  readonly id: string;
  readonly level: DemoLevel;
  /** The wilaya's code, as the reference data's zones name it. */
  readonly wilaya: string;
  readonly directorateId: string;
  readonly director: DemoPerson;
  readonly deputy: DemoPerson;
  readonly preparer: DemoPerson;
  readonly classes: readonly DemoClass[];
  readonly teachers: readonly DemoTeacher[];
  readonly week: readonly DemoSession[];
}

export interface DemoDirectorate {
  readonly id: string;
  readonly wilaya: Zone;
}

export interface DemoWorld {
  readonly directorates: readonly DemoDirectorate[];
  readonly schools: readonly DemoSchool[];
}

/** The pack the app would offer first for a grade and subject, at its latest release, leaving out stale ones. */
function pinned(packs: readonly PlanPack[], grade: string, subject: string): PinnedPack | null {
  const found = packsFor(packs, grade, subject).find((pack) => pack.status !== 'stale');
  return found === undefined ? null : pinOf(found);
}

/**
 * A class's week: its subjects' sessions take periods 0, 1, 2… in order, and the class at `index` takes period
 * `period + step × index` of the slots, counted day by day, so a CEM or lycée class has two or three sessions a day and a primary class one. `step` is the
 * largest subject's sessions, so one teacher's classes, 1 or 3 apart, meet at different slots while the week has
 * room; the world checks every week for a clash anyway (answer 579).
 */
function sessions(
  level: DemoLevel,
  classId: string,
  index: number,
  teacherOf: (subject: string) => string,
  workingDays: readonly Weekday[],
): DemoSession[] {
  const slots = workingDays.length * SLOTS_PER_HALF;
  const step = Math.max(...WEEK[level].map(([, count]) => count));
  const week: DemoSession[] = [];
  let period = 0;
  for (const [subject, count] of WEEK[level]) {
    for (let session = 0; session < count; session += 1, period += 1) {
      const at = (period + step * index) % slots;
      week.push({
        classId,
        teacherId: teacherOf(subject),
        subject,
        weekday: workingDays[at % workingDays.length]!,
        slot: { half: 'morning', index: Math.floor(at / workingDays.length) + 1 },
      });
    }
  }
  return week;
}

/** Throws when a class or a teacher would be in two places at once, or a class has more sessions than slots. */
function checkWeek(week: readonly DemoSession[]): void {
  const taken = new Set<string>();
  for (const one of week)
    for (const who of [one.classId, one.teacherId]) {
      const key = `${who}@${one.weekday}/${one.slot.index}`;
      if (taken.has(key)) throw new RangeError('A seeded week puts someone in two places at once');
      taken.add(key);
    }
}

/** A seeded national world from the reference data's zones, working days and bundled packs. */
export function seedNationalWorld(
  seed: string,
  zones: readonly Zone[],
  workingDays: readonly Weekday[],
  packs: readonly PlanPack[],
): DemoWorld {
  if (new Set(workingDays).size < 5) throw new RangeError('A seeded week needs five working days');
  const names = demoNames(seed);
  let made = 0;
  const id = (kind: string) => `${kind}-${(made += 1)}`;
  let registered = 0;
  const counts = { teacher: 0, director: 0, deputy: 0, preparer: 0 };
  const person = (role: keyof typeof counts, start: 0 | 1) =>
    names.person(((counts[role] += 1) + start) % 2 === 1 ? 'f' : 'm');
  const directorates: DemoDirectorate[] = [];
  const schools: DemoSchool[] = [];
  for (const [place, wilaya] of demoWilayas(zones).entries()) {
    const directorate = { id: id('directorate'), wilaya };
    directorates.push(directorate);
    for (const level of SCHOOLS) {
      const schoolId = id('school');
      const classes: DemoClass[] = CLASSES[level].map(([grade, section]) => {
        const classId = id('class');
        const pupils = demoPupils(classId, () => id('pupil')).map((pupil) => ({
          ...pupil,
          registration: `99${String((registered += 1)).padStart(8, '0')}`,
        }));
        const classPacks: Record<string, PinnedPack> = {};
        for (const [subject] of WEEK[level]) {
          const pack = pinned(packs, grade, subject);
          if (pack !== null) classPacks[subject] = pack;
        }
        return { id: classId, grade, name: `${grade.toUpperCase()}${section}`, pupils, packs: classPacks };
      });
      const teachers: DemoTeacher[] = WEEK[level].flatMap(([subject]) => {
        const shares = level === 'primary' ? classes.length : SHARES[level];
        return Array.from({ length: shares }, (_, share) => ({
          ...person('teacher', 0),
          id: id('teacher'),
          subject,
          classIds: classes.filter((_, index) => index % shares === share).map((one) => one.id),
        }));
      });
      const teacherOf = (classId: string) => (subject: string) =>
        teachers.find((one) => one.subject === subject && one.classIds.includes(classId))!.id;
      const week = classes.flatMap((one, index) => sessions(level, one.id, index, teacherOf(one.id), workingDays));
      checkWeek(week);
      schools.push({
        ...names.school(level),
        id: schoolId,
        level,
        wilaya: wilaya.code,
        directorateId: directorate.id,
        director: person('director', place % 2 === 0 ? 0 : 1),
        deputy: person('deputy', place % 2 === 0 ? 1 : 0),
        preparer: person('preparer', Math.floor(counts.preparer / 2) % 2 === 0 ? 0 : 1),
        classes,
        teachers,
        week,
      });
    }
  }
  return { directorates, schools };
}
