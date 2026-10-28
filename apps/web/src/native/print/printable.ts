// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A printed document made ready for the PC's print frame (#250, answer 507).
// The app's documents are HTML pages made by documentHead (print-html.ts), with
// their styles in the head and a few widths in style attributes. The page's
// security policy refuses both in a frame of this page, so they are taken out
// here: the head gives the language, direction, title and rules; each style
// attribute becomes a rule on a numbered data attribute, every declaration
// marked important, so it wins over the page's rules as the attribute did; and
// the bundled fonts are read from the web app's own fonts folder. Anything that
// is not such a page is refused. The frame keeps the page's policy, so a script
// or an event attribute would not run there either.

export interface Printable {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  /** Every rule of the page, its style attributes' among them. */
  readonly css: string;
  /** The body's markup, with no style attribute left. */
  readonly body: string;
}

const PAGE = new RegExp(
  [
    String.raw`^<!doctype html><html lang="([^"]*)" dir="(rtl|ltr)"><head><meta charset="utf-8">(?:<meta [^>]*>)*`,
    String.raw`<title>([^<]*)</title><style>([^<]*)</style><style>([^<]*)</style></head>`,
    String.raw`<body>([\s\S]*)</body></html>$`,
  ].join(''),
  'u',
);
const STYLE = /\sstyle="([^"]*)"/gu;

/** The text of an escaped HTML title. */
function unescaped(text: string): string {
  return text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&');
}

/** The declarations of a style attribute, each marked important. */
function important(style: string): string {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => (/!\s*important$/iu.test(part) ? part : `${part} !important`))
    .join(';');
}

/** The document `html` made ready for the print frame, its fonts read from `fonts`, a folder's URL ending in `/`. */
export function printable(html: string, fonts: string): Printable {
  const page = PAGE.exec(html);
  if (page === null) throw new Error('Not a printed document');
  const [, lang = '', dir, title = '', shared = '', own = '', markup = ''] = page;
  const rules: string[] = [];
  const body = markup.replace(STYLE, (_, style: string) => {
    rules.push(`[data-print-style="${rules.length}"]{${important(unescaped(style))}}`);
    return ` data-print-style="${rules.length - 1}"`;
  });
  const css = `${shared}${own}`.replace(/url\('([a-z0-9_]+\.ttf)'\)/gu, (_, file: string) => `url('${fonts}${file}')`);
  return { lang, dir: dir as 'rtl' | 'ltr', title: unescaped(title), css: css + rules.join(''), body };
}
