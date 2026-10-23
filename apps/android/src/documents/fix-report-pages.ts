// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تقرير تصحيح نقطة» from a correction after the term (#243, answer 468): the
// class and subject, the term, the pupil's name and registration number, the
// mark and its day as dd/mm/yyyy, the value before and after, the reason with
// its detail, and the correction's day; the teacher's drawn signature goes on
// a middle-school report only, as on the grade book.

import type { Day, MarkFix, Version } from '@minhajna/core';
import { logDay } from '../log/log-text';
import { termWord } from '../marks/marks-rules';
import { valueWord } from '../marks/fix-rules';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { documentSignature, drawnMark } from './drawn-mark';
import { fixReportHtml } from './fix-report-html';
import { sheetNames } from './mark-sheet-pages';

/** The report of one correction as HTML; `target` names the mark, `day` is its test's or exam's day. */
export function fixReportPages(
  data: DocumentData,
  t: Translate,
  fix: Version<MarkFix>,
  target: string,
  day: Day | null,
): string {
  const { state } = data;
  const { mark, before, reason, note } = fix.value;
  const room = state.classes.get(state.courses.get(mark.courseId)?.classId ?? '');
  const { className, subject } = sheetNames(data, t, mark.courseId);
  const pupil = state.pupils.get(mark.pupilId);
  const why = t(`marks.fix.reasons.${reason}`);
  return fixReportHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('documents.markFix.name'),
      school: state.schools.get(room?.schoolId ?? '')?.name ?? '',
      year: yearShown(data),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      confidential: t('documents.confidential'),
    },
    {
      book: `${className} · ${subject}`,
      facts: [
        { label: t('documents.markFix.course'), value: `${className} · ${subject} · ${termWord(t, mark.term)}` },
        { label: t('documents.markFix.pupil'), value: pupil?.name ?? '' },
        { label: t('documents.markFix.registration'), value: pupil?.registration ?? '—' },
        {
          label: t('documents.markFix.mark'),
          value: day === null ? target : `${target}${t('marks.book.comma')}${logDay(day)}`,
        },
        {
          label: t('documents.markFix.value'),
          value: t('marks.fix.fromTo', { from: valueWord(t, before), to: valueWord(t, mark.value) }),
        },
        { label: t('documents.markFix.reason'), value: note === undefined ? why : `${why}: ${note}` },
        { label: t('documents.markFix.day'), value: logDay(fix.day) },
      ],
      mark: room?.level === 'cem' ? drawnMark(documentSignature(data, false)) : '',
    },
  );
}
