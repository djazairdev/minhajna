// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a timetable file's reading says (#576, answer 592): each problem in
// plain words with its row, as the spreadsheet numbers it, the template's
// columns in the screen's language and FET's as FET writes them; and what was
// read, counted: the sessions, and the distinct classes, teachers and rooms.

import {
  timetableNameKey,
  type FetColumn,
  type FetProblem,
  type ImportedSession,
  type TimetableColumn,
} from '@minhajna/core';
import type { TFunction } from 'i18next';

/** FET's columns as its export's header writes them. */
const FET_HEADER: Readonly<Record<FetColumn, string>> = {
  'activity id': 'Activity Id',
  day: 'Day',
  hour: 'Hour',
  'students sets': 'Students Sets',
  subject: 'Subject',
  teachers: 'Teachers',
  room: 'Room',
};

/** A problem of the reading, in the screen's language, with its row. */
export function problemText(t: TFunction, problem: FetProblem): string {
  const columns = (missing: readonly TimetableColumn[]) =>
    missing.map((one) => t(`ttImport.column.${one}`)).join(t('ttImport.listSeparator'));
  const fetColumns = (missing: readonly FetColumn[]) =>
    missing.map((one) => FET_HEADER[one]).join(t('ttImport.listSeparator'));
  const what = (() => {
    switch (problem.kind) {
      case 'columns':
        return t('ttImport.problem.columns', { columns: columns(problem.missing) });
      case 'fet-columns':
        return t('ttImport.problem.fetColumns', { columns: fetColumns(problem.missing) });
      case 'column-twice':
        return t('ttImport.problem.columnTwice', { column: t(`ttImport.column.${problem.column}`) });
      case 'column-unknown':
        return t('ttImport.problem.columnUnknown', { value: problem.value });
      case 'empty':
        return t('ttImport.problem.empty', { column: t(`ttImport.column.${problem.column}`) });
      case 'day':
      case 'time':
      case 'week':
      case 'teachers':
        return t(`ttImport.problem.${problem.kind}`, { value: problem.value });
      case 'order':
        return t('ttImport.problem.order');
      default:
        return t(`ttImport.problem.${problem.kind}`, { with: problem.with });
    }
  })();
  return t('ttImport.row', { row: problem.row, what });
}

/** How many sessions were read, and how many distinct classes, teachers and rooms, names compared as names are. */
export function readCounts(sessions: readonly ImportedSession[]) {
  const distinct = (pick: (one: ImportedSession) => string) =>
    new Set(
      sessions
        .map(pick)
        .filter((one) => one.trim() !== '')
        .map((one) => timetableNameKey(one)),
    ).size;
  return {
    sessions: sessions.length,
    classes: distinct((one) => one.class),
    teachers: distinct((one) => one.teacher),
    rooms: distinct((one) => one.room),
  };
}
