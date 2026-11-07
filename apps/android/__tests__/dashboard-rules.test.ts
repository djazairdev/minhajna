// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's rules (answers 804 and 805): what changed since the last
// version; a new school's code; an added option's code, never one an edited
// option kept nor one the published list gave other subjects, and a hidden
// option's own code when it comes back. Every name is made up.

import { COMMUNE, schoolIn } from '../jest/dashboard-world';
import {
  draftChanges,
  makeOption,
  newSchoolId,
  startingDraft,
  withOption,
  withSchool,
} from '../src/dashboard/reference-rules';
import { bundledReference, readReference } from '../src/reference';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile } = read;

it('counts what changed since the last version', () => {
  const base = withSchool(startingDraft(profile), schoolIn('160101', COMMUNE, 'متوسطة أولى'));
  const changed = withSchool(
    withSchool({ ...base, schools: [] }, schoolIn('160101', COMMUNE, 'متوسطة أولى معدلة')),
    schoolIn('160102', COMMUNE, 'متوسطة ثانية'),
  );
  expect(draftChanges(changed, base)).toEqual({ added: 1, edited: 1, hidden: 0, options: 0 });
  expect(draftChanges({ ...base, schools: [] }, base).hidden).toBe(1);
});

it('gives a new school its commune’s first free code', () => {
  expect(newSchoolId([schoolIn('160101', COMMUNE, 'x'), schoolIn('160103', COMMUNE, 'y')], '1601')).toBe('160102');
});

it('gives an added option a code no edited option kept', () => {
  const draft = { levels: [{ code: 'cem', options: [makeOption(['math'])] }], schools: [] };
  const edited = withOption(draft, 'cem', { ...makeOption(['phys']), code: 'math' }, makeOption(['math']));
  const added = withOption(withOption(edited, 'cem', makeOption(['math'])), 'cem', makeOption(['math']));
  expect(added.levels[0]?.options.map((option) => option.code)).toEqual(['math', 'math-2', 'math-3']);
  const published = { code: 'cem', options: [makeOption(['math']), makeOption(['phys'])] };
  const hidden = { levels: [{ code: 'cem', options: [] }], schools: [] };
  const back = withOption(hidden, 'cem', makeOption(['math']), undefined, published);
  const other = withOption(hidden, 'cem', { code: 'phys', subjects: ['chem'] }, undefined, published);
  expect([back, other].map((one) => one.levels[0]?.options[0]?.code)).toEqual(['math', 'phys-2']);
  const numbered = { code: 'cem', options: [{ code: 'math-3', subjects: ['math'] }] };
  expect(withOption(hidden, 'cem', makeOption(['math']), undefined, numbered).levels[0]?.options[0]?.code).toBe(
    'math-3',
  );
});
