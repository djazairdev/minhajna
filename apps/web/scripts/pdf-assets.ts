// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PDF assets are Adobe CMaps, Foxit fonts and the JavaScript OpenJPEG
// decoder. Every retained asset's notice is visible in the app and cached.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Notice } from './licences.ts';

export function pdfAssets(root: URL, output: URL): Notice[] {
  return [
    { folder: 'cmaps', target: 'cmaps', keep: /\.bcmap$/u, licences: ['LICENSE'] },
    { folder: 'standard_fonts', target: 'standard_fonts', keep: /^Foxit[A-Za-z]+\.pfb$/u, licences: ['LICENSE_FOXIT'] },
    {
      folder: 'wasm',
      target: 'decoders',
      keep: /^openjpeg_nowasm_fallback\.js$/u,
      licences: ['LICENSE_OPENJPEG', 'LICENSE_PDFJS_OPENJPEG'],
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
}
