// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ملف مجلس القسم» as a document (#244, answer 470), from the same pack and
// words as the screen: the figures with the full-value note; the bands; boys
// and girls; the comparison with the previous term, or why there is none;
// every rank, with the previous rank and its change from term 2; the pupils for
// remediation and for distinction under their thresholds; the note that the
// thresholds are the teacher's; and the roll-call book's summary.

import type { CouncilPack, CouncilRank } from '@minhajna/core';
import { atThresholdLines } from '../marks/book-rules';
import { attendanceLine, bandLabel, rankChange, share, shown, thresholdWords, trend } from '../marks/council-rules';
import { termWord } from '../marks/marks-rules';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { councilHtml, type CouncilSection } from './council-html';
import { sheetNames } from './mark-sheet-pages';

/** The comparison's lines, each with its arrow, or why there is nothing to compare. */
function comparison(t: Translate, pack: CouncilPack, term: number): string[] {
  const { previous } = pack;
  if (term === 1) return [t('marks.council.noCompareFirst')];
  if (previous === null) return [t('marks.council.noComparePrevious', { term: termWord(t, term - 1) })];
  const rate = (reached: number, counted: number) => (counted === 0 ? null : reached / counted);
  const mean = t('marks.council.compareMean', { from: shown(previous.mean), to: shown(pack.mean) });
  const reached = t('marks.council.compareReached', {
    threshold: pack.book.threshold,
    fromCount: previous.reached,
    fromTotal: previous.counted,
    fromShare: share(previous.reached, previous.counted),
    toCount: pack.reached,
    toTotal: pack.counted,
    toShare: share(pack.reached, pack.counted),
  });
  const after = trend(t, rate(previous.reached, previous.counted), rate(pack.reached, pack.counted));
  return [`${mean} ${trend(t, previous.mean, pack.mean).shown}`.trim(), `${reached} ${after.shown}`.trim()];
}

/** The pack of a course's term as HTML. */
export function councilPages(
  data: DocumentData,
  t: Translate,
  pack: CouncilPack,
  courseId: string,
  term: number,
): string {
  const { state } = data;
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const { className, subject } = sheetNames(data, t, courseId);
  const nameOf = (pupilId: string) => state.pupils.get(pupilId)?.name ?? '';
  const { threshold } = pack.book;
  const later = term > 1;
  const words = thresholdWords(pack.thresholds);
  const listed = (rows: readonly CouncilRank[]) => rows.map((row) => [nameOf(row.pupilId), shown(row.average)]);
  const none = (rows: readonly CouncilRank[]) => (rows.length === 0 ? [t('marks.council.noneListed')] : []);
  const rate = pack.attendance?.rate ?? null;
  const sections: CouncilSection[] = [
    {
      title: t('marks.council.figures'),
      heads: [t('marks.council.figure'), t('marks.council.value')],
      rows: [
        [t('marks.council.mean'), shown(pack.mean)],
        [t('marks.council.highest'), shown(pack.highest)],
        [t('marks.council.lowest'), shown(pack.lowest)],
        [t('marks.council.deviation'), shown(pack.deviation)],
        [
          t('marks.council.reached', { threshold, reached: pack.reached, counted: pack.counted }),
          share(pack.reached, pack.counted),
        ],
        [t('marks.council.attendanceRate'), rate === null ? '—' : share(rate, 1)],
      ],
      lines: [t('marks.council.fullNote'), ...atThresholdLines(t, pack.book, nameOf)],
    },
    {
      title: t('marks.council.bands'),
      heads: [t('marks.council.band'), t('marks.council.count')],
      rows: pack.bands.map((band) => [bandLabel(t, band), String(band.count)]),
    },
    {
      title: t('marks.council.sexes'),
      heads: ['', t('marks.council.count'), t('marks.council.atLeast', { threshold }), t('marks.council.average')],
      rows: pack.sexes.map((one) => [
        t(one.sex === 'm' ? 'marks.council.boys' : 'marks.council.girls'),
        String(one.counted),
        String(one.reached),
        shown(one.mean),
      ]),
    },
    {
      title: later
        ? t('marks.council.compareTitle', { term: termWord(t, term - 1) })
        : t('marks.council.compareTitleFirst'),
      lines: comparison(t, pack, term),
    },
    {
      title: t('marks.council.ranks'),
      heads: [
        t('marks.council.rank'),
        t('marks.council.pupil'),
        t('marks.council.average'),
        ...(later ? [t('marks.council.before'), t('marks.council.changeHead')] : []),
      ],
      rows: pack.ranks.map((row) => [
        String(row.rank),
        nameOf(row.pupilId),
        shown(row.average),
        ...(later ? [row.previous === null ? '—' : String(row.previous), rankChange(t, row).shown] : []),
      ]),
      lines: pack.ranks.length === 0 ? [t('marks.council.noRanks')] : later ? [t('marks.council.rankNote')] : [],
    },
    {
      title: `${t('marks.council.remedial')} · ${t('marks.council.below', { to: words.remedial })}`,
      heads: [t('marks.council.pupil'), t('marks.council.average')],
      rows: listed(pack.remedial),
      lines: none(pack.remedial),
    },
    {
      title: `${t('marks.council.distinction')} · ${t('marks.council.andAbove', { from: words.distinction })}`,
      heads: [t('marks.council.pupil'), t('marks.council.average')],
      rows: listed(pack.distinction),
      lines: [...none(pack.distinction), t('marks.council.thresholdsNote')],
    },
    { title: t('marks.council.attendanceTitle'), lines: [attendanceLine(t, pack.attendance)] },
  ];
  return councilHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('marks.council.title'),
      school: state.schools.get(room?.schoolId ?? '')?.name ?? '',
      year: yearShown(data),
      confidential: t('documents.confidential'),
    },
    { book: `${className} · ${subject}`, scope: `${className} · ${subject} · ${termWord(t, term)}`, sections },
  );
}
