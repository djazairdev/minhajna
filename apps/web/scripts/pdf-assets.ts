// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Only the permitted PDF assets are distributed: Adobe CMaps (BSD-3-Clause),
// Foxit standard fonts (BSD-3-Clause), and the ICC profile (CC0-1.0).
// Liberation fonts under GPL-2.0 with an exception are not on our allowed
// list. Every retained asset's notice is visible in the app and cached.

import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import type { Notice } from './licences.ts';

export function pdfAssets(root: URL, output: URL): Notice[] {
  return [
    { folder: 'cmaps', keep: /\.bcmap$/u, licence: 'LICENSE' },
    { folder: 'standard_fonts', keep: /^Foxit[A-Za-z]+\.pfb$/u, licence: 'LICENSE_FOXIT' },
    { folder: 'iccs', keep: /\.icc$/u, licence: 'LICENSE' },
  ].map(({ folder, keep, licence }) => {
    const source = new URL(`node_modules/pdfjs-dist/${folder}/`, root);
    const destination = new URL(`pdf-assets/${folder}/`, output);
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source).filter((one) => keep.test(one)))
      copyFileSync(new URL(name, source), new URL(name, destination));
    copyFileSync(new URL(licence, source), new URL('LICENSE.txt', destination));
    const name = `PDF.js ${folder}`;
    return { name, text: `${name}\n\n${readFileSync(new URL(licence, source), 'utf8')}` };
  });
}
