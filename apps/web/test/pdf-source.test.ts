// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Synthetic PDF text, scripts, metadata and drawings. No external files or
// requests. Browser rendering and worker isolation are checked separately.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { draftRows } from '../src/pdf/rows.ts';
import { sourceBytes } from '../src/pdf/source-bytes.ts';
import { pdfFixture } from './pdf-fixture.ts';

const piece = (str: string, x: number, y: number, dir = 'ltr') => ({ str, dir, transform: [1, 0, 0, 1, x, y] });

test('rows keep page order and reading direction, and are explicitly bounded', () => {
  assert.deepEqual(draftRows([piece('second', 0, 80), piece('title', 50, 100), piece('2', 0, 100)]), [
    '2 title',
    'second',
  ]);
  assert.deepEqual(draftRows([piece('عنوان', 50, 100, 'rtl'), piece('٢', 100, 100, 'rtl')]), ['٢ عنوان']);
  assert.deepEqual(draftRows([piece('ﻣﺨﺘﻠﻖ', 50, 100, 'rtl')]), ['مختلق']);
  assert.throws(() => draftRows(Array.from({ length: 20001 }, () => piece('x', 0, 1))), /E_PDF_LIMIT/u);
  assert.throws(() => draftRows([piece('x'.repeat(100001), 0, 1)]), /E_PDF_LIMIT/u);
});

test('size and signature are checked before parsing, without exposing a file name', async () => {
  await assert.rejects(sourceBytes(new File(['not a pdf'], 'private-name.txt')), { message: 'E_PDF_FORMAT' });
  await assert.rejects(sourceBytes(new Blob()), { message: 'E_PDF_LIMIT' });
  await assert.rejects(sourceBytes(new Blob([new Uint8Array(32 * 1024 * 1024 + 1)])), { message: 'E_PDF_LIMIT' });
  assert.deepEqual(await sourceBytes(new Blob([pdfFixture()])), pdfFixture());
});

test('text extraction reads the page, excludes metadata and never runs embedded PDF JavaScript', async () => {
  const task = getDocument({ data: pdfFixture(), verbosity: 0, enableXfa: false, useWasm: false });
  try {
    const document = await task.promise;
    assert.equal(document.numPages, 2);
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    assert.deepEqual(draftRows(content.items.filter((one) => 'str' in one)), ['2 Synthetic lesson title']);
    const scan = await (await document.getPage(2)).getTextContent();
    assert.deepEqual(draftRows(scan.items.filter((one) => 'str' in one)), []);
    assert.equal(Reflect.get(globalThis, 'PDF_SCRIPT_RAN'), undefined);
  } finally {
    await task.destroy();
  }
});

test('the asset bridge refuses document-supplied URLs and paths before any request', async () => {
  const { PdfAssets } = await import('../src/pdf/assets.ts');
  const assets = new PdfAssets();
  for (const filename of [
    'https://example.invalid/source',
    '../secret.bcmap',
    'a%2fb.bcmap',
    'x.bcmap?q=private',
    'LiberationSans-Regular.ttf',
  ]) {
    await assert.rejects(assets.fetch({ kind: 'cMapUrl', filename }), { message: 'E_PDF_ASSET' });
  }
  await assert.rejects(assets.fetch({ kind: 'source', filename: 'foo.bcmap' }), { message: 'E_PDF_ASSET' });
});
