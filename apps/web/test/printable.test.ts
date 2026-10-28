// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A printed document made ready for the PC's print frame (#250, answer 507),
// from pages the phone's own code makes: the language, direction and title read
// from the head; every rule kept, the page size and margins among them; the
// bundled fonts read from the web app's fonts folder; each style attribute
// turned into an important rule on a numbered data attribute, so none is left
// for the page's policy to refuse and each still wins; and anything that is not
// such a page refused. Made-up content only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { printDocument } from '../../android/src/documents/print-html.ts';
import { printable } from '../src/native/print/printable.ts';

const FONTS = 'https://pc.test/fonts/';

describe('a document for the print frame', () => {
  it('reads the head, keeps every rule and reads the fonts from the web app', () => {
    const html = printDocument({
      lang: 'ar',
      dir: 'rtl',
      title: 'Made-up & "quoted" <title>',
      landscape: true,
      css: '.own{font-weight:700}',
      pages: ['<p class="own">Made-up page</p>'],
      confidential: 'Internal',
    });
    const page = printable(html, FONTS);
    assert.equal(page.lang, 'ar');
    assert.equal(page.dir, 'rtl');
    assert.equal(page.title, 'Made-up & "quoted" <title>');
    assert.match(page.css, /@page\{size:A4 landscape;margin:12mm 15mm\}/u);
    assert.match(page.css, /\.own\{font-weight:700\}$/u);
    assert.match(page.css, /src:url\('https:\/\/pc\.test\/fonts\/noto_naskh_arabic_regular\.ttf'\)/u);
    assert.doesNotMatch(page.css, /url\('noto/u);
    assert.match(page.body, /^<section class="page"><table class="frame">/u);
    assert.match(page.body, /<td class="mark">Internal<\/td>/u);
  });

  it('turns each style attribute into a rule, leaving none in the markup', () => {
    const html = printDocument({
      lang: 'fr',
      dir: 'ltr',
      title: 'Made up',
      landscape: false,
      css: '',
      pages: [
        '<table><colgroup><col style="width:7mm"><col style="width:6mm; height:2mm;"></colgroup></table>',
        '<p>x</p>',
      ],
    });
    const page = printable(html, FONTS);
    assert.doesNotMatch(page.body, /\sstyle=/u);
    assert.match(page.body, /<col data-print-style="0"><col data-print-style="1">/u);
    assert.ok(page.css.includes('[data-print-style="0"]{width:7mm !important}'));
    assert.ok(page.css.endsWith('[data-print-style="1"]{width:6mm !important;height:2mm !important}'));
    assert.match(page.css, /@page\{size:A4 portrait;margin:12mm 12mm 12mm 18mm\}/u);
  });

  it('refuses what is not a printed document', () => {
    assert.throws(() => printable('<p>Made up</p>', FONTS), /Not a printed document/u);
    assert.throws(() => printable('<!doctype html><html><body></body></html>', FONTS), /Not a printed document/u);
  });
});
