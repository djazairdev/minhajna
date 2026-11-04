// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Text positions yield draft rows only, never a validated plan or a number
// marked as checked. Arabic presentation glyphs become ordinary letters,
// so a title keyed with an Arabic keyboard can match the extracted words.
// Scanned pages remain usable through their page images, and so does a page
// with too much text, or text that cannot be read: it just has no rows.

export interface TextPiece {
  readonly str: string;
  readonly transform: readonly number[];
  readonly dir: string;
}

/** A page's draft rows, or none when its text cannot be read or is over the limits. */
export async function pageRows(page: {
  getTextContent(): Promise<{ readonly items: readonly object[] }>;
}): Promise<string[]> {
  try {
    const content = await page.getTextContent();
    return draftRows(content.items.filter((one): one is TextPiece => 'str' in one));
  } catch {
    return [];
  }
}

export function draftRows(pieces: readonly TextPiece[]): string[] {
  if (pieces.length > 20000) throw new Error('E_PDF_LIMIT');
  const lines: { y: number; parts: TextPiece[] }[] = [];
  for (const piece of pieces) {
    if (piece.str.trim() === '') continue;
    const y = piece.transform[5];
    if (y === undefined || !Number.isFinite(y)) continue;
    let row = lines.find((one) => Math.abs(one.y - y) <= 2);
    if (row === undefined) {
      row = { y, parts: [] };
      lines.push(row);
    }
    row.parts.push(piece);
  }
  const rows = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const rtl = line.parts.filter((one) => one.dir === 'rtl').length > line.parts.length / 2;
      return line.parts
        .sort((a, b) => ((a.transform[4] ?? 0) - (b.transform[4] ?? 0)) * (rtl ? -1 : 1))
        .map((part) => part.str.replace(/[\uFB50-\uFDFF\uFE70-\uFEFE]/gu, (one) => one.normalize('NFKC')))
        .join(' ')
        .trim();
    });
  if (rows.length > 2000 || rows.join('').length > 100000) throw new Error('E_PDF_LIMIT');
  return rows;
}
