// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's chart for a school exam in a subject and grade (#601, answers
// 631 and 632): the pack its classes pin, each class's position on the figures
// day, the furthest item of the pack its signed weeks worked on, and its
// forecast on the forecast day, the last school day before the exam, with the
// setters who sign its cut, each named and known by their channel's key. A
// class's forecast carries its own pace, the items it reached over the open
// days from the year's first day to the figures day, over the open days after
// it up to the forecast day, so it never moves the class and is never a
// judgement; a class with no position has no forecast. The chart names its
// world, school, exam, subject and grade, so a chart for one room is never read
// for another; names hold no hidden characters, and a pack of more than
// CHART_MOST's items has no chart, so its room is not opened.

import { isSigningKey } from './certify.ts';
import { addDays, compareDays, isDay, type Day } from './day.ts';
import { PACK_ID } from './pack.ts';
import { ITEM_ID } from './pack-fields.ts';
import { RELEASE } from './read.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ID, SCHOOL } from './school-key-shape.ts';
import { named, record } from './timetable-record.ts';
import { isWorldId } from './world-code.ts';

export const EXAM_CHART_FORMAT = 'minhajna/exam-chart/1';
/** An exam's ID, as world-exams.ts makes it. */
export const EXAM_ID = /^[a-z0-9-]{1,96}$/u;
/** The most items, classes and setters a chart holds. */
export const CHART_MOST = { items: 1000, classes: 64, setters: 32 } as const;

/** What names a cut room: the world, the school's space, the exam, the subject and the grade. */
export interface RoomName {
  readonly world: string;
  readonly school: string;
  readonly exam: string;
  readonly subject: string;
  readonly grade: string;
}

/** A setter, by their assignment, their name and the public key their channel's joining certificate names. */
export interface ChartSetter {
  readonly assignment: string;
  readonly name: string;
  readonly key: string;
}

/** A class's position on the figures day and its forecast, both items of the chart's pack, or null. */
export interface ChartClass {
  readonly name: string;
  readonly position: string | null;
  readonly forecast: string | null;
}

export interface ExamChart extends RoomName {
  readonly from: Day;
  readonly figuresDay: Day;
  readonly signBy: Day;
  readonly forecastDay: Day;
  readonly pack: { readonly id: string; readonly release: string };
  readonly items: readonly string[];
  readonly setters: readonly ChartSetter[];
  readonly classes: readonly ChartClass[];
}

const text = (one: unknown, shape: RegExp): one is string => typeof one === 'string' && shape.test(one);
const once = (list: readonly string[]) => new Set(list).size === list.length;

/** Whether a value names a room, with these fields only. */
export function isRoomName(value: unknown, more: readonly string[] = []): value is RoomName {
  if (!record(value)) return false;
  const keys = ['world', 'school', 'exam', 'subject', 'grade', ...more];
  const { world, school, exam, subject, grade } = value;
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key)) &&
    isWorldId(world) &&
    text(school, SCHOOL) &&
    text(exam, EXAM_ID) &&
    text(subject, ENTRY_ID) &&
    text(grade, ENTRY_ID)
  );
}

const FIELDS = ['from', 'figuresDay', 'signBy', 'forecastDay', 'pack', 'items', 'setters', 'classes'];

/**
 * Whether a value is a chart: its days in order, its pack and items each
 * once, its setters each with their own assignment and key, its classes each
 * named once with a forecast exactly when a position, never before it.
 */
export function isExamChart(value: unknown): value is ExamChart {
  if (!isRoomName(value, FIELDS)) return false;
  const { from, figuresDay, signBy, forecastDay, pack, items, setters, classes } = value as unknown as ExamChart;
  if (![figuresDay, signBy, forecastDay, from].every(isDay)) return false;
  const before = (a: Day, b: Day) => compareDays(a, b) < 0;
  if (before(forecastDay, figuresDay) || before(signBy, figuresDay) || !before(forecastDay, from)) return false;
  if (!before(signBy, from) || !record(pack) || Object.keys(pack).length !== 2) return false;
  if (!text(pack.id, PACK_ID) || !text(pack.release, RELEASE)) return false;
  const listed = (list: unknown, most: number, each: (one: unknown) => boolean): list is unknown[] =>
    Array.isArray(list) && list.length <= most && list.every(each);
  if (!listed(items, CHART_MOST.items, (one) => text(one, ITEM_ID)) || !once(items)) return false;
  const at = new Map(items.map((item, place) => [item, place]));
  const isSetter = (one: unknown) =>
    record(one) &&
    Object.keys(one).length === 3 &&
    text(one.assignment, ID) &&
    named(one.name) &&
    isSigningKey(one.key);
  const isClass = (one: unknown) => {
    if (!record(one) || Object.keys(one).length !== 3 || !named(one.name)) return false;
    const { position, forecast } = one;
    if (position === null || forecast === null) return position === forecast;
    if (typeof position !== 'string' || typeof forecast !== 'string') return false;
    const [here, there] = [at.get(position), at.get(forecast)];
    return here !== undefined && there !== undefined && here <= there;
  };
  return (
    listed(setters, CHART_MOST.setters, isSetter) &&
    once(setters.map((one) => one.assignment)) &&
    once(setters.map((one) => one.key)) &&
    listed(classes, CHART_MOST.classes, isClass) &&
    once(classes.map((one) => one.name))
  );
}

/** How many days from `from` to `to`, both included, `open` says are school days. */
export function openDays(from: Day, to: Day, open: (day: Day) => boolean): number {
  let count = 0;
  for (let day = from; compareDays(day, to) <= 0; day = addDays(day, 1)) if (open(day)) count += 1;
  return count;
}

/** The last school day before an exam's first day, after its figures day, or the figures day when none is. */
export function forecastDayOf(figuresDay: Day, from: Day, open: (day: Day) => boolean): Day {
  for (let day = addDays(from, -1); compareDays(day, figuresDay) > 0; day = addDays(day, -1)) if (open(day)) return day;
  return figuresDay;
}

/**
 * The place in the pack a class at `position` reaches by the forecast day at
 * its own pace: its items so far over the open days so far, carried over the
 * open days left, never past the pack's last item nor before the position;
 * a pack of no item has no place, and no day left keeps the position.
 */
export function forecastAt(position: number, count: number, before: number, left: number): number {
  if (count < 1) return -1;
  if (position < 0 || before <= 0 || left <= 0) return Math.min(position, count - 1);
  return Math.min(count - 1, Math.max(position, Math.floor(((position + 1) * (before + left)) / before) - 1));
}
