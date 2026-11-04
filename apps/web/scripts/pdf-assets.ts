// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PDF assets are Adobe CMaps, Foxit fonts and the JavaScript image
// decoders, OpenJPEG for JPEG 2000 and PDFium's for JBIG2 and CCITT. Every
// retained asset's notice is in licences.json, which the app shows and every
// install keeps, as is core-js's, which PDF.js's legacy build embeds with no
// licence file of its own. The offline worker keeps none of the assets
// themselves (answer 743).

import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Notice } from './licences.ts';

/** The MIT licence, under which core-js is released, after its copyright lines. */
const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`;

/** The notice of the core-js that a PDF.js legacy build embeds, from the version and copyright it carries. */
export function coreJsNotice(bundle: string): Notice {
  const found = /version: '(\d+\.\d+\.\d+)',\s+mode: [^,]+,\s+copyright: '([^']+)'/u.exec(bundle);
  if (found === null) throw new Error('No core-js version or copyright in the PDF.js build');
  const name = `core-js ${found[1]}, inside PDF.js`;
  return { name, text: `${name}\n\n${found[2]}\n\n${MIT}\n` };
}

export function pdfAssets(root: URL, output: URL): Notice[] {
  const engine = readFileSync(new URL('node_modules/pdfjs-dist/legacy/build/pdf.mjs', root), 'utf8');
  const assets = [
    { folder: 'cmaps', target: 'cmaps', keep: /\.bcmap$/u, licences: ['LICENSE'] },
    { folder: 'standard_fonts', target: 'standard_fonts', keep: /^Foxit[A-Za-z]+\.pfb$/u, licences: ['LICENSE_FOXIT'] },
    {
      folder: 'wasm',
      target: 'decoders',
      keep: /^(?:openjpeg|jbig2)_nowasm_fallback\.js$/u,
      licences: ['LICENSE_OPENJPEG', 'LICENSE_PDFJS_OPENJPEG', 'LICENSE_JBIG2', 'LICENSE_PDFJS_JBIG2'],
    },
  ].map(({ folder, target, keep, licences }) => {
    const source = new URL(`node_modules/pdfjs-dist/${folder}/`, root);
    const destination = new URL(`pdf-assets/${target}/`, output);
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source).filter((one) => keep.test(one)))
      copyFileSync(new URL(name, source), new URL(name, destination));
    const notice = licences.map((file) => readFileSync(new URL(file, source), 'utf8')).join('\n\n');
    writeFileSync(new URL('LICENSE.txt', destination), notice);
    const name = `PDF.js ${target}`;
    return { name, text: `${name}\n\n${notice}` };
  });
  return [...assets, coreJsNotice(engine)];
}
