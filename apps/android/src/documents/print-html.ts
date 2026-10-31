// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What every printed document shares (PRD §3.8, §5.13): the bundled fonts,
// embedded by the phone's web engine from the app's own resources; A4 pages in
// black and white with a binding margin on the spine's side, the right of a
// page in Arabic and the left in French or English (R-3.8-51); text escaped,
// since names and lessons come from the teacher and the class list; and, on a
// document with pupils' data, «داخلي · سري» at the head and foot of every page
// (R-5.9-15): the head and foot of a frame table around each page's content,
// which the web engine repeats on each printed page, as fixed positions are
// not; the same frame carries a demo world's mark on a document made in one.
// Pages break between frames, never inside a cell. The page carries no script,
// and its policy refuses any. A document's own styles stand apart from the
// shared ones, and each page can name the book it belongs to, such as a class's
// texts book, so that the print set (print-set.ts) can bind several documents
// into one PDF.

/** The bundled fonts, read by the web engine from the APK's resources. */
const FONTS = [
  ['Naskh', 'noto_naskh_arabic_regular', 400],
  ['Naskh', 'noto_naskh_arabic_bold', 700],
  ['Ruqaa', 'aref_ruqaa_bold', 700],
  ['Sans', 'noto_sans_regular', 400],
  ['Sans', 'noto_sans_bold', 700],
] as const;

/** Text made safe to place in HTML, in an element or an attribute. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The page margins: 12 mm, and 18 mm on the spine's side when there is one, with the same width for the text. */
export function pageMargins(spine: 'left' | 'right' | 'none'): string {
  const [left, right] = spine === 'left' ? [18, 12] : spine === 'right' ? [12, 18] : [15, 15];
  return `margin:12mm ${right}mm 12mm ${left}mm`;
}

/** A landscape page's margins: its long edges, where the spine falls, keep 12 mm, as its layout fills the rest. */
export const LANDSCAPE_MARGINS = 'margin:12mm 15mm';

/** The bundled fonts, as rules for the page's style. */
export const FONT_FACES = FONTS.map(
  ([family, file, weight]) =>
    `@font-face{font-family:${family};src:url('${file}.ttf') format('truetype');font-weight:${weight};font-display:block}`,
).join('');

/** What every page shares: the fonts' families, page breaks between pages, and the frame of the confidential mark. */
export const BASE_CSS =
  'html{-webkit-print-color-adjust:exact}body{margin:0;font-family:Naskh,Sans,serif;font-size:11pt;color:#000}' +
  '.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}' +
  '.latin{font-family:Sans,Naskh,sans-serif}bdi{unicode-bidi:isolate}' +
  'table.frame{width:100%;border-collapse:collapse;table-layout:auto;font-size:inherit}' +
  'table.frame>*>tr{break-inside:auto}table.frame>*>tr>td{border:0;padding:0;height:auto;overflow:visible;text-align:start}' +
  'table.frame>thead{display:table-header-group}table.frame>tfoot{display:table-footer-group}' +
  'table.frame>*>tr>td.mark{text-align:center;font-size:9pt;font-weight:700;padding:2mm 0}' +
  '.drawn{display:block;height:14mm;width:auto;max-width:100%;margin:1mm auto 0}';

/** The head of an HTML document of A4 pages, with its language, direction, title and styles. */
export function documentHead(lang: string, dir: 'rtl' | 'ltr', title: string, css: string, own: string): string {
  return (
    `<!doctype html><html lang="${escapeHtml(lang)}" dir="${dir}"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">` +
    `<title>${escapeHtml(title)}</title><style>${css}</style><style>${own}</style></head>`
  );
}

/** A whole HTML document of A4 pages, portrait or landscape, in the interface's language and direction. */
export function printDocument(options: {
  lang: string;
  dir: 'rtl' | 'ltr';
  title: string;
  landscape: boolean;
  css: string;
  /** Each page's content; a long one runs onto more printed pages. */
  pages: readonly string[];
  /** The book each page belongs to, such as a class's, in the order of the pages; one book when not given. */
  books?: readonly string[];
  /** A mark at the head and foot of every page: the internal, confidential one for pupils' data, or a demo world's. */
  confidential?: string;
}): string {
  const { confidential, books } = options;
  const marked = confidential !== undefined;
  const margins = options.landscape ? LANDSCAPE_MARGINS : pageMargins(options.dir === 'rtl' ? 'right' : 'left');
  const page = `@page{size:A4 ${options.landscape ? 'landscape' : 'portrait'};${margins}}`;
  const mark = marked ? `<tr><td class="mark">${escapeHtml(confidential)}</td></tr>` : '';
  const framed = (content: string) =>
    marked
      ? `<table class="frame"><thead>${mark}</thead><tbody><tr><td>${content}</td></tr></tbody><tfoot>${mark}</tfoot></table>`
      : content;
  const book = (index: number) => (books?.[index] ? ` data-book="${escapeHtml(books[index])}"` : '');
  const body = options.pages
    .map((content, index) => `<section class="page"${book(index)}>${framed(content)}</section>`)
    .join('');
  return (
    documentHead(options.lang, options.dir, options.title, `${FONT_FACES}${page}${BASE_CSS}`, options.css) +
    `<body>${body}</body></html>`
  );
}

/** A printed document read back: its language, direction, own styles, and each page with its book. */
export interface PrintedParts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly css: string;
  readonly pages: readonly { readonly book: string; readonly content: string }[];
}

/** Reads back what `printDocument` made; anything else is refused, as the print set relies on its shape. */
export function printedParts(html: string): PrintedParts {
  const head =
    /^<!doctype html><html lang="([^"]*)" dir="(rtl|ltr)">.*?<\/style><style>(.*?)<\/style><\/head><body>/s.exec(html);
  if (head === null || !html.endsWith('</body></html>')) throw new Error('Not a printed document');
  const body = html.slice(head[0].length, -'</body></html>'.length);
  const found = [...body.matchAll(/<section class="page"(?: data-book="([^"]*)")?>(.*?)<\/section>/gs)];
  if (found.map((one) => one[0]).join('') !== body) throw new Error('Not a printed document');
  const pages = found.map((one) => ({ book: one[1] ?? '', content: one[2] }));
  return { lang: head[1], dir: head[2] as 'rtl' | 'ltr', css: head[3], pages };
}
