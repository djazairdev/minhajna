// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's share of the totals as the server takes it (#596, answers 628 and
// 631), in the shape packages/core's total-shares.ts prepares on a device that
// holds the school key: its format, its ID, a MAC in hex, the announced day it
// is for, its directorate, and by subject what the school's assignments show
// and what its signed weeks add up to, each item of a plan with its sessions
// and the classes that merged, skipped or re-taught it, and, when the school's
// plans give them, by grade its teachers, its classes, of at most the subject's
// in all, and by item how many of them reached it, never more than the grade's
// classes. Every count is a whole number from 0 up; a subject, a directorate, a
// grade and an item are named as the reference data names them, never as a name
// an object already holds, such as __proto__; and a share holds at most 64
// subjects, each of 2,000 items and of 16 grades with 2,000 items in all, in
// 256 KB of JSON, which a CEM's share over every pack of its grades fits, at
// about 75 bytes an item and 20 more for its grade. Anything else is refused
// with the reason, and nothing in a share names a school, a class or a teacher.

import { hasOnly } from '../state-standins/term-export-read.js';
import { isDay } from '../worlds/world-rules.js';

export const SHARE_FORMAT = 'minhajna/total-share/1';
/** The most JSON a share may take, in bytes. */
export const MAX_SHARE_BYTES = 256 * 1024;
const MAX_SUBJECTS = 64;
/** The most plan items a share's subject holds, and its grades in all. */
export const MAX_SHARE_ITEMS = 2000;
const MAX_COUNT = 100_000_000;
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
const MAC = /^[0-9a-f]{64}$/;

/** Whether a value is a name of the reference data's shape that no object already holds. */
export const isName = (value: unknown): value is string =>
  typeof value === 'string' && NAME.test(value) && !value.startsWith('__') && !(value in Object.prototype);

/** How many bytes a value takes as JSON. */
export const shareBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');

const SUBJECT_FIELDS = [
  'teachers',
  'vacantPosts',
  'hoursWithoutTeacher',
  'classes',
  'cover',
  'closed',
  'reached',
  'runLong',
  'items',
] as const;
const ITEM_FIELDS = ['sessions', 'merged', 'skipped', 'retaught'] as const;
const GRADE_FIELDS = ['teachers', 'classes', 'items'] as const;
/** The most grades a share's subject holds. */
export const MAX_SHARE_GRADES = 16;

export type ItemShare = Readonly<Record<(typeof ITEM_FIELDS)[number], number>>;

/** A grade's teachers and classes in a subject, and by plan item how many of the classes reached it. */
export interface GradeReach {
  readonly teachers: number;
  readonly classes: number;
  readonly items: Readonly<Record<string, number>>;
}

export type SubjectShare = Readonly<Record<Exclude<(typeof SUBJECT_FIELDS)[number], 'items'>, number>> & {
  readonly items: Readonly<Record<string, ItemShare>>;
  /** By grade, when the school's plans give them. */
  readonly grades?: Readonly<Record<string, GradeReach>>;
};

export interface Share {
  readonly format: typeof SHARE_FORMAT;
  readonly id: string;
  readonly day: string;
  readonly directorate: string;
  readonly subjects: Readonly<Record<string, SubjectShare>>;
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COUNT;

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isItem(value: unknown): value is ItemShare {
  return hasOnly(value, ITEM_FIELDS) && ITEM_FIELDS.every((field) => isCount(value[field]));
}

function isGrade(value: unknown): value is GradeReach {
  if (!hasOnly(value, GRADE_FIELDS) || !isCount(value['teachers']) || !isCount(value['classes'])) return false;
  if (!isMap(value['items'])) return false;
  const classes = value['classes'];
  return Object.entries(value['items']).every(([item, count]) => isName(item) && isCount(count) && count <= classes);
}

/** Whether a subject's grades are named and counted right, of at most its classes and MAX_SHARE_ITEMS items in all. */
function isGrades(value: unknown, classes: number): boolean {
  if (!isMap(value) || Object.keys(value).length > MAX_SHARE_GRADES) return false;
  const grades = Object.entries(value);
  if (!grades.every(([grade, one]) => isName(grade) && isGrade(one))) return false;
  const sum = (count: (one: GradeReach) => number) =>
    grades.reduce((all, [, one]) => all + count(one as GradeReach), 0);
  return sum((one) => one.classes) <= classes && sum((one) => Object.keys(one.items).length) <= MAX_SHARE_ITEMS;
}

function isSubject(value: unknown): value is SubjectShare {
  const graded = isMap(value) && 'grades' in value;
  if (!hasOnly(value, graded ? [...SUBJECT_FIELDS, 'grades'] : SUBJECT_FIELDS)) return false;
  const { items } = value;
  if (!SUBJECT_FIELDS.every((field) => field === 'items' || isCount(value[field]))) return false;
  if (!isMap(items) || Object.keys(items).length > MAX_SHARE_ITEMS) return false;
  if (graded && !isGrades(value['grades'], value['classes'] as number)) return false;
  return Object.entries(items).every(([item, one]) => isName(item) && isItem(one));
}

/** A share as the server takes it, or why it is refused. */
export function readShare(value: unknown): Share | string {
  if (shareBytes(value) > MAX_SHARE_BYTES) return `a share takes at most ${MAX_SHARE_BYTES} bytes`;
  if (!hasOnly(value, ['format', 'id', 'day', 'directorate', 'subjects'])) {
    return 'a share has its format, ID, day, directorate and subjects';
  }
  const { format, id, day, directorate, subjects } = value;
  if (format !== SHARE_FORMAT) return `a share’s format is ${SHARE_FORMAT}`;
  if (typeof id !== 'string' || !MAC.test(id)) return 'a share’s ID is a MAC in hex';
  if (!isDay(day)) return 'a share’s day is written YYYY-MM-DD';
  if (!isName(directorate)) return 'a share names its directorate';
  if (!isMap(subjects) || Object.keys(subjects).length > MAX_SUBJECTS) {
    return `a share holds at most ${MAX_SUBJECTS} subjects`;
  }
  for (const [subject, one] of Object.entries(subjects)) {
    if (!isName(subject) || !isSubject(one)) return `the subject ${JSON.stringify(subject)} is not counted right`;
  }
  return value as unknown as Share;
}
