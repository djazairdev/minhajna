// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lesson notes, «المذكرة» (#237, PRD §3.8, R-3.8-32 to R-3.8-34, answers 416
// to 418). A note is kept for a plan item of a class's subject and numbered
// for the class, across its subjects, in the order the notes are made. It is
// the teacher's own preparation: it syncs, backs up and prints, and leaves the
// teacher on no other route. Its head comes from the plan: the sequence, the
// domain, the resource and the duration. Its paragraphs are the competence
// indicator, the objectives and the resources, then one for each stage of the
// item's stage template. The plan proposes them; the packs carry no text for
// them yet, so they come empty, and the draft gives the item's textbook pages
// for the resources paragraph. A proposed paragraph is kept in the note once
// the teacher accepts or writes it, and the teacher's own paragraphs follow,
// each with its title. A written note kept for the same item of the same pack
// in an earlier year's class of the same subject and grade can be reused.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { courseGrade } from './joint.ts';
import { lineageIds } from './lineage.ts';
import { budgetInSessions, stageNames } from './pack.ts';
import { followId, type Migration } from './pack-migration.ts';
import type { LocalizedText } from './reference.ts';
import { findPackItem } from './plan-layer.ts';
import type { State } from './state-type.ts';

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** A plan paragraph's key: the indicator, the objectives, the resources, or a stage, counted from 1. */
export type NoteKey = 'indicator' | 'objectives' | 'resources' | `stage-${number}`;

export interface NoteParagraph {
  /** The plan paragraph it fills; none for one the teacher added. */
  readonly key?: NoteKey;
  /** The teacher's title, for a paragraph the teacher added. */
  readonly title?: string;
  readonly text: string;
}

export interface LessonNote {
  readonly id: string;
  readonly courseId: string;
  /** The plan item the note is for. */
  readonly itemId: string;
  /** Its number for the class, from 1. */
  readonly number: number;
  /** The plan paragraphs accepted or written, then the teacher's own, in order. */
  readonly paragraphs: readonly NoteParagraph[];
}

/** A paragraph the plan proposes: its key, a stage's name, and its text. */
export interface NoteProposal {
  readonly key: NoteKey;
  /** For a stage, its name as the plan prints it. */
  readonly stage?: string;
  readonly text: string;
}

/** What the plan gives a note: the head, the textbook pages, and the proposed paragraphs. */
export interface NoteDraft {
  /** The sequence's title, when the item belongs to one. */
  readonly unit?: string;
  /** The domain: the item's activity, in each language, when it names one. */
  readonly domain?: LocalizedText;
  /** The resource: the item's title. */
  readonly resource: string;
  /** The item's budget in minutes. */
  readonly minutes: number;
  readonly pages?: string;
  readonly proposals: readonly NoteProposal[];
}

/**
 * What the plan gives a note for `itemId` in the course, or null when its
 * pack holds no such item. An item of an earlier release, taught before the
 * class moved, is read as the item it was carried to, or its first part.
 */
export function noteDraft(context: Context, courseId: string, itemId: string): NoteDraft | null {
  const setup = courseSetup(context, courseId);
  const item =
    findPackItem(setup.pack, itemId) ??
    followId(setup.migration, itemId)
      .map((id) => findPackItem(setup.pack, id))
      .find((one) => one !== undefined);
  if (setup.pack === null || item === undefined) return null;
  const unit = item.unit === undefined ? undefined : findPackItem(setup.pack, item.unit)?.title;
  const domain = setup.pack.activities?.find((one) => one.code === item.activity)?.name;
  const stages = stageNames(setup.pack, item).map((stage, index): NoteProposal => ({
    key: `stage-${index + 1}`,
    stage,
    text: '',
  }));
  return {
    ...(unit !== undefined && { unit }),
    ...(domain !== undefined && { domain }),
    resource: item.title,
    minutes: budgetInSessions(setup.pack, item, setup.sessionMinutes) * setup.sessionMinutes,
    ...(item.pages !== undefined && { pages: item.pages }),
    proposals: [
      { key: 'indicator', text: '' },
      { key: 'objectives', text: '' },
      { key: 'resources', text: '' },
      ...stages,
    ],
  };
}

/** The courses whose notes share the course's numbering: its class's courses this year, and those they continue. */
function classCourses(state: Pick<State, 'courses'>, courseId: string): Set<string> {
  const course = state.courses.get(courseId);
  const own =
    course === undefined
      ? []
      : [...state.courses.values()].filter((one) => one.classId === course.classId && one.year === course.year);
  return new Set([...lineageIds(state, courseId), ...own.flatMap((one) => lineageIds(state, one.id))]);
}

/** The notes of the course's class this year, every subject's and its earlier courses' included, by number. */
export function notesOf(state: Pick<State, 'courses' | 'lessonNotes'>, courseId: string): LessonNote[] {
  const courses = classCourses(state, courseId);
  return [...state.lessonNotes.values()]
    .filter((note) => courses.has(note.courseId))
    .sort((a, b) => a.number - b.number || compareText(a.id, b.id));
}

/** The course's note for `itemId`, one kept by a course it continues included, if one is kept. */
export function noteFor(
  state: Pick<State, 'courses' | 'lessonNotes'>,
  courseId: string,
  itemId: string,
  migration: Migration = [],
): LessonNote | undefined {
  const courses = new Set(lineageIds(state, courseId));
  const notes = notesOf(state, courseId).filter((note) => courses.has(note.courseId));
  return notes.find((note) => note.itemId === itemId) ?? notes.find((note) => carriedTo(note, itemId, migration));
}

/** Whether a note on an item of an earlier release shows on `itemId`: its part, or its merged item (#322). */
function carriedTo(note: LessonNote, itemId: string, migration: Migration): boolean {
  return migration.length > 0 && note.itemId !== itemId && followId(migration, note.itemId).includes(itemId);
}

/** The number a new note of the course takes: one more than the highest of its class this year. */
export function nextNoteNumber(state: Pick<State, 'courses' | 'lessonNotes'>, courseId: string): number {
  return notesOf(state, courseId).reduce((highest, note) => Math.max(highest, note.number), 0) + 1;
}

/**
 * The newest note with some text kept for `itemId` in an earlier year's class of the course's subject, grade and
 * pack, to reuse.
 */
export function earlierNote(
  state: Pick<State, 'courses' | 'classes' | 'lessonNotes'>,
  courseId: string,
  itemId: string,
  migration: Migration = [],
): LessonNote | undefined {
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined) return undefined;
  const grade = courseGrade(course, schoolClass);
  const year = (note: LessonNote) => state.courses.get(note.courseId)?.year ?? '';
  return [...state.lessonNotes.values()]
    .filter((note) => {
      const other = state.courses.get(note.courseId);
      const room = other && state.classes.get(other.classId);
      return (
        (note.itemId === itemId || carriedTo(note, itemId, migration)) &&
        note.paragraphs.some((one) => one.text.trim() !== '') &&
        other !== undefined &&
        room !== undefined &&
        other.year < course.year &&
        other.subject === course.subject &&
        other.pack?.id === course.pack?.id &&
        courseGrade(other, room) === grade
      );
    })
    .sort((a, b) => compareText(year(b), year(a)) || b.number - a.number || compareText(a.id, b.id))[0];
}

/**
 * The note with the plan paragraph `key` kept with `text`, in the plan's order, a key the order lacks last, before
 * the teacher's own.
 */
export function noteWithPlan(note: LessonNote, key: NoteKey, text: string, order: readonly NoteKey[]): LessonNote {
  const kept = note.paragraphs.filter((one) => one.key !== undefined && one.key !== key);
  const own = note.paragraphs.filter((one) => one.key === undefined);
  const rank = (one: NoteParagraph) => {
    const at = order.indexOf(one.key as NoteKey);
    return at === -1 ? order.length : at;
  };
  const plan = [...kept, { key, text }].sort((a, b) => rank(a) - rank(b));
  return { ...note, paragraphs: [...plan, ...own] };
}

/** The note without the plan paragraph `key`, which goes back to the plan's proposal. */
export function noteWithoutPlan(note: LessonNote, key: NoteKey): LessonNote {
  return { ...note, paragraphs: note.paragraphs.filter((one) => one.key !== key) };
}

/**
 * The note with the teacher's own paragraph at `index` set, added at the end
 * when `index` is past the last, or removed when `paragraph` is null.
 */
export function noteWithOwn(
  note: LessonNote,
  index: number,
  paragraph: { readonly title: string; readonly text: string } | null,
): LessonNote {
  const plan = note.paragraphs.filter((one) => one.key !== undefined);
  const own = note.paragraphs.filter((one) => one.key === undefined);
  const next =
    paragraph === null
      ? own.filter((_, at) => at !== index)
      : index < own.length
        ? own.map((one, at) => (at === index ? paragraph : one))
        : [...own, paragraph];
  return { ...note, paragraphs: [...plan, ...next] };
}
