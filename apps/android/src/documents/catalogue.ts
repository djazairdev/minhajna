// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every document the app makes (#212, PRD §3.8), in the order «الوثائق»
// lists them. Each one gives its title, what it covers, whether it holds
// pupils' data, its page orientation, and its pages as recorded or blank
// with their headings; the output screen does the rest. A later document,
// such as the grade book, plugs in here.

import type { IconName } from '../design/Icon';
import { monthLabel, taughtClasses, type DocumentData, type Translate } from './document-data';
import { journalPages } from './journal-pages';
import { rollPages } from './roll-pages';
import { supervisedPages } from './supervised-pages';
import { bookClasses, bookCourses, textsBookPages } from './texts-book-pages';

export type DocumentId = 'journal' | 'roll' | 'texts' | 'supervised';

export interface DocumentKind {
  readonly id: DocumentId;
  readonly icon: IconName;
  /** Pupils' names or marks: «داخلي · سري» on every page (R-5.9-15). */
  readonly pupils: boolean;
  readonly landscape: boolean;
  /** Nothing to print yet, such as a roll-call book with no class taught; the output says so. */
  readonly empty: (data: DocumentData) => boolean;
  /** What a saved file is named after: the day, or the month for a document of a month. */
  readonly period: (data: DocumentData) => string;
  readonly title: (t: Translate) => string;
  /** What it covers now, under its title in the list. */
  readonly line: (data: DocumentData, t: Translate) => string;
  /** What the blank version fills in, and what it leaves for the pen. */
  readonly blankLine: (t: Translate) => string;
  /** What is left to sign by hand. */
  readonly signatureLine: (t: Translate) => string;
  /** Why there is nothing to print, when `empty` says so. */
  readonly emptyLine: (t: Translate) => string;
  /** The whole document as HTML, as recorded or blank with its headings. */
  readonly pages: (data: DocumentData, t: Translate, blank: boolean) => string;
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
    line: (data, t) => `${classes(data, t)} · ${t('documents.list.today')}`,
    blankLine: (t) => t('documents.output.blankJournal'),
    signatureLine: (t) => t('documents.output.signature'),
    emptyLine: (t) => t('documents.output.noClasses'),
    pages: journalPages,
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
];

/** The document with this ID; an unknown one, as from a later version's saved screen, is none. */
export function documentKind(id: string): DocumentKind | undefined {
  return DOCUMENTS.find((kind) => kind.id === id);
}

/** The file name offered when saving, such as «الدفتر اليومي 2026-10-18.pdf», with the blank version said. */
export function fileName(kind: DocumentKind, data: DocumentData, t: Translate, blank: boolean): string {
  const version = blank ? ` - ${t('documents.output.blank')}` : '';
  return `${kind.title(t)} ${kind.period(data)}${version}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
}
