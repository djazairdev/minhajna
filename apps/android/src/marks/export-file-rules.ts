// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The files of «التصدير الفصلي» (#242, Export-file and Marks-check, answers
// 466 and 467): the CSV file's words in the interface's language, as the
// printed sheet heads its columns; its marking line, «داخلي · سري» with the
// class, subject, term and year; the file's name; the password a protected
// file takes, Latin letters, digits and symbols until Windows' archivers are
// known to open an Arabic one; and the check of a file read back, against the
// words of whichever of the app's languages it was written in.

import { checkExport, exportCsv, type CsvLabels, type ExportCheck, type TermExport } from '@minhajna/core';
import { yearLabel, type DocumentData, type Translate } from '../documents/document-data';
import { sheetNames } from '../documents/mark-sheet-pages';
import { partLabel } from './book-rules';
import { termWord } from './marks-rules';

export type FileFormat = 'pdf' | 'csv';

/** Why a file read back was not checked. */
export type CheckRefusal = 'binary' | 'size' | 'header' | 'failed';

/** The CSV file's words: the list's heads as the printed sheet has them, and «غائب». */
export function csvLabels(t: Translate): CsvLabels {
  return {
    number: t('documents.number'),
    name: t('documents.name'),
    parts: {
      T: partLabel(t, 'T'),
      F: partLabel(t, 'F'),
      E: partLabel(t, 'E'),
      P: partLabel(t, 'P'),
      O: partLabel(t, 'O'),
    },
    average: t('marks.book.average'),
    appreciation: t('documents.markSheet.appreciation'),
    absent: t('marks.export.absent'),
  };
}

/** The file's name: the sheet's, the class and subject, the term and the year, with no character a folder refuses. */
export function sheetFileName(
  t: Translate,
  label: string,
  term: number,
  data: DocumentData,
  format: FileFormat,
): string {
  const name = `${t('documents.markSheet.name')} ${label} ${termWord(t, term)} ${yearLabel(data)}`;
  const safe = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 100)
    .trim();
  return `${safe}.${format}`;
}

/** The export as CSV text, marked «داخلي · سري» with the class, subject, term and year. */
export function sheetCsv(t: Translate, data: DocumentData, courseId: string, term: number, sheet: TermExport): string {
  const { className, subject } = sheetNames(data, t, courseId);
  const marking = [t('documents.confidential'), className, subject, termWord(t, term), yearLabel(data)];
  const nameOf = (pupilId: string) => data.state.pupils.get(pupilId)?.name ?? '';
  return exportCsv(sheet, nameOf, marking, csvLabels(t));
}

/** A protected file's password: 6 to 64 Latin letters, digits or symbols, with no space. */
export function passwordAllowed(password: string): boolean {
  return /^[\x21-\x7E]{6,64}$/.test(password);
}

/** Why the native side refused a file read back. */
export function refusalOf(error: unknown): CheckRefusal {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'E_FILE_BINARY' ? 'binary' : code === 'E_FILE_SIZE' ? 'size' : 'failed';
}

/** The check against each language's words, the one that finds the most of the file's columns; null when none does. */
export function fileCheck(
  sheet: TermExport,
  table: readonly (readonly string[])[],
  nameOf: (pupilId: string) => string,
  languages: readonly CsvLabels[],
): ExportCheck | null {
  let best: ExportCheck | null = null;
  for (const labels of languages) {
    const check = checkExport(sheet, table, nameOf, labels);
    if (check.missingColumns.length === sheet.parts.length) continue;
    const better =
      best === null ||
      check.missingColumns.length < best.missingColumns.length ||
      (check.missingColumns.length === best.missingColumns.length && check.matched > best.matched);
    if (better) best = check;
  }
  return best;
}
