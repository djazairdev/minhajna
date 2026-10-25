// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's picture of a school (#246, R-Picture, answers 489 and 490): the
// statements received for the latest school year among them, one part per
// grade. A statement dated after the day it came, or outside its school year,
// is left out and counted, so no key can take over the picture. Rows are the
// classes' sections and columns the subjects; each cell is the latest statement
// for that class and subject, by the statement's day, then the one kept last.
// When the teachers were named with two schools or more, the rows are grouped
// by school, those with none last. Nothing is ranked: rows follow their
// sections' names.

import { compareDays, type Day } from './day.ts';
import type { TeacherName } from './share-events.ts';
import type { Received } from './statement-received.ts';

/** One section's row: its latest statement per subject code. */
export interface PictureRow {
  readonly section: string;
  readonly cells: ReadonlyMap<string, Received>;
}

/** The rows of one school, or of all when fewer than two schools are named. */
export interface PictureGroup {
  /** The school the teachers were named with; null for none, or when the rows are not grouped. */
  readonly school: string | null;
  readonly rows: readonly PictureRow[];
}

/** One grade's part of the picture. */
export interface PictureGrade {
  readonly level: string;
  readonly grade: string;
  /** The subject codes with a statement, in the order first met; the reader orders them. */
  readonly subjects: readonly string[];
  readonly groups: readonly PictureGroup[];
  /** The statements in its cells, and the keys that signed them. */
  readonly statements: number;
  readonly teachers: number;
}

export interface Picture {
  /** The school year shown, such as `2026-2027`; null when nothing was received. */
  readonly year: string | null;
  /** The grades with a statement, in the order first met; the reader orders them. */
  readonly grades: readonly PictureGrade[];
  /** The day the last statement of that year came. */
  readonly latest: Day | null;
  /** The statements left out: dated after the day they came, or outside their school year. */
  readonly leftOut: number;
  /** True while two keys or more are shown, ungrouped, and one has no school: their rows may merge. */
  readonly mayMerge: boolean;
}

/** A row while it is gathered, with the school it is grouped under. */
type Gathered = { school: string | null; section: string; cells: Map<string, Received> };

const bySection = (a: PictureRow, b: PictureRow) => a.section.localeCompare(b.section, undefined, { numeric: true });

/** Whether a statement's day falls in its school year, from August to July, and not after the day it came. */
export function inPicture(one: Received): boolean {
  const years = /^(\d{4})-(\d{4})$/.exec(one.statement.class.year);
  if (years === null || Number(years[2]) !== Number(years[1]) + 1) return false;
  const { day } = one.statement;
  return day >= `${years[1]}-08-01` && day <= `${years[2]}-07-31` && compareDays(day, one.day) <= 0;
}

/** The picture of the statements received, with the names the reader gave the keys. */
export function statementPicture(list: readonly Received[], names: ReadonlyMap<string, TeacherName>): Picture {
  const kept = list.filter(inPicture);
  const year = kept.reduce<string | null>(
    (latest, one) => (latest === null || one.statement.class.year > latest ? one.statement.class.year : latest),
    null,
  );
  const shown = kept.filter((one) => one.statement.class.year === year);
  const schoolOf = (one: Received) => names.get(one.spki)?.school ?? null;
  const grouped = new Set(shown.map(schoolOf).filter((school) => school !== null)).size >= 2;
  const keys = new Set(shown.map((one) => one.spki));
  const grades = new Map<string, { level: string; subjects: Set<string> }>();
  const rows = new Map<string, Map<string, Gathered>>();
  for (const one of shown) {
    const { level, grade, section, subject } = one.statement.class;
    const part = grades.get(grade) ?? { level, subjects: new Set() };
    grades.set(grade, part);
    part.subjects.add(subject);
    const school = grouped ? schoolOf(one) : null;
    const key = JSON.stringify([school, section]);
    const gradeRows = rows.get(grade) ?? new Map<string, Gathered>();
    rows.set(grade, gradeRows);
    const row = gradeRows.get(key) ?? { school, section, cells: new Map<string, Received>() };
    gradeRows.set(key, row);
    const before = row.cells.get(subject);
    if (before === undefined || compareDays(one.statement.day, before.statement.day) >= 0) row.cells.set(subject, one);
  }
  return {
    year,
    latest: shown.reduce<Day | null>(
      (day, one) => (day === null || compareDays(one.day, day) > 0 ? one.day : day),
      null,
    ),
    leftOut: list.length - kept.length,
    mayMerge: !grouped && keys.size >= 2 && shown.some((one) => schoolOf(one) === null),
    grades: [...grades].map(([grade, part]) => {
      const all = [...(rows.get(grade)?.values() ?? [])];
      const cells = all.flatMap((row) => [...row.cells.values()]);
      const schools = [...new Set(all.map((row) => row.school))].sort((a, b) =>
        a === null ? 1 : b === null ? -1 : a.localeCompare(b),
      );
      return {
        level: part.level,
        grade,
        subjects: [...part.subjects],
        groups: schools.map((school) => ({
          school,
          rows: all
            .filter((row) => row.school === school)
            .map(({ section, cells }) => ({ section, cells }))
            .sort(bySection),
        })),
        statements: cells.length,
        teachers: new Set(cells.map((one) => one.spki)).size,
      };
    }),
  };
}
