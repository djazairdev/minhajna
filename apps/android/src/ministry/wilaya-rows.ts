// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The wilayas' rows of N-Totals' owed table (#599, answers 539 and 630): each
// directorate shown as its wilaya, the one the world's seeded schools of that
// directorate are in, by the wilaya's code and name, in the official order of
// the reference data's zones, never by a figure; a directorate no seeded school
// names comes after the wilayas, by its ID; and a last row for the nation. For
// one subject each row takes that subject's figure, and over every subject its
// figure over them, whose teachers are at least that many. A demo world has one
// directorate in each wilaya, so no wilaya's name shows twice; two directorates
// in one wilaya would each have a row of that name.

import type { DemoSchool, Zone } from '@minhajna/core';
import type { OwedRow } from '../directorate/OwedTable';
import type { DirectorateFigures, MinistryFigures } from '../directorate/totals-read';

/** A directorate's figure for one subject, or over every subject for null. */
export const figureFor = (figures: DirectorateFigures, subject: string | null) =>
  subject === null ? figures.all : (figures.subjects.find(([code]) => code === subject)?.[1] ?? null);

/** The owed table's rows for the Ministry: the wilayas in their official order, then the nation. */
export function wilayaRows(
  figures: MinistryFigures,
  schools: readonly Pick<DemoSchool, 'directorateId' | 'wilaya'>[],
  zones: readonly Zone[],
  names: { readonly zone: (zone: Zone) => string; readonly nation: string },
  subject: string | null,
): OwedRow[] {
  const placed = figures.directorates.map(([id, own]) => {
    const code = schools.find((school) => school.directorateId === id)?.wilaya;
    const at = zones.findIndex((zone) => zone.code === code);
    const name = at === -1 ? id : `${zones[at].code} ${names.zone(zones[at])}`;
    return { at: at === -1 ? zones.length : at, row: { key: id, name, figure: figureFor(own, subject) } };
  });
  placed.sort((a, b) => a.at - b.at || (a.row.key < b.row.key ? -1 : a.row.key > b.row.key ? 1 : 0));
  const atLeast = subject === null;
  const nation = { key: '', name: names.nation, figure: figureFor(figures.national, subject) };
  return [...placed.map(({ row }) => ({ ...row, atLeast })), { ...nation, atLeast }];
}
