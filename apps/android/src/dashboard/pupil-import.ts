// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing pupils into a school's book from a CSV file (answer 807, R-3.2-09):
// a line for each pupil, with their registration number, name, sex and class,
// the class as the school names it. No reader for the official Excel file
// exists yet, so the file is that list saved as CSV. Before anything changes
// the page shows the new pupils, the unchanged, those whose class changes and
// those whose name or sex changes, matched on the registration number, and the
// refused lines, each with its number and why. Pupils missing from the file
// stay where they are.

import type { BookPupil, SchoolBook } from '@minhajna/core';
import { MAX_CLASS_PUPILS } from '@minhajna/core';
import { dashboardCatalogues } from './catalogues';
import { headings, names, readTable } from './csv-table';
import { idsOf, movedPupil, newId, withPupil } from './school-rules';

const COLUMNS = headings((words) => words.import.pupilColumns);
const NEEDED = ['registration', 'name', 'sex', 'class'] as const;
const REGISTRATION = /^[A-Za-z0-9_+-]{1,64}$/u;

export type PupilRefusal = 'registration' | 'name' | 'sex' | 'class' | 'twice' | 'full';

export interface PupilLine {
  readonly line: number;
  readonly kind: 'new' | 'same' | 'moved' | 'changed';
  readonly classId: string;
  readonly pupil: Omit<BookPupil, 'id'> & { readonly id: string | null };
}

export interface PupilCheck {
  readonly lines: readonly PupilLine[];
  readonly refused: readonly { readonly line: number; readonly why: PupilRefusal; readonly cell: string }[];
}

const SEXES = (['f', 'm'] as const).map((sex) => ({
  sex,
  words: Object.fromEntries(
    Object.entries(dashboardCatalogues).map(([language, words]) => [language, words.import.sex[sex]]),
  ),
}));

/** A sex as a file writes it, in any language or as its letter. */
function sexOf(cell: string): 'f' | 'm' | null {
  for (const { sex, words } of SEXES) {
    const all = Object.fromEntries(
      Object.entries(words).flatMap(([at, word]) => word.split('|').map((one, n) => [`${at}${n}`, one])),
    );
    if (names(cell, sex, all)) return sex;
  }
  return null;
}

const plain = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/gu, '');

/** The file's pupils against the book, or the columns it lacks. */
export function checkPupils(
  text: string,
  book: SchoolBook,
): PupilCheck | { readonly missing: readonly (typeof NEEDED)[number][] } {
  const table = readTable(text, COLUMNS, NEEDED);
  if (!table.ok) return { missing: NEEDED.filter((one) => table.missing.includes(one)) };
  const kept = new Map(
    book.classes.flatMap((schoolClass) =>
      schoolClass.pupils.map((pupil) => [pupil.registration, { pupil, schoolClass }]),
    ),
  );
  const counts = new Map(book.classes.map((one) => [one.id, one.pupils.length]));
  const lines: PupilLine[] = [];
  const refused: PupilCheck['refused'][number][] = [];
  const seen = new Set<string>();
  for (const { line, cells } of table.rows) {
    const { registration = '', name = '', sex = '', class: given = '' } = cells;
    const schoolClass = book.classes.find((one) => plain(one.name) === plain(given));
    const read = sexOf(sex);
    const refuse = (why: PupilRefusal, cell: string) => refused.push({ line, why, cell });
    const known = kept.get(registration);
    if (!REGISTRATION.test(registration)) refuse('registration', registration);
    else if (seen.has(registration)) refuse('twice', registration);
    else if (name === '' || name.length > 120) refuse('name', name);
    else if (read === null) refuse('sex', sex);
    else if (schoolClass === undefined) refuse('class', given);
    else if (known?.schoolClass.id !== schoolClass.id && (counts.get(schoolClass.id) ?? 0) >= MAX_CLASS_PUPILS)
      refuse('full', given);
    else {
      seen.add(registration);
      const moving = known !== undefined && known.schoolClass.id !== schoolClass.id;
      if (known === undefined || moving) counts.set(schoolClass.id, (counts.get(schoolClass.id) ?? 0) + 1);
      if (moving) counts.set(known.schoolClass.id, (counts.get(known.schoolClass.id) ?? 1) - 1);
      const same = known !== undefined && known.pupil.name === name && known.pupil.sex === read;
      lines.push({
        line,
        kind: known === undefined ? 'new' : moving ? 'moved' : same ? 'same' : 'changed',
        classId: schoolClass.id,
        pupil: { id: known?.pupil.id ?? null, name, sex: read, registration },
      });
    }
  }
  return { lines, refused };
}

/** The book with the check's new, moved and changed pupils. */
export function applyPupils(book: SchoolBook, check: PupilCheck): SchoolBook {
  return check.lines
    .filter((one) => one.kind !== 'same')
    .reduce((next, { classId, pupil }) => {
      const id = pupil.id ?? newId('p', idsOf(next));
      const moved = pupil.id === null ? next : movedPupil(next, id, classId);
      return withPupil(moved, classId, { ...pupil, id });
    }, book);
}
