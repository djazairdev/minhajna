// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term export as a CSV file (#242, PRD §3.7 and §5.9, answer 466). The file
// is UTF-8 with a byte-order mark, so Excel reads its Arabic, and its cells are
// split by semicolons, the list separator of Excel set in French or Arabic for
// Algeria; its first line marks it, «داخلي · سري» with the class, subject, term
// and year; then the header and a line for each pupil in list order, numbers
// with two decimals after a comma, that Excel's decimal mark, and the absence's
// word. A cell that a spreadsheet would run as a formula starts with an
// apostrophe. Read back, a file is split by its own separator, semicolon, comma
// or tab, the one that splits the most of its first lines, as a spreadsheet
// saving it again may change it.

import type { AveragePart } from './assessment.ts';
import { shownMark } from './grade-book.ts';
import type { ExportValue, TermExport } from './term-export.ts';

export interface CsvLabels {
  readonly number: string;
  readonly name: string;
  readonly parts: Readonly<Record<AveragePart, string>>;
  readonly average: string;
  readonly appreciation: string;
  /** The word for an absence, «غائب». */
  readonly absent: string;
}

/** A value as the export writes it: two decimals, the absence's word, or nothing. */
export function exportCell(value: ExportValue, labels: Pick<CsvLabels, 'absent'>): string {
  return value === null ? '' : value === 'absent' ? labels.absent : shownMark(value);
}

/** A value as the CSV file writes it: a number with a decimal comma, the absence's word as it is, or nothing. */
function csvCell(value: ExportValue, labels: Pick<CsvLabels, 'absent'>): string {
  return typeof value === 'number' ? shownMark(value).replace('.', ',') : exportCell(value, labels);
}

/** A cell as a CSV field: never run as a formula, quoted when it holds a semicolon, tab, quote or line break. */
function field(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\t\r\n]|^\s|\s$/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The export as CSV text: the marking line, the header, then each pupil. */
export function exportCsv(
  sheet: TermExport,
  nameOf: (pupilId: string) => string,
  marking: readonly string[],
  labels: CsvLabels,
): string {
  const header = [
    labels.number,
    labels.name,
    ...sheet.parts.map((part) => labels.parts[part]),
    ...(sheet.averaged ? [labels.average] : []),
    labels.appreciation,
  ];
  const rows = sheet.rows.map((row) => [
    String(row.number),
    nameOf(row.pupilId),
    ...sheet.parts.map((part) => csvCell(row.values[part] ?? null, labels)),
    ...(sheet.averaged ? [csvCell(row.average, labels)] : []),
    row.appreciation ?? '',
  ]);
  const lines = [marking, header, ...rows].map((cells) => cells.map(field).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** The separator a file uses: of semicolon, comma and tab, the one in the most of its first lines, outside quotes. */
function separatorOf(text: string): string {
  const candidates = [';', ',', '\t'];
  const lines = new Map(candidates.map((one) => [one, 0]));
  const counts = new Map(candidates.map((one) => [one, 0]));
  const seen = new Set<string>();
  let quoted = false;
  let read = 0;
  for (let at = 0; at < text.length && read < 20; at += 1) {
    const char = text[at] ?? '';
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) {
      for (const one of seen) lines.set(one, (lines.get(one) ?? 0) + 1);
      seen.clear();
      read += 1;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
      seen.add(char);
    }
  }
  for (const one of seen) lines.set(one, (lines.get(one) ?? 0) + 1);
  const score = (one: string) => (lines.get(one) ?? 0) * 1e6 + (counts.get(one) ?? 0);
  return candidates.reduce((best, next) => (score(next) > score(best) ? next : best));
}

/** A CSV file's cells, line by line, without the byte-order mark or a last empty line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const separator = separatorOf(text);
  const lines: string[][] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (quoted && char === '"' && text[at + 1] === '"') {
      cell += '"';
      at += 1;
    } else if (char === '"') quoted = !quoted;
    else if (!quoted && char === separator) {
      cells.push(cell);
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[at + 1] === '\n') at += 1;
      lines.push([...cells, cell]);
      cells = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || cells.length > 0) lines.push([...cells, cell]);
  return lines;
}
