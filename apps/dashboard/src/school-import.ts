// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing schools into the Ministry's draft from a CSV file (answer 809): a
// line for each school, with its commune's code, its cycle, its name and,
// when it has one, its code. Before anything changes the page shows what is
// new, what is unchanged, what changes and what is refused, matched on the
// school's code, else on its commune, cycle and name. A commune or school code
// Excel wrote as a number gets back the leading zero it dropped. A refused line
// says its number and why; the rest can still be applied.

import type { CountryProfile, DirectorySchool, ReferenceDraft } from '@minhajna/core';
import { communeByCode } from './communes';
import { headings, names, readTable } from './csv-table';
import { newSchoolId, withSchool } from './reference-rules';

export type SchoolRefusal = 'commune' | 'level' | 'name' | 'code' | 'twice';

export interface SchoolLine {
  readonly line: number;
  readonly kind: 'new' | 'same' | 'changed';
  /** The school, with no id yet when the file gives none and it is new. */
  readonly school: Omit<DirectorySchool, 'id'> & { readonly id: string | null };
}

export interface SchoolCheck {
  readonly lines: readonly SchoolLine[];
  readonly refused: readonly { readonly line: number; readonly why: SchoolRefusal; readonly cell: string }[];
}

/** A number Excel wrote without its leading zero, as 101 for commune 0101, given back its length. */
const padded = (cell: string, length: number) => (/^\d+$/u.test(cell) ? cell.padStart(length, '0') : cell);

const COLUMNS = headings((words) => words.import.schoolColumns);
const NEEDED = ['commune', 'level', 'name'] as const;
/** A code as the directory takes it. */
export const CODE = /^[A-Za-z0-9_+-]{1,64}$/u;

/** The file's schools against the draft, or the columns it lacks. */
export function checkSchools(
  text: string,
  draft: ReferenceDraft,
  profile: CountryProfile,
): SchoolCheck | { readonly missing: readonly (typeof NEEDED)[number][] } {
  const table = readTable(text, COLUMNS, NEEDED);
  if (!table.ok) return { missing: NEEDED.filter((one) => table.missing.includes(one)) };
  const lines: SchoolLine[] = [];
  const refused: SchoolCheck['refused'][number][] = [];
  const seen = new Set<string>();
  for (const { line, cells } of table.rows) {
    const { level = '', name = '' } = cells;
    const commune = padded(cells.commune ?? '', 4);
    const code = padded(cells.code ?? '', 6);
    const place = communeByCode(commune);
    const cycle = profile.levels.find((one) => names(level, one.code, one.name));
    const refuse = (why: SchoolRefusal, cell: string) => refused.push({ line, why, cell });
    if (place === null) refuse('commune', commune);
    else if (cycle === undefined) refuse('level', level);
    else if (name === '' || name.length > 120) refuse('name', name);
    else if (code !== '' && !CODE.test(code)) refuse('code', code);
    else if (seen.has(code || `${commune}/${cycle.code}/${name}`)) refuse('twice', code || name);
    else {
      seen.add(code || `${commune}/${cycle.code}/${name}`);
      const school = { name, level: cycle.code, wilaya: place.wilaya, commune: place.commune };
      const known = draft.schools.find((one) =>
        code !== '' ? one.id === code : one.commune.code === commune && one.level === cycle.code && one.name === name,
      );
      const same =
        known !== undefined &&
        known.name === name &&
        known.level === cycle.code &&
        known.commune.code === place.commune.code;
      lines.push({
        line,
        kind: known === undefined ? 'new' : same ? 'same' : 'changed',
        school: { ...school, id: known?.id ?? (code || null) },
      });
    }
  }
  return { lines, refused };
}

/** The draft with the check's new and changed schools; a new one with no code takes its commune's next. */
export function applySchools(
  draft: ReferenceDraft,
  check: SchoolCheck,
  published: readonly DirectorySchool[] = [],
): ReferenceDraft {
  return check.lines
    .filter((one) => one.kind !== 'same')
    .reduce(
      (next, { school }) =>
        withSchool(next, { ...school, id: school.id ?? newSchoolId(next.schools, school.commune.code, published) }),
      draft,
    );
}
