// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Arabic PDF check (#44, PRD §5.13): October 2026 of the core's demo
// year, made up from start to end and held in memory only, becomes the
// daily journal, one A4 portrait page a day, and the class's roll-call book
// as its two-page A4 portrait spread. The phone's web engine makes both
// PDFs; the times cover building the HTML and making the file, against the
// target of 10 seconds for a month of journal pages (§6.8).

import {
  buildState,
  courseSetup,
  formatDayWithMonth,
  makeContext,
  parseDay,
  todayView,
  weekday,
  type Day,
  type HistoryDeps,
} from '@minhajna/core';
import { makeDemoYear } from '@minhajna/core/test-support/demo-year';
import { journalHtml, type JournalDay } from '../documents/journal-html';
import { journalLines, proposedRecord } from '../documents/journal-lines';
import { rollSpreadPages } from '../documents/roll-spread-pages';
import pdf, { type MadePdf } from '../native/NativeMinhajnaPdf';
import { bundledReference, readReference } from '../reference';
import type { useText } from '../text/i18n';
import { sessionMeta } from '../today/today-meta';

type Translate = ReturnType<typeof useText>;

export interface PdfTimes {
  readonly journal: MadePdf;
  readonly roll: MadePdf;
  /** Building both documents' HTML from the records. */
  readonly htmlMilliseconds: number;
}

const DAYS = Array.from({ length: 31 }, (_, index) => parseDay(`2026-10-${String(index + 1).padStart(2, '0')}`));

/** Makes the month's two PDFs in the app's cache, ready to share. */
export async function makeDemoPdfs(t: Translate, deps: HistoryDeps): Promise<PdfTimes> {
  const read = readReference(bundledReference);
  if (!read.ok) throw new Error('The bundled reference data does not verify');
  const reference = {
    country: read.profile,
    year: read.calendar.year,
    calendar: read.calendar.entries,
    packs: new Map(),
  };
  const year = await makeDemoYear(reference, deps, 'cem');
  const start = Date.now();
  const state = buildState(year.entries);
  const context = makeContext(year.reference, state);
  const meta = { state, profile: read.profile, bells: read.bells, calendar: read.calendar.entries };
  const title = (day: Day) => `${t(`week.days.${weekday(day)}`)} ${formatDayWithMonth(day, 'ar', read.profile)}`;
  const names = {
    type: (code: string) => read.profile.sessionTypes.find((one) => one.code === code)?.name.ar ?? code,
    day: title,
  };
  const days: JournalDay[] = DAYS.map((day) => todayView(context, day))
    .filter((view) => view.sessions.some((item) => item.status !== 'calendar'))
    .map((view) => ({
      title: title(view.day),
      entries: view.sessions
        .filter((item) => item.status !== 'calendar')
        .map((item) => ({
          time: sessionMeta(meta, t, 'rtl', item, false).slot,
          className: sessionMeta(meta, t, 'rtl', item, false).className,
          lines: journalLines(
            t,
            names,
            courseSetup(context, item.course.id).pack,
            item.record ?? proposedRecord(item.session, item.proposal),
            item.record === null,
          ),
          awaiting: item.record === null,
        })),
    }));
  const schoolClass = state.classes.get(year.classId)!;
  const school = state.schools.get(schoolClass.schoolId)?.name ?? '';
  const journal = journalHtml(
    {
      lang: 'ar',
      dir: 'rtl',
      book: t('documents.journal'),
      school,
      year: t('documents.year', { year: '\u20682026-2027\u2069' }),
      time: t('documents.time'),
      className: t('documents.className'),
      content: t('documents.content'),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      empty: t('documents.empty'),
      colon: t('documents.journalLines.colon'),
    },
    days,
  );
  const roll = rollSpreadPages(
    {
      state,
      profile: read.profile,
      year: read.calendar.year,
      calendar: read.calendar.entries,
      packs: [],
      bells: read.bells,
      day: DAYS[0],
      today: DAYS[30],
      lang: 'ar',
      dir: 'rtl',
    },
    t,
    false,
  );
  const htmlMilliseconds = Date.now() - start;
  return {
    journal: await pdf.makePdf(journal, 'journal-2026-10', false),
    roll: await pdf.makePdf(roll, 'roll-2026-10', false),
    htmlMilliseconds,
  };
}
