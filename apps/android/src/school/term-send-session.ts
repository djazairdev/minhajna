// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A term's marks sent to the state's stand-in in a demo world (#591, Term-send,
// §3.7, §5.9, R-3.7-02, R-3.7-09, R-5.5-11, answer 619). The courses are the
// classes and subjects of the timetable in force on the world's date, or else
// of the latest sent, never a one-day part, as the teacher's channel gives it
// (week-sign-session.ts); the term is the one holding that date, or between
// terms the one that last ended. A world records no marks, so a course's marks
// are those the world makes up (the core's term-send.ts) for the class's pupils
// as the world's school lists them, found by name key, which stands in for the
// sector's class list, on the scale and by the official formula of the school's
// level, with their appreciations from the bundled list; a class the school
// does not list, or a subject the country does not know, has none. Sending
// writes the export on the world's date with the world's school ID, the class's
// name as the school lists it and the subject's country code, checks every
// pupil has every part and that it gives back every row shown, signs it with
// the key the teacher joined with and sends it, sealed, to the stand-in
// (state-standin.ts); either failing is refused as E_TERM_MISMATCH.

import {
  compareDays,
  exportMatches,
  formulaFor,
  madeUpTermMarks,
  signExport,
  termExportText,
  termMarksSeed,
  type AppreciationList,
  type AssessmentData,
  type DemoClass,
  type DemoSchool,
  type Day,
  type Formula,
  type SchoolJoined,
  type SchoolYear,
  type SignedPart,
  type Subject,
  type Term,
  type TermExportHead,
  type TermMarks,
  timetableNameKey,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { sessionsOf } from '../timetable/teacher-session';
import { standingOn, termOn } from '../week/school-mine-session';
import { courseKey, subjectCode, type WeekToSign } from '../week/week-sign-session';
import { deliverMarks, type StandInReceipt } from './state-standin';

/** A course of the timetable: its class and subject as written, and the subject's country code or null. */
export type TermCourse = Pick<WeekToSign, 'class' | 'subject' | 'code'>;

/** A course's term marks, or why it has none. */
export type TermSheet =
  | { readonly kind: 'no-subject' }
  | { readonly kind: 'no-list' }
  | {
      readonly kind: 'marks';
      readonly room: DemoClass;
      readonly formula: Formula | null;
      readonly release: string;
      readonly marks: TermMarks;
      readonly head: TermExportHead;
    };

/** The term to send on a day: the one holding it, or between terms the one that last ended; null before any ended. */
export function sendingTerm(year: SchoolYear, day: Day): Term | null {
  const ended = [...year.terms]
    .filter((one) => compareDays(one.to, day) < 0)
    .sort((one, other) => compareDays(one.to, other.to));
  return termOn(year, day) ?? ended.at(-1) ?? null;
}

/** Each class and subject of the timetable in force on the day, or else the latest sent, once, in its order. */
export function termCourses(parts: readonly SignedPart[], day: Day, subjects: readonly Subject[]): TermCourse[] {
  const part = (standingOn(parts, day) ?? [...parts].reverse().find((one) => !one.part.once))?.part;
  const found = new Map<string, TermCourse>();
  for (const one of part === undefined ? [] : sessionsOf(part)) {
    const course = { class: one.class, subject: one.subject, code: subjectCode(subjects, one.subject) };
    if (!found.has(courseKey(course))) found.set(courseKey(course), course);
  }
  return [...found.values()];
}

/** A level's scale: its subject's preset's, else any preset's at the level, else 20. */
const scaleOf = (data: AssessmentData, level: string, subject: string) =>
  (
    data.presets.find((one) => one.level === level && one.subjects?.includes(subject)) ??
    data.presets.find((one) => one.level === level)
  )?.scale ?? 20;

/** A course's made-up marks for a term, signed on the day, from the world's school and the bundled data. */
export function termSheet(
  world: string,
  school: DemoSchool,
  course: TermCourse,
  term: number,
  day: Day,
  data: { readonly assessment: AssessmentData; readonly list: AppreciationList },
): TermSheet {
  if (course.code === null) return { kind: 'no-subject' };
  const room = school.classes.find((one) => timetableNameKey(one.name) === timetableNameKey(course.class));
  if (room === undefined) return { kind: 'no-list' };
  const formula = formulaFor(data.assessment, school.level, course.code) ?? null;
  const scale = scaleOf(data.assessment, school.level, course.code);
  const seed = termMarksSeed(world, room.name, course.code, term);
  const marks = madeUpTermMarks(seed, room.pupils, formula, scale, data.list);
  const head = { world, school: school.id, term, className: room.name, subject: course.code, signed: day };
  return { kind: 'marks', room, formula, release: data.assessment.release, marks, head };
}

/** How many pupils have a mark or an absence for every part. */
export const termComplete = (marks: TermMarks) =>
  marks.rows.filter((row) => marks.parts.every((part) => row.values[part] !== undefined)).length;

/** How many of the marks' rows the export about to be signed gives back, of how many. */
export const termMatches = (head: TermExportHead, marks: TermMarks) =>
  exportMatches(termExportText(head, marks), marks);

/** The course's latest receipt for the term from this device's key, among the world's. */
export const courseReceipt = (receipts: readonly StandInReceipt[], join: SchoolJoined, head: TermExportHead) =>
  receipts.find(
    (one) =>
      one.signer === join.certificate.subject &&
      one.term === head.term &&
      one.subject === head.subject &&
      timetableNameKey(one.class) === timetableNameKey(head.className),
  );

/** Writes, checks, signs and sends a course's term export: the stand-in's receipt, and whether it came before. */
export async function sendTermMarks(
  world: Pick<OpenWorld, 'world'>,
  join: SchoolJoined,
  head: TermExportHead,
  marks: TermMarks,
  kit: WorldKit,
  send: Send = worldRequest,
) {
  const text = termExportText(head, marks);
  const { matched, total } = exportMatches(text, marks);
  if (matched !== total || termComplete(marks) !== marks.rows.length)
    throw failed('The export does not give back the marks shown', 'E_TERM_MISMATCH');
  const signer = {
    publicKey: join.certificate.publicKey,
    sign: (one: string) => kit.sign(join.pkcs8, one),
    verify: kit.verify,
  };
  const signed = await kitStep(() => signExport(text, join.certificate, signer));
  return deliverMarks(world.world, signed, kit, send);
}
