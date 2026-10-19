// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every document the app makes (#212, PRD §3.8), in the order «الوثائق»
// lists them. Each one gives its title, what it covers, whether it holds
// pupils' data, its page orientation, and its pages as recorded or blank
// with their headings, and for some the day and the layout to choose; the
// output screen does the rest. A later document, such as the grade book,
// plugs in here.

import type { IconName } from '../design/Icon';
import { dayTitle, monthLabel, taughtClasses, yearShown, type DocumentData, type Translate } from './document-data';
import { journalFrontPages } from './journal-front-pages';
import { journalLayouts, journalPages } from './journal-pages';
import { primaryFrontPages } from './primary-front-pages';
import { primaryJournalPages } from './primary-journal-pages';
import { specialistJournalPages } from './specialist-journal-pages';
import { teachesPrimary, teachesSecondary, teachesSpecialist } from './specialists';
import { printedVersion, timetableLine, timetablePages } from './timetable-pages';
import { rollPages } from './roll-pages';
import { homeworkPages } from './homework-pages';
import { stripEmpty, stripPages } from './strip-pages';
import { supervisedPages } from './supervised-pages';
import { bookDate } from './texts-book-rows';
import { bookClasses, bookCourses, textsBookPages } from './texts-book-pages';

export type DocumentId =
  | 'journal'
  | 'journal-front'
  | 'primary-journal'
  | 'specialist-journal'
  | 'timetable'
  | 'primary-front'
  | 'roll'
  | 'texts'
  | 'supervised'
  | 'homework'
  | 'strip';

export interface DocumentKind {
  readonly id: DocumentId;
  readonly icon: IconName;
  /** Pupils' names or marks: «داخلي · سري» on every page (R-5.9-15). */
  readonly pupils: boolean;
  readonly landscape: boolean;
  /** Whether the tab lists it, such as a journal only for the levels taught; listed when not given. */
  readonly shown?: (data: DocumentData) => boolean;
  /** Nothing to print yet, such as a roll-call book with no class taught; the output says so. */
  readonly empty: (data: DocumentData) => boolean;
  /** What a saved file is named after: the day, or the month for a document of a month. */
  readonly period: (data: DocumentData) => string;
  readonly title: (t: Translate) => string;
  /** What it covers now, under its title in the list. */
  readonly line: (data: DocumentData, t: Translate) => string;
  /** What the blank version fills in, and what it leaves for the pen; null for a document with no blank version. */
  readonly blankLine: (t: Translate) => string | null;
  /** What is left to sign by hand. */
  readonly signatureLine: (t: Translate) => string;
  /** Why there is nothing to print, when `empty` says so. */
  readonly emptyLine: (t: Translate) => string;
  /** A document of a day: the output chooses the day, within the school year. */
  readonly byDay?: true;
  /** The ways the document can be kept, the first by default, such as one journal or one per class. */
  readonly layouts?: (t: Translate) => readonly DocumentLayout[];
  /** The whole document as HTML, as recorded or blank with its headings, in the chosen layout. */
  readonly pages: (data: DocumentData, t: Translate, blank: boolean, layout?: string) => string;
}

export interface DocumentLayout {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

const classes = (data: DocumentData, t: Translate) =>
  t('documents.list.classes', { count: taughtClasses(data).length });

/** The texts book's classes: those taught this school year. */
const bookClassCount = (data: DocumentData, t: Translate) =>
  t('documents.list.classes', { count: bookClasses(data).length });

export const DOCUMENTS: readonly DocumentKind[] = [
  {
    id: 'journal',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: () => false,
    period: (data) => data.day,
    title: (t) => t('documents.journal'),
    line: (data, t) => `${classes(data, t)} · ${dayTitle(data, t, data.day)}`,
    blankLine: (t) => t('documents.output.blankJournal'),
    signatureLine: (t) => t('documents.output.signature'),
    emptyLine: (t) => t('documents.output.noClasses'),
    shown: teachesSecondary,
    byDay: true,
    layouts: journalLayouts,
    pages: journalPages,
  },
  {
    id: 'journal-front',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: () => false,
    period: (data) => data.year.id,
    title: (t) => `${t('documents.journal')} · ${t('documents.journalFront.name')}`,
    line: (data, t) => t('documents.journalFront.line', { year: yearShown(data) }),
    blankLine: (t) => t('documents.output.blankJournalFront'),
    signatureLine: (t) => t('documents.output.signatureJournalFront'),
    emptyLine: (t) => t('documents.output.noClasses'),
    shown: teachesSecondary,
    pages: journalFrontPages,
  },
  {
    id: 'primary-journal',
    icon: 'homework',
    pupils: false,
    landscape: true,
    empty: (data) => !teachesPrimary(data),
    period: (data) => data.day,
    title: (t) => t('documents.primaryJournal.name'),
    line: (data, t) => dayTitle(data, t, data.day),
    blankLine: (t) => t('documents.output.blankPrimaryJournal'),
    signatureLine: (t) => t('documents.output.signaturePrimaryJournal'),
    emptyLine: (t) => t('documents.output.noPrimary'),
    shown: teachesPrimary,
    byDay: true,
    pages: primaryJournalPages,
  },
  {
    id: 'primary-front',
    icon: 'homework',
    pupils: true,
    landscape: false,
    empty: (data) => !teachesPrimary(data),
    period: (data) => data.year.id,
    title: (t) => `${t('documents.primaryJournal.name')} · ${t('documents.journalFront.name')}`,
    line: (data, t) => t('documents.journalFront.line', { year: yearShown(data) }),
    blankLine: (t) => t('documents.output.blankPrimaryFront'),
    signatureLine: (t) => t('documents.output.signaturePrimaryFront'),
    emptyLine: (t) => t('documents.output.noPrimary'),
    shown: teachesPrimary,
    pages: primaryFrontPages,
  },
  {
    id: 'specialist-journal',
    icon: 'homework',
    pupils: false,
    landscape: true,
    empty: (data) => !teachesSpecialist(data),
    period: (data) => data.day,
    title: (t) => t('documents.specialistJournal.name'),
    line: (data, t) => dayTitle(data, t, data.day),
    blankLine: (t) => t('documents.output.blankSpecialistJournal'),
    signatureLine: (t) => t('documents.output.signatureSpecialistJournal'),
    emptyLine: (t) => t('documents.output.noSpecialist'),
    shown: teachesSpecialist,
    byDay: true,
    layouts: (t) =>
      journalLayouts(t).map((one) =>
        one.value === 'combined' ? { ...one, description: t('documents.specialistJournal.combinedLine') } : one,
      ),
    pages: specialistJournalPages,
  },
  {
    id: 'timetable',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: (data) => printedVersion(data) === null,
    period: (data) => printedVersion(data)?.from ?? data.year.id,
    title: (t) => t('documents.timetable.name'),
    line: timetableLine,
    blankLine: (t) => t('documents.output.blankTimetable'),
    signatureLine: (t) => t('documents.output.signatureTimetable'),
    emptyLine: (t) => t('documents.output.noTimetable'),
    byDay: true,
    pages: timetablePages,
  },
  {
    id: 'roll',
    icon: 'pupils',
    pupils: true,
    landscape: true,
    empty: (data) => taughtClasses(data).length === 0,
    period: (data) => data.day.slice(0, 7),
    title: (t) => t('documents.rollBook'),
    line: (data, t) => `${classes(data, t)} · ${monthLabel(data, data.day)}`,
    blankLine: (t) => t('documents.output.blankRoll'),
    signatureLine: (t) => t('documents.output.signature'),
    emptyLine: (t) => t('documents.output.noClasses'),
    pages: rollPages,
  },
  {
    id: 'texts',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: (data) => bookCourses(data).length === 0,
    period: (data) => data.day.slice(0, 7),
    title: (t) => t('documents.textsBook.name'),
    line: (data, t) => `${bookClassCount(data, t)} · ${monthLabel(data, data.day)}`,
    blankLine: (t) => t('documents.output.blankTexts'),
    signatureLine: (t) => t('documents.output.signatureTexts'),
    emptyLine: (t) => t('documents.output.noClassesTexts'),
    pages: textsBookPages,
  },
  {
    id: 'supervised',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: (data) => bookCourses(data).length === 0,
    period: (data) => data.year.id,
    title: (t) => t('documents.supervised.name'),
    line: (data, t) => `${bookClassCount(data, t)} · ${t('documents.supervised.line')}`,
    blankLine: (t) => t('documents.output.blankSupervised'),
    signatureLine: (t) => t('documents.output.signatureSupervised'),
    emptyLine: (t) => t('documents.output.noClassesTexts'),
    pages: supervisedPages,
  },
  {
    id: 'homework',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: (data) => bookCourses(data).length === 0,
    period: (data) => data.year.id,
    title: (t) => t('documents.homework.name'),
    line: (data, t) => `${bookClassCount(data, t)} · ${t('documents.homework.line')}`,
    blankLine: (t) => t('documents.output.blankHomework'),
    signatureLine: (t) => t('documents.output.signatureHomework'),
    emptyLine: (t) => t('documents.output.noClassesTexts'),
    pages: homeworkPages,
  },
  {
    id: 'strip',
    icon: 'homework',
    pupils: false,
    landscape: false,
    empty: stripEmpty,
    period: (data) => data.day,
    title: (t) => t('documents.strip.name'),
    line: (data, t) => t('documents.strip.line', { day: bookDate(data.day, data.dir) }),
    blankLine: () => null,
    signatureLine: (t) => t('documents.output.signatureStrip'),
    emptyLine: (t) => t('documents.output.noStrip'),
    pages: (data, t) => stripPages(data, t),
  },
];

/** The document with this ID; an unknown one, as from a later version's saved screen, is none. */
export function documentKind(id: string): DocumentKind | undefined {
  return DOCUMENTS.find((kind) => kind.id === id);
}

/**
 * The file name offered when saving, such as «الدفتر اليومي 2026-10-18.pdf», with the blank version and a layout
 * other than the first said.
 */
export function fileName(
  kind: DocumentKind,
  data: DocumentData,
  t: Translate,
  blank: boolean,
  layout?: string,
): string {
  const layouts = kind.layouts?.(t) ?? [];
  const other = layouts.find((one) => one.value === layout && one !== layouts[0]);
  const version = `${other === undefined ? '' : ` - ${other.label}`}${blank ? ` - ${t('documents.output.blank')}` : ''}`;
  return `${kind.title(t)} ${kind.period(data)}${version}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
}
