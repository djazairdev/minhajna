// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What every printed document shares (PRD §3.8, §5.13): the bundled fonts,
// embedded by the phone's web engine from the app's own resources; A4
// pages in black and white with a binding margin; text escaped, since names
// and lessons come from the teacher and the class list; and, on a document
// with pupils' data, «داخلي · سري» at the head and foot of every page
// (R-5.9-15): the head and foot of a frame table around each page's
// content, which the web engine repeats on each printed page, as fixed
// positions are not. Pages break between frames, never inside a cell. The
// page carries no script, and its policy refuses any.

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

/** A whole HTML document of A4 pages, portrait or landscape, in the interface's language and direction. */
export function printDocument(options: {
  lang: string;
  dir: 'rtl' | 'ltr';
  title: string;
  landscape: boolean;
  css: string;
  /** Each page's content; a long one runs onto more printed pages. */
  pages: readonly string[];
  /** The mark for a document with pupils' data, such as «داخلي · سري», on every page. */
  confidential?: string;
}): string {
  const faces = FONTS.map(
    ([family, file, weight]) =>
      `@font-face{font-family:${family};src:url('${file}.ttf') format('truetype');font-weight:${weight};font-display:block}`,
  ).join('');
  const { confidential } = options;
  const marked = confidential !== undefined;
  const page = `@page{size:A4 ${options.landscape ? 'landscape' : 'portrait'};margin:12mm 12mm 12mm 18mm}`;
  const mark = marked ? `<tr><td class="mark">${escapeHtml(confidential)}</td></tr>` : '';
  const framed = (content: string) =>
    marked
      ? `<table class="frame"><thead>${mark}</thead><tfoot>${mark}</tfoot><tbody><tr><td>${content}</td></tr></tbody></table>`
      : content;
  const body = options.pages.map((content) => `<section class="page">${framed(content)}</section>`).join('');
  const base =
    'html{-webkit-print-color-adjust:exact}body{margin:0;font-family:Naskh,Sans,serif;font-size:11pt;color:#000}' +
    '.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}' +
    '.latin{font-family:Sans,Naskh,sans-serif}bdi{unicode-bidi:isolate}' +
    'table.frame{width:100%;border-collapse:collapse;table-layout:auto;font-size:inherit}' +
    'table.frame>*>tr{break-inside:auto}table.frame>*>tr>td{border:0;padding:0;height:auto;overflow:visible;text-align:start}' +
    'table.frame>thead{display:table-header-group}table.frame>tfoot{display:table-footer-group}' +
    'table.frame>*>tr>td.mark{text-align:center;font-size:9pt;font-weight:700;padding:2mm 0}';
  return (
    `<!doctype html><html lang="${escapeHtml(options.lang)}" dir="${options.dir}"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">` +
    `<title>${escapeHtml(options.title)}</title><style>${faces}${page}${base}${options.css}</style></head>` +
    `<body>${body}</body></html>`
  );
}
