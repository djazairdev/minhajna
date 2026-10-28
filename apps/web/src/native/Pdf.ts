// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing on the web (#250, answers 507, 521 and 522): the document goes into
// a hidden frame of this page, its rules through the frame's own style sheet
// (print/printable.ts), and the browser's print dialog opens on it, where the
// teacher picks a printer or "Save as PDF". The page's title is the document's
// while the dialog is open, so a saved PDF takes its name. The frame is filled
// once its first page has loaded, waits for the fonts and pictures, and goes
// once the browser says the print is over, whether its print call waits for the
// dialog or not, or at once when the browser ignored the call, as Chrome does
// after several cancelled dialogs or where printing is turned off; one print at
// a time. A PDF made without the dialog, a PDF to share or keep, and reading a
// page's colours to count pages stay on the phone, as does a protected PDF
// archive (Files).

import type { Spec } from '../../../android/src/native/NativeMinhajnaPdf';
import { refused } from './files/picked.ts';
import { printable } from './print/printable.ts';

const phoneOnly = () => Promise.reject(refused('E_WEB_PHONE_ONLY', 'A PC prints through the browser instead'));

let printing = false;

/** Lays the document out in a hidden frame, opens the print dialog on it, and removes the frame once it closes. */
async function print(html: string, title: string): Promise<void> {
  if (printing) throw refused('E_BUSY', 'A print is already open');
  const page = printable(html, new URL('fonts/', document.baseURI).href);
  printing = true;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', visibility: 'hidden' });
  const shown = document.title;
  try {
    const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    document.body.appendChild(frame);
    await loaded;
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (win === null || doc === null) throw new Error('The print frame did not open');
    const sheet = new (win as unknown as typeof globalThis).CSSStyleSheet();
    sheet.replaceSync(page.css);
    doc.adoptedStyleSheets = [sheet];
    doc.documentElement.lang = page.lang;
    doc.documentElement.dir = page.dir;
    doc.title = title || page.title;
    doc.body.innerHTML = page.body;
    await Promise.all(Array.from(doc.fonts, (face) => face.load().catch(() => undefined)));
    await Promise.all(Array.from(doc.images, (image) => image.decode().catch(() => undefined)));
    document.title = doc.title;
    let begun = false;
    win.addEventListener('beforeprint', () => (begun = true), { once: true });
    const over = new Promise((resolve) => win.addEventListener('afterprint', resolve, { once: true }));
    win.focus();
    win.print();
    if (begun) await over;
  } finally {
    document.title = shown;
    frame.remove();
    printing = false;
  }
}

const Pdf: Spec = {
  makePdf: phoneOnly,
  sharePdf: phoneOnly,
  printHtml: (html, title) => print(html, title),
  savePdf: phoneOnly,
  pageColors: phoneOnly,
};

export default Pdf;
