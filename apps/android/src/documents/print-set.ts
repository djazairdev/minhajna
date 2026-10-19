// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One PDF a print shop can use (#215, Print-set, R-3.8-51 to R-3.8-56): the
// chosen documents, each made as the Documents tab makes it, bound into one
// HTML document that the phone's web engine prints, portrait and landscape
// pages together through a named page for one of them.
// - The other is the set's own page: the orientation of the documents with
//   pupils' data when they share one, else portrait. On a named page, the
//   web engine (Chromium 124) moves a repeated table footer onto a page of
//   its own, so a framed page there keeps «داخلي · سري» at its head on every
//   printed page and at its foot at its end only.
// - Each document keeps its own styles, scoped to its pages with :where(),
//   which adds no weight to a rule, so a page lays out as it does alone.
// - A book is a document's pages for one class, such as its texts book or
//   its roll-call book, or all its pages for a document kept as one, such
//   as the journal; a document's copies, such as a journal's days, are
//   gathered book by book. A page that names no book in a document whose
//   other pages do, such as a day with no session in a journal kept for
//   each class, is left out.
// - Binding margins put 18 mm on the spine's side of a portrait page: the
//   right in Arabic and the left in French or English, or, printed on both
//   sides, the side facing the spine, which alternates. Landscape pages keep
//   the 12 mm their layouts fill. Without binding margins, both sides get
//   15 mm, so the text's width, and so each page's layout, never changes.
// - Printed on both sides, each book starts on a sheet of its own, so a
//   class's pages can go into its own book: a blank page goes before a book
//   that would start on the back of a sheet. That needs each book's pages,
//   which only the web engine knows, so a counting pass prints the set once
//   with a red and green mark at the top of each book's first page, and the
//   native module reads the colours at MARK_POINTS on each page.
// - The summary counts the printed pages, the sheets and their cost, at about
//   5 DA a page (R-3.8-56).

import {
  BASE_CSS,
  FONT_FACES,
  LANDSCAPE_MARGINS,
  documentHead,
  escapeHtml,
  pageMargins,
  printedParts,
} from './print-html';

/** About what a print shop charges for a page, in dinars (R-3.8-56). */
export const PAGE_PRICE = 5;

/** Where the counting pass looks for its mark, in millimetres from a page's top-left corner: red, then green. */
export const MARK_POINTS: readonly number[] = [17, 22, 21, 22];

/** The mark: a strip of red and one of green in the top-left corner of the text, laid over it, taking no room. */
const MARK_CSS =
  'section.set-u{position:relative}section.set-u::before{content:"";position:absolute;z-index:9;top:0;left:0;width:4mm;height:20mm;' +
  'background:#f00;box-shadow:4mm 0 #0f0}';

/** A document of the set: what it prints, a copy for each day or month, and its orientation. */
export interface SetDocument {
  readonly landscape: boolean;
  /** Pupils' names or marks, framed by «داخلي · سري». */
  readonly pupils: boolean;
  /** Each copy as `printDocument` makes it, in order, such as the journal of each day of the week. */
  readonly copies: readonly string[];
}

export interface SetLayout {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  /** Printed on both sides of each sheet. */
  readonly twoSided: boolean;
  /** A wider margin on the spine's side. */
  readonly binding: boolean;
}

interface SetPage {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly css: string;
  readonly content: string;
}

interface Book {
  readonly landscape: boolean;
  readonly pupils: boolean;
  readonly pages: SetPage[];
}

/** The set's books, document after document, each document's in the order its first copy names them. */
function booksOf(documents: readonly SetDocument[]): Book[] {
  return documents.flatMap((document) => {
    const books = new Map<string, Book>();
    const copies = document.copies.map(printedParts);
    const named = copies.some((parts) => parts.pages.some((page) => page.book !== ''));
    for (const parts of copies) {
      for (const page of parts.pages.filter((one) => !named || one.book !== '')) {
        const book = books.get(page.book) ?? { landscape: document.landscape, pupils: document.pupils, pages: [] };
        books.set(page.book, book);
        book.pages.push({ lang: parts.lang, dir: parts.dir, css: parts.css, content: page.content });
      }
    }
    return [...books.values()];
  });
}

/** How many books the set holds, each starting on a sheet of its own when printed on both sides. */
export function bookCount(documents: readonly SetDocument[]): number {
  return booksOf(documents).length;
}

/** Whether the set's own page is landscape: when every document with pupils' data is, and one is. */
export function setLandscape(documents: readonly SetDocument[]): boolean {
  const framed = documents.filter((document) => document.pupils);
  return framed.length > 0 && framed.every((document) => document.landscape);
}

/** A document's own styles, each rule kept to the pages under `scope` with no added weight. */
function scoped(css: string, scope: string): string {
  return css
    .split('}')
    .filter((rule) => rule.trim() !== '')
    .map((rule) => {
      const [selectors, body] = rule.split('{');
      if (body === undefined || selectors.includes('@')) throw new Error('A style the print set cannot scope');
      return `${selectors
        .split(',')
        .map((one) => `:where(.${scope}) ${one.trim()}`)
        .join(',')}{${body}}`;
    })
    .join('');
}

/**
 * The page rules, with the set's own page unnamed and the other named «p» or «l», and the named one's frame footers
 * kept from repeating. The counting pass's margins never change, as they give the text the same width.
 */
function pageCss(layout: SetLayout, counting: boolean, landscape: boolean): string {
  const own = landscape ? 'l' : 'p';
  const named = landscape ? 'p' : 'l';
  const page = (name: 'p' | 'l', side = '') => `@page ${name === own ? '' : name}${side}`;
  const spine = counting || !layout.binding ? 'none' : layout.dir === 'rtl' ? 'right' : 'left';
  const sides =
    !counting && layout.binding && layout.twoSided
      ? `${page('p', ':left')}{${pageMargins('right')}}${page('p', ':right')}{${pageMargins('left')}}`
      : '';
  return (
    `${page('p')}{size:A4 portrait;${pageMargins(spine)}}${sides}${page('l')}{size:A4 landscape;${LANDSCAPE_MARGINS}}` +
    `section.set-${named}{page:${named}}:where(section.set-${named}) table.frame>tfoot{display:table-row-group}`
  );
}

/** Before each book, whether a blank page goes first, so that, on both sides, it starts on a sheet's front. */
export function blankBefore(counts: readonly number[], twoSided: boolean): boolean[] {
  let pages = 0;
  return counts.map((count) => {
    const blank = twoSided && pages % 2 === 1;
    pages += count + (blank ? 1 : 0);
    return blank;
  });
}

/**
 * The set as one HTML document. With each book's pages counted, it is the one printed; without, it is the counting
 * pass, with the mark on each book's first page.
 */
export function printSetHtml(documents: readonly SetDocument[], layout: SetLayout, counts?: readonly number[]): string {
  const books = booksOf(documents);
  if (counts !== undefined && counts.length !== books.length) throw new Error('A count for each book');
  const counting = counts === undefined;
  const blanks = counting ? [] : blankBefore(counts, layout.twoSided);
  const landscape = setLandscape(documents);
  const scopes = new Map<string, string>();
  const scope = (css: string) => {
    const name = scopes.get(css) ?? `d${scopes.size}`;
    scopes.set(css, name);
    return name;
  };
  const sections = books.flatMap((book, index) => [
    ...(blanks[index] ? ['<section class="page"></section>'] : []),
    ...book.pages.map(
      (page, at) =>
        `<section class="page set-${book.landscape ? 'l' : 'p'} ${scope(page.css)}${counting && at === 0 ? ' set-u' : ''}"` +
        ` lang="${escapeHtml(page.lang)}" dir="${page.dir}">${page.content}</section>`,
    ),
  ]);
  const own = [...scopes].map(([css, name]) => scoped(css, name)).join('');
  const css = `${FONT_FACES}${BASE_CSS}${pageCss(layout, counting, landscape)}${counting ? MARK_CSS : ''}`;
  return `${documentHead(layout.lang, layout.dir, layout.title, css, own)}<body>${sections.join('')}</body></html>`;
}

/** Each book's pages, from the colours the counting pass's PDF has at MARK_POINTS on each page; null if unclear. */
export function countsFromColors(colors: readonly number[], books: number): number[] | null {
  const per = MARK_POINTS.length / 2;
  if (colors.length % per !== 0) return null;
  const channel = (color: number, shift: number) => (color >> shift) & 0xff;
  const red = (color: number) => channel(color, 16) > 200 && channel(color, 8) < 80 && channel(color, 0) < 80;
  const green = (color: number) => channel(color, 8) > 150 && channel(color, 16) < 80 && channel(color, 0) < 80;
  const pages = colors.length / per;
  const starts = Array.from({ length: pages }, (_, page) => page).filter(
    (page) => red(colors[page * per]) && green(colors[page * per + 1]),
  );
  if (starts.length !== books || (books > 0 && starts[0] !== 0)) return null;
  return starts.map((start, index) => (starts[index + 1] ?? pages) - start);
}

/** What the set costs: its printed pages, the sheets they take, and about what a print shop charges. */
export function printSummary(
  counts: readonly number[],
  twoSided: boolean,
): { readonly pages: number; readonly sheets: number; readonly price: number } {
  const pages = counts.reduce((sum, count) => sum + count, 0);
  const blanks = blankBefore(counts, twoSided).filter(Boolean).length;
  return { pages, sheets: twoSided ? Math.ceil((pages + blanks) / 2) : pages, price: pages * PAGE_PRICE };
}
