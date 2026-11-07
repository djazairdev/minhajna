// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A CSV file as the dashboard's imports read it: Excel's CSV UTF-8, with
// commas or semicolons, a header naming each column in any of the interface's
// languages, then a line for each row, numbered as a spreadsheet numbers it.
// Lines with nothing in them are skipped. The words each column may be headed
// with come from the dashboard's catalogues, so a file made in French reads in
// Arabic too.

import { parseCsv } from '@minhajna/core';
import { dashboardCatalogues } from './catalogues';

export type ColumnWords = Readonly<Record<string, string>>;

/** One row of the file, by column, and its line in the file. */
export interface CsvRow {
  readonly line: number;
  readonly cells: Readonly<Record<string, string>>;
}

export type CsvTable =
  { readonly ok: true; readonly rows: readonly CsvRow[] } | { readonly ok: false; readonly missing: readonly string[] };

const plain = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/gu, ' ');

/** Every heading a column may have, from each language's words, split at `|`. */
export function headings(pick: (words: typeof dashboardCatalogues.ar) => ColumnWords): Map<string, string> {
  const known = new Map<string, string>();
  for (const words of Object.values(dashboardCatalogues))
    for (const [column, names] of Object.entries(pick(words)))
      for (const name of names.split('|')) known.set(plain(name), column);
  return known;
}

/** The file's rows under the columns its header names; a needed column missing refuses the file. */
export function readTable(text: string, known: Map<string, string>, needed: readonly string[]): CsvTable {
  const lines = parseCsv(text);
  const header = (lines[0] ?? []).map((cell) => known.get(plain(cell)) ?? null);
  const missing = needed.filter((column) => !header.includes(column));
  if (missing.length > 0) return { ok: false, missing };
  const rows: CsvRow[] = [];
  lines.slice(1).forEach((cells, at) => {
    if (cells.every((cell) => cell.trim() === '')) return;
    const named: Record<string, string> = {};
    header.forEach((column, index) => {
      if (column !== null && named[column] === undefined) named[column] = (cells[index] ?? '').trim();
    });
    rows.push({ line: at + 2, cells: named });
  });
  return { ok: true, rows };
}

/** Whether a cell names this thing by its code or by any of its names. */
export function names(cell: string, code: string, words: Readonly<Record<string, string>>): boolean {
  const typed = plain(cell);
  return typed === plain(code) || Object.values(words).some((word) => plain(word) === typed);
}
