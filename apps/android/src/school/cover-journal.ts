// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TeacherCover } from '@minhajna/core';
import { isolate } from '../week/grid-labels';
import { dayTitle, type DocumentData, type Translate } from '../documents/document-data';
import type { JournalDay } from '../documents/journal-html';
import type { PrimaryDay } from '../documents/primary-journal-html';

/** An explicit school projection for future journal integration, not the preview's DocumentData. */
export type SchoolCoverDocumentData = DocumentData & { readonly cover?: readonly TeacherCover[] };

const given = (data: SchoolCoverDocumentData, blank: boolean, primary: boolean) =>
  blank
    ? []
    : (data.cover ?? []).filter(
        (row) =>
          row.direction === 'given' &&
          row.assigned &&
          row.completed &&
          row.session.day === data.day &&
          (row.session.level === 'primary') === primary &&
          data.state.schools.has(row.session.schoolId),
      );
const place = (row: TeacherCover, t: Translate) =>
  t('schoolCover.cover.slot', {
    half: t(`calendarView.periods.${row.session.slot.half}`),
    index: row.session.slot.index,
  });

/** Confirmed cover given belongs to the teacher's journal only; no reasons or holder identity enter it. */
export function coverJournalDays(data: SchoolCoverDocumentData, t: Translate, blank: boolean): JournalDay[] {
  const rows = given(data, blank, false);
  return rows.length === 0
    ? []
    : [
        {
          title: dayTitle(data, t, data.day),
          className: t('schoolCover.cover.given'),
          entries: rows.map((row) => ({
            time: place(row, t),
            className: row.session.className,
            awaiting: false,
            lines: [{ text: t(`schoolCover.cover.kinds.${row.choice}`) }],
          })),
        },
      ];
}

/** Primary cover prints in that day's journal, in its own bands, without inventing a duration. */
export function coverPrimaryDays(data: SchoolCoverDocumentData, t: Translate, blank: boolean): PrimaryDay[] {
  const rows = given(data, blank, true);
  const schools = [...new Set(rows.map((row) => row.session.schoolId))];
  return schools.map((schoolId) => ({
    title: dayTitle(data, t, data.day),
    className: t('schoolCover.cover.given'),
    school: data.state.schools.get(schoolId)!.name,
    visas: [data.state.schools.get(schoolId)!.name],
    bands: (['morning', 'afternoon'] as const).map((half) => ({
      name: t(`calendarView.periods.${half}`),
      entries: rows
        .filter((row) => row.session.schoolId === schoolId && row.session.slot.half === half)
        .map((row) => ({
          when: place(row, t),
          what: isolate(row.session.className),
          activity: t('schoolCover.cover.given'),
          content: [{ text: t(`schoolCover.cover.kinds.${row.choice}`) }],
          domain: '',
          awaiting: false,
        })),
    })),
  }));
}
