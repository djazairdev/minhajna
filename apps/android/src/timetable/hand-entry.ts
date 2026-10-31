// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Entering the timetable by hand (#576, R-7.4-08, answer 594): the form's
// fields become one weekly session, numbered with the next number, never one
// used before even when its session was removed, once the class, subject,
// teacher, day, start and end are given, the times read as the template reads
// them (08:00, 8h00, 8.00) and the end comes after the start; until then, what
// is missing or unreadable is said, a clash naming the class and subject it
// meets. A session that reads is checked against those entered by the files'
// rules (clashesOf), and one that clashes cannot be added, so the timetable
// entered never holds a clash. What the checks say, what of it is said aloud (a
// clash as it comes, and, once a field is left, the session ready or why it
// does not read), each session's line in the list, and the entered sessions as
// a reading, with the sessions taught together, are worded here.

import {
  checkSessions,
  clashesOf,
  readTime,
  type ImportedSession,
  type ImportProblem,
  type TimetableImport,
  type TimetableWeek,
  type Weekday,
} from '@minhajna/core';
import type { TFunction } from 'i18next';
import { sessionText, spanText } from './grid-text';

/** The form's fields, as typed. */
export interface HandFields {
  readonly class: string;
  readonly group: string;
  readonly subject: string;
  readonly teacher: string;
  readonly room: string;
  readonly day: Weekday | null;
  readonly start: string;
  readonly end: string;
  readonly week: TimetableWeek;
}

export const NO_FIELDS: HandFields = {
  class: '',
  group: '',
  subject: '',
  teacher: '',
  room: '',
  day: null,
  start: '',
  end: '',
  week: 'both',
};

const REQUIRED = ['class', 'subject', 'teacher', 'day', 'start', 'end'] as const;

/** What the fields give: a session that can be added, or what keeps it out. */
export type HandDraft =
  | { readonly kind: 'ready'; readonly session: ImportedSession }
  | { readonly kind: 'missing'; readonly missing: readonly (typeof REQUIRED)[number][] }
  | { readonly kind: 'problems'; readonly problems: readonly ImportProblem[] };

/** The fields as a session with the given number, checked against those entered. */
export function handDraft(fields: HandFields, entered: readonly ImportedSession[], row: number): HandDraft {
  const missing = REQUIRED.filter((one) => (one === 'day' ? fields.day === null : fields[one].trim() === ''));
  if (missing.length > 0 || fields.day === null) return { kind: 'missing', missing };
  const [start, end] = [readTime(fields.start), readTime(fields.end)];
  if (start === null) return { kind: 'problems', problems: [{ row, kind: 'time', value: fields.start.trim() }] };
  if (end === null) return { kind: 'problems', problems: [{ row, kind: 'time', value: fields.end.trim() }] };
  if (end <= start) return { kind: 'problems', problems: [{ row, kind: 'order' }] };
  const trim = (one: string) => one.trim();
  const session: ImportedSession = {
    row,
    class: trim(fields.class),
    group: trim(fields.group),
    subject: trim(fields.subject),
    teacher: trim(fields.teacher),
    room: trim(fields.room),
    day: fields.day,
    start,
    end,
    week: fields.week,
  };
  const clashes = clashesOf(entered, session);
  return clashes.length > 0 ? { kind: 'problems', problems: clashes } : { kind: 'ready', session };
}

/** The entered sessions as a reading: none clash, and those taught together are listed. */
export const handReading = (sessions: readonly ImportedSession[]): TimetableImport =>
  checkSessions<ImportProblem>(sessions);

/** What the form's check says, in the screen's language, a clash naming the class and subject it meets. */
export function draftText(t: TFunction, draft: HandDraft, entered: readonly ImportedSession[]): string[] {
  if (draft.kind === 'ready') return [t('ttImport.handReady')];
  if (draft.kind === 'missing')
    return [
      t('ttImport.handMissing', {
        columns: draft.missing.map((one) => t(`ttImport.column.${one}`)).join(t('ttImport.listSeparator')),
      }),
    ];
  return draft.problems.map((problem) => {
    switch (problem.kind) {
      case 'time':
        return t('ttImport.problem.time', { value: problem.value });
      case 'teacher':
      case 'class':
      case 'room': {
        const other = entered.find((one) => one.row === problem.with);
        return t(`ttImport.handClash.${problem.kind}`, {
          with: problem.with,
          class: other?.class ?? '',
          subject: other?.subject ?? '',
        });
      }
      default:
        return t('ttImport.problem.order');
    }
  });
}

/** What the form says aloud: its clashes as they come, and once a field is left, the session ready or why it fails. */
export function spokenText(t: TFunction, draft: HandDraft, entered: readonly ImportedSession[], left: boolean): string {
  if (draft.kind === 'missing') return '';
  const clashes = draft.kind === 'problems' && draft.problems.some((one) => 'with' in one);
  return clashes || left ? draftText(t, draft, entered).join(' ') : '';
}

/** A session entered, as the list shows it: its number, day, span, class, group, subject, teacher and room. */
export function entryText(t: TFunction, session: ImportedSession): string {
  const what = [session.class, sessionText(t, session), session.room].filter((one) => one !== '').join(' · ');
  return t('ttImport.entry', {
    number: session.row,
    day: t(`week.days.${session.day}`),
    span: spanText(session.start, session.end),
    what,
  });
}
