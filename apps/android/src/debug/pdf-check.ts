// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Arabic PDF check (#44, PRD §5.13): October 2026 of the core's demo
// year, made up from start to end and held in memory only, becomes the
// daily journal, one A4 portrait page a day, and the class's roll calls on
// an A4 landscape page. The phone's web engine makes both PDFs; the times
// cover building the HTML and making the file, against the target of 10
// seconds for a month of journal pages (§6.8).

import {
  buildState,
  courseSetup,
  current,
  formatDayWithMonth,
  groupPupils,
  makeContext,
  parseDay,
  rollCallUnits,
  todayView,
  weekday,
  wholeGroup,
  type Day,
  type HistoryDeps,
} from '@minhajna/core';
import { makeDemoYear } from '@minhajna/core/test-support/demo-year';
import { bookLines } from '../entry/book-lines';
import { journalHtml, type JournalDay } from '../documents/journal-html';
import { rollMonthHtml, type RollMark } from '../documents/roll-month-html';
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
  const days: JournalDay[] = DAYS.map((day) => todayView(context, day))
    .filter((view) => view.sessions.some((item) => item.status !== 'calendar'))
    .map((view) => ({
      title: title(view.day),
      entries: view.sessions
        .filter((item) => item.status !== 'calendar')
        .map((item) => ({
          time: sessionMeta(meta, t, 'rtl', item, false).slot,
          className: sessionMeta(meta, t, 'rtl', item, false).className,
          lines:
            item.record === null
              ? [{ text: t('documents.awaiting') }]
              : bookLines(t, courseSetup(context, item.course.id).pack, item.record, title),
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
      year: t('documents.year', { year: '2026-2027' }),
      time: t('documents.time'),
      className: t('documents.className'),
      content: t('documents.content'),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      empty: t('documents.empty'),
    },
    days,
  );
  const units = rollCallUnits(context, year.classId, DAYS[0], DAYS[30]);
  const pupils = groupPupils(context, year.classId, wholeGroup(schoolClass).id, DAYS[0]);
  const markOf = (unitKey: string, pupilId: string): RollMark => {
    const roll = current(state.rollCalls.get(unitKey));
    const absence = roll?.absent.find((one) => one.pupilId === pupilId);
    if (absence !== undefined) return absence.justified ? 'justified' : 'unjustified';
    return roll?.late.includes(pupilId) ? 'late' : null;
  };
  const roll = rollMonthHtml(
    {
      lang: 'ar',
      dir: 'rtl',
      title: t('documents.rollTitle', { month: t('documents.october') }),
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
    [
      {
        title: t('documents.rollTitle', { month: t('documents.october') }),
        scope: `${schoolClass.name} · ${school}`,
        columns: units.map((unit) => `${unit.day.slice(8)}/${unit.day.slice(5, 7)}`),
        rows: pupils.map((pupil, index) => ({
          number: index + 1,
          name: pupil.name,
          latinName: pupil.latinName ?? '',
          marks: units.map((unit) => markOf(unit.key, pupil.id)),
        })),
      },
    ],
  );
  const htmlMilliseconds = Date.now() - start;
  return {
    journal: await pdf.makePdf(journal, 'journal-2026-10', false),
    roll: await pdf.makePdf(roll, 'roll-2026-10', true),
    htmlMilliseconds,
  };
}
