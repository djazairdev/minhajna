// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher of a teachers' demo world and the sendings their classes would
// make (#622, choice D6, answers 547, 626, 675 and 696). Every device rebuilds
// the world's description from its ID, as a national world's (answer 591), with
// no school space, and the phone or PC acting as the world's teacher is the
// first teacher of its first CEM, who teaches a 1AM and a 4AM class; a class
// that pins no pack makes no sending, as its sessions say nothing of a plan.
// Their classes' terms come from the same generator as a seeded school's
// (seeded-term.ts), run to the term's end over the teacher's own classes and
// sessions, which give the same weeks as the whole school. The term whose
// sendings are shown is the latest the world's date has ended. Its token and
// each class's sending ID are drawn at random the first time its sendings are
// shown, and kept in the world's store as a device-layer event, the first that
// reads for a term counting, not the latest as for most records, so what was
// shown is what is sent; nothing is sent here.

import { compareDays, type Day } from './day.ts';
import type { DemoSchool, DemoTeacher, DemoWorld } from './demo-world.ts';
import type { InsightsDraw } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Digest, Entry } from './history.ts';
import type { RandomBytes } from './id.ts';
import { insightsSending, newSendingId, newTermToken, schoolTermCode, type InsightsSending } from './insights.ts';
import type { BellData } from './bells.ts';
import type { Reference, SchoolYear, Term } from './reference.ts';
import { YEAR_ID } from './reference-fields.ts';
import { directorSchool } from './school-dashboard.ts';
import { seededTerm } from './seeded-term.ts';
import type { WorldMac } from './world-keys.ts';

export type { InsightsDraw } from './device-events.ts';

const HEX32 = /^[0-9a-f]{32}$/u;

/** Why a class makes no sending: it pins no pack, so its sessions are entered freely and say nothing of a plan. */
export const NO_PACK = 'the class pins no pack';

/** The teacher a device acts as in a teachers' world, with their school. */
export interface WorldTeacher {
  readonly school: DemoSchool;
  readonly teacher: DemoTeacher;
}

/** One class's sending for a term, or why it makes none. */
export interface ClassSending {
  readonly classId: string;
  readonly sending: InsightsSending | string;
}

/** The world's teacher: the first teacher of its first CEM, or null when it has none. */
export function worldTeacher(world: DemoWorld): WorldTeacher | null {
  const school = directorSchool(world);
  const teacher = school?.teachers[0];
  return school === null || teacher === undefined ? null : { school, teacher };
}

/** The latest term the date has ended, as insights count terms, or null before the first ends. */
export function endedTerm(year: SchoolYear, date: Day): (Term & { readonly number: 1 | 2 | 3 }) | null {
  const ended = year.terms.filter((one) => compareDays(one.to, date) <= 0 && [1, 2, 3].includes(one.number));
  return (ended.at(-1) as (Term & { readonly number: 1 | 2 | 3 }) | undefined) ?? null;
}

/** A new draw for a term: its token, and a sending ID for each class. */
export function drawInsights(
  year: string,
  term: 1 | 2 | 3,
  classIds: readonly string[],
  random: RandomBytes,
): InsightsDraw {
  const ids = Object.fromEntries(classIds.map((one) => [one, newSendingId(random)]));
  return { year, term, token: newTermToken(random), ids };
}

/** A kept draw as the store may hold it, or null when it does not read. */
export function readInsightsDraw(value: unknown): InsightsDraw | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { year, term, token, ids, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || typeof year !== 'string' || !YEAR_ID.test(year)) return null;
  if ((term !== 1 && term !== 2 && term !== 3) || typeof token !== 'string' || !HEX32.test(token)) return null;
  if (typeof ids !== 'object' || ids === null || Array.isArray(ids)) return null;
  const entries = Object.entries(ids as Record<string, unknown>);
  if (!entries.every(([key, id]) => key !== '' && typeof id === 'string' && HEX32.test(id))) return null;
  return { year, term, token, ids: Object.fromEntries(entries) as Record<string, string> };
}

/** The draw the store keeps for a term: the first that reads for it, or null. */
export function keptDraw(entries: readonly Entry[], year: string, term: 1 | 2 | 3): InsightsDraw | null {
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'insights.drawn') continue;
    const draw = readInsightsDraw(event.drawn);
    if (draw !== null && draw.year === year && draw.term === term) return draw;
  }
  return null;
}

/** The school cut to the teacher's classes and sessions, for which the generator gives the same weeks. */
export function teacherPart({ school, teacher }: WorldTeacher): DemoSchool {
  return {
    ...school,
    classes: school.classes.filter((one) => teacher.classIds.includes(one.id)),
    week: school.week.filter((one) => one.teacherId === teacher.id),
  };
}

export interface TeacherSendingsInput {
  /** The world's ID, which every draw of its generator starts from. */
  readonly seed: string;
  readonly teacher: WorldTeacher;
  readonly reference: Reference;
  readonly bells: BellData;
  readonly term: Term & { readonly number: 1 | 2 | 3 };
  readonly draw: InsightsDraw;
}

/** Each of the teacher's classes' sendings for the term, in the school's order of classes. */
export async function teacherSendings(
  input: TeacherSendingsInput,
  mac: WorldMac,
  digest: Digest,
): Promise<ClassSending[]> {
  const { seed, teacher, reference, bells, term, draw } = input;
  const { school } = teacher;
  const weeks = await seededTerm(
    { seed, school: teacherPart(teacher), space: school.id, reference, closures: [], bells, until: term.to },
    mac,
  );
  const year = reference.year.id;
  const schoolTerm = await schoolTermCode(digest, {
    wilaya: school.wilaya,
    school: school.id,
    year,
    term: term.number,
  });
  const subject = teacher.teacher.subject;
  return school.classes
    .filter((one) => teacher.teacher.classIds.includes(one.id))
    .map((one) => {
      const pack = one.packs[subject];
      const id = draw.ids[one.id];
      if (pack === undefined) return { classId: one.id, sending: NO_PACK };
      if (id === undefined) return { classId: one.id, sending: 'the draw holds no sending ID for the class' };
      const course = weeks.filter((week) => week.classId === one.id && week.teacherId === teacher.teacher.id);
      const sending = insightsSending({
        id,
        token: draw.token,
        schoolTerm,
        year,
        term: term.number,
        wilaya: school.wilaya,
        grade: one.grade,
        subject,
        pack,
        from: term.from,
        to: term.to,
        weeks: course.flatMap((week) => week.versions),
      });
      return { classId: one.id, sending };
    });
}
