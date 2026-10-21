// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list of items, without a pack (#227, PRD §4.2, R-4.2-06,
// R-4.2-20, answer 346). It is the class's plan: the core reads it as a
// pack of its own, so Today proposes its next item and the plan, pace and
// texts book follow it. The teacher edits it in place; each save records
// the whole list. A unit groups the items after it and takes no session.
// A removed item keeps its title for the sessions recorded under it, and
// nothing recorded changes. The list carries the day it began and the day
// it was last offered for review, so a backup or another device keeps its
// history. The list is never a pack: its status is `own`, and no class
// change or layer applies to it.

import { isDay, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { ITEM_KINDS, type ItemKind, type PackItem, type PlanPack, type StageTemplate } from './pack.ts';
import type { Course, SchoolClass } from './records.ts';
import { isOneLine } from './calendar-notice-read.ts';
import type { CountryProfile } from './reference.ts';

export interface FreeItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly title: string;
  /** Sessions from 1 to 60; a unit has none. */
  readonly sessions?: number;
  /** The stages, when the teacher gives them. */
  readonly stages?: readonly string[];
}

export interface FreeList {
  readonly courseId: string;
  /** The day the teacher first saved it. */
  readonly started: Day;
  /** The day the teacher last offered it for review, if ever. */
  readonly offered?: Day;
  readonly items: readonly FreeItem[];
  /** Items taken out of the list, kept for their titles. */
  readonly removed?: readonly Pick<FreeItem, 'id' | 'kind' | 'title'>[];
}

export const FREE_ITEMS_MAX = 300;
export const FREE_STAGES_MAX = 12;
export const FREE_TITLE_MAX = 160;
export const FREE_STAGE_MAX = 80;
const ITEM_ID = /^[A-Za-z0-9._-]{1,64}$/;

const isKind = (kind: string): boolean => (ITEM_KINDS as readonly string[]).includes(kind);

function itemFits(item: FreeItem): boolean {
  const sessions = item.sessions;
  const stages = item.stages ?? [];
  return (
    ITEM_ID.test(item.id) &&
    isKind(item.kind) &&
    isOneLine(item.title, FREE_TITLE_MAX) &&
    (item.kind === 'unit'
      ? sessions === undefined && stages.length === 0
      : sessions !== undefined && Number.isInteger(sessions) && sessions >= 1 && sessions <= 60) &&
    stages.length <= FREE_STAGES_MAX &&
    stages.every((stage) => isOneLine(stage, FREE_STAGE_MAX))
  );
}

/**
 * Whether a list keeps the rules: its days, at most 300 items and 300
 * removed, each ID once, every item and removed entry well formed.
 */
export function freeListFits(list: FreeList): boolean {
  const removed = list.removed ?? [];
  const ids = [...list.items, ...removed].map((item) => item.id);
  return (
    isDay(list.started) &&
    (list.offered === undefined || (isDay(list.offered) && list.offered >= list.started)) &&
    list.items.length <= FREE_ITEMS_MAX &&
    removed.length <= FREE_ITEMS_MAX &&
    new Set(ids).size === ids.length &&
    list.items.every(itemFits) &&
    removed.every((item) => ITEM_ID.test(item.id) && isKind(item.kind) && isOneLine(item.title, FREE_TITLE_MAX))
  );
}

/** The record of saving a course's list; refused for a course with a pack, or a list that breaks the rules. */
export function saveFreeList(courses: ReadonlyMap<string, Course>, list: FreeList): RecordEvent {
  const course = courses.get(list.courseId);
  if (course === undefined || course.pack !== null) throw new RangeError('Only a class without a pack keeps a list');
  if (!freeListFits(list)) throw new RangeError('This list does not keep the rules');
  return { kind: 'list.set', list };
}

/** The list with an item added before another, or at the end. */
export function withItem(list: FreeList, item: FreeItem, before: string | null): FreeList {
  const items = [...list.items];
  const at = before === null ? -1 : items.findIndex((one) => one.id === before);
  items.splice(at < 0 ? items.length : at, 0, item);
  return { ...list, items };
}

/** The list with an item replaced by its edited version, in its place. */
export function withEdit(list: FreeList, item: FreeItem): FreeList {
  return { ...list, items: list.items.map((one) => (one.id === item.id ? item : one)) };
}

/** The list with an item moved before another, or to the end. */
export function withMove(list: FreeList, id: string, before: string | null): FreeList {
  const item = list.items.find((one) => one.id === id);
  if (item === undefined || before === id) return list;
  return withItem({ ...list, items: list.items.filter((one) => one.id !== id) }, item, before);
}

/** The list without the items named, each kept for its title. */
export function withoutItems(list: FreeList, ids: readonly string[]): FreeList {
  const gone = list.items.filter((one) => ids.includes(one.id));
  if (gone.length === 0) return list;
  return {
    ...list,
    items: list.items.filter((one) => !ids.includes(one.id)),
    removed: [...(list.removed ?? []), ...gone.map(({ id, kind, title }) => ({ id, kind, title }))],
  };
}

/** The record of offering a course's saved list for review on `day`. */
export function offerFreeList(courses: ReadonlyMap<string, Course>, list: FreeList, day: Day): RecordEvent {
  return saveFreeList(courses, { ...list, offered: day });
}

const memo = new WeakMap<FreeList, WeakMap<Course, PlanPack>>();

/**
 * The list as a pack of its own, counted in sessions: an ID made from the
 * course's level, grade and subject that no published pack takes, its
 * stages as templates, and its removed items kept for their titles.
 */
export function ownPack(list: FreeList, course: Course, schoolClass: SchoolClass, country: CountryProfile): PlanPack {
  const byCourse = memo.get(list) ?? new WeakMap<Course, PlanPack>();
  memo.set(list, byCourse);
  const known = byCourse.get(course);
  if (known !== undefined) return known;
  const subject = country.subjects.find((one) => one.code === course.subject);
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .slice(0, 40) || 'x';
  const grade = course.grade ?? schoolClass.grade;
  const templates: StageTemplate[] = [];
  let unit: string | undefined;
  const items = list.items.map((item): PackItem => {
    if (item.kind === 'unit') {
      unit = item.id;
      return { id: item.id, kind: 'unit', title: item.title };
    }
    const stages = item.stages !== undefined && item.stages.length > 0 ? `${item.id}~stages` : undefined;
    if (stages !== undefined) templates.push({ id: stages, stages: item.stages ?? [] });
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      budget: item.sessions ?? 1,
      ...(unit !== undefined && { unit }),
      ...(stages !== undefined && { stages }),
    };
  });
  const retired = (list.removed ?? []).map(({ id, kind, title }): PackItem => ({ id, kind, title }));
  const pack: PlanPack = {
    format: 1,
    id: [country.code, schoolClass.level, grade, course.subject, `own-${slug(course.id)}`].map(slug).join('.'),
    release: 'own',
    status: 'own',
    licence: 'full-text',
    language: subject?.language ?? country.language ?? 'ar',
    anchor: { kind: 'budgets', unit: 'sessions' },
    provenance: { issuer: '', edition: 'own' },
    stageTemplates: templates,
    items,
    merges: [],
    ...(retired.length > 0 && { retired }),
  };
  byCourse.set(course, pack);
  return pack;
}
