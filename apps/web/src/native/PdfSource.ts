// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The picked PDF remains in this page's memory, never in a release or an
// upload. Only rendered PNGs and plain draft rows cross the adapter. The
// worker is separate from app data and is terminated on close or timeout.
// PDF.js's scripting/viewer layers are deliberately absent. Its own asset
// requests name bundled files only; the source has no URL or base URL.

import type { PDFWorker, PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Spec } from '../../../android/src/native/NativeMinhajnaPdfSource';
import { pickFile } from './files/picked.ts';
import { sourceBytes } from '../pdf/source-bytes.ts';
import { PdfAssets } from '../pdf/assets.ts';
import { draftRows } from '../pdf/rows.ts';

const PIXELS = 16000000;
const held = new Map<
  string,
  { worker: Worker; pdfWorker: PDFWorker; task: PDFDocumentLoadingTask; uris: Set<string>; cancel: Set<() => void> }
>();
let pickGeneration = 0;
let pending: string | null = null;
const asset = (name: string) => new URL(`./pdf-assets/${name}/`, import.meta.url).href;

function drop(token: string) {
  const kept = held.get(token);
  if (kept === undefined) return;
  held.delete(token);
  for (const cancel of kept.cancel) cancel();
  kept.cancel.clear();
  const finish = () => {
    kept.worker.terminate();
    kept.pdfWorker.destroy();
  };
  const timer = setTimeout(finish, 500);
  void kept.task
    .destroy()
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timer);
      finish();
    });
  for (const uri of kept.uris) URL.revokeObjectURL(uri);
}

async function bounded<T>(token: string, work: Promise<T>): Promise<T> {
  const kept = held.get(token);
  if (kept === undefined) throw new Error('E_PDF_CLOSED');
  let cancel: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('E_PDF_CLOSED'));
        kept.cancel.add(cancel);
        timer = setTimeout(() => {
          drop(token);
          reject(new Error('E_PDF_LIMIT'));
        }, 30000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel !== undefined) kept.cancel.delete(cancel);
  }
}

function cancelPick() {
  pickGeneration += 1;
  if (pending !== null) drop(pending);
  pending = null;
}

async function pick() {
  const generation = ++pickGeneration;
  const file = await pickFile('.pdf,application/pdf');
  if (file === null || generation !== pickGeneration) return null;
  const data = await sourceBytes(file);
  if (generation !== pickGeneration) {
    data.fill(0);
    return null;
  }
  const { getDocument, PDFWorker } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (generation !== pickGeneration) {
    data.fill(0);
    return null;
  }
  const token = crypto.randomUUID();
  pending = token;
  const worker = new Worker(new URL('./pdf-worker.js', import.meta.url), { type: 'module' });
  const pdfWorker = PDFWorker.create({ port: worker });
  let task: PDFDocumentLoadingTask;
  try {
    task = getDocument({
      data,
      worker: pdfWorker,
      verbosity: 0,
      enableXfa: false,
      useWorkerFetch: false,
      BinaryDataFactory: PdfAssets,
      useSystemFonts: true,
      useWasm: false,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      stopAtErrors: true,
      maxImageSize: -1,
      canvasMaxAreaInBytes: PIXELS * 4,
      cMapUrl: asset('cmaps'),
      standardFontDataUrl: asset('standard_fonts'),
      iccUrl: asset('iccs'),
    });
  } catch {
    worker.terminate();
    pdfWorker.destroy();
    pending = null;
    throw new Error('E_PDF_OPEN');
  }
  task.onPassword = () => {
    drop(token);
  };
  held.set(token, { worker, pdfWorker, task, uris: new Set(), cancel: new Set() });
  worker.addEventListener('error', () => drop(token), { once: true });
  worker.addEventListener('messageerror', () => drop(token), { once: true });
  try {
    const document = await bounded(token, task.promise);
    if (!Number.isSafeInteger(document.numPages) || document.numPages < 1 || document.numPages > 1000)
      throw new Error('E_PDF_LIMIT');
    return { token, pages: document.numPages };
  } catch {
    drop(token);
    throw new Error('E_PDF_OPEN');
  } finally {
    if (pending === token) pending = null;
  }
}

async function page(token: string, number: number, scale: number) {
  const kept = held.get(token);
  if (kept === undefined || !Number.isSafeInteger(number) || number < 1 || ![1, 1.5, 2].includes(scale))
    throw new Error('E_PDF_PAGE');
  try {
    return await bounded(
      token,
      (async () => {
        const document = await kept.task.promise;
        const page = await document.getPage(number);
        const viewport = page.getViewport({ scale });
        const width = Math.ceil(viewport.width),
          height = Math.ceil(viewport.height);
        if (!Number.isSafeInteger(width * height) || width < 1 || height < 1 || width * height > PIXELS)
          throw new Error('E_PDF_LIMIT');
        const canvas = window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        await page.render({ canvas, viewport }).promise;
        const content = await page.getTextContent();
        const rows = draftRows(content.items.filter((one) => 'str' in one));
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((one) => {
            if (one === null) reject(new Error('E_PDF_RENDER'));
            else resolve(one);
          }, 'image/png'),
        );
        canvas.width = 0;
        canvas.height = 0;
        if (!held.has(token)) throw new Error('E_PDF_CLOSED');
        for (const uri of kept.uris) URL.revokeObjectURL(uri);
        kept.uris.clear();
        const uri = URL.createObjectURL(blob);
        kept.uris.add(uri);
        page.cleanup();
        return { uri, width, height, rows };
      })(),
    );
  } catch {
    drop(token);
    throw new Error('E_PDF_PAGE');
  }
}

export default { pick, page, drop, cancelPick } satisfies Pick<Spec, 'pick' | 'page' | 'drop' | 'cancelPick'>;
