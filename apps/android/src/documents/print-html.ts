// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What every printed document shares (PRD §3.8, §5.13): the bundled fonts,
// embedded by the phone's web engine from the app's own resources; A4
// pages in black and white with a binding margin; and text escaped, since
// names and lessons come from the teacher and the class list.

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
  body: string;
}): string {
  const faces = FONTS.map(
    ([family, file, weight]) =>
      `@font-face{font-family:${family};src:url('${file}.ttf') format('truetype');font-weight:${weight};font-display:block}`,
  ).join('');
  const page = `@page{size:A4 ${options.landscape ? 'landscape' : 'portrait'};margin:12mm 12mm 12mm 18mm}`;
  const base =
    'html{-webkit-print-color-adjust:exact}body{margin:0;font-family:Naskh,Sans,serif;font-size:11pt;color:#000}' +
    '.page{break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}' +
    '.latin{font-family:Sans,Naskh,sans-serif}bdi{unicode-bidi:isolate}';
  return (
    `<!doctype html><html lang="${escapeHtml(options.lang)}" dir="${options.dir}"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(options.title)}</title><style>${faces}${page}${base}${options.css}</style></head>` +
    `<body>${options.body}</body></html>`
  );
}
