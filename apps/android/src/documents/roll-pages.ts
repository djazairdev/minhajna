// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's month (#212), from the record book: a landscape
// page for each class, a column for each roll call the timetable gives in
// the month, and a row for each pupil of the whole class. The blank page
// keeps the head, the columns and the names, with the marks left empty.

import { current, groupPupils, rollCallUnits, wholeGroup, type Day, type State } from '@minhajna/core';
import { coreContext } from '../storage/core-context';
import { monthLabel, schoolNames, taughtClasses, type DocumentData, type Translate } from './document-data';
import { rollMonthHtml, type RollMark, type RollSheet } from './roll-month-html';

function markOf(state: State, unitKey: string, pupilId: string): RollMark {
  const roll = current(state.rollCalls.get(unitKey));
  const absence = roll?.absent.find((one) => one.pupilId === pupilId);
  if (absence !== undefined) return absence.justified ? 'justified' : 'unjustified';
  return roll?.late.includes(pupilId) ? 'late' : null;
}

/** The month of `data.day` for every class, or its blank pages with the names filled. */
export function rollPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const from = `${data.day.slice(0, 8)}01` as Day;
  const last = new Date(Date.UTC(Number(data.day.slice(0, 4)), Number(data.day.slice(5, 7)), 0)).getUTCDate();
  const to = `${data.day.slice(0, 8)}${String(last).padStart(2, '0')}` as Day;
  const month = monthLabel(data, data.day);
  const sheets: RollSheet[] = taughtClasses(data).map((schoolClass) => {
    const units = rollCallUnits(context, schoolClass.id, from, to);
    const pupils = groupPupils(context, schoolClass.id, wholeGroup(schoolClass).id, to);
    const school = data.state.schools.get(schoolClass.schoolId)?.name ?? schoolNames(data);
    return {
      title: t('documents.rollTitle', { month }),
      scope: `${schoolClass.name} · ${school}`,
      columns: units.map((unit) => `${unit.day.slice(8)}/${unit.day.slice(5, 7)}`),
      rows: pupils.map((pupil, index) => ({
        number: index + 1,
        name: pupil.name,
        latinName: pupil.latinName ?? '',
        marks: units.map((unit) => (blank ? null : markOf(data.state, unit.key, pupil.id))),
      })),
      blank,
    };
  });
  return rollMonthHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('documents.rollTitle', { month }),
      number: t('documents.number'),
      name: t('documents.name'),
      latinName: t('documents.latinName'),
      absent: t('documents.absent'),
      late: t('documents.late'),
      key: t('documents.key'),
      marks: {
        unjustified: t('documents.marks.unjustified'),
        justified: t('documents.marks.justified'),
        late: t('documents.marks.late'),
      },
      confidential: t('documents.confidential'),
    },
    sheets,
  );
}
