// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The check before signing (#242, R-3.7-09, answer 466): a file read back, the
// CSV now and the school's workbook with #45, set beside the register in the
// form of the official control sheet. Each pupil's line is found by their
// number; their name and each part, and the average when both have one, are
// compared, a file's number with a comma decimal read as a point and compared
// with the value as the register shows it, never rounded. The file's numbers
// that are not on the register's list, and those it has twice, are given too.
// It changes neither the register nor the file.

import type { AveragePart } from './assessment.ts';
import { exportCell, type CsvLabels } from './export-csv.ts';
import { shownMark } from './grade-book.ts';
import type { TermExport } from './term-export.ts';

export interface CheckCell {
  readonly part: AveragePart | 'name' | 'average';
  readonly register: string;
  /** What the file has; null when the pupil's line or the column is not in it. */
  readonly file: string | null;
  readonly same: boolean;
}

export interface CheckRow {
  readonly pupilId: string;
  readonly number: number;
  readonly cells: readonly CheckCell[];
  readonly same: boolean;
}

export interface ExportCheck {
  readonly rows: readonly CheckRow[];
  /** The rows whose every value is the same in the file. */
  readonly matched: number;
  /** The parts whose column the file's header does not have. */
  readonly missingColumns: readonly AveragePart[];
  /** The numbers on the file's lines that are not on the register's list. */
  readonly extra: readonly number[];
  /** The numbers the file has on more than one line; their first line is compared. */
  readonly twice: readonly number[];
}

/** Whether a file's cell holds the register's value: the same number, or the same word. */
function sameValue(register: string, file: string): boolean {
  const text = file.trim().replace(/^'/, '');
  const shown = Number(register);
  const read = Number(text.replace(',', '.'));
  if (register !== '' && Number.isFinite(shown) && text !== '' && Number.isFinite(read)) {
    return Math.abs(read - shown) < 1e-9;
  }
  return text === register;
}

/** A name as compared: no apostrophe before it, one space between words. */
function plainName(name: string): string {
  return name.replace(/^'/, '').replace(/\s+/g, ' ').trim();
}

/** The register beside a file read back, pupil by pupil; it changes neither. */
export function checkExport(
  sheet: TermExport,
  table: readonly (readonly string[])[],
  nameOf: (pupilId: string) => string,
  labels: CsvLabels,
): ExportCheck {
  const headerAt = table.findIndex((cells) => cells.some((cell) => cell.trim() === labels.number));
  const header = headerAt < 0 ? [] : (table[headerAt] ?? []).map((cell) => cell.trim());
  const at = (label: string) => header.indexOf(label);
  const columns = new Map(sheet.parts.map((part) => [part, at(labels.parts[part])]));
  const lines = new Map<number, readonly string[]>();
  const twice = new Set<number>();
  for (const cells of headerAt < 0 ? [] : table.slice(headerAt + 1)) {
    const number = Number((cells[at(labels.number)] ?? '').trim());
    if (!Number.isInteger(number) || number <= 0) continue;
    if (lines.has(number)) twice.add(number);
    else lines.set(number, cells);
  }
  const listed = new Set(sheet.rows.map((row) => row.number));
  const rows = sheet.rows.map((row) => {
    const line = lines.get(row.number);
    const cell = (part: CheckCell['part'], register: string, column: number, compare = sameValue) => {
      const file = line === undefined || column < 0 ? null : (line[column] ?? '').trim();
      return { part, register, file, same: file !== null && compare(register, file) };
    };
    const name = nameOf(row.pupilId);
    const average = row.average === null ? '' : shownMark(row.average);
    const cells = [
      ...(at(labels.name) < 0 ? [] : [cell('name', name, at(labels.name), (a, b) => plainName(a) === plainName(b))]),
      ...sheet.parts.map((part) => cell(part, exportCell(row.values[part] ?? null, labels), columns.get(part) ?? -1)),
      ...(sheet.averaged && at(labels.average) >= 0 ? [cell('average', average, at(labels.average))] : []),
    ];
    return { pupilId: row.pupilId, number: row.number, cells, same: cells.every((one) => one.same) };
  });
  return {
    rows,
    matched: rows.filter((row) => row.same).length,
    missingColumns: sheet.parts.filter((part) => (columns.get(part) ?? -1) < 0),
    extra: [...lines.keys()].filter((number) => !listed.has(number)).sort((a, b) => a - b),
    twice: [...twice].sort((a, b) => a - b),
  };
}
