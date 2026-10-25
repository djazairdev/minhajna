// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of reader mode's merge (#246, R-Merge, answers 489 and 492), which
// the screen and the printed page share: each class by its section, teacher
// and statement day; its unit as this app's pack has it, with its place among
// the units; its last resource, whether the whole class finished it, and its
// place in the unit, unless it is outside any unit; then the delay and the
// sessions not held. A resource that cannot be placed keeps the statement's
// own words and says why.

import type { CountryProfile, MergeRow } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { frontDate } from '../documents/front-tables';
import { statementLines } from '../sharing/statement-lines';
import { isolate } from '../week/grid-labels';

/** One class of the merge, in words. */
export interface MergeWords {
  /** The statement's ID, which opens it. */
  readonly id: string;
  readonly school: string | null;
  readonly section: string;
  readonly teacher: string;
  readonly day: string;
  readonly unit: string;
  readonly resource: string;
  /** Its place in the unit, or why it is not placed; null with no resource yet, or none to give. */
  readonly place: string | null;
  /** The unit's items, the resource's index among them and whether it is done; null when not placed. */
  readonly track: { readonly of: number; readonly at: number; readonly done: boolean } | null;
  readonly delay: string;
  readonly notHeld: string;
}

/** The place in the unit, and the newer release it was placed on; null outside a unit on the statement's own. */
function placeLine(t: Translate, place: MergeRow['place'], newer: boolean): string | null {
  if (place === null) return null;
  const lines = [
    ...(place.unit === null ? [] : [t('reader.merge.place', { at: place.at + 1, of: place.items.length })]),
    ...(newer ? [t('reader.merge.placedOn', { release: isolate(place.release) })] : []),
  ];
  return lines.length === 0 ? null : lines.join(' · ');
}

/** A class of the merge in words, with its teacher as the reader knows them. */
export function mergeWords(t: Translate, profile: CountryProfile, row: MergeRow, teacher: string): MergeWords {
  const { statement } = row.one;
  const { place } = row;
  const resource = statement.lastResource;
  const lines = statementLines(t, profile, statement);
  const first = (id: 'delay' | 'notHeld') => lines.find((line) => line.id === id)?.lines[0] ?? '';
  const unit =
    place === null
      ? '—'
      : place.unit === null
        ? t('reader.merge.noUnit')
        : t('reader.merge.unit', { title: isolate(place.unit.title), at: place.unit.at, of: place.unit.of });
  const title = place === null ? resource?.title : place.items[place.at]?.title;
  const status = resource?.status === 'done' ? 'statement.done' : 'statement.started';
  const newer = place !== null && place.release !== statement.pack.release;
  return {
    id: row.one.id,
    school: row.school,
    section: row.section,
    teacher,
    day: frontDate(statement.day),
    unit,
    resource: resource === null ? t('statement.noResource') : `${isolate(title ?? resource.title)} · ${t(status)}`,
    place: row.miss !== null ? t(`reader.merge.miss.${row.miss}`) : placeLine(t, place, newer),
    track:
      place === null || place.unit === null || resource === null
        ? null
        : { of: place.items.length, at: place.at, done: resource.status === 'done' },
    delay: first('delay'),
    notHeld: first('notHeld'),
  };
}
