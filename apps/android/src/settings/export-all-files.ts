// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The files of «تصدير كل البيانات» (#248, Export-all, R-5.9-01, R-5.9-03,
// answer 472). The archive is one JSON file in a ZIP, as the core writes it.
// The CSV choice is three files in one ZIP, in the term export's dialect, each
// marked «داخلي · سري» on its first line: a line per mark recorded, a line per
// absence or lateness, and a line per session recorded, with what the daily
// journal says of it and its homework apart. Names come from the pupils' list,
// never from a file, and a pupil's number is their number on the list. Lines
// are sorted by what they are, a term by its number and a class as «4م2» before
// «4م10», never by a word that reads differently in another language. A mark
// for a test since removed is left out, as it no longer counts.

import {
  ARCHIVE_FILE,
  archiveOf,
  archiveText,
  courseSetup,
  csvCell,
  csvText,
  current,
  type AssessmentData,
  type Entry,
  type MarkEntry,
  type PlanPack,
} from '@minhajna/core';
import { yearLabel, type DocumentData, type Translate } from '../documents/document-data';
import { journalLines, type JournalNames } from '../documents/journal-lines';
import { sheetNames } from '../documents/mark-sheet-pages';
import { partLabel } from '../marks/book-rules';
import { assessmentData, courseMarks, lineName, termWord } from '../marks/marks-rules';
import { listNumbers } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';

/** A file of the export: its name inside the ZIP, and its text. */
export interface ExportFile {
  readonly name: string;
  readonly text: string;
}

export interface ArchiveFacts {
  readonly entries: readonly Entry[];
  /** The app's version, such as `0.5.0`. */
  readonly app: string;
  readonly privateNotes: boolean;
}

/** The archive's one file, from the history as stored and the bundled packs the classes are pinned to. */
export function archiveFile(data: DocumentData, facts: ArchiveFacts): ExportFile {
  const bundledPacks: readonly PlanPack[] = data.packs;
  const archive = archiveOf(facts.entries, data.state, {
    made: data.day,
    app: facts.app,
    country: data.profile.code,
    calendarRelease: data.calendarRelease,
    privateNotes: facts.privateNotes,
    bundledPacks,
  });
  return { name: ARCHIVE_FILE, text: archiveText(archive) };
}

/** Bidi isolates, which the screen and the books use and a spreadsheet cell would only hide. */
const ISOLATES = /[\u2066-\u2069]/g;

/** A line's cells, and what it is sorted by: texts as a reader orders them, «4م2» before «4م10», then numbers. */
interface Line {
  readonly cells: readonly string[];
  readonly key: readonly (string | number)[];
}

function inOrder(lines: Line[]): string[][] {
  const compare = (a: string | number, b: string | number) =>
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true });
  return lines
    .sort((a, b) => a.key.reduce<number>((order, value, at) => order || compare(value, b.key[at] ?? ''), 0))
    .map((line) => [...line.cells]);
}

/** A pupil's number on the class list, Infinity for a pupil no longer there. */
function numberOf(data: DocumentData, numbers: Map<string, Map<string, number>>, pupilId: string): number {
  const pupil = data.state.pupils.get(pupilId);
  if (pupil === undefined) return Infinity;
  if (!numbers.has(pupil.classId)) numbers.set(pupil.classId, listNumbers(data, pupil.classId));
  return numbers.get(pupil.classId)?.get(pupilId) ?? Infinity;
}

/** The pupil's columns: number on the list, name and registration number. */
function pupilCells(data: DocumentData, number: number, pupilId: string): string[] {
  const pupil = data.state.pupils.get(pupilId);
  return [Number.isFinite(number) ? String(number) : '', pupil?.name ?? '', pupil?.registration ?? ''];
}

const KIND_ORDER = { component: 0, test: 1, practical: 2, oral: 3, exam: 4 } as const;

/** What a mark was given for and its day, if it has one; null for a test since removed, whose marks no longer count. */
function markWhat(
  t: Translate,
  data: DocumentData,
  assessment: AssessmentData | null,
  mark: MarkEntry,
): readonly [string, string] | null {
  const { target } = mark;
  switch (target.kind) {
    case 'test': {
      const test = data.state.tests.get(target.testId);
      return test === undefined ? null : [test.title, test.day];
    }
    case 'exam':
      return [partLabel(t, 'E'), ''];
    case 'practical':
      return [partLabel(t, 'P'), ''];
    case 'oral':
      return [partLabel(t, 'O'), ''];
    case 'component': {
      const setup = assessment && courseMarks(data.state, assessment, mark.courseId, mark.term)?.assessment;
      const line = setup?.lines.find((one) => one.id === target.componentId);
      const name = line === undefined ? '' : lineName(line);
      return [target.month === undefined ? name : `${name} · ${target.month}`, ''];
    }
  }
}

function marking(t: Translate, data: DocumentData, title: string): string[] {
  return [t('documents.confidential'), title, yearLabel(data)];
}

/** A line per mark recorded: class, subject, term, number, name, registration, what, its day, the value. */
export function marksCsv(t: Translate, data: DocumentData, assessment: AssessmentData | null): string {
  const numbers = new Map<string, Map<string, number>>();
  const lines: Line[] = [];
  for (const mark of data.state.marks.values()) {
    const what = mark.value === null ? null : markWhat(t, data, assessment, mark);
    if (what === null) continue;
    const { className, subject } = sheetNames(data, t, mark.courseId);
    const number = numberOf(data, numbers, mark.pupilId);
    lines.push({
      cells: [
        className,
        subject,
        termWord(t, mark.term),
        ...pupilCells(data, number, mark.pupilId),
        ...what,
        csvCell(mark.value, { absent: t('marks.export.absent') }),
      ],
      key: [className, subject, mark.term, number, KIND_ORDER[mark.target.kind], what[1], what[0]],
    });
  }
  const head = ['class', 'subject', 'term', 'number', 'name', 'registration', 'what', 'day', 'value'] as const;
  return csvText([
    marking(t, data, t('settings.exportAll.csv.marksTitle')),
    head.map((key) => t(`settings.exportAll.csv.${key}`)),
    ...inOrder(lines),
  ]);
}

/** A line per absence or lateness: class, day, half, number, name, registration, the mark, justified or not. */
export function rollCallCsv(t: Translate, data: DocumentData): string {
  const numbers = new Map<string, Map<string, number>>();
  const lines: Line[] = [];
  for (const versions of data.state.rollCalls.values()) {
    const taken = current(versions);
    if (taken === null) continue;
    const className = data.state.classes.get(taken.classId)?.name ?? '';
    const line = (pupilId: string, mark: string, justified: string) => {
      const number = numberOf(data, numbers, pupilId);
      lines.push({
        cells: [className, taken.day, t(`week.${taken.half}`), ...pupilCells(data, number, pupilId), mark, justified],
        key: [className, taken.day, taken.half === 'morning' ? 0 : 1, number],
      });
    };
    for (const absence of taken.absent)
      line(absence.pupilId, t('roll.absent'), t(absence.justified ? 'fix.yes' : 'fix.no'));
    for (const pupilId of taken.late) line(pupilId, t('roll.late'), '');
  }
  const head = ['class', 'day', 'half', 'number', 'name', 'registration', 'mark', 'justified'] as const;
  return csvText([
    marking(t, data, t('settings.exportAll.csv.rollTitle')),
    head.map((key) => t(`settings.exportAll.csv.${key}`)),
    ...inOrder(lines),
  ]);
}

/** A line per session recorded: class, subject, day, what the daily journal says of it, and its homework. */
export function lessonsCsv(t: Translate, data: DocumentData): string {
  const context = coreContext(data);
  const names: JournalNames = {
    type: (code) => data.profile.sessionTypes.find((one) => one.code === code)?.name[data.lang] ?? code,
    day: (day) => day,
  };
  const lines: Line[] = [];
  for (const versions of data.state.sessions.values()) {
    const record = current(versions);
    if (record === null) continue;
    const { homework, ...done } = record;
    const { className, subject } = sheetNames(data, t, record.session.courseId);
    const pack = courseSetup(context, record.session.courseId).pack;
    const said = journalLines(t, names, pack, done, false)
      .map((one) => `${one.label}: ${one.text}`.replace(ISOLATES, ''))
      .join(' · ');
    const { day, slot } = record.session;
    lines.push({
      cells: [className, subject, day, said, homework?.text ?? '', homework?.due ?? ''],
      key: [day, slot.half === 'morning' ? 0 : 1, slot.index, className, subject],
    });
  }
  const head = ['class', 'subject', 'day', 'lines', 'homework', 'due'] as const;
  return csvText([
    marking(t, data, t('settings.exportAll.csv.lessonsTitle')),
    head.map((key) => t(`settings.exportAll.csv.${key}`)),
    ...inOrder(lines),
  ]);
}

/** The CSV choice's three files. */
export function csvFiles(t: Translate, data: DocumentData, assessment: AssessmentData | null): ExportFile[] {
  return [
    { name: 'marks.csv', text: marksCsv(t, data, assessment) },
    { name: 'roll-call.csv', text: rollCallCsv(t, data) },
    { name: 'lessons.csv', text: lessonsCsv(t, data) },
  ];
}

export type ExportFormat = 'archive' | 'csv';

export interface ExportChoice {
  readonly format: ExportFormat;
  readonly entries: readonly Entry[];
  readonly app: string;
  readonly privateNotes: boolean;
}

/** The files the teacher chose: the archive's one file, or the three CSV files. */
export function exportFiles(t: Translate, data: DocumentData, choice: ExportChoice): ExportFile[] {
  return choice.format === 'archive' ? [archiveFile(data, choice)] : csvFiles(t, data, assessmentData(data.profile));
}
