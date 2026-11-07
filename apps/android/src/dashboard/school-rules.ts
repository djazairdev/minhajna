// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's book as D-Classes edits it (answers 807 to 809): its classes and
// their pupils, its teachers, and who teaches what. A class's subjects come
// from its level's options in the published list. Where the level has a class
// teacher, as the primary has, each option is assigned whole, the class
// teacher taking all their subjects; elsewhere each subject is assigned on its
// own, to a teacher whose option holds it. A pupil who leaves is taken out of
// the list, which a teacher's phone records as leaving. Every name is made up.

import type { BookClass, BookPupil, BookTeacher, DirectoryLevel, DirectoryOption, SchoolBook } from '@minhajna/core';

/** What a class has one teacher for: an option of the primary's, or one subject. */
export interface Unit {
  readonly key: string;
  readonly subjects: readonly string[];
  readonly option: DirectoryOption | null;
}

/** The units a level's classes are assigned by. */
export function unitsOf(level: DirectoryLevel | undefined): Unit[] {
  if (level === undefined) return [];
  if (level.options.some((option) => option.classTeacher === true))
    return level.options.map((option) => ({ key: option.code, subjects: option.subjects, option }));
  const subjects = [...new Set(level.options.flatMap((option) => option.subjects))];
  return subjects.map((subject) => ({ key: subject, subjects: [subject], option: null }));
}

/** The class's teacher for a unit, when every subject of it has the same one. */
export function unitTeacher(schoolClass: BookClass, unit: Unit): string | null {
  const [first, ...rest] = unit.subjects.map((subject) => schoolClass.teachers[subject]);
  return first !== undefined && rest.every((one) => one === first) ? first : null;
}

/** The teachers whose option holds every subject of the unit. */
export function candidates(book: SchoolBook, level: DirectoryLevel | undefined, unit: Unit): BookTeacher[] {
  return book.teachers.filter((teacher) => {
    const option = level?.options.find((one) => one.code === teacher.option);
    return option !== undefined && unit.subjects.every((subject) => option.subjects.includes(subject));
  });
}

/** How many units of a class have no teacher. */
export const gaps = (schoolClass: BookClass, units: readonly Unit[]) =>
  units.filter((unit) => unitTeacher(schoolClass, unit) === null).length;

const onClass = (book: SchoolBook, id: string, change: (one: BookClass) => BookClass): SchoolBook => ({
  ...book,
  classes: book.classes.map((one) => (one.id === id ? change(one) : one)),
});

/** The book with a unit given to a teacher, or to none. */
export function withUnitTeacher(book: SchoolBook, classId: string, unit: Unit, teacher: string | null): SchoolBook {
  return onClass(book, classId, (one) => {
    const teachers = { ...one.teachers };
    for (const subject of unit.subjects) {
      if (teacher === null) delete teachers[subject];
      else teachers[subject] = teacher;
    }
    return { ...one, teachers };
  });
}

/** A new id that the book does not hold, for a class, pupil, teacher or session. */
export function newId(prefix: string, taken: ReadonlySet<string>, random: () => number = Math.random): string {
  for (;;) {
    const id = `${prefix}${Math.floor(random() * 36 ** 8).toString(36)}`;
    if (!taken.has(id)) return id;
  }
}

/** Every id the book holds. */
export function idsOf(book: SchoolBook): Set<string> {
  return new Set([
    ...book.classes.flatMap((one) => [one.id, ...one.pupils.map((pupil) => pupil.id)]),
    ...book.teachers.map((one) => one.id),
    ...book.week.map((one) => one.id),
  ]);
}

/** A class's name as the school's names are compared: case and spaces aside. */
export const className = (name: string) => name.trim().toLocaleLowerCase().replace(/\s+/gu, '');

/** Whether the book already has a class of this name. */
export const classNameTaken = (book: SchoolBook, name: string) =>
  book.classes.some((one) => className(one.name) === className(name));

/** The book with a new class of a year. */
export function withClass(book: SchoolBook, grade: string, name: string): SchoolBook {
  const id = newId('c', idsOf(book));
  return { ...book, classes: [...book.classes, { id, grade, name: name.trim(), pupils: [], teachers: {} }] };
}

/** The book with a pupil added to a class, or changed where the id is there. */
export function withPupil(book: SchoolBook, classId: string, pupil: BookPupil): SchoolBook {
  return onClass(book, classId, (one) => ({
    ...one,
    pupils: one.pupils.some((other) => other.id === pupil.id)
      ? one.pupils.map((other) => (other.id === pupil.id ? pupil : other))
      : [...one.pupils, pupil],
  }));
}

/** The book with a pupil gone from the school. */
export function withoutPupil(book: SchoolBook, pupilId: string): SchoolBook {
  return {
    ...book,
    classes: book.classes.map((one) => ({ ...one, pupils: one.pupils.filter((p) => p.id !== pupilId) })),
  };
}

/** The book with a pupil moved to another class. */
export function movedPupil(book: SchoolBook, pupilId: string, toClass: string): SchoolBook {
  const pupil = book.classes.flatMap((one) => one.pupils).find((one) => one.id === pupilId);
  return pupil === undefined ? book : withPupil(withoutPupil(book, pupilId), toClass, pupil);
}

/** Whether another pupil of the school has this registration number. */
export function registrationTaken(book: SchoolBook, registration: string, except?: string): boolean {
  return book.classes.some((one) =>
    one.pupils.some((pupil) => pupil.registration === registration && pupil.id !== except),
  );
}

/** The book with a new teacher; the server gives their joining code once saved. */
export function withTeacher(book: SchoolBook, name: string, option: string): SchoolBook {
  const id = newId('t', idsOf(book));
  return { ...book, teachers: [...book.teachers, { id, name: name.trim(), option }] };
}

/** The book without a teacher, whose classes lose them. */
export function withoutTeacher(book: SchoolBook, teacherId: string): SchoolBook {
  return {
    ...book,
    teachers: book.teachers.filter((one) => one.id !== teacherId),
    classes: book.classes.map((one) => ({
      ...one,
      teachers: Object.fromEntries(Object.entries(one.teachers).filter(([, id]) => id !== teacherId)),
    })),
  };
}

/** A joining code as it is handed over, in groups of four. */
export const codeShown = (code: string) => (code.includes('-') ? code : (code.match(/.{1,4}/gu) ?? []).join('-'));
