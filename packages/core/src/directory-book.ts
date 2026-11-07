// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's book in the directory (answers 807 and 808): its classes, pupils,
// its teachers and its week, which the director fills in. A teacher's phone
// receives only its own delivery, through the joining code the school gave it.
// Every name in it is made up until the national system exists. The reader
// answers the book, or a sentence saying what is wrong with it.

import type { Weekday } from './day.ts';
import { DIRECTORY_FORMAT, type DirectorySchool } from './directory.ts';
import { isCode, isObject, isText } from './directory-read.ts';
import type { Half, Slot } from './records.ts';

export const MAX_BOOK_CLASSES = 300;
export const MAX_BOOK_TEACHERS = 300;
export const MAX_CLASS_PUPILS = 200;
export const MAX_BOOK_SESSIONS = 6_000;

export interface BookPupil {
  readonly id: string;
  readonly name: string;
  readonly sex: 'f' | 'm';
  readonly registration?: string;
}

export interface BookClass {
  readonly id: string;
  readonly grade: string;
  readonly name: string;
  readonly pupils: readonly BookPupil[];
  /** Each subject's teacher, by subject code and teacher id. */
  readonly teachers: Readonly<Record<string, string>>;
}

export interface BookTeacher {
  readonly id: string;
  readonly name: string;
  readonly option: string;
  /** The joining code, which the server issues and the director hands over. */
  readonly code?: string;
}

export interface BookSession {
  readonly id: string;
  readonly classId: string;
  readonly subject: string;
  readonly weekday: Weekday;
  readonly slot: Slot;
}

export interface SchoolBook {
  readonly format: typeof DIRECTORY_FORMAT;
  readonly teachers: readonly BookTeacher[];
  readonly classes: readonly BookClass[];
  readonly week: readonly BookSession[];
}

export interface TeacherDelivery {
  readonly format: typeof DIRECTORY_FORMAT;
  readonly school: DirectorySchool | null;
  readonly teacher: { readonly id: string; readonly name: string; readonly option: string };
  readonly classes: readonly Omit<BookClass, 'teachers'>[];
  readonly sessions: readonly BookSession[];
}

function readPupil(value: unknown): BookPupil | string {
  if (!isObject(value) || !isCode(value.id) || !isText(value.name)) return 'a pupil needs an id and a name';
  if (value.sex !== 'f' && value.sex !== 'm') return `pupil ${value.id} needs a sex`;
  if (value.registration !== undefined && !isCode(value.registration)) return `pupil ${value.id} has a bad number`;
  return {
    id: value.id,
    name: value.name.trim(),
    sex: value.sex,
    ...(value.registration !== undefined && { registration: value.registration }),
  };
}

function readClass(value: unknown): BookClass | string {
  if (!isObject(value) || !isCode(value.id) || !isCode(value.grade) || !isText(value.name)) {
    return 'a class needs an id, a grade and a name';
  }
  if (!Array.isArray(value.pupils) || value.pupils.length > MAX_CLASS_PUPILS) return `class ${value.id} has a bad list`;
  if (!isObject(value.teachers) || !Object.entries(value.teachers).every(([key, id]) => isCode(key) && isCode(id))) {
    return `class ${value.id} has bad teachers`;
  }
  const pupils: BookPupil[] = [];
  for (const one of value.pupils) {
    const pupil = readPupil(one);
    if (typeof pupil === 'string') return pupil;
    pupils.push(pupil);
  }
  return {
    id: value.id,
    grade: value.grade,
    name: value.name.trim(),
    pupils,
    teachers: value.teachers as Record<string, string>,
  };
}

function readTeacher(value: unknown): BookTeacher | string {
  if (!isObject(value) || !isCode(value.id) || !isText(value.name) || !isCode(value.option)) {
    return 'a teacher needs an id, a name and an option';
  }
  if (value.code !== undefined && !isCode(value.code)) return `teacher ${value.id} has a bad code`;
  return {
    id: value.id,
    name: value.name.trim(),
    option: value.option,
    ...(value.code !== undefined && { code: value.code }),
  };
}

function readSession(value: unknown): BookSession | string {
  if (!isObject(value) || !isCode(value.id) || !isCode(value.classId) || !isCode(value.subject)) {
    return 'a session needs an id, a class and a subject';
  }
  const { weekday, slot } = value;
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return `session ${value.id} needs a weekday`;
  }
  const half = isObject(slot) ? (slot.half as Half) : null;
  const index = isObject(slot) ? slot.index : null;
  if ((half !== 'morning' && half !== 'afternoon') || !Number.isInteger(index) || (index as number) < 1) {
    return `session ${value.id} needs a slot`;
  }
  return {
    id: value.id,
    classId: value.classId,
    subject: value.subject,
    weekday: weekday as Weekday,
    slot: { half, index: index as number },
  };
}

function readAll<T>(values: readonly unknown[], read: (value: unknown) => T | string): T[] | string {
  const kept: T[] = [];
  for (const one of values) {
    const value = read(one);
    if (typeof value === 'string') return value;
    kept.push(value);
  }
  return kept;
}

/** A school's book, as the director's page saves it. */
export function readSchoolBook(value: unknown): SchoolBook | string {
  if (!isObject(value) || value.format !== DIRECTORY_FORMAT) return 'not a school book of this format';
  const { teachers, classes, week } = value;
  if (!Array.isArray(teachers) || !Array.isArray(classes) || !Array.isArray(week)) {
    return 'a school book needs teachers, classes and a week';
  }
  if (teachers.length > MAX_BOOK_TEACHERS || classes.length > MAX_BOOK_CLASSES || week.length > MAX_BOOK_SESSIONS) {
    return 'this school book is too large';
  }
  const readTeachers = readAll(teachers, readTeacher);
  if (typeof readTeachers === 'string') return readTeachers;
  const readClasses = readAll(classes, readClass);
  if (typeof readClasses === 'string') return readClasses;
  const readWeek = readAll(week, readSession);
  if (typeof readWeek === 'string') return readWeek;
  const classIds = new Set(readClasses.map((one) => one.id));
  const stray = readWeek.find((session) => !classIds.has(session.classId));
  if (stray !== undefined) return `session ${stray.id} names no class of this school`;
  return { format: DIRECTORY_FORMAT, teachers: readTeachers, classes: readClasses, week: readWeek };
}

/** What one teacher's phone receives: only the classes and sessions the book gives them. */
export function deliveryFor(
  book: SchoolBook,
  teacherId: string,
  school: DirectorySchool | null,
): TeacherDelivery | null {
  const teacher = book.teachers.find((one) => one.id === teacherId);
  if (teacher === undefined) return null;
  const taught = book.classes.filter((one) => Object.values(one.teachers).includes(teacherId));
  const ownSubject = (session: BookSession) =>
    taught.find((one) => one.id === session.classId)?.teachers[session.subject] === teacherId;
  return {
    format: DIRECTORY_FORMAT,
    school,
    teacher: { id: teacher.id, name: teacher.name, option: teacher.option },
    classes: taught.map(({ id, grade, name, pupils }) => ({ id, grade, name, pupils })),
    sessions: book.week.filter(ownSubject),
  };
}
