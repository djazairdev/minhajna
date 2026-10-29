// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a host of the PC web app serves (answers 528, 531 and 537), shared by
// the local server and the host check so that both hold to the same rules:
// the files of one build and nothing else, each with its media type, never
// cached by the browser or a proxy, with the page's own security policy as
// a header too, where it can also refuse framing by another site. Over HTTPS
// the browser is told to keep to HTTPS.

/** The address teachers open (answer 531). */
export const ADDRESS = 'https://minhajna.djazair.dev/';

/** The media type of each file kind in dist/. */
export const TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
};

/** The media type of a file in dist/, by its name, or undefined for a kind it never holds. */
export function typeOf(name: string): string | undefined {
  return TYPES[name.split('.').at(-1) ?? ''];
}

/** The security policy in the page's meta element. */
export function pagePolicy(html: string): string {
  const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u.exec(html)?.[1];
  if (policy === undefined) throw new Error('index.html has no security policy');
  return policy;
}

/** The headers every answer carries besides its media type; the HTTPS one only over HTTPS. */
export function hostHeaders(policy: string, secure: boolean): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `${policy}; frame-ancestors 'self'`,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...(secure ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}
