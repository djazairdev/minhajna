// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each book's pages for «طباعة الأسبوع» (#215): the counting pass printed
// by the phone's web engine and read back by the native module
// (print-set.ts). The screen counts again a moment after its choices
// change, keeps only the latest answer, and says when the count failed;
// printing counts first if no answer is in yet, and, if it cannot, prints
// with no blank page between books. The count follows the counting pass's
// HTML only, so a change that leaves it alone counts nothing again.

import { useEffect, useMemo, useState } from 'react';
import pdf from '../native/NativeMinhajnaPdf';
import {
  bookCount,
  countsFromColors,
  MARK_POINTS,
  printSetHtml,
  setLandscape,
  type SetDocument,
  type SetLayout,
} from './print-set';

/** How long the screen waits after a change before counting, in milliseconds. */
export const COUNT_DELAY = 400;

/** Each book's pages, from the counting pass's HTML; rejects when the marks cannot be read. */
async function countHtml(html: string, books: number, landscape: boolean): Promise<number[]> {
  if (books === 0) return [];
  const counts = countsFromColors(await pdf.pageColors(html, landscape, MARK_POINTS), books);
  if (counts === null) throw new Error('The pages could not be counted');
  return counts;
}

/** Each book's pages; rejects when the marks cannot be read. */
export function countBooks(documents: readonly SetDocument[], layout: SetLayout): Promise<number[]> {
  return countHtml(printSetHtml(documents, layout), bookCount(documents), setLandscape(documents));
}

/** Each book's pages, or, when they cannot be counted, none, so that no blank page goes between books. */
export function countsForPrint(documents: readonly SetDocument[], layout: SetLayout): Promise<number[]> {
  return countBooks(documents, layout).catch(() => Array.from({ length: bookCount(documents) }, () => 0));
}

/** The latest count for the set: null while counting, and `failed` when it could not be made. */
export function useBookCounts(
  documents: readonly SetDocument[],
  layout: SetLayout,
): { readonly counts: readonly number[] | null; readonly failed: boolean } {
  const html = useMemo(() => printSetHtml(documents, layout), [documents, layout]);
  const books = useMemo(() => bookCount(documents), [documents]);
  const landscape = useMemo(() => setLandscape(documents), [documents]);
  const [answer, setAnswer] = useState<{ html: string; counts: number[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      countHtml(html, books, landscape).then(
        (counts) => current && setAnswer({ html, counts, failed: false }),
        () => current && setAnswer({ html, counts: null, failed: true }),
      );
    }, COUNT_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [html, books, landscape]);
  const fresh = answer?.html === html ? answer : null;
  return { counts: fresh?.counts ?? null, failed: fresh?.failed ?? false };
}
