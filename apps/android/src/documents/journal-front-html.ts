// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée daily journal's front pages as printed pages (#216,
// Journal-front, R-3.8-12): the teacher's card with the director's visa,
// then one page for each table, seminars, training and meetings, then
// holidays and national days. A table's rows come first, an entry still to
// come in grey, then empty rules to fill by hand; a long table runs on to
// the next page with its heads. Dates and class codes are isolated, so they
// keep their order in any language.

import { escapeHtml, printDocument } from './print-html';

export interface FrontField {
  readonly label: string;
  /** Empty in the blank version, or when the teacher has not given it. */
  readonly value: string;
}

export interface FrontRow {
  readonly cells: readonly string[];
  /** Not happened yet: printed in grey. */
  readonly later: boolean;
  /** The rules its longest cell wraps onto. */
  readonly rules: number;
}

export interface FrontTable {
  readonly title: string;
  readonly heads: readonly string[];
  /** Each column's width, such as «32mm» or «auto». */
  readonly widths: readonly string[];
  /** The column of dates, centred on one line. */
  readonly dateColumn: number;
  readonly rows: readonly FrontRow[];
  readonly note?: string;
  /** The rules the table fills to with empty ones; FRONT_RULES when not given. */
  readonly rules?: number;
}

export interface FrontTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly book: string;
  readonly front: string;
  readonly school: string;
  readonly year: string;
  readonly card: string;
  readonly director: string;
}

/** The rules a table's page holds below its head, its title and its column heads. */
export const FRONT_RULES = 25;

export const FRONT_CSS =
  '.head{display:flex;justify-content:space-between;align-items:flex-end;border:1.2pt solid #000;border-radius:4pt;' +
  'padding:6pt 10pt;margin-bottom:8pt}.head .book{font-family:Ruqaa,Naskh;font-size:18pt}.head small{font-size:10pt}' +
  'h2{font-family:Ruqaa,Naskh;font-size:15pt;font-weight:700;text-align:center;margin:4mm 0}' +
  'table.card{width:100%;border-collapse:collapse;margin-bottom:10mm}' +
  'table.card th{width:40mm;text-align:start;font-weight:700;padding:3mm 2mm;vertical-align:bottom}' +
  'table.card td{border-bottom:0.6pt dotted #555;padding:3mm 2mm;vertical-align:bottom}' +
  '.visa{border:1.2pt solid #000;border-radius:4pt;height:45mm;padding:4pt 8pt;font-family:Ruqaa,Naskh;width:50%}' +
  'table.front{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.front th{border:0.8pt solid #000;height:8mm;font-family:Ruqaa,Naskh;font-size:11pt}' +
  'table.front td{border:0.8pt solid #000;height:8mm;padding:0 2mm;vertical-align:middle}' +
  'table.front tr{break-inside:avoid}table.front td.d{text-align:center;white-space:nowrap}' +
  '.later{color:#666}.note{font-size:9pt;margin-top:3mm}';

/** The head every front page carries: the book and the school, then the front pages' name and the year. */
export function headHtml(texts: FrontTexts): string {
  return (
    `<div class="head"><div><div class="book">${escapeHtml(texts.book)}</div>` +
    `<small>${escapeHtml(texts.school)}</small></div><div><b>${escapeHtml(texts.front)}</b><br>` +
    `<small>${escapeHtml(texts.year)}</small></div></div>`
  );
}

/** A table with its title and heads, its rows, then empty rules up to its total, and its note. */
export function tableHtml(table: FrontTable): string {
  const cols = table.widths.map((width) => `<col${width === 'auto' ? '' : ` style="width:${width}"`}>`).join('');
  const heads = table.heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('');
  const rows = table.rows.map(
    (row) =>
      `<tr${row.later ? ' class="later"' : ''}>` +
      row.cells
        .map((cell, index) =>
          index === table.dateColumn
            ? `<td class="d"><bdi>${escapeHtml(cell)}</bdi></td>`
            : `<td>${escapeHtml(cell)}</td>`,
        )
        .join('') +
      '</tr>',
  );
  const empty = `<tr>${table.heads.map(() => '<td></td>').join('')}</tr>`;
  const used = table.rows.reduce((sum, row) => sum + row.rules, 0);
  const fill = Array.from({ length: Math.max(0, (table.rules ?? FRONT_RULES) - used) }, () => empty);
  return (
    `<h2>${escapeHtml(table.title)}</h2><table class="front"><colgroup>${cols}</colgroup>` +
    `<thead><tr>${heads}</tr></thead><tbody>${[...rows, ...fill].join('')}</tbody></table>` +
    (table.note === undefined ? '' : `<div class="note">${escapeHtml(table.note)}</div>`)
  );
}

/** The teacher's card with its title, then the box for the director's visa. */
export function cardHtml(texts: FrontTexts, card: readonly FrontField[]): string {
  const fields = card
    .map(
      (field) =>
        `<tr><th>${escapeHtml(field.label)}</th><td><bdi dir="${texts.dir}">${escapeHtml(field.value)}</bdi></td></tr>`,
    )
    .join('');
  return (
    `<h2>${escapeHtml(texts.card)}</h2><table class="card">${fields}</table>` +
    `<div class="visa">${escapeHtml(texts.director)}</div>`
  );
}

/** The front pages: the card, then each table on its own page, as one HTML document. */
export function journalFrontHtml(
  texts: FrontTexts,
  card: readonly FrontField[],
  tables: readonly FrontTable[],
): string {
  const first = `${headHtml(texts)}${cardHtml(texts, card)}`;
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: `${texts.book} · ${texts.front}`,
    landscape: false,
    css: FRONT_CSS,
    pages: [first, ...tables.map((table) => `${headHtml(texts)}${tableHtml(table)}`)],
  });
}
